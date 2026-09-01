/**
 * Where the chat says this player stands.
 *
 * `specs/009` found the board and the bot keeping two games with no key in
 * common, and the owner settled it on 2026-08-28: *«да 3D поле везде!»* — one
 * game, and the 3D board is the board. The bot now serves a player their own
 * position at `GET /api/game`, behind a signature it checks
 * (`apps/bot/src/vouched.ts`). This is the half that asks.
 *
 * **Step 4 was answered on 2026-08-31: ADOPT** — settled by a screenshot of
 * both surfaces open at once, the chat reading *«Вы стоите на плане 6»* and the
 * board, same session, *41. The human plane*.
 *
 * So this file now asks two things rather than one. `myGame` reads the game —
 * the WHOLE state, because a position cannot be played on — and `askForARoll`
 * asks the bot to throw. **The board does not roll.** The value is the one
 * thing a client must not choose, and the bot's die is seeded per room and
 * advanced by `rollsTaken`; a board inventing its own number would be replaying
 * a different game from the chat's.
 *
 * What the board still does is the walking. Both surfaces run the same
 * `@leela/engine` over the same `GameState`, so applying the bot's value here
 * gives the answer the bot already computed — which is how the token can walk
 * and the die can spin without a second implementation of the rules deciding
 * anything.
 *
 * Everything that can fail is a shape, never a throw: the board runs inside
 * somebody else's webview, on a phone, with the network the player happens to
 * have. A companion line that does not appear is a disappointment; an exception
 * on the boot path is a black screen.
 */

import { isLanguage, type Language } from '@leela/content';
import type { GameState } from '@leela/engine';

/** What the bot will say about one player, and no more. */
export interface Standing {
  plan: number;
  waiting: boolean;
  won: boolean;
  /** The language of the active Telegram room, when the bot can name it. */
  language?: Language;
  /**
   * The whole state the rules run on — `specs/009` step 4.
   *
   * Optional, and read as *this bot cannot give you the game* when absent
   * rather than as an error: a deployment still serving the older three fields
   * must be understood by a newer board, and the board falls back to showing
   * what the chat holds instead of playing it. **A missing field is a different
   * fact from a refusal**, and collapsing them is how a surface tells a player
   * their game is gone because a deploy is a few minutes behind.
   */
  state?: GameState;
  yourTurn?: boolean;
  moved?: number;
  entitled?: boolean;
  canSubscribe?: boolean;
}

/** What one throw of the chat's die produced. */
export interface Rolled {
  roll: number;
  standing: Standing;
  rollsAgain: boolean;
}

/**
 * What asking for a throw produced.
 *
 * `refused` is its own answer and not an error: *it is not your turn* and
 * *write what this plan brings up first* are things a player can act on, and
 * they arrive in the player's own language because the bot composed them.
 */
export type TransportFailure =
  | 'outside-telegram'
  | 'unauthorized'
  | 'forbidden'
  | 'unavailable'
  | 'unreadable'
  | 'timeout'
  | 'unreachable';

export type Throw =
  | { kind: 'rolled'; rolled: Rolled }
  | { kind: 'refused'; why: string }
  | { kind: 'unasked'; reason: TransportFailure };

/**
 * What asking produced.
 *
 * Three answers rather than two, for the reason this repository keeps
 * relearning: *no game* and *could not ask* are different facts, and a surface
 * that shows the same thing for both tells the player their chat game is gone
 * when the wifi dropped.
 */
export type Mine =
  | { kind: 'standing'; standing: Standing }
  | { kind: 'none' }
  | { kind: 'unasked'; reason: TransportFailure };

/** How long to wait before the board gets on with drawing itself. */
export const ASK_TIMEOUT_MS = 8_000;

/**
 * The url the bot serves games on.
 *
 * Built the way `askUrl` builds its own, and for the reason given there: the
 * page and the route share an origin in a browser, and a host that loads this
 * page from somewhere else names the origin on `window.__leelaAsk`. One
 * spelling of that rule would be better than two; it is two because `ask.ts`
 * appends its own path to the same base, and a shared helper that took the path
 * as an argument would be a third thing to keep in step for no gain.
 */
export const gameUrl = (): string => routeUrl('/api/game');

/** The url the bot throws its die on. */
export const rollUrl = (): string => routeUrl('/api/roll');

