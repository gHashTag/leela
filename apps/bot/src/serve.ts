/**
 * The ask route: the 3D board's companion, answered from this process.
 *
 * `apps/webgl` NOTES.md names its weak point 3 — the reflection is a prompt,
 * not an answer, because a key needs a server. This process is the server the
 * bot already runs on Railway, so the key stays here and the board asks over
 * HTTP: POST `/api/ask` with `{system, question}`, server-sent events back.
 *
 * **The contract is the client.** `askOverHttp` in `apps/webgl/src/ask.ts`
 * reads frames cut at a blank line, takes the `data:` rows, and parses one
 * JSON object per frame: `{text}` accumulates into the answer, `{thinking}` is
 * shown while the model works, `{done}` is parsed and ignored. A refusal is a
 * non-2xx status whose JSON body carries `{error}`, which the client throws as
 * `Refused` — the one failure it reports in the player's own words. The tests
 * hold this file to the client's parsing loop, ported line for line, rather
 * than to an SSE library's idea of the format.
 *
 * Every failure that can be known early is refused *before* the stream starts
 * — bounds, origin, the allowance, and the upstream connection itself. The
 * client's frame loop swallows its own in-stream `{error}` throw — the catch
 * that forgives a half-delivered frame catches the refusal too — so a status
 * and a JSON body is the one shape it reliably reports. What cannot be known
 * early is how the model's answer ends, and hiding the whole stream behind
 * `complete()` cost the page its thinking: the phone app shows the reasoning
 * while the model works, and this route showed a spinner. So a streamer, when
 * one is configured, forwards `{thinking}` and `{text}` deltas as they arrive
 * — the dev route's wire, `apps/webgl/server/ask.ts` — and accepts that a
 * failure after the first byte can only be said in-stream, where the client
 * keeps what it has already shown.
 */

import {
  ModelError,
  ModelTimeout,
  type LanguageModel,
  type Message,
} from '@leela/ai';
import type { GameState } from '@leela/engine';
import type { Report } from '@leela/journal';

import { Allowance, MAX_ASKERS } from './bot';
import { CODE_HEADER, SERVING_HEADER, runningFingerprint, servingFingerprint } from './serving';
import { decide } from './take-in';
import { whoSent } from './vouched';

/**
 * Who may ask from a browser.
 *
 * The dev route (`apps/webgl/server/ask.ts`) answers `*`, and its argument is
 * right for what it protects: no cookie, no session, no credential. This route
 * fronts a paid key on a public host, and the list is the cheapest statement
 * of who the answer is for. It does not authenticate — `Origin` is whatever a
 * non-browser chooses to send — it only keeps other people's pages from
 * spending this key out of their visitors' browsers.
 */
export const ALLOWED_ORIGINS = [
  'https://t27.ai',
  'http://localhost:5173',
  'http://localhost:4173',
];

/**
 * How large a question may be, measured in what the client actually sends.
 *
 * The board's `systemFor` builds the rules, up to 1200 chars of the plan's own
 * text and a fixed instruction — around 3K on the longest plan — so 8000 takes
 * everything the board composes with room to spare, and refuses a payload no
 * board wrote. The question carries up to ten history lines of 400 chars each
 * plus the player's words — up to ~4.2K before the player types a word, per
 * `historyFor`'s own arithmetic — so 5000 admits the client's legitimate
 * maximum, and a conversation that outgrows even that is refused with the
 * reason rather than truncated silently.
 */
export const MAX_SYSTEM_CHARS = 8000;
export const MAX_QUESTION_CHARS = 5000;

/**
 * How many questions one address may start per minute.
 *
 * Crude, and said so. The key is an address: every player behind one NAT
 * shares an allowance, an attacker with many addresses holds many, the count
 * lives in this process and a restart forgets it, and behind Railway the
 * address is read from `x-forwarded-for`, which is only as honest as the proxy
 * that wrote it. Accepted today because there is no account to bill and
 * nothing to leak — the worst a flood buys is model spend, which this bounds
 * per address and `DEFAULT_MAX_TOKENS` bounds per answer — and the spec makes
 * no auth surface, which is where a real bound would live. Four a minute is a
 * person thinking, not a loop.
 */
