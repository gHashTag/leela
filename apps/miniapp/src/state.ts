/**
 * The saved game, and what is allowed to come back out of storage.
 *
 * `localStorage` is the only thing this app persists to, and it is writable by
 * anyone with the console open, by an older version of this app, and by a
 * half-finished write. The previous check read one field:
 *
 *     if (!Number.isInteger(parsed.loka) || parsed.loka < 1 || parsed.loka > 72)
 *
 * so a stored value with a plausible square and nonsense everywhere else was
 * handed straight to the engine. `consecutive_sixes: "2"` makes the three-sixes
 * rule silently stop working, because `"2" + 1` is `"21"` and never equals 3.
 *
 * The rule here is not a list of fields to check. It is: **a saved game must be
 * one the engine could have produced.** Anything else is discarded and the
 * player starts over, which is the only honest thing to do with a state whose
 * history cannot be trusted.
 */

import { TOTAL_PLANS, WIN_LOKA, initialState, type Direction, type GameState } from '@leela/engine';

/** Where a saved game lives. Versioned: a shape change starts a new key. */
export const STORAGE_KEY = 'leela.game.v1';

/** The directions the engine can leave behind, plus "has not moved". */
const DIRECTIONS: ReadonlySet<string> = new Set<Direction | ''>([
  '',
  'step 🚶🏼',
  'snake 🐍',
  'arrow 🏹',
  'stop 🛑',
  'win 🕉',
]);

function isSquare(value: unknown, from: number): boolean {
  return Number.isInteger(value) && (value as number) >= from && (value as number) <= TOTAL_PLANS;
}

/**
 * Whether this could have come out of the engine.
 *
 * The consistency rule at the end is the one a field-by-field check misses:
 * `is_finished` is only ever set on the win square, before a game and after
 * one. A state claiming to be finished on plan 41 has no meaning — the app
 * would show "throw a six to enter" while a throw moved the player from 41.
 */
export function isSavedGame(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;

  if (!isSquare(state.loka, 1)) return false;
  if (!isSquare(state.previous_loka, 0)) return false;
  if (!isSquare(state.position_before_three_sixes, 0)) return false;
  if (typeof state.is_finished !== 'boolean') return false;
  if (typeof state.direction !== 'string' || !DIRECTIONS.has(state.direction)) return false;

  // 0, 1 or 2: a third six resets the run, so it is never stored.
  if (!Number.isInteger(state.consecutive_sixes)) return false;
  const sixes = state.consecutive_sixes as number;
  if (sixes < 0 || sixes > 2) return false;

  // Out of play means on the win square, and nowhere else.
  if (state.is_finished && state.loka !== WIN_LOKA) return false;

  return true;
}

/** Somewhere a game can be kept. `localStorage` is one; a Map is another. */
export interface GameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read the saved game, or start a new one.
 *
 * Nothing writes this key any more: the app keeps a table of seats, and one
 * seat is what a single-player game became. This stays because that table is
 * built from whatever was already here — a game in progress from before there
 * were seats is a game somebody is in the middle of.
 *
 * Never throws. Storage can be disabled outright — a private window, a browser
 * with cookies blocked — and a game that cannot be saved should still be a game
 * that can be played.
 */
export function loadState(storage: GameStorage | undefined): GameState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed: unknown = JSON.parse(raw);
    return isSavedGame(parsed) ? parsed : initialState();
  } catch {
    return initialState();
  }
}

/**
 * Where the last throw lives.
 *
 * A key of its own rather than a field on the saved game: `isSavedGame` refuses
 * anything it does not recognise, so a value added inside would make every
 * existing save unreadable — a player's whole path dropped to remember a die.
 * Two keys can drift apart; the drift here is that the die shows a face nobody
 * threw, which is what it does now.
 */
export const DIE_KEY = 'leela.die.v1';

/**
 * The face to show when nothing has been thrown yet.
 *
 * Six, because that is `DiceStore.count`'s initial value in the published app,
 * and because a six is what a player needs to begin: the die at rest shows the
 * throw the game is waiting for.
 */
export const RESTING_FACE = 6;

