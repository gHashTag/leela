// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * What survives when a browser stops halfway.
 *
 * The mini app keeps six kinds of key — the table, a journal per seat, a
 * question per seat, a draft per seat, the die's last face, and a game from
 * before there were seats. Every test until now handed it a storage that either
 * worked or refused everything. A browser does neither: it fills up, it is
 * cleared by a setting, a tab is closed mid-write, and what is left is *some* of
 * the keys.
 *
 * The first partial state tried found the worst defect available. A storage that
 * takes the table and refuses the journal — which is what a full quota looks
 * like, since the table is small and the journal grows — answered **"Written.
 * You may throw."**, opened the gate, and lost the account. On the next load
 * there was no record of it and no obligation to write it again: the record the
 * game exists to produce, dropped under a sentence saying it had been kept.
 *
 * The game still goes on — it is in hand for the session either way — but a
 * player whose browser will not keep their writing is owed that while their
 * words are still on the screen.
 */

/** A storage that takes some keys and refuses others. */
function partial(refuse: RegExp, seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (refuse.test(key)) throw new DOMException('quota', 'QuotaExceededError');
      map.set(key, value);
    },
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
    kept: () => Object.fromEntries(map),
  } as unknown as Storage & { kept(): Record<string, string> };
}

async function play(storage: Storage): Promise<string[]> {
  vi.resetModules();

  const html = readFileSync('index.html', 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');

  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

  const broke: string[] = [];
  window.addEventListener('error', (event) => broke.push(String((event as ErrorEvent).message)));

  await import('../src/main');
  await new Promise((resolve) => setTimeout(resolve, 60));

  return broke;
}

const el = (id: string) =>
  document.getElementById(id) as HTMLElement & { disabled?: boolean; value?: string };

const onFortyOne = {
  loka: 41,
  previous_loka: 35,
  direction: 'step 🚶🏼',
  consecutive_sixes: 0,
  position_before_three_sixes: 0,
  is_finished: false,
};

const seated = (reportSubmitted: boolean) =>
  JSON.stringify({
    turnIndex: 0,
    players: [{ id: 'p1', state: onFortyOne, reportSubmitted }],
  });

describe('a browser that keeps some of it', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('never says an account was kept when it was refused', async () => {
    // The defect this file was written for. The sentence and the storage were
    // saying different things, and only one of them was true.
    const storage = partial(/^leela\.reports/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(false),
    });

    await play(storage);

    (el('writer-text') as HTMLTextAreaElement).value = 'The account I would have lost.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(el('say').textContent).toMatch(/will not keep/i);
    expect(el('say').textContent).not.toMatch(/^Written\. You may throw\.$/);
    expect(storage.kept()['leela.reports.v1'], 'and it really was not kept').toBeUndefined();
  }, 20_000);

  it('goes on with the game, because the account is in hand either way', async () => {
    // Refusing to open the gate would be the other lie: the player has written
    // it, and a game that stops because a browser is full is a game lost to a
    // setting.
    const storage = partial(/^leela\.reports/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(false),
    });

    await play(storage);

    (el('writer-text') as HTMLTextAreaElement).value = 'Something worth writing.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(el('roll').disabled, 'the die opens').toBe(false);
    expect(el('report').disabled, 'and nothing more is owed').toBe(true);
  }, 20_000);

  it('says it plainly when the writing did land', async () => {
    const storage = partial(/^never$/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(false),
    });

    await play(storage);

    (el('writer-text') as HTMLTextAreaElement).value = 'Something worth writing.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(el('say').textContent).not.toMatch(/will not keep/i);
    expect(storage.kept()['leela.reports.v1']).toContain('Something worth writing.');
  }, 20_000);

  it('opens on a journal whose table was lost', async () => {
    // The other half of a half-written storage: the writing survived and the
    // board did not. A year of somebody's path is not thrown away because the
    // position it was written at has gone.
    const storage = partial(/^never$/, {
      'leela.reports.v1': JSON.stringify({
        reported: true,
        entries: [{ plan: 41, text: 'From a table that is gone.', at: 1 }],
      }),
    });

    expect(await play(storage)).toEqual([]);

    el('path').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(document.getElementById('reader-body')?.textContent).toContain(
      'From a table that is gone.',
    );
  }, 20_000);

  it('starts again on a table that was written halfway', async () => {
    // A tab closed mid-write leaves the first half of a JSON document. It is
    // not a game, it is not readable, and the writing beside it is untouched.
    const storage = partial(/^never$/, {
      'leela.seats.v1': '{"turnIndex":0,"players":[{"id":"p1","sta',
      'leela.reports.v1': JSON.stringify({
        reported: true,
        entries: [{ plan: 41, text: 'Older than the broken table.', at: 1 }],
      }),
    });

    expect(await play(storage)).toEqual([]);
    expect(document.querySelectorAll('#board .cell')).toHaveLength(72);

    el('path').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.getElementById('reader-body')?.textContent).toContain('Older than the broken');
  }, 20_000);
});

