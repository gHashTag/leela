/**
 * Waiting for the app to have done something, in one place.
 *
 * Four test files wrote this function out for themselves, and by 2026-08-28
 * they had drifted into three different deadlines — 400, 600 and 900 attempts.
 * Nobody chose those numbers against anything, and the tightest of them is the
 * one that decides whether a suite goes red on a busy machine.
 *
 * **It also means the deadline that binds is not the one anybody set.** The
 * workspaces run `vitest --testTimeout=30000` since f7eeb31, chosen against
 * measurements of a twelve-workspace parallel run; a helper that gives up after
 * four seconds of its own accord makes that setting decorative. The bound
 * belongs where the waiting is.
 *
 * **And it is a clock now, not a count.** `for (let i = 0; i < 600; i++)` with
 * a 10 ms sleep is six seconds only on an idle machine: each `await` costs the
 * sleep *plus* however long the event loop takes to come back, which under load
 * is the whole point. So six hundred attempts was six seconds when it did not
 * matter and considerably more when it did — a deadline that stretches exactly
 * when you want it to hold.
 */

/**
 * How long to wait before saying the app never got there.
 *
 * Under `--testTimeout=30000`, deliberately: **this must lose the race.** When
 * vitest wins it prints `Test timed out in 30000ms` and nothing about what was
 * being waited for; when this wins it names the thing and can describe the page.
 * A useful failure is worth ten seconds of headroom.
 */
export const PATIENCE_MS = 20_000;

/** How often to look. Small enough not to add latency worth measuring. */
const LOOK_EVERY_MS = 10;

/**
 * Wait until `ready()`, or fail saying what was waited for.
 *
 * @param what     named in the failure, so an operator learns from the line.
 * @param describe optional, called only on failure, for the state that explains
 *                 it — `the-end-of-a-game` prints the plan, the sentence and
 *                 whether the die is shut, and that was worth keeping when the
 *                 four copies became one.
 */
export async function until(
  ready: () => boolean,
  what: string,
  describe?: () => string,
  // Injected so this file's own tests need not wait out twenty seconds to see
  // it give up — the same reason `ASKS_PER_MINUTE`'s clock is injected in the
  // bot's route. No caller passes it; the suites take the bound above.
  patienceMs: number = PATIENCE_MS,
): Promise<void> {
  const giveUpAt = Date.now() + patienceMs;

  while (Date.now() < giveUpAt) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, LOOK_EVERY_MS));
  }

  // Checked once more after the clock: a `ready()` that became true during the
  // last sleep is a pass, not a race lost by a millisecond.
  if (ready()) return;

  throw new Error(
    `waited ${patienceMs}ms for ${what}${describe === undefined ? '' : ` — ${describe()}`}`,
  );
}