export const ASKS_PER_MINUTE = 4;
const ASK_MINUTE_MS = 60_000;

/**
 * How long the model may take, and why the number is under the client's.
 *
 * `askOverHttp` aborts at 180 seconds. A deadline here that outlives the
 * client's is a refusal written to a connection nobody is reading, so this one
 * comes first — and it is generous for the same measured reason the client's
 * is: this model has taken 111 seconds on one plan. Raced rather than merely
 * signalled, for the reason `guide.ts` gives at length: `LanguageModel` is a
 * surface anyone can put an SDK behind, and an SDK that ignores the signal
 * would otherwise hold this connection open forever.
 */
export const MODEL_DEADLINE_MS = 170_000;

/** Railway injects `PORT`; a laptop gets this. */
export const DEFAULT_PORT = 8788;

/**
 * A throw the rules would not allow, with the reason in the player's language.
 *
 * Distinct from a null so the board can say *it is not your turn* rather than
 * *there is no game*: the two look identical to a caller that only checks for
 * absence, and one of them is a dead end while the other is a wait.
 */
export interface Refused {
  refused: string;
}

/** One delta of a streaming answer, in the client's own vocabulary. */
export interface Streamed {
  text?: string;
  thinking?: string;
}

/**
 * A connected stream of deltas.
 *
 * A factory rather than an iterable, and awaited before the 200 is written:
 * the connection to the provider is the last failure that can still be a
 * proper status, so the factory makes it and throws it, and only what it
 * returns is pumped into the response.
 */
export type StreamAsk = (ask: {
  system: string;
  question: string;
  maxTokens: number;
  signal: AbortSignal;
}) => Promise<AsyncIterable<Streamed>>;

/**
 * What the board is told about the player's own game, and nothing more.
 *
 * Three fields because three are what a board needs to draw somebody: where
 * they stand, whether they are still outside waiting for a six, and whether
 * they have finished. Deliberately not the whole `Room`: the chat's table holds
 * other people's names and other people's positions, and a route that answers
 * "your game" must not answer with theirs.
 */
export interface Standing {
  /** The plan they are on, 1..72. */
  plan: number;
  /** True before the six that puts them on the board. */
  waiting: boolean;
  won: boolean;
  /**
   * The whole state the rules run on, so the board can BE this game rather
   * than describe it.
   *
   * `specs/009` step 4, answered 2026-08-31 with a screenshot of both surfaces
   * open at once: the chat reading *«Вы стоите на плане 6»* and the board, same
   * session, reading *41. The human plane*. The decision was **adopt**, and
   * this field is what makes adopting possible.
   *
   * Three fields were not enough and the code said so: *the route serves a
   * position, not a table, so writing it into storage would make a board that
   * claims to be the chat's game and diverges from it the moment anybody rolls
   * here.* A position cannot be played on — `consecutive_sixes` decides whether
   * a third six sends the player back, `is_finished` decides whether a six is
   * an entry or a win, and a board without them would compute a different game
   * from the same square.
   *
   * `GameState` is **the same shape both surfaces already persist** — the bot's
   * seat and the board's `KeptSeat` both hold one, field for field. That is the
   * key `specs/009` was named for not existing, and it existed at this level
   * the whole time.
   *
   * Optional so that a deployment serving the older three fields is still read
   * by a newer board rather than refused: absent means *this bot cannot give
   * you the game*, which is a different fact from *you have no game*.
   */
  state?: GameState;
  /** Whether the die is theirs to throw right now, by the session's own rule. */
  yourTurn?: boolean;
}

