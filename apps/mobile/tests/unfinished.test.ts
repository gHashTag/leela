import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_REPORT_CHARS } from '@leela/journal';
import {
  DRAFT_KEY,
  NOTHING_WRITTEN,
  draftFor,
  draftOn,
  keepDraft,
  loadKeptDraft,
  type Draft,
  type Keeper,
} from '../src/journal';

/**
 * The sentence that has not been filed yet.
 *
 * The path is on the device. The board is on the device. What the player is
 * playing for is on the device. The account they are **in the middle of
 * writing** lived in a `useState` and nowhere else — so an iPhone reclaiming a
 * backgrounded app took it, and the gate that will not open without it was
 * still shut when they came back.
 *
 * The one thing the game asks a player to produce was the one thing the app did
 * not keep. The mini app lost the same words the same way and says so in
 * `state.ts`; a browser discards a tab, and a phone discards an app far more
 * readily. The published app loses it too — `CreatePost` holds the text in
 * `react-hook-form` and clears it with `methods.reset()`, under a rule of
 * `yup.string().trim().min(100)`. At least a paragraph, held nowhere.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8');

/** A device, as a `Map`. Every test here hands in its own. */
function device(held = new Map<string, string>()) {
  return {
    held,
    keeper: {
      read: async () => held.get(DRAFT_KEY) ?? null,
      write: async (value: string) => {
        held.set(DRAFT_KEY, value);
        return true;
      },
    } satisfies Keeper,
  };
}

describe('what is being written survives the app being killed', () => {
  it('comes back, on the square of the game it was written in', async () => {
    const { keeper } = device();
    await keepDraft(keeper, draftOn(42, 30, 'what this square asked of me'));

    // A new run of the app: nothing in memory, everything from the device.
    const back = await loadKeptDraft(keeper);
    expect(draftFor(back, 42, 30)).toBe('what this square asked of me');
  });

  it('is not shown anywhere else, however it got back', async () => {
    /**
     * The reader does not have to ask whether a restored draft is still the
     * right one — `draftFor` asks on every render, which is the same question
     * whether the draft came from memory or from a disk. One rule, one place.
     */
    const { keeper } = device();
    await keepDraft(keeper, draftOn(42, 30, 'about thirty'));
    const back = await loadKeptDraft(keeper);

    expect(draftFor(back, 42, 31), 'another square').toBe('');
    expect(draftFor(back, 43, 30), 'another game').toBe('');
    expect(draftFor(back, 42, null), 'a player who has not entered').toBe('');
  });

  it('keeps every keystroke, not the ones a timer caught', async () => {
    // The window an app is killed in is the moment after somebody stops
    // typing, which is exactly the window a debounce leaves open.
    const { keeper, held } = device();

    for (const text of ['I', 'I s', 'I sto', 'I stood']) {
      await keepDraft(keeper, draftOn(42, 30, text));
    }

    expect(JSON.parse(held.get(DRAFT_KEY) ?? '{}').text).toBe('I stood');
  });
});

describe('a device that will not hold it', () => {
  it('says so rather than reporting success', async () => {
    const refusing: Keeper = { read: async () => null, write: async () => false };
    expect(await keepDraft(refusing, draftOn(42, 30, 'words'))).toBe(false);
  });

  it('says so when it throws', async () => {
    const throwing: Keeper = {
      read: async () => {
        throw new Error('no disk');
      },
      write: async () => {
        throw new Error('no disk');
      },
    };

    expect(await keepDraft(throwing, draftOn(42, 30, 'words'))).toBe(false);
    expect(await loadKeptDraft(throwing)).toBe(NOTHING_WRITTEN);
  });

  it('gives up on one that never answers, rather than waiting for it', async () => {
    // The reason `KEEP_TIMEOUT_MS` exists: this write happens while the player
    // is looking at the words they just typed.
    const silent: Keeper = { read: () => new Promise(() => {}), write: () => new Promise(() => {}) };

    expect(await keepDraft(silent, draftOn(42, 30, 'words'), 5)).toBe(false);
    expect(await loadKeptDraft(silent, 5)).toBe(NOTHING_WRITTEN);
  });

  it('has nothing to keep it in, and does not pretend otherwise', async () => {
    expect(await keepDraft(undefined, draftOn(42, 30, 'words'))).toBe(false);
    expect(await loadKeptDraft(undefined)).toBe(NOTHING_WRITTEN);
  });
});