/**
 * The last throw, as the die should show it.
 *
 * The mini app showed `1` on every load — hard-coded — so a player who threw a
 * six to move from 5 to 11, closed the app and came back was shown a one over a
 * board that had plainly moved by six. The die is a record of the throw, and a
 * record that resets is worse than no record.
 *
 * Anything that is not a face this die has is not restored. That is the rule,
 * rather than a list of the wrong values seen so far: a half-written string, a
 * `0` from an older shape and a `7` from a different game are all the same
 * answer.
 */
export function loadLastRoll(storage: GameStorage | undefined): number {
  try {
    const raw = storage?.getItem(DIE_KEY);
    const value = Number(raw);
    if (!raw || !Number.isInteger(value) || value < 1 || value > 6) return RESTING_FACE;
    return value;
  } catch {
    return RESTING_FACE;
  }
}

/**
 * Keep the last throw, and say whether it was kept.
 *
 * Forgetting it is a worse face, not a broken game — which is why the caller
 * does nothing in particular with the answer beyond what it already does for
 * the board. But answering is not the caller's business to decide, and a writer
 * that cannot be asked is one nobody can ask later either.
 */
export function saveLastRoll(storage: GameStorage | undefined, value: number): boolean {
  if (!storage) return false;

  try {
    storage.setItem(DIE_KEY, String(value));
    return true;
  } catch {
    return false;
  }
}


/**
 * Where an unfinished report waits.
 *
 * Its own key, like the die's: the saved game refuses anything it does not
 * recognise, and a draft has no business making a player's path unreadable.
 */
export const DRAFT_KEY = 'leela.draft.v1';

/**
 * Where each player's unfinished sentence waits.
 *
 * One key held one draft and named its owner inside the value, so a second
 * player starting to type overwrote the first one's, and the reader — which
 * correctly refuses another player's words — then returned nothing to either of
 * them. The check was right and the shelf was one.
 *
 * The first seat keeps the bare key, so a sentence left mid-thought before
 * there were seats is still there afterwards.
 */
export function draftKeyFor(playerId: string): string {
  return playerId === 'p1' ? DRAFT_KEY : `${DRAFT_KEY}.${playerId}`;
}

/**
 * What has been typed and not yet filed, for the plan it is about.
 *
 * The game will not let a player throw until they have written about the
 * square they are on, and the writing was held in a `<textarea>` and nowhere
 * else. A phone discards a backgrounded tab — which is not hypothetical here:
 * a *throw* was lost the same way two passes ago, and found by watching it
 * happen — so a notification arriving mid-sentence took the sentence with it.
 * The one thing the game asks a player to produce was the one thing it did not
 * keep.
 *
 * Kept per plan. A draft belongs to the square it is about, and offering one
 * written about plan 41 to somebody standing on 6 would be worse than offering
 * nothing.
 */
export function loadDraft(
  storage: GameStorage | undefined,
  playerId: string,
  plan: number,
): string {
  try {
    const raw = storage?.getItem(draftKeyFor(playerId));
    if (!raw) return '';

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return '';

    const draft = parsed as { player?: unknown; plan?: unknown; text?: unknown };
    if (draft.plan !== plan || typeof draft.text !== 'string') return '';

    // Whose it is. Two people sharing a device can stand on the same square,
    // and one of them opening the box to find the other's unfinished sentence
    // in it is the worst thing this app could do with writing. A draft saved
    // before there were seats carries no player and belongs to the first one.
    const whose = typeof draft.player === 'string' ? draft.player : 'p1';
    if (whose !== playerId) return '';

    return draft.text;
  } catch {
    return '';
  }
}

/**
 * Keep what has been typed, and say whether it was kept. Blank clears it:
 * there is nothing to come back to.
 *
 * The last of the app's writers to answer the question the others answer. Its
 * excuse for silence was true as far as it went — *a window that cannot store
 * still plays, and still lets somebody write; they simply have to finish in one
 * sitting* — and that last clause is a thing a player would want to be told
 * before they walk away from half an account, not after.
 *
 * It is also the earliest write in a session: somebody typing in a private
 * window reaches this before any throw, so it is the first chance the app has
 * to notice that nothing is being kept.
 */