/**
 * One throw of the chat's die, taken on the board's behalf.
 *
 * **The board does not roll.** It asks, and the bot rolls — because the value
 * is the one thing a client must not choose. The bot's die is seeded per room
 * and advanced by `rollsTaken`, so a board that invented its own number would
 * be playing a different game from the one the chat replays.
 *
 * `roll` is the value the die showed. The board applies it with the same
 * `@leela/engine` the bot just did, over the same `GameState`, and gets the
 * same answer — which is what lets it animate the walk without a second
 * implementation of the rules deciding anything.
 */
export interface Rolled {
  /** 1..6, the face the bot's die showed. */
  roll: number;
  /** Where the player stands now, after the roll was applied and stored. */
  standing: Standing;
  /** True when this seat throws again — a six, by the session's rules. */
  rollsAgain: boolean;
}

export interface AskRouteOptions {
  /** Absent is honest: no key means 503, and the board falls back to reading the plan. */
  model?: LanguageModel;
  /**
   * Which texts this process is serving, for the header on every answer.
   *
   * A function and not a string, and injected rather than read straight from
   * `./serving`, for one reason: **`null` is a state and it has to be
   * reachable from a test.** The whole value of the guard reading this header
   * is that its absence means *cannot tell* — and a branch nothing can drive
   * is a branch nothing has shown to work. `servingFingerprint` reads a fixed
   * directory and memoises, so with no seam here the only way to exercise the
   * absence would be to delete the dataset.
   */
  serving?: () => string | null;
  /**
   * And which code, for the header beside it.
   *
   * Separate from `serving` because the two fail separately: a container can
   * hold its texts and not its source, or the reverse, and one option covering
   * both would make the guard unable to say which.
   */
  running?: () => string | null;
  /** Injected so the allowance can be tested without waiting out a minute. */
  now?: () => number;
  /** When set, answers stream as deltas; `model` stays the fallback. */
  stream?: StreamAsk;
  /**
   * The bot token, which is the key `initData` is signed with.
   *
   * Absent means this deployment cannot check who is asking, and `/api/game`
   * answers 401 to everybody rather than serving a game to a caller it cannot
   * name. Passed in, never read from the environment here: see `vouched.ts`.
   */
  token?: string;
  /**
   * One player's own game, by the id Telegram vouched for.
   *
   * Injected as a function rather than handing this file a `Storage`, so the
   * route stays a thing a test can drive with no database and no bot — which is
   * what the file's own header says it is for.
   */
  gameOf?: (userId: string) => Promise<Standing | null>;
  /**
   * Throw the chat's die for this player, apply it, and store the result.
   *
   * Injected exactly as `gameOf` is, and for the same reason: this file decides
   * who is asking and what a refusal says, and it owns no storage. The caller
   * wires it to the same `commands.roll` the `/roll` message runs, so the rules
   * have ONE implementation and the two surfaces cannot drift apart on a third
   * six.
   *
   * `null` for a player with no game here. A rule that forbids the throw — not
   * their turn, a report owed first — is a `Refused`, because *you may not*
   * carries a reason a player can act on and *nothing happened* does not.
   */
  rollFor?: (userId: string) => Promise<Rolled | Refused | null>;
  /**
   * A player's own path, read and added to.
   *
   * `specs/001-shared-reports` P1: *what I wrote should be one path, wherever I
   * wrote it.* The bot has kept reports per player since it was written and the
   * mini app has kept them in `localStorage`; a player who used both had half a
   * path in each. The file in the mini app has been the bridge, carried by
   * hand. This is the same bridge without the carrying.
   *
   * Two functions in one object because they are one capability and a route
   * holding only half of it could read a path it cannot add to. `of` answers
   * null for a deployment that keeps nothing, which is a different thing from a
   * player with an empty path.
   */
  reports?: {
    of: (userId: string) => Promise<Report[] | null>;
    keep: (userId: string, added: readonly Report[]) => Promise<void>;
  };
}

export type AskRoute = (request: Request, address?: string) => Promise<Response>;

