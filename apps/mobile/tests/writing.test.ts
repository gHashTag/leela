import { describe, expect, it } from 'vitest';
import { MAX_REPORTS, MAX_REPORT_CHARS } from '@leela/journal';
import { EMPTY, load, record, save, takeAccount, writingsOn, type Store } from '../src/journal';

/**
 * The gate exists so that a player reflects before they move.
 *
 * This app shipped with a button labelled **Write a report** that wrote
 * nothing: it called `submitReport`, the gate opened, and no account was kept
 * anywhere. The requirement was cleared and the thing it requires was removed —
 * the ceremony without the reflection, under a label promising otherwise.
 *
 * So what is asserted here is that the account is the thing, and the gate
 * follows it: no writing, no opening. Everything else in this file is the
 * contract every writer in the repository answers, which the mini app took four
 * passes to make all seven of its own answer.
 */

const keeps = (): Store & { held: Map<string, string> } => {
  const held = new Map<string, string>();
  return {
    held,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
  };
};

const refuses = (): Store => ({
  getItem: () => null,
  setItem: () => {
    throw new Error('the disk is full');
  },
});

describe('a writer says whether it was kept', () => {
  it('says kept when it was', () => {
    expect(save(keeps(), record(EMPTY, 41, 'What this square asked.', 1))).toBe(true);
  });

  it('says not kept when the store refuses', () => {
    expect(save(refuses(), record(EMPTY, 41, 'What this square asked.', 1))).toBe(false);
  });

  it('says not kept when there is no store', () => {
    // Nowhere to write is not a write. `store?.setItem` on nothing is a no-op
    // that fell through to a happy return in the mini app for four passes, and
    // the app put "Written." under it.
    expect(save(undefined, record(EMPTY, 41, 'What this square asked.', 1))).toBe(false);
  });
});

describe('an account is what opens the gate, not a button', () => {
  it('keeps what was written, on the square it was written about', () => {
    const journal = record(EMPTY, 41, 'I kept circling the same thing.', 1);

    expect(writingsOn(journal, 41).map((entry) => entry.text)).toEqual([
      'I kept circling the same thing.',
    ]);
    expect(writingsOn(journal, 40), 'and nowhere else').toEqual([]);
  });

  it('refuses a blank one, which is the same defect one keystroke further on', () => {
    for (const nothing of ['', '   ', '\n\t ']) {
      expect(record(EMPTY, 41, nothing, 1), JSON.stringify(nothing)).toBe(EMPTY);
    }
  });

  it('holds a path to the bounds the format states', () => {
    // Against the constants rather than their values: raising one must not
    // leave this asserting the old number.
    const long = record(EMPTY, 41, 'x'.repeat(MAX_REPORT_CHARS + 500), 1);
    expect(long.entries[0]?.text.length).toBe(MAX_REPORT_CHARS);

    let many = EMPTY;
    for (let index = 0; index < MAX_REPORTS + 20; index += 1) {
      many = record(many, (index % 72) + 1, `entry ${index}`, index + 1);
    }
    expect(many.entries.length).toBe(MAX_REPORTS);
    expect(many.entries.at(-1)?.text, 'and the newest is what stayed').toBe(
      `entry ${MAX_REPORTS + 19}`,
    );
  });
});

describe('what comes back out of a store', () => {
  it('comes back as it went in', () => {
    const store = keeps();
    const journal = record(record(EMPTY, 6, 'first', 1), 41, 'second', 2);

    expect(save(store, journal)).toBe(true);
    expect(load(store)).toEqual(journal);
  });

  it('starts fresh rather than crashing on anything else', () => {
    // A store is the least trustworthy thing here: it has been on a disk, and
    // a half-written value is what a process killed mid-write leaves.
    for (const rubbish of ['half a write{', 'null', '42', '{"entries":7}', '{}']) {
      const store: Store = { getItem: () => rubbish, setItem: () => undefined };
      expect(load(store), rubbish).toEqual(EMPTY);
    }
  });

  it('drops an entry that is not a report and keeps the rest', () => {
    // Half a path is still a path. The file format refuses a whole document
    // over one bad row — a file has been out of the app and half of it would be
    // worse than none — but this is the app's own store, and dropping one
    // unreadable row loses less than dropping a year of writing.
    const store: Store = {
      getItem: () =>
        JSON.stringify({
          entries: [
            { plan: 6, text: 'kept', at: 1 },
            { plan: 900, text: 'not a square', at: 2 },
            7,
            { plan: 41, text: 'kept too', at: 3 },
          ],
        }),
      setItem: () => undefined,
    };

    expect(load(store).entries.map((entry) => entry.text)).toEqual(['kept', 'kept too']);
  });

  it('has nothing to give when the store cannot be read', () => {
    const blind: Store = {
      getItem: () => {
        throw new Error('storage is disabled');
      },
      setItem: () => undefined,
    };

    expect(load(blind)).toEqual(EMPTY);
  });
});

describe('what follows from taking an account', () => {
  /**
   * The decision the screen used to make inline, which is why no test of this
   * module could see the defect: the button cleared the gate and kept nothing,
   * and a component is not a function anybody can ask.
   *
   * So it is a function now, and the three answers it gives are separate on
   * purpose. *Was anything written* decides whether the gate opens. *Was it
   * kept* decides what the player is told. Running them together is how a
   * refused write came to be reported as "Written." in the app next door.
   */
  it('opens the gate only when something was written', () => {
    const nothing = takeAccount(EMPTY, 41, '   ', 1, keeps());

    expect(nothing.written).toBe(false);
    expect(nothing.gateOpens, 'a blank draft buys nothing').toBe(false);
    expect(nothing.journal, 'and changes nothing').toBe(EMPTY);
  });

  it('opens it when there is, and says the account was kept', () => {
    const taken = takeAccount(EMPTY, 41, 'What this square asked.', 1, keeps());

    expect(taken.written).toBe(true);
    expect(taken.gateOpens).toBe(true);
    expect(taken.kept).toBe(true);
  });

  it('opens it even when the device refuses, and does not say it was kept', () => {
    // They wrote it. A phone that will not hold the words is not their doing,
    // and shutting a gate they have earned would charge them for it — the same
    // decision the mini app made at a full quota.
    const taken = takeAccount(EMPTY, 41, 'What this square asked.', 1, refuses());

    expect(taken.written).toBe(true);
    expect(taken.gateOpens, 'the game goes on').toBe(true);
    expect(taken.kept, 'and the loss is not dressed as a success').toBe(false);
    expect(taken.journal.entries, 'held for this session either way').toHaveLength(1);
  });

  it('never opens the gate without adding to the path', () => {
    // The shape of the defect, over the drafts a person actually types rather
    // than the two somebody thought of.
    for (const draft of ['', ' ', '\n', '\t\t', '   \n  ', 'x', 'a real account of it']) {
      const taken = takeAccount(EMPTY, 41, draft, 1, keeps());

      expect(taken.gateOpens, JSON.stringify(draft)).toBe(taken.journal.entries.length > 0);
    }
  });
});