describe('a browser that keeps none of the game', () => {
  /**
   * The other thing a full quota takes. The journal was hardened first, and the
   * table beside it went on being swallowed on the stated grounds that
   * *forgetting is a lost game, not an error to show*.
   *
   * Half right: a private window should still play. The other half was that the
   * app kept describing a game it was not keeping — "a snake at 44 takes you to
   * 9", with the stored board still reading 41 — so a player could build a month
   * of play in a window holding none of it and be told at no point.
   *
   * Said once. A window that refuses one write refuses them all, and the notice
   * repeated under every throw would bury the sentence about the throw.
   */
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const playing = (storage: Storage) => ({
    said: () => el('say').textContent ?? '',
    throwOnce: async () => {
      // Long enough for the die to finish turning. The board only moves when it
      // stops, and an assertion made while it spins is an assertion about a
      // player who has not thrown yet — which is how this test first read.
      el('roll').click();
      for (let waited = 0; waited < 40; waited += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (/threw/i.test(el('say').textContent ?? '')) return;
      }
      throw new Error('the die never landed');
    },
    stored: () => storage.kept()['leela.seats.v1'] ?? null,
  });

  const refusingTheTable = () =>
    partial(/^leela\.seats/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(true),
    });

  it('says the game is not being kept, beside the move it is not keeping', async () => {
    const storage = refusingTheTable();
    expect(await play(storage)).toEqual([]);
    const game = playing(storage);

    await game.throwOnce();

    expect(game.said(), 'the throw is still described').toMatch(/threw/i);
    expect(game.said(), 'and so is the fact that it is going nowhere').toMatch(/will not keep/i);
    expect(game.stored(), 'which is true: the board is as it was').toContain('"loka":41');
  }, 20_000);

  it('says it once, and not again under the next thing said', async () => {
    // A throw, then the account it asks for — two different lines, and a
    // browser that refuses one write refuses both. The second one carries no
    // notice: repeated, it would become the wallpaper a player reads past.
    const storage = refusingTheTable();
    await play(storage);
    const game = playing(storage);

    await game.throwOnce();
    expect(game.said(), 'said the first time').toMatch(/will not keep/i);

    el('report').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    (el('writer-text') as HTMLTextAreaElement).value = 'What that square asked of me.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(game.said(), 'the writing is confirmed').toMatch(/written/i);
    expect(game.said(), 'and not re-announced').not.toMatch(/will not keep/i);
  }, 20_000);

  it('says nothing at all when the browser is keeping it', async () => {
    // The case that must stay quiet, and the one a notice bolted to `announce`
    // would break first.
    const storage = partial(/^never$/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(true),
    });
    await play(storage);
    const game = playing(storage);

    await game.throwOnce();

    expect(game.said()).toMatch(/threw/i);
    expect(game.said()).not.toMatch(/will not keep/i);
    expect(game.stored(), 'and the board moved').not.toContain('"loka":41');
  }, 20_000);
});

describe('a question the browser will not keep', () => {
  /**
   * The intention dialog is the one the game will not start without, and its
   * writer was the odd one out: `saveIntention` returned `true` for "worth
   * keeping" rather than "kept", so one word answered two questions and the
   * caller could not tell which. Over a store that refuses, the player was told
   * **"Two characters at least — say something you mean."** about a sentence
   * that was long enough — a browser's failure reported as their mistake, in
   * the one place they cannot go around.
   *
   * Two facts, two sentences now: whether the words are a question worth
   * playing for, and whether this browser is keeping anything.
   */
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const answering = async (text: string, refuse: RegExp) => {
    const storage = partial(refuse);
    await play(storage);

    (el('intention-text') as HTMLTextAreaElement).value = text;
    el('intention-save').click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    return { hint: el('intention-hint').textContent ?? '', said: el('say').textContent ?? '' };
  };

  it('does not call a long enough question too short', async () => {
    const { hint, said } = await answering('To see what I keep avoiding.', /^leela\.intention/);

    expect(hint, 'nothing wrong with what they wrote').not.toMatch(/two characters/i);
    expect(said, 'and the browser is what is wrong').toMatch(/will not keep/i);
  }, 20_000);

  it('still calls a short one short', async () => {
    // The message has a cause of its own, and it has to keep it.
    const { hint } = await answering('x', /^never$/);

    expect(hint).toMatch(/two characters/i);
  }, 20_000);

  it('plays on with the question held for the session', async () => {
    const storage = partial(/^leela\.intention/);
    await play(storage);

    (el('intention-text') as HTMLTextAreaElement).value = 'To see what I keep avoiding.';
    el('intention-save').click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect((el('intention') as HTMLDialogElement).open, 'the dialog lets them through').toBe(false);
    expect(el('roll').disabled, 'and the die turns').toBe(false);
  }, 20_000);
});