export function saveDraft(
  storage: GameStorage | undefined,
  playerId: string,
  plan: number,
  text: string,
): boolean {
  if (!storage) return false;

  try {
    const held =
      text.trim().length === 0 ? '' : JSON.stringify({ player: playerId, plan, text });
    storage.setItem(draftKeyFor(playerId), held);
    return true;
  } catch {
    return false;
  }
}

/** Forget one seat's draft. Filed, or the game started again. */
export function clearDraft(storage: GameStorage | undefined, playerId = 'p1'): boolean {
  return saveDraft(storage, playerId, 0, '');
}

/** Where the first seat's intention lives. */
export const INTENTION_KEY = 'leela.intention.v1';

/**
 * Where each player's intention lives, once there is more than one player.
 *
 * The published app keeps it on the profile — `Profiles/{uid}.intention`,
 * updated by `updateIntention`, beside `plan`, `history` and `isReported`.
 * Every other field of that profile this app already keeps per seat. The
 * intention was the one that stayed with the device.
 *
 * The first seat keeps the original key, for the same reason the journal does:
 * the question was answered before there were seats, and moving it would make
 * the app ask again for something already given.
 */
export function intentionKeyFor(playerId: string): string {
  return playerId === 'p1' ? INTENTION_KEY : `${INTENTION_KEY}.${playerId}`;
}

/**
 * How short and how long an intention may be.
 *
 * The published app's own numbers: `yup.string().min(2).max(800)` in
 * `ChangeIntention`. Two characters is a bound against an empty field rather
 * than a standard, and eight hundred is a paragraph.
 */
export const MIN_INTENTION_CHARS = 2;

/**
 * The upper bound, from the format rather than beside it.
 *
 * Three copies of eight hundred: here, in `@leela/journal`, and in
 * `@leela/ai`. They validate, they bound a file on the way in, and they clip a
 * prompt — three different jobs and one number, which agreed until somebody
 * changed one of them. Then the app accepts a question the file drops, and
 * nothing anywhere says so.
 *
 * The format owns it because the format is the one that cannot be given it:
 * `@leela/journal` has no dependencies at all, on purpose, so that a browser
 * bundle and a Bun process can both hold it.
 */
import { MAX_INTENTION_CHARS } from '@leela/journal';
export { MAX_INTENTION_CHARS };

/**
 * What the player is playing for.
 *
 * The published app asks before it lets anyone near the board —
 * `if (!prof.intention) navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true })`
 * — and keeps it on the profile, where it can be changed later. The column
 * exists in this repository's own schema (`players.intention`) and no surface
 * had ever asked for one.
 *
 * In Leela the intention is not a profile field. It is the question the game is
 * being played to answer, and the reports are the answer accumulating. Which is
 * exactly why it cannot belong to the device: two people sharing one phone are
 * playing for two different things, and signing one player's square with the
 * other's question is the same mistake as handing them the other's journal.
 */
export function loadIntention(storage: GameStorage | undefined, playerId = 'p1'): string {
  try {
    return storage?.getItem(intentionKeyFor(playerId))?.trim() ?? '';
  } catch {
    return '';
  }
}

/** Whether this is something the game can hold. */
export function isIntention(text: string): boolean {
  const written = text.trim();
  return written.length >= MIN_INTENTION_CHARS && written.length <= MAX_INTENTION_CHARS;
}

/**
 * Keep the question, and say whether it was kept.
 *
 * The odd one out until now. Every other writer in this app answers "was it
 * kept"; this one answered "was it worth keeping", and returned `true` over a
 * store that had just refused it. One word, two questions, and a caller cannot
 * tell which it was asking — which is how a browser's refusal came to be
 * reported to the player as *"a little longer, please"*: the wrong cause, in
 * the one dialog the game will not start without.
 *
 * Validity is `isIntention`, which was exported all along. This is storage.
 */
export function saveIntention(
  storage: GameStorage | undefined,
  text: string,
  playerId = 'p1',
): boolean {
  if (!isIntention(text)) return false;
  if (!storage) return false;

  try {
    storage.setItem(intentionKeyFor(playerId), text.trim());
    return true;
  } catch {
    // A window that cannot store still plays. It is the caller's business
    // whether to say so, and it now can.
    return false;
  }
}
