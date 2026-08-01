/**
 * The game itself, kept between launches.
 *
 * The phone kept what a player wrote and lost where they were standing. The
 * journal survives a restart, the intention survives a restart, and the board
 * did not: `useState(() => newGame(startingSeed()))` made a fresh game with a
 * random seed every launch, so somebody who had climbed to plan 41 came back to
 * the waiting square needing a six to begin again — with a year of their own
 * writing intact underneath, about squares they were no longer on.
 *
 * That is this repository's recurring shape from the other side. The record the
 * game exists to produce was kept; the game was not.
 *
 * **And `game.ts` already promised otherwise.** Its `throwDie` says: *the die is
 * `(seed, rollsTaken)`, so a game replays exactly from two numbers a player can
 * carry away*. Both numbers were computed, held in memory, and thrown away on
 * every launch. The promise was true of the engine and false of the app.
 *
 * So the seed and the count are saved, and the die is rebuilt by turning it
 * `rollsTaken` times — which is what makes the next throw continue the sequence
 * rather than start it again. The session is saved beside them because the
 * report gate is not derivable from the die: whether an account has been given
 * for the square a player stands on is a fact about the player, not about the
 * numbers that got them there.
 */

import { CLASSIC, type RuleSet, type Session } from '@leela/engine';
import { newGame, type Game } from './game';
import { KEEP_TIMEOUT_MS, type Keeper } from './journal';

export const GAME_KEY = 'leela.game.v1';

/** Whatever it is, settled within `ms` — the journal's own clock, same reason. */
async function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** What is written down: two numbers and the state they produced. */
interface Saved {
  seed: number;
  rollsTaken: number;
  session: Session;
}

function isSaved(value: unknown): value is Saved {
  if (typeof value !== 'object' || value === null) return false;
  const one = value as Partial<Saved>;

  return (
    Number.isFinite(one.seed) &&
    Number.isInteger(one.rollsTaken) &&
    (one.rollsTaken ?? -1) >= 0 &&
    typeof one.session === 'object' &&
    one.session !== null &&
    Array.isArray((one.session as Session).players) &&
    (one.session as Session).players.length > 0 &&
    (one.session as Session).players.every(
      (player) => typeof player?.id === 'string' && typeof player?.state?.loka === 'number',
    )
  );
}

/**
 * Keep the game, and say whether it landed.
 *
 * The same contract every writer in this repository answers. A device that will
 * not hold the game is not the player's doing, and a caller that is told
 * nothing has no way to say so.
 */
export async function keepGame(
  keeper: Keeper | undefined,
  game: Game,
  timeoutMs = KEEP_TIMEOUT_MS,
): Promise<boolean> {
  if (!keeper) return false;

  const saved: Saved = { seed: game.seed, rollsTaken: game.rollsTaken, session: game.session };

  try {
    return await within(keeper.write(JSON.stringify(saved)), timeoutMs, false);
  } catch {
    return false;
  }
}

/**
 * The game as it was, or null to begin one.
 *
 * Null rather than a thrown error, and null rather than a half-restored game:
 * a board that came back wrong is worse than a board that came back empty,
 * because only one of them is visible. The journal's own reader makes the same
 * choice for the same reason.
 *
 * The die is turned `rollsTaken` times before it is handed back. Without that
 * the next throw repeats the first one of the game, which is not a fresh start
 * and not a continuation — it is the same sequence played twice, and a player
 * would see their opening throw again on every relaunch.
 */
export async function loadKeptGame(
  keeper: Keeper | undefined,
  rules: RuleSet = CLASSIC,
  timeoutMs = KEEP_TIMEOUT_MS,
): Promise<Game | null> {
  if (!keeper) return null;

  let parsed: unknown;
  try {
    const raw = await within(keeper.read(), timeoutMs, null);
    if (raw === null) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isSaved(parsed)) return null;

  const fresh = newGame(parsed.seed, rules);
  for (let turn = 0; turn < parsed.rollsTaken; turn += 1) fresh.die();

  return {
    ...fresh,
    session: parsed.session,
    rollsTaken: parsed.rollsTaken,
    // The last throw is not kept. It is a sentence about something that has
    // already happened, and a player returning tomorrow is told where they are
    // rather than what they rolled yesterday.
    event: null,
  };
}