describe('nothing rather than half a draft', () => {
  /**
   * The choice `loadKept` and `loadKeptGame` both make, for the same reason: a
   * device store has been on a disk between two runs of the app, and half a
   * write is what a process killed mid-save leaves behind. A draft restored
   * wrong is worse than one restored empty, because only one of them is
   * visible.
   *
   * The shape, not a list of bad values: **anything that is not a whole draft
   * is no draft.** Each case below is one field of the three being absent or of
   * the wrong kind, which is what a truncated or a stale write looks like.
   */
  const notADraft = [
    ['not JSON at all', 'I stood on the square'],
    ['a truncated write', '{"seed":42,"plan":30,"te'],
    ['not an object', '"a string"'],
    ['null', 'null'],
    ['no seed', JSON.stringify({ plan: 30, text: 'words' })],
    ['a seed that is not a number', JSON.stringify({ seed: '42', plan: 30, text: 'words' })],
    ['no plan', JSON.stringify({ seed: 42, text: 'words' })],
    ['a plan between squares', JSON.stringify({ seed: 42, plan: 30.5, text: 'words' })],
    ['no text', JSON.stringify({ seed: 42, plan: 30 })],
    ['text that is not a string', JSON.stringify({ seed: 42, plan: 30, text: 12 })],
    ['nothing written', JSON.stringify({ seed: 42, plan: 30, text: '   ' })],
  ] as const;

  it.each(notADraft)('%s', async (_name, raw) => {
    const held = new Map([[DRAFT_KEY, raw]]);
    expect(await loadKeptDraft(device(held).keeper)).toBe(NOTHING_WRITTEN);
  });

  it('holds a restored draft to the format\'s own bound', async () => {
    // A store can hold anything. `record` would cut it on the way out anyway,
    // and a box that opens with more than it will accept is a box that loses
    // the end of a sentence at the moment of filing.
    const held = new Map([
      [DRAFT_KEY, JSON.stringify({ seed: 42, plan: 30, text: 'x'.repeat(MAX_REPORT_CHARS + 500) })],
    ]);

    expect((await loadKeptDraft(device(held).keeper)).text.length).toBe(MAX_REPORT_CHARS);
  });

  it('takes back exactly what it was given, when it is whole', async () => {
    const { keeper } = device();
    const draft: Draft = draftOn(42, 30, 'I stood here and this is what it asked.');

    await keepDraft(keeper, draft);
    expect(await loadKeptDraft(keeper)).toEqual(draft);
  });
});

describe('nothing written is not something written', () => {
  it('clears the shelf rather than keeping an empty draft on it', async () => {
    // A blank draft left on the device would be read back as a draft, and
    // `NOTHING_WRITTEN` and "a draft whose text is empty" would then be two
    // answers to one question.
    const { keeper, held } = device();

    await keepDraft(keeper, draftOn(42, 30, 'words'));
    await keepDraft(keeper, draftOn(42, 30, ''));

    expect(held.get(DRAFT_KEY)).toBe('');
    expect(await loadKeptDraft(keeper)).toBe(NOTHING_WRITTEN);
  });
});

describe('everything the player produces is on the device', () => {
  it('has a keeper for each, and the writing box is one of them', () => {
    /**
     * The shape the defect had: three of the four things this app holds went to
     * the disk and the fourth did not, and the fourth is the only one the game
     * refuses to go on without.
     *
     * A player can produce three things here — what they are playing for, what
     * they have written, and what they are writing. The board is not one of
     * them; it is kept because re-entering a game is a loss too, but the engine
     * could rebuild it from `(seed, rollsTaken)`.
     */
    for (const key of ['INTENTION_KEY', 'GAME_KEY', 'DRAFT_KEY']) {
      expect(APP, key).toContain(`deviceKeeper(${key})`);
    }

    expect(APP, 'the path, on the default key').toContain('deviceKeeper()');
  });

  it('writes each one to it, and reads each one back', () => {
    /**
     * The call with its arguments, not the name somewhere in the file. The
     * first version of this asked only whether `DRAFT_KEY` and `loadKeptDraft`
     * were mentioned — and mentioned they stayed when the effects that use them
     * were deleted, so **removing the fix outright left every test green**. A
     * check that an import exists is a check on an import.
     */
    for (const [write, read] of [
      ['keepDraft(draftKeeper, draft)', 'loadKeptDraft(draftKeeper)'],
      ['keepGame(gameKeeper, game)', 'loadKeptGame(gameKeeper)'],
      ['keep(keeper, taken.journal)', 'loadKept(keeper)'],
    ] as const) {
      expect(APP, write).toContain(write);
      expect(APP, read).toContain(read);
    }

    // The question is written where it is answered rather than on a change.
    expect(APP).toContain('keepIntention(intentionKeeper,');
    expect(APP).toContain('loadKeptIntention(intentionKeeper)');
  });

  it('keeps the writing on every change of it, not on some other occasion', () => {
    // An effect keyed on the game would keep the sentence only when the board
    // moves — which, while a report is owed, it cannot.
    const kept = APP.match(/useEffect\(\(\) => \{\s*void keepDraft\([^)]*\);\s*\}, \[([^\]]*)\]\)/);

    expect(kept, 'a draft is kept in an effect of its own').not.toBe(null);
    expect(kept?.[1]?.trim()).toBe('draft');
  });

  it('never lets yesterday land on top of what is being done now', () => {
    /**
     * Every one of the four reads answers a slow disk the same way: it takes
     * effect only if nothing has happened since. A player who starts typing
     * before the disk replies must not have their sentence replaced by the one
     * they abandoned yesterday — the mirror of the defect being fixed.
     */
    const loads = [...APP.matchAll(/void (loadKept\w*)\(([\s\S]*?)\n  \}, \[/g)];

    expect(loads.length, 'the reads at startup').toBeGreaterThanOrEqual(3);
    for (const [body, name] of loads) {
      expect(body, `${name} lands unconditionally`).toMatch(/now\s*===|now\.rollsTaken === 0|kept !== null/);
    }
  });
});
