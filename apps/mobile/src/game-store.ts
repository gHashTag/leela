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

import {
  CLASSIC,
  isRuleSetId,
  isSeatedTable,
  ruleSetById,
  type RuleSet,
  type Session,
} from '@leela/engine';
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

/**
 * Whether the file holds a game, judged by the engine rather than by this app.
 *
 * This asked that `state.loka` be a *number*, and nothing else about it. The
 * mini app's `isSavedGame`, its `isSavedSeats` and the database's `checkSeat`
 * all asked the whole question; this one shipped to a phone.
 *
 * Read through this loader, that accepted plan 999 — a tile numbered 999 that
 * no throw ever leaves — plan 41.5 walking on to 47.5, and `is_finished` on
 * plan 41, which draws no square while still letting the player throw off it.
 * Worst of the four, a `turnIndex` of 7 at a table of one was let through here
 * and then thrown by everything downstream: the tile, the throw gate and the
 * move all raise `turn 7 at a table of 1`. On a phone that is the app failing
 * to open, over a file whose only right answer was to begin again — which this
 * function returning false already does.
 */
function isSaved(value: unknown): value is Saved {
  if (typeof value !== 'object' || value === null) return false;
  const one = value as Partial<Saved>;

  return (
    Number.isFinite(one.seed) &&
    Number.isInteger(one.rollsTaken) &&
    (one.rollsTaken ?? -1) >= 0 &&
    isSeatedTable(one.session)
  );
}

/**
 * The variant the file names, rebuilt — not the one it carries.
 *
 * `keepGame` writes `session.rules` whole, so the file holds a rule *object*: a
 * hand-edited `{"id":"classic","threeSixesReset":false}` would come back as a
 * RuleSet the engine never defined and be played as though it had. A saved game
 * may say which variant it is; it may not say what that variant means.
 *
 * An id nobody defines is not guessed at either. Falling back to `CLASSIC`
 * would change the rules of a game already in progress, which is the one thing
 * this repository exists to have stopped happening.
 */
function ruleSetOf(session: Session): RuleSet | null {
  const id: unknown = (session.rules as Partial<RuleSet> | undefined)?.id;
  return typeof id === 'string' && isRuleSetId(id) ? ruleSetById(id) : null;
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
 * A game read back, and whether one was thrown away to give it.
 *
 * `loadKeptGame` answered `null` to both *nothing has ever been saved* and *the
 * file is there and cannot be read*, and the screen treated them the same: it
 * began a fresh game and said nothing. After the check above was tightened, the
 * second case became commoner — and it is the exact failure this module was
 * written to end. Its own header describes it: somebody who had climbed to plan
 * 41 comes back to the waiting square, *with a year of their own writing intact
 * underneath, about squares they were no longer on*.
 *
 * A board that has to be re-entered is a smaller loss than words, which is why
 * the app does not interrupt a throw to report a failed *write*. Reading is the
 * other direction: what is gone is already gone, and the player is the only one
 * who can decide what to do about it — so they are told.
 */
export interface KeptGame {
  /** The game that was kept, or null if there is none to continue. */
  game: Game | null;
  /** True when there was a file and it could not be played. */
  unreadable: boolean;
}

const NOTHING_KEPT: KeptGame = { game: null, unreadable: false };
const UNREADABLE: KeptGame = { game: null, unreadable: true };

/**
 * The game as it was, or nothing to begin one — and which of the two.
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
): Promise<KeptGame> {
  if (!keeper) return NOTHING_KEPT;

  let raw: string | null;
  try {
    raw = await within(keeper.read(), timeoutMs, null);
  } catch {
    // The device would not answer. Nothing is known about what it holds, so
    // this is not a loss to report — only a game that cannot be continued now.
    return NOTHING_KEPT;
  }

  if (raw === null) return NOTHING_KEPT;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Something was written here and is not a game. Half a write is what a
    // process killed mid-save leaves behind, and it is still a game lost.
    return UNREADABLE;
  }

  if (!isSaved(parsed)) return UNREADABLE;

  // The variant is taken from the file by name; an unknown one is a file to
  // start again from, not a game to play under a guess.
  const kept = ruleSetOf(parsed.session);
  if (kept === null) return UNREADABLE;

  const fresh = newGame(parsed.seed, rules);
  for (let turn = 0; turn < parsed.rollsTaken; turn += 1) fresh.die();

  return {
    game: {
      ...fresh,
      session: { ...parsed.session, rules: kept },
      rollsTaken: parsed.rollsTaken,
      // The last throw is not kept. It is a sentence about something that has
      // already happened, and a player returning tomorrow is told where they
      // are rather than what they rolled yesterday.
      event: null,
    },
    unreadable: false,
  };
}
