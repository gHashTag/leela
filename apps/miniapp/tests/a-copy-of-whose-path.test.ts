// @vitest-environment happy-dom
/**
 * *Save a copy* writes one seat's file and copies another seat's path.
 *
 * `exportPath` says what it is for, in its own words: *"it used to save whoever
 * held the turn — so a player could scroll to their own section, tap Save a
 * copy, and carry away a file of somebody else's writing."* The fix was to ask
 * which seat the button belongs to, and it reached the file.
 *
 * It did not reach the clipboard. Two lines below the download, the same
 * function does `navigator.clipboard.writeText(toText(journal, …))` — `journal`
 * being whatever the **current** player holds — while everything above it uses
 * `theirs`. So at a table, tapping *Save a copy* under seat two hands you seat
 * two's file and puts **seat one's whole path, in readable text**, on the
 * clipboard. The next paste, into a message or a notes app, is somebody else's
 * year of writing.
 *
 * The gate above it is asked of `theirs` as well, so the two disagree in the
 * other direction too: a seat with nothing written copies out the current
 * player's path, and a current player with nothing written copies out an empty
 * string over a file that is not empty.
 *
 * Held here as the property the function's own comment states — **one seat is
 * asked, and everything the button produces is that seat's** — over both of the
 * things it produces, because it was fixed in one of them and not the other.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

const HERS = 'the salt marsh at low tide, and what I would not look at';
const HIS = 'the hallway light left on all night in an empty flat';

function held(): Storage {
  const map = new Map<string, string>();

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

const standing = (plan: number) => ({
  state: {
    loka: plan,
    previous_loka: plan - 3,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
  },
  reportSubmitted: true,
});

/** A table of two, both settled: `p1` holds the turn, `p2` sits beside them. */
const twoSeats = JSON.stringify({
  turnIndex: 0,
  players: [
    { id: 'p1', ...standing(30) },
    { id: 'p2', ...standing(41) },
  ],
});

const written = (plan: number, text: string) =>
  JSON.stringify({ reported: true, entries: [{ plan, text, at: 1_700_000_000_000 }] });

async function until(ready: () => boolean, what: string): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`waited for ${what}`);
}

/**
 * The app on a seated table, with the path view open and what the clipboard
 * was given.
 */
async function atTheTable() {
  const storage = held();

  storage.setItem('leela.seats.v1', twoSeats);
  storage.setItem('leela.intention.v1', 'what am I keeping the light on for');
  storage.setItem('leela.intention.v1.p2', 'why do I keep arriving at the same shoreline');
  storage.setItem('leela.reports.v1', written(30, HIS));
  storage.setItem('leela.reports.v1.p2', written(41, HERS));

  const copied: string[] = [];

  vi.resetModules();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  Object.defineProperty(window.navigator, 'language', { value: 'en', configurable: true });
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async (text: string) => void copied.push(text) },
    configurable: true,
  });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

  // A download in happy-dom needs both of these, and neither exists there.
  Object.defineProperty(window.URL, 'createObjectURL', {
    value: () => 'blob:leela',
    configurable: true,
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', { value: () => undefined, configurable: true });

  const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');

  await import('../src/main');
  await until(() => document.querySelectorAll('#board .cell').length === 72, 'the board');

  (document.getElementById('path') as HTMLElement).click();
  await until(
    () => (document.getElementById('reader') as HTMLDialogElement)?.open === true,
    'the path view',
  );

  /** The per-seat save buttons, in the order the sections are drawn. */
  const saves = [...document.querySelectorAll('#reader-body button')].filter((button) =>
    /save/i.test(button.textContent ?? ''),
  ) as HTMLButtonElement[];

  return { copied, saves };
}

/**
 * The bound is explicit because the document is loaded and run inside it.
 *
 * Each case opens the app afresh — a new module, a new clipboard, a new table —
 * and under `bun run verify`, beside nine other packages, that does not fit the
 * default five seconds. It passed alone and timed out in the full run, which is
 * the fourth time this shape has appeared here; a bound that fits an idle
 * machine is a bound that fails on a busy one.
 */
describe('Save a copy, under one seat’s section at a table', { timeout: 120_000 }, () => {
  it('draws a button for each seat, or there is nothing to press', async () => {
    // The guard: the per-seat buttons only exist when the table has more than
    // one, and a check that pressed nothing would pass in silence.
    const { saves } = await atTheTable();

    expect(saves.length).toBe(2);
  });

  it('copies that seat’s path and not the seat beside them', async () => {
    // The half the fix did not reach. The file is right; the clipboard holds
    // whatever the current player has written, and the next paste is somebody
    // else's writing in a message.
    const { copied, saves } = await atTheTable();

    saves[1]?.click();
    await until(() => copied.length > 0, 'the path to be copied');

    expect(copied[0], 'the seat whose button was pressed').toContain(HERS);
    expect(copied[0], 'and not the one beside them').not.toContain(HIS);
  });

  it('copies the current player’s own path when it is their button', async () => {
    // The other half, so the fix cannot be "always the other seat".
    const { copied, saves } = await atTheTable();

    saves[0]?.click();
    await until(() => copied.length > 0, 'the path to be copied');

    expect(copied[0]).toContain(HIS);
    expect(copied[0]).not.toContain(HERS);
  });
});
