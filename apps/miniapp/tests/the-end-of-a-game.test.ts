/**
 * The last throw, played rather than seeded.
 *
 * `assembled.test.ts` puts a player on 68 with `is_finished` already true and
 * asks what the app does with a winner. That is the state after; the act was
 * never played. The bot's end of a game was held the pass before, and this is
 * the same question asked of the surface people actually play on.
 *
 * Seeded one arrow's throw from the end and played from there: the board reaches
 * 68, the line announces it, **the die closes**, and the winner still owes an
 * account — which is the report gate carried to the last square, the same as in
 * the chat. Writing it is taken, the game is called complete, and the die stays
 * shut.
 *
 * **Waits are conditions, and the conditions were learned the hard way.** A
 * throw spins for `(value / 2) * 500` ms with the button disabled, so the way to
 * know a throw has finished is to watch the button go down and come back — not
 * to watch the sentence change, because *not enough room — you stay on 70*
 * repeats word for word and a wait for new text never returns. And the app opens
 * the reader on landing, which covers the die, so a dialog left open stalls the
 * next throw.
 */

// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { messageFor } from '@leela/content';

const HERE = dirname(fileURLToPath(import.meta.url));

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

/** A seat in play on a square, with the question already answered. */
const seatedOn = (plan: number) =>
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

const el = (id: string) => document.getElementById(id) as HTMLElement & { disabled?: boolean };
const dialog = (id: string) => document.getElementById(id) as HTMLDialogElement;
const board = () => document.querySelectorAll('#board .cell');

async function until(ready: () => boolean, what: string): Promise<void> {
  for (let attempt = 0; attempt < 900; attempt += 1) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(
    `waited for ${what}: on ${el('plan-number')?.textContent}, "${el('say')?.textContent}", ` +
      `die ${el('roll')?.disabled ? 'shut' : 'open'}`,
  );
}

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
  await until(() => board().length === 72, 'the board');
}

/** Write whatever is owed, through the box a player uses. */
async function writeAnAccount(words: string): Promise<void> {
  el('report').click();
  await until(() => dialog('writer')?.open === true, 'the writing box');

  (el('writer-text') as HTMLTextAreaElement).value = words;
  el('writer-save').click();
  await until(() => dialog('writer')?.open === false, 'the writing box to close');
}

/** Throw until the winning square, writing an account whenever one is owed. */
async function playToTheEnd(storage: Storage): Promise<void> {
  await play(storage);

  for (let throws = 0; throws < 300; throws += 1) {
    for (const open of document.querySelectorAll('dialog')) {
      if ((open as HTMLDialogElement).open) (open as HTMLDialogElement).close();
    }

    await until(() => el('roll')?.disabled === false, `the die to open, throw ${throws}`);
    el('roll').click();

    // The button goes down for the spin and comes back when the app has
    // settled — or stays down because an account is owed.
    await until(() => el('roll')?.disabled === true, `the throw to start, ${throws}`);
    await until(
      () => el('roll')?.disabled === false || el('report')?.disabled === false,
      `the throw to finish, ${throws}`,
    );

    if (el('plan-number')?.textContent === '68') return;

    for (const open of document.querySelectorAll('dialog')) {
      if ((open as HTMLDialogElement).open) (open as HTMLDialogElement).close();
    }

    // Asked of the buttons rather than of the sentence: the words for an owed
    // account differ by surface, the state does not.
    if (el('roll')?.disabled === true && el('report')?.disabled !== true) {
      await writeAnAccount(`an account of the ${throws}th square, long enough to count`);
    }
  }

  throw new Error('three hundred throws and no winning square');
}

/**
 * One game, played once, and read in three places.
 *
 * Written first as three tests each playing their own, which cost
 * thirty-eight seconds and doubled the time `audit-mutants` takes — it runs a
 * package's suite once per mutation, so a slow test is paid for eighty-two
 * times. A throw spins for up to a second and a half and a game from 62 takes
 * dozens of them; the play is the cost, so it happens once.
 *
 * The last of the three writes the winner's account, so it has to come last.
 * Vitest runs them in the order they are written, and the comment is here
 * because that order is load-bearing rather than incidental.
 *
 * The bound is generous for the same reason it was in the bot's end-game test:
 * a die and a board of snakes has a long tail, and these timed out at the
 * default five seconds beside the other nine packages while passing alone.
 */
describe('the throw that ends a game', { timeout: 180_000 }, () => {
  const storage = held();

  // The hook needs its own bound: a `describe` timeout does not reach it, and a
  // `beforeAll` that runs out is reported as three skipped tests and a failing
  // suite — which is what happened, and reads nothing like *the game took too
  // long*.
  beforeAll(async () => {
    storage.setItem('leela.seats.v1', seatedOn(62));
    storage.setItem('leela.intention.v1', 'to see it through to the end');
    await playToTheEnd(storage);
  }, 180_000);

  it('puts the player on the winning square and says so', () => {
    expect(el('plan-number')?.textContent).toBe('68');
    expect(el('plan-title')?.textContent).toContain('Cosmic Consciousness');
    expect(el('say')?.textContent).toContain('Cosmic Consciousness');
  });

  it('closes the die, and leaves the account still to be written', () => {
    // The report gate carried to the last square, which is what the bot says
    // out loud in a chat: the game is not done until the square it was played
    // to reach has been written about.
    expect(el('roll')?.disabled, 'nothing left to throw for').toBe(true);
    expect(el('report')?.disabled, 'the account is still open').not.toBe(true);

    const stored = JSON.parse(storage.getItem('leela.seats.v1') ?? '{}');
    expect(stored.players?.[0]?.state?.is_finished).toBe(true);
    expect(stored.players?.[0]?.reportSubmitted, 'owed, and kept owed').toBe(false);
  });

  it('takes that account and calls the game complete', async () => {
    // Last on purpose: this one writes, and the two above read the state it
    // changes.
    for (const open of document.querySelectorAll('dialog')) {
      if ((open as HTMLDialogElement).open) (open as HTMLDialogElement).close();
    }

    await writeAnAccount('I got here, and it turned out not to be about the square');

    expect(el('say')?.textContent).toBe(messageFor('en', 'app.reportSavedDone'));
    expect(el('roll')?.disabled, 'and the die stays shut').toBe(true);

    const stored = JSON.parse(storage.getItem('leela.seats.v1') ?? '{}');
    expect(stored.players?.[0]?.reportSubmitted).toBe(true);
  });
});