const routeUrl = (path: string): string => {
  const base = (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
  return typeof base === 'string' && base !== '' ? `${base.replace(/\/+$/, '')}${path}` : path;
};

/**
 * Whether a value is a state the engine could be handed.
 *
 * Every field checked, because this arrives over a network and a board that
 * trusts a partial one computes a different game from a square that looks
 * right. A state that is not a state is dropped and the standing keeps its
 * three fields — the board then SHOWS the chat's game instead of playing it,
 * which is the older behaviour and a safe floor.
 */
const stateIn = (value: unknown): GameState | null => {
  if (typeof value !== 'object' || value === null) return null;

  const held = value as Record<string, unknown>;
  const numbers = ['loka', 'previous_loka', 'consecutive_sixes', 'position_before_three_sixes'];
  for (const key of numbers) {
    if (typeof held[key] !== 'number' || !Number.isFinite(held[key])) return null;
  }
  if (typeof held.is_finished !== 'boolean') return null;
  if (typeof held.direction !== 'string') return null;

  return held as unknown as GameState;
};

/** Whether a body is the shape the route documents. */
const standingIn = (value: unknown): Standing | null => {
  if (typeof value !== 'object' || value === null) return null;

  const held = value as {
    plan?: unknown;
    waiting?: unknown;
    won?: unknown;
    state?: unknown;
    yourTurn?: unknown;
    moved?: unknown;
    entitled?: unknown;
    canSubscribe?: unknown;
    language?: unknown;
  };
  if (typeof held.plan !== 'number' || !Number.isFinite(held.plan)) return null;
  if (typeof held.waiting !== 'boolean' || typeof held.won !== 'boolean') return null;

  const state = stateIn(held.state);

  return {
    plan: held.plan,
    waiting: held.waiting,
    won: held.won,
    ...(typeof held.language === 'string' && isLanguage(held.language) ? { language: held.language } : {}),
    ...(state === null ? {} : { state }),
    ...(typeof held.yourTurn === 'boolean' ? { yourTurn: held.yourTurn } : {}),
    ...(typeof held.moved === 'number' && Number.isFinite(held.moved) ? { moved: held.moved } : {}),
    ...(typeof held.entitled === 'boolean' ? { entitled: held.entitled } : {}),
    ...(typeof held.canSubscribe === 'boolean' ? { canSubscribe: held.canSubscribe } : {}),
  };
};

/** Whether a body is one throw, as the route documents it. */
const rolledIn = (value: unknown): Rolled | null => {
  if (typeof value !== 'object' || value === null) return null;

  const held = value as { roll?: unknown; standing?: unknown; rollsAgain?: unknown };
  // 1..6 and nothing else. A face this board cannot draw is a face it must not
  // walk on, and `0` is what the route answers when it found no move event —
  // a shape that means *something went wrong*, not *the die showed nothing*.
  if (typeof held.roll !== 'number' || !Number.isInteger(held.roll) || held.roll < 1 || held.roll > 6) return null;
  if (typeof held.rollsAgain !== 'boolean') return null;

  const standing = standingIn(held.standing);
  return standing === null ? null : { roll: held.roll, standing, rollsAgain: held.rollsAgain };
};

/**
 * Ask the bot where this player stands, if there is anybody to ask about.
 *
 * `initData` empty is a plain browser — nobody is signed in, and there is
 * nothing to ask. That is `unasked`, not `none`: the board outside Telegram has
 * not learned that the player has no chat game, it has learned nothing.
 *
 * `fetch` and the clock are passed in because this is the one file here that
 * talks to a server, and a test that needs a server is a test nobody runs.
 */
export async function myGame({
  initData,
  fetch: get,
  timeoutMs = ASK_TIMEOUT_MS,
}: {
  initData: string;
  fetch: typeof globalThis.fetch;
  timeoutMs?: number;
}): Promise<Mine> {
  if (initData === '') return { kind: 'unasked', reason: 'outside-telegram' };

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);

  try {
    const answer = await get(gameUrl(), {
      headers: { authorization: `tma ${initData}` },
      signal: stop.signal,
    });

    // A player with no table is the route's 404 and is a real answer about
    // them. Everything else — 401, 503, a proxy's 502 — is this board failing
    // to ask, and must not be shown as "you have no game".
    if (answer.status === 404) return { kind: 'none' };
    if (answer.status !== 200) {
      return {
        kind: 'unasked',
        reason: answer.status === 401 ? 'unauthorized' : answer.status === 403 ? 'forbidden' : 'unavailable',
      };
    }

    const standing = standingIn(await answer.json().catch(() => null));
    return standing === null
      ? { kind: 'unasked', reason: 'unreadable' }
      : { kind: 'standing', standing };
  } catch (error) {
    return {
      kind: 'unasked',
      reason: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the chat's die to turn, for this player.
 *
 * **Nothing is sent but the signature.** A roll in the body would be a roll the
 * player chose, and every player can sign a launch for their own game — so the
 * request is a bare POST and the value comes back.
 *
 * Three answers again, and the middle one is the reason this is not a boolean:
 * a throw the rules forbid — not your turn, a reflection owed first — is a
 * `refused` carrying the bot's own sentence in the player's own language, which
 * a board can show. Folding it into `unasked` would tell a waiting player their
 * bot could not be reached, and folding it into an error would tell them
 * nothing at all.
 */
export async function askForARoll({
  initData,
  fetch: post,
  timeoutMs = ASK_TIMEOUT_MS,
}: {
  initData: string;
  fetch: typeof globalThis.fetch;
  timeoutMs?: number;
}): Promise<Throw> {
  if (initData === '') return { kind: 'unasked', reason: 'outside-telegram' };

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);

  try {
    const answer = await post(rollUrl(), {
      method: 'POST',
      headers: { authorization: `tma ${initData}` },
      signal: stop.signal,
    });

    if (answer.status === 409) {
      const said = (await answer.json().catch(() => null)) as { error?: unknown } | null;
      return typeof said?.error === 'string' && said.error.trim() !== ''
        ? { kind: 'refused', why: said.error }
        : { kind: 'unasked', reason: 'unreadable' };
    }
    if (answer.status !== 200) {
      return {
        kind: 'unasked',
        reason: answer.status === 401 ? 'unauthorized' : answer.status === 403 ? 'forbidden' : 'unavailable',
      };
    }

    const rolled = rolledIn(await answer.json().catch(() => null));
    return rolled === null
      ? { kind: 'unasked', reason: 'unreadable' }
      : { kind: 'rolled', rolled };
  } catch (error) {
    return {
      kind: 'unasked',
      reason:
        error instanceof Error && error.name === 'AbortError'
          ? 'timeout'
          : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}
