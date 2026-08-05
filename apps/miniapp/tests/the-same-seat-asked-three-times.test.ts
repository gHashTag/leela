// @vitest-environment happy-dom
/**
 * The writing box belongs to the seat that owes an account, not to the turn.
 *
 * This app says so twice, in its own source. `whatIsBeingWritten` ends *"The
 * whole of the fix is asking the same seat three times instead of three
 * different ones"*, and `writingSeat` above it records the fourth place that
 * asked differently: the keystroke handler saved a draft under the turn holder
 * while `openWriter` had loaded it under the seat that owed one, so at a table
 * the writing seat's draft was never kept and the other seat's was destroyed on
 * every keystroke.
 *
 * Both were fixed. **Three of the asks were then held by nothing**, measured by
 * putting each defect back one at a time and running this package's whole suite:
 *
 * - the shared square carries the **turn holder's question** instead of the
 *   writer's — 494 of 494 green, and that is a leak off the device: what the
 *   other player is playing for, up to eight hundred characters of their own
 *   writing, signed to a square they did not write;
 * - the box is filled with the **turn holder's unsaved words** — 494 green, and
 *   saving then files them under the writer;
 * - the *room left in your path* warning counts the **turn holder's** journal —
 *   494 green, so a player is told what somebody else has left.
 *
 * The two asks that *are* held are the title and the accounts shown above the
 * box, which is what made the box read as covered.
 *
 * Seated rather than played. A table of two where the seat that owes an account
 * is not the one holding the turn is exactly the state a throw produces, and
 * reaching it by playing costs a minute of dice for a claim about one dialog.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messageFor } from '@leela/content';

const HERE = dirname(fileURLToPath(import.meta.url));

const HERS = 'what I wrote here the last time, and did not want to read again';
const HER_QUESTION = 'why do I keep arriving at the same shoreline';
const HIS_DRAFT = 'his half-written words, never filed';
const HIS_QUESTION = 'what am I keeping the light on for';

function held(): Storage {
  const map = new Map<string, string>();

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
    all: map,
  } as unknown as Storage & { all: Map<string, string> };
}

const standing = (plan: number, owes: boolean) => ({
  state: {
    loka: plan,
    previous_loka: plan - 3,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
  },
  reportSubmitted: !owes,
});

/**
 * A table of two: `p1` holds the turn and owes nothing, `p2` owes an account.
 *
 * `owingSeat` asks the holder first and then anybody, so this is the state in
 * which the box is opened for a seat that is not the turn — the only state in
 * which asking the wrong one can be seen at all.
 */
const twoSeats = JSON.stringify({
  turnIndex: 0,
  players: [
    // **Both on 41.** A draft is kept per seat *and* per square, so a turn
    // holder standing somewhere else has their draft discarded by the plan
    // check and the wrong-seat read cannot be seen at all. Two players on one
    // square is ordinary — the board has no rule against it.
    { id: 'p1', ...standing(41, false) },
    { id: 'p2', ...standing(41, true) },
  ],
});

const el = (id: string) => document.getElementById(id) as HTMLElement & { value?: string };
const dialog = (id: string) => document.getElementById(id) as HTMLDialogElement;

async function until(ready: () => boolean, what: string): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`waited for ${what}`);
}

/** The app, opened on a table already seated, with both seats' writing kept. */
async function seated(): Promise<Storage & { all: Map<string, string> }> {
  const storage = held() as Storage & { all: Map<string, string> };

  storage.setItem('leela.seats.v1', twoSeats);
  storage.setItem('leela.intention.v1', HIS_QUESTION);
  storage.setItem('leela.intention.v1.p2', HER_QUESTION);
  // What p2 wrote the last time they stood on 41, and what p1 has left typed.
  storage.setItem(
    'leela.draft.v1',
    JSON.stringify({ player: 'p1', plan: 41, text: HIS_DRAFT }),
  );
  // A path at the bound for the seat being written for, and nothing for the
  // turn holder. The hint is *room left in your path*, and that is the one
  // reading where the two journals say different things without a word of
  // either being shown.
  storage.setItem(
    'leela.reports.v1.p2',
    JSON.stringify({
      reported: true,
      entries: Array.from({ length: 500 }, (_unused, index) => ({
        plan: index === 0 ? 41 : (index % 71) + 1,
        text: index === 0 ? HERS : `an account of the ${index}th square, long enough to count`,
        at: 1_700_000_000_000 + index,
      })),
    }),
  );

  vi.resetModules();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  Object.defineProperty(window.navigator, 'language', { value: 'en', configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

  const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');

  await import('../src/main');
  await until(() => document.querySelectorAll('#board .cell').length === 72, 'the board');

  el('report').click();
  await until(() => dialog('writer')?.open === true, 'the writing box');

  return storage;
}

describe('the writing box at a table, opened for a seat that is not the turn', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('is filled with the writing seat’s own draft, not the turn holder’s', async () => {
    // The defect this app already met once, in the direction that leaks: the
    // box opens holding words the other player typed and never filed, and
    // saving files them under somebody else's name.
    await seated();

    expect(String(el('writer-text').value)).not.toContain(HIS_DRAFT);
  });

  it('counts what is left in the writing seat’s own path', async () => {
    // The hint is a number about a record, and telling it about the wrong
    // record warns a player about room somebody else has used. Read against a
    // path at the bound: the seat being written for is full, the turn holder
    // has written nothing, and the two say opposite things.
    const storage = await seated();

    expect(storage.getItem('leela.reports.v1'), 'the turn holder has no path').toBeNull();
    expect(el('writer-hint').textContent, 'and the writer’s is full').toBe(
      messageFor('en', 'writer.pathFull'),
    );
    expect(el('writer-before').textContent, 'their own square, read back').toContain(HERS);
  });

  it('shares the square under the writing seat’s own question', async () => {
    // The whole of the recorded defect: *a square nobody stood on, signed by
    // somebody who did not write it*. The plan half is held; the question half
    // was not, and it is the half that carries another player's writing off the
    // device entirely.
    await seated();

    const shared: string[] = [];
    vi.stubGlobal('navigator', {
      ...window.navigator,
      language: 'en',
      share: async (data: { text: string }) => void shared.push(data.text),
    });

    (el('writer-text') as HTMLTextAreaElement).value = 'an account of the forty-first square';
    el('writer-text').dispatchEvent(new Event('input'));
    await until(() => el('writer-share').hidden === false, 'the share button');

    el('writer-share').click();
    await until(() => shared.length > 0, 'the square to be shared');

    expect(shared[0], 'the writer’s question').toContain(HER_QUESTION);
    expect(shared[0], 'and not the turn holder’s').not.toContain(HIS_QUESTION);
    expect(shared[0], 'about the square they are on').toContain('41.');
  });
});