/**
 * Who is asking, as well as this process can tell.
 *
 * Behind Railway the socket peer is the edge proxy, and the player travels in
 * `x-forwarded-for` — first entry, since each hop appends its own. Bare of
 * both, every caller shares one allowance under one name, which throttles a
 * flood and honest players alike; better than a limiter that counts nobody.
 */
const askedBy = (request: Request, address?: string): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || address || 'everyone';
};

/**
 * What a browser is allowed to send here.
 *
 * **These two lines silently forbade `/api/game` and `/api/roll` from the day
 * each was written.** They were composed for `/api/ask` — a POST carrying JSON
 * — and were correct for it. Then `/api/game` arrived as a GET carrying
 * `authorization`, and `/api/roll` as a POST carrying the same, and neither
 * method nor header was ever added here.
 *
 * A browser answers that by refusing before it asks. `authorization` is not a
 * CORS-safelisted header, so every call preflights; the preflight came back
 * allowing `content-type` and `POST, OPTIONS`; and the board saw
 * `TypeError: Failed to fetch` — the shape that its own code reports as *the
 * bot could not be reached*. MEASURED 2026-08-31 in a real browser, with a
 * validly signed launch: the request never left.
 *
 * **Nothing in the repository could see it.** Every test drives `askRoute` as a
 * function, where there is no browser to enforce a preflight, so all of them
 * passed on a route no page could call. The route was right, the client was
 * right, and the permission between them was for a different route.
 *
 * The old comment here said *nothing here is answered to a GET*. It was true
 * when written and became false one commit later, and it is exactly the kind of
 * sentence that keeps a defect invisible: a reader checking whether GET matters
 * finds a note saying it does not.
 */
const corsFor = (origin: string): Record<string, string> => ({
  'access-control-allow-origin': origin,
  // `/api/ask` and `/api/roll` are POSTs; `/api/game` is a GET. Listing what
  // the routes actually are, rather than what the first of them was.
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  // `authorization` carries the signed launch — `tma <initData>` — which is how
  // every route but `/api/ask` knows whose game it is answering about. Without
  // it here, the browser never sends it.
  'access-control-allow-headers': 'authorization, content-type',
  // A day, so a board is not asking permission before every question. The cache
  // is the browser's own and keyed by origin. A FAILED preflight is not cached,
  // which is why this fix reaches a player who met the broken one without their
  // having to wait the day out.
  'access-control-max-age': '86400',
});

/**
 * The route itself, as a plain `Request -> Response` function.
 *
 * Separate from `serveAsk` so the tests can drive it without a socket and
 * without Bun: everything this file decides is decided here, and the server
 * below only supplies the port and the peer address.
 */
