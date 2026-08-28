/**
 * Where the chat says this player stands.
 *
 * `specs/009` found the board and the bot keeping two games with no key in
 * common, and the owner settled it on 2026-08-28: *«да 3D поле везде!»* — one
 * game, and the 3D board is the board. The bot now serves a player their own
 * position at `GET /api/game`, behind a signature it checks
 * (`apps/bot/src/vouched.ts`). This is the half that asks.
 *
 * **It asks and it shows. It does not adopt, and that is deliberate.** The
 * route answers a snapshot — the plan, and whether the player is waiting or has
 * won — not the table. Writing that into `leela.webgl.game` would produce a
 * board that claims to be the chat's game and then diverges from it the moment
 * anybody rolls here, because nothing writes back yet. The spec's step 4 is the
 * question that decides what should happen to a game already in this browser,
 * and it is the owner's to answer; until he does, this surface tells the player
 * what the chat holds and changes nothing.
 *
 * Everything that can fail is a shape, never a throw: the board runs inside
 * somebody else's webview, on a phone, with the network the player happens to
 * have. A companion line that does not appear is a disappointment; an exception
 * on the boot path is a black screen.
 */

/** What the bot will say about one player, and no more. */
export interface Standing {
  plan: number;
  waiting: boolean;
  won: boolean;
}

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
  | { kind: 'unasked'; why: string };

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
export const gameUrl = (): string => {
  const base = (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
  return typeof base === 'string' && base !== ''
    ? `${base.replace(/\/+$/, '')}/api/game`
    : '/api/game';
};

/** Whether a body is the shape the route documents. */
const standingIn = (value: unknown): Standing | null => {
  if (typeof value !== 'object' || value === null) return null;

  const held = value as { plan?: unknown; waiting?: unknown; won?: unknown };
  if (typeof held.plan !== 'number' || !Number.isFinite(held.plan)) return null;
  if (typeof held.waiting !== 'boolean' || typeof held.won !== 'boolean') return null;

  return { plan: held.plan, waiting: held.waiting, won: held.won };
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
  if (initData === '') return { kind: 'unasked', why: 'this board was not opened from Telegram' };

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
    if (answer.status !== 200) return { kind: 'unasked', why: `the bot answered ${answer.status}` };

    const standing = standingIn(await answer.json().catch(() => null));
    return standing === null
      ? { kind: 'unasked', why: 'the bot answered something this board cannot read' }
      : { kind: 'standing', standing };
  } catch (error) {
    return {
      kind: 'unasked',
      why: error instanceof Error && error.name === 'AbortError' ? 'the bot did not answer in time' : 'the bot could not be reached',
    };
  } finally {
    clearTimeout(timer);
  }
}
