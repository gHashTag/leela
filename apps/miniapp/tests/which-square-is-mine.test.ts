/**
 * Finding your own square without seeing the board.
 *
 * The board is seventy-two `<button>`s, and each is named after the plan it
 * is — *41. The human plane (jana-loka)* — which is right and was already
 * there. What was not there is which one the player is standing on: that was a
 * CSS class, `here`, and a class is a colour.
 *
 * So a player moving across the board by keyboard heard seventy-two square
 * names and had no way to find their own. The sentence in `#say` announces the
 * square once, on the throw — that is the live region, and
 * `where-a-player-now-is.test.ts` holds it to naming the square — but a board
 * is a thing a player comes back to, and it said nothing.
 *
 * `aria-current` is the word for exactly this: the one item of a set that is
 * the current one. Nothing new has to be said in twenty-two languages for it to
 * be understood, which is why it is the right repair for a catalogue that is
 * complete in two.
 *
 * These assert the shape: **exactly one square is the player's, it is the one
 * the game says they are on, and it moves with them.** The last is the half
 * that a repair like this usually loses — a mark that is set and never cleared
 * is a board that was right once.
 */

// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A store the app can keep a game in, held in memory. */
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

/** The app, running on the markup it ships with. */
async function play(storage: Storage): Promise<void> {
  vi.resetModules();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  Object.defineProperty(window.navigator, 'language', { value: 'en', configurable: true });

  const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');

  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

  await import('../src/main');
  // The plans arrive as a dynamic import, so the board is drawn some time after
  // this returns. Waited for by asking rather than by counting: a fixed sleep
  // long enough on an idle machine is a test that fails when the other nine
  // packages are running beside it, which is exactly what happened.
  await until(() => board().length === 72);
}

/** Wait for something to become true, or give up with a reason. */
async function until(ready: () => boolean, what = 'the board to be drawn'): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`waited for ${what} and it never came`);
}

const board = () => [...document.querySelectorAll('#board .cell')];
const mine = () => board().filter((cell) => cell.getAttribute('aria-current') === 'true');

/** A seat already in play, so the board is drawn on a square. */
const seated = (plan: number) =>
  JSON.stringify({
    turnIndex: 0,
    players: [
      {
        id: 'p1',
        state: {
          loka: plan,
          previous_loka: plan - 6,
          direction: 'step 🚶🏼',
          consecutive_sixes: 0,
          position_before_three_sixes: 0,
          is_finished: false,
        },
        reportSubmitted: true,
      },
    ],
  });

/**
 * Booting the app costs seconds, and more of them when the other nine packages
 * are building beside it.
 *
 * Every case here starts the app over, because the board is drawn from what is
 * in the store at boot and each case needs a different store. The default five
 * seconds is enough on an idle machine and was not enough under `bun run
 * verify`, where two of these timed out — so the bound is stated rather than
 * discovered, and it is a bound on the app's start rather than on anything this
 * file waits for: the waits are conditions, not sleeps.
 */
describe('the square the player is standing on', { timeout: 30_000 }, () => {
  it('says so, and only it does', async () => {
    const storage = held();
    storage.setItem('leela.seats.v1', seated(41));
    await play(storage);

    expect(board()).toHaveLength(72);
    expect(mine().map((cell) => cell.textContent)).toEqual(['41']);
  });

  it('is the one the board draws as the player’s', async () => {
    // The mark and the colour must agree. Two answers to *where am I* is worse
    // than one, because whichever a player trusts, somebody is being told the
    // wrong thing.
    const storage = held();
    storage.setItem('leela.seats.v1', seated(23));
    await play(storage);

    const [current] = mine();
    expect(current?.classList.contains('here')).toBe(true);
    expect(current?.textContent).toBe('23');
  });

  it('carries the plan’s name, so hearing it is knowing where you are', async () => {
    // The mark says *this one*; the name says which. Neither is any use alone.
    const storage = held();
    storage.setItem('leela.seats.v1', seated(41));
    await play(storage);

    expect(mine()[0]?.getAttribute('aria-label')).toContain('41');
    expect(mine()[0]?.getAttribute('aria-label')?.length).toBeGreaterThan(4);
  });

  it('leaves the square it came from, in one sitting', async () => {
    // The half a repair like this loses. Every test above starts a fresh
    // document, so a mark that is set and never cleared passes all of them —
    // measured: taking the `removeAttribute` out breaks nothing until a board
    // is drawn twice. This throws, which draws it again.
    const storage = held();
    storage.setItem('leela.seats.v1', seated(41));
    storage.setItem('leela.intention.v1', 'to see it through');
    await play(storage);

    const before = mine()[0]?.textContent;
    expect(before).toBe('41');

    const announced = () => document.getElementById('say')?.textContent ?? '';
    const said = announced();

    (document.getElementById('roll') as HTMLButtonElement).click();
    // A throw spins for `(value / 2) * 500` ms and the board is redrawn when it
    // stops. Waited for by asking rather than by counting: the app has answered
    // when the line it announces through says something new.
    await until(() => announced() !== said, 'the throw to be announced');

    expect(mine()).toHaveLength(1);
    expect(mine()[0]?.classList.contains('here')).toBe(true);
  });

  it('opens a chapter whose headings step down one at a time', async () => {
    // The rule lives in `@leela/content`'s test; this is the surface using it.
    // Reverting the shift in `main.ts` breaks nothing a rule-shaped test can
    // see, because such a test computes the outline itself — so the reader is
    // opened and the levels are read off the dialog that a player gets.
    //
    // The dialog's own title is an `h2`, so the chapter's sections must start
    // at `h3`. The chakras chapter writes them as `####`, which a fixed shift
    // drew as `h6`: three levels missing under the title.
    await play(held());

    (document.getElementById('rules') as HTMLButtonElement).click();
    await until(() => document.querySelectorAll('#list-items button').length > 0, 'the rules list');

    const chapters = [...document.querySelectorAll('#list-items button')];
    const chakras = chapters.find((one) => /chakra|чакр/i.test(one.textContent ?? '')) ?? chapters[0];
    (chakras as HTMLButtonElement).click();
    await until(
      () => (document.getElementById('reader-body')?.children.length ?? 0) > 0,
      'the chapter to open',
    );

    const levels = [...(document.getElementById('reader-body')?.children ?? [])]
      .filter((node) => /^H[1-6]$/.test(node.tagName))
      .map((node) => Number(node.tagName.slice(1)));

    expect(levels.length).toBeGreaterThan(0);
    // The title is an `h2`; nothing under it may jump more than one level.
    for (const [at, level] of [2, ...levels].entries()) {
      if (at === 0) continue;
      expect(level - Number([2, ...levels][at - 1])).toBeLessThanOrEqual(1);
    }
  });

  it('is the winning square before the first six, where the piece actually sits', async () => {
    // Measured rather than assumed. The first version of this expected no mark
    // at all and was wrong about the game: a waiting player's piece stands on
    // 68 — the published app starts every seat there, `plans: [68, 68, …]`, and
    // this app followed it so that a player looking for their piece before the
    // first six finds one. The mark says where the piece is, so it says 68.
    await play(held());

    expect(board()).toHaveLength(72);
    expect(mine().map((cell) => cell.textContent)).toEqual(['68']);
  });
});