function answering({ model, stream, now = Date.now, token, gameOf, rollFor, reports }: AskRouteOptions = {}): AskRoute {
  // The same guard `/ask` in the chat stands behind, with the address where
  // the player id would be. See `Allowance` in bot.ts for why checking is
  // spending, and `MAX_ASKERS` for why the map is capped.
  const asks = new Allowance(ASKS_PER_MINUTE, ASK_MINUTE_MS, MAX_ASKERS);

  return async (request, address) => {
    const origin = request.headers.get('origin') ?? '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    // Refusals to an allowed origin carry the permission headers too: without
    // them the browser hides the body, and the client reports a network error
    // where the route had written the reason.
    const cors = allowed ? corsFor(origin) : {};

    const refuse = (status: number, error: string): Response =>
      new Response(JSON.stringify({ error }), {
        status,
        headers: { 'content-type': 'application/json', ...cors },
      });

    const path = new URL(request.url).pathname;
    if (path !== '/api/ask' && path !== '/api/game' && path !== '/api/reports' && path !== '/api/roll') {
      return refuse(404, 'no such route');
    }

    // The permission question, answered before the real one is refused. A 204
    // without the allow header is how a disallowed origin hears no at the
    // preflight rather than after the question has travelled.
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (!allowed) {
      return refuse(403, origin ? `${origin} may not ask here` : 'an origin is required to ask here');
    }

    /*
     * The player's own game, to whoever Telegram will vouch is that player.
     *
     * `specs/009`: the board and the chat were two stores with no key in
     * common, and the owner chose to make them one game — «да 3D поле везде!».
     * This is the door. Its whole security is `whoSent`, and the prior art on
     * this disk is why that is said out loud: the donor board read the user id
     * out of `initData` **in the browser** and looked the player up with it, so
     * anybody could ask for anybody's game.
     *
     * Nothing here is cached and nothing is answered to an origin that is not
     * ours, which is the same door the ask route stands behind.
     */
    if (path === '/api/game') {
      if (request.method !== 'GET') return refuse(405, 'GET only');

      const carried = request.headers.get('authorization') ?? '';
      // `tma <initData>` is Telegram's own convention for this header, and the
      // scheme name is checked so a bare token cannot be mistaken for one.
      const initData = carried.startsWith('tma ') ? carried.slice(4) : '';

      const vouched = whoSent(initData, token ?? '', { now: now() });
      // The reason travels, because a board that cannot say why it was refused
      // shows a player a blank square and no way to act.
      if (!vouched.ok) return refuse(401, vouched.why);

      if (gameOf === undefined) {
        return refuse(503, 'this deployment keeps no games to serve');
      }

      const standing = await gameOf(vouched.who.id).catch(() => null);
      if (standing === null) return refuse(404, 'no game of yours here yet');

      return new Response(JSON.stringify(standing), {
        status: 200,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }

    /*
     * One throw of the chat's die, taken on the board's behalf.
     *
     * `specs/009` step 4 — **adopt** — and this is the half that makes adoption
     * more than a prettier desynchronisation. A board that reads the chat's
     * game and then rolls its own die has two games again one throw later; the
     * only way the two stay one is for the same die to serve both.
     *
     * **The board does not send a number, it asks for one.** A roll arriving in
     * a request body is a roll the caller chose, and this route is reachable by
     * anything that can sign a launch — which is every player, for their own
     * game. So the value is the bot's: seeded per room, advanced by
     * `rollsTaken`, exactly as `/roll` in the chat advances it.
     *
     * The rules are not re-implemented here either. `rollFor` is wired in
     * `index.ts` to the same `commands.roll` the chat message runs, so a third
     * six sends a player back on both surfaces or on neither.
     *
     * POST, because it changes the game. A GET that rolls a die is a die thrown
     * by a link preview, a prefetch, or a browser restoring a tab.
     */
    if (path === '/api/roll') {
      if (request.method !== 'POST') return refuse(405, 'POST only');

      const carried = request.headers.get('authorization') ?? '';
      const initData = carried.startsWith('tma ') ? carried.slice(4) : '';

      const vouched = whoSent(initData, token ?? '', { now: now() });
      if (!vouched.ok) return refuse(401, vouched.why);

      if (rollFor === undefined) {
        return refuse(503, 'this deployment keeps no games to roll in');
      }

      const outcome = await rollFor(vouched.who.id).catch(() => null);
      if (outcome === null) return refuse(404, 'no game of yours here yet');

      // *You may not throw yet* is not *you have no game*. A board told 404 for
      // a turn that is simply somebody else's would offer the player a new game
      // instead of the wait they are actually in.
      if ('refused' in outcome) return refuse(409, outcome.refused);

      return new Response(JSON.stringify(outcome), {
        status: 200,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }

    /*
     * A player's path, arriving from the other surface.
     *
     * `specs/001-shared-reports` P1, and the last piece of it that needed no
     * decision from anybody: *what I wrote should be one path, wherever I wrote
     * it.* The mini app has been able to save a path to a file and this bot to
     * read one back since `take-in.ts`; that file was the bridge, and a player
     * had to carry it. This is the same bridge with the carrying removed.
     *
     * **The merge is not written here.** `decide` and `keep` are the same two
     * functions the file path uses, so a report arriving over HTTP and a report
     * arriving as a document are merged by one rule — the first principle, and
     * the defect this repository found two days ago when one paragraph had been
     * written out twice. In particular the union and the timestamps come free:
     * `newEntries` compares by the moment each report was WRITTEN, so sending
     * the same path twice adds nothing the second time, which is FR-002.
     *
     * FR-003 — an arriving report must not open the report gate — holds
     * structurally rather than by care taken here: the gate is
     * `reportSubmitted` on a seat in the session, and `ReportSink.record`
     * writes a report row and touches no seat.
     */
    if (path === '/api/reports') {
      if (request.method !== 'POST') return refuse(405, 'POST only');

      const carried = request.headers.get('authorization') ?? '';
      const initData = carried.startsWith('tma ') ? carried.slice(4) : '';

      const vouched = whoSent(initData, token ?? '', { now: now() });
      if (!vouched.ok) return refuse(401, vouched.why);

      if (reports === undefined) return refuse(503, 'this deployment keeps no reports');

      const document = await request.text().catch(() => null);
      if (document === null) return refuse(400, 'the body could not be read');

      // Bytes, not characters, and the same bound the file path uses: a path in
      // Devanagari costs three bytes a character, and a limit measured in
      // characters would be a different limit for every language.
      const bytes = new TextEncoder().encode(document).length;

      const existing = await reports.of(vouched.who.id).catch(() => null);
      const outcome = decide(document, bytes, existing);

      if (outcome.kind === 'too-big') return refuse(413, `${outcome.bytes} bytes is more than a path`);
      if (outcome.kind === 'unreadable') return refuse(400, 'this is not a path this bot can read');
      if (outcome.kind === 'not-kept') return refuse(503, 'this deployment keeps no reports');

      // `nothing-new` is a success and says so with a zero. Sending the same
      // path twice must be safe and boring, not an error the client has to
      // learn to ignore.
      const added = outcome.kind === 'took' ? outcome.added : [];
      if (added.length > 0) await reports.keep(vouched.who.id, added);

      return new Response(JSON.stringify({ added: added.length }), {
        status: 200,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }

    if (request.method !== 'POST') return refuse(405, 'POST only');

    // Spent at the door, before the body is read: the bound is on questions
    // *started*, and a refused one still counted. The size bound below is
    // measured only after reading, so what caps the reading itself is this.
    const wait = asks.take(askedBy(request, address), now());
    if (wait > 0) {
      return refuse(429, `asked too often; try again in ${Math.ceil(wait / 1000)}s`);
    }

    const said = (await request.json().catch(() => undefined)) as
      | { system?: unknown; question?: unknown }
      | undefined
      | null;
    if (typeof said !== 'object' || said === null) {
      return refuse(400, 'the body must be JSON: {system, question}');
    }

    const { system, question } = said;
    if (typeof system !== 'string' || typeof question !== 'string') {
      return refuse(400, 'system and question must be strings');
    }
    if (!question.trim()) return refuse(400, 'empty question');
    if (system.length > MAX_SYSTEM_CHARS) {
      return refuse(413, `system is ${system.length} chars; at most ${MAX_SYSTEM_CHARS}`);
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return refuse(413, `question is ${question.length} chars; at most ${MAX_QUESTION_CHARS}`);
    }

    // 503, not 500: the service is simply not configured here, and the board
    // falls back to reading the plan rather than blaming a model it never had.
    if (!model && !stream) return refuse(503, 'no model configured');

    const messages: Message[] = [
      { role: 'system', content: system },
      { role: 'user', content: question },
    ];

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ModelTimeout(MODEL_DEADLINE_MS));
      }, MODEL_DEADLINE_MS);
    });

    // The streaming path first: the connection is made inside the try so a
    // refused upstream is still a status, and only a connected stream is
    // pumped into a 200.
    if (stream) {
      try {
        const parts = await Promise.race([
          stream({ system, question, maxTokens: 16_000, signal: controller.signal }),
          deadline,
        ]);

        const headers = {
          ...cors,
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
        };

        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          start: async (sink) => {
            const say = (event: Record<string, unknown>): void =>
              sink.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

            // Reasoning alone is not an answer: the model spends one budget on
            // both, and a long think can leave nothing for the reply. The two
            // empty endings are told apart because an operator acts on them
            // differently - the dev route's rule, kept.
            let sawAnything = false;
            let saidAnyText = false;
            try {
              for await (const part of parts) {
                if (part.thinking) {
                  sawAnything = true;
                  say({ thinking: part.thinking });
                }
                if (part.text) {
                  sawAnything = true;
                  saidAnyText = true;
                  say({ text: part.text });
                }
              }
              if (!sawAnything) {
                say({ error: 'empty completion' });
              } else if (!saidAnyText) {
                say({ error: 'the model spent the whole budget thinking and never answered' });
              }
            } catch (error) {
              // Past the first byte a status is no longer possible; the frame
              // is what remains, and the client keeps what it already shows.
              say({ error: error instanceof Error ? error.message : String(error) });
            } finally {
              say({ done: true });
              clearTimeout(timer);
              sink.close();
            }
          },
          cancel: () => {
            // The reader hung up; stop paying for tokens nobody will see.
            controller.abort();
            clearTimeout(timer);
          },
        });

        return new Response(body, { status: 200, headers });
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof ModelTimeout) return refuse(504, error.message);
        if (error instanceof ModelError) return refuse(502, error.message);
        return refuse(502, String(error));
      }
    }

    try {
      // The default token ceiling stands: the prompt asks for a short
      // paragraph — but glm-4.6 reasons before it speaks whether or not anyone
      // asked, and the default 800-token ceiling is spent entirely on that
      // reasoning: the live probe of 2026-08-22 got back an empty `content`
      // and nothing else. 16000 is the dev route's measured price for a model
      // that thinks first; the answer itself still ends within a paragraph.
      if (!model) return refuse(503, 'no model configured');
      const answer = await Promise.race([
        model.complete(messages, { maxTokens: 16_000, signal: controller.signal }),
        deadline,
      ]);

      // One {text} frame and a {done}. `LanguageModel.complete` is a function
      // from messages to text — no token stream — so the answer arrives whole
      // and is said whole. The wire stays the streaming wire on purpose: the
      // client accumulates {text} frames without caring how many there are, so
      // a streaming model can stand here later without the page changing.
      //
      // JSON.stringify escapes every newline, so an answer carrying its own
      // blank lines cannot cut a frame short.
      const frames =
        `data: ${JSON.stringify({ text: answer })}\n\n` +
        `data: ${JSON.stringify({ done: true })}\n\n`;

      return new Response(frames, {
        status: 200,
        headers: {
          ...cors,
          'content-type': 'text/event-stream; charset=utf-8',
          // `no-transform` matters: a proxy that buffers this to be helpful
          // turns an answer back into waiting, silently.
          'cache-control': 'no-cache, no-transform',
        },
      });
    } catch (error) {
      // The order matters: a `ModelTimeout` is a `ModelError` too, and 504
      // says nothing answered where 502 says something refused.
      if (error instanceof ModelTimeout) return refuse(504, error.message);
      if (error instanceof ModelError) return refuse(502, error.message);
      return refuse(502, String(error));
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * The route, saying on the way out which texts this process is serving.
 *
 * A wrapper rather than a line in each of the fourteen places a response is
 * built. The rule *put the header on every answer* is the kind that gets
 * remembered eleven times out of fourteen, and the three it does not are the
 * three a guard then reads as **cannot tell** — which is exactly the answer
 * that stops anybody looking. One place, so there is nothing to forget.
 *
 * A refusal carries it too, and that is the point rather than an oversight:
 * the guard asks with an `OPTIONS` preflight, which is answered `204` before
 * any question is read, costs the model nothing and sends nobody a message.
 * A fingerprint only a successful answer carried could not be read without
 * spending a question.
 */
export function askRoute({
  serving = servingFingerprint,
  running = runningFingerprint,
  ...options
}: AskRouteOptions = {}): AskRoute {
  const answer = answering(options);

  /**
   * A reader's answer, or `null` however it failed.
   *
   * A throw is the same fact as a `null`: this process cannot say. It must not
   * be the same fact as *the bot is down*. The header is a diagnostic, and a
   * diagnostic that can fail the answer it is attached to has made the
   * deployment less reliable than not measuring it — which is what
   * `audit-promises.mjs` asks of every injected dependency, and it asked of
   * the first of these before any player did.
   *
   * One helper for both, so the second reader cannot be added without the
   * protection the first has. That is not hypothetical care: the second reader
   * exists *because* the first one measured less than the sentence about it
   * claimed, and the way that happened was one being written after the other.
   */
  const said = (reader: () => string | null): string | null => {
    try {
      return reader();
    } catch {
      return null;
    }
  };

  return async (request, address) => {
    const response = await answer(request, address);

    // Absent when the bot cannot read its own files: a missing header is a
    // third state, and writing "unknown" into it would turn that state into a
    // string somebody compares. Each is absent on its own, so a guard can say
    // which half it could not establish.
    const texts = said(serving);
    if (texts !== null) response.headers.set(SERVING_HEADER, texts);

    const code = said(running);
    if (code !== null) response.headers.set(CODE_HEADER, code);

    return response;
  };
}

/**
 * What `Bun.serve` is, to a package typed against Node.
 *
 * This workspace compiles with `types: ["node"]` and runs under bun; pulling
 * `bun-types` in for one call would put two disagreeing globals under every
 * file. The shape used is written out instead, and it is three members long.
 */
interface BunServer {
  port: number;
  stop(): void;
  requestIP(request: Request): { address: string } | null;
}

interface BunLike {
  serve(options: {
    port: number;
    idleTimeout: number;
    fetch: (request: Request, server: BunServer) => Promise<Response>;
  }): BunServer;
}

export interface ServeAskOptions extends AskRouteOptions {
  /** Defaults to `PORT` from the environment, then `DEFAULT_PORT`. */
  port?: number;
  log?: (line: string) => void;
}

/** The route on a socket. All the deciding is `askRoute`'s; this adds a port. */
export function serveAsk({ port, log = console.log, ...options }: ServeAskOptions = {}): BunServer {
  const bun = (globalThis as { Bun?: BunLike }).Bun;
  if (!bun) {
    // Refuse at startup rather than 404 at the first question: a process this
    // route is missing from looks healthy until the board asks.
    throw new Error('the ask route serves through Bun.serve; run under bun, or mount askRoute() yourself');
  }

  const wanted = port ?? Number(process.env.PORT);
  const handle = askRoute(options);
  const listening = {
    port: Number.isFinite(wanted) ? wanted : DEFAULT_PORT,
    // Bun closes a connection that is quiet for ten seconds by default, and a
    // question is quiet for as long as the model thinks. 255 seconds is the
    // most Bun accepts.
    idleTimeout: 255,
    fetch: (request: Request, at: BunServer) => handle(request, at.requestIP(request)?.address),
  };

  // The deadline must speak before Bun hangs up, or the refusal is written to
  // a socket already closed. A constant relationship, but checked where the
  // two numbers meet rather than promised in two comments that can drift.
  if (MODEL_DEADLINE_MS >= listening.idleTimeout * 1000) {
    throw new Error('MODEL_DEADLINE_MS must stay under the idle timeout, or refusals go unread');
  }

  const server = bun.serve(listening);
  log(`Answering /api/ask on port ${server.port} for ${ALLOWED_ORIGINS.join(', ')}.`);
  return server;
}
