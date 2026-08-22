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
 * Every failure here is refused *before* the stream starts. The client's frame
 * loop swallows its own in-stream `{error}` throw — the catch that forgives a
 * half-delivered frame catches the refusal too — so anything said mid-stream
 * reads as an empty answer, the offline fallback, and the reason is lost. A
 * status and a JSON body is the one shape the client reliably reports, and the
 * model is asked to finish before a single byte of the 200 is written.
 */

import {
  ModelError,
  ModelTimeout,
  type LanguageModel,
  type Message,
} from '@leela/ai';
import { Allowance, MAX_ASKERS } from './bot';

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

export interface AskRouteOptions {
  /** Absent is honest: no key means 503, and the board falls back to reading the plan. */
  model?: LanguageModel;
  /** Injected so the allowance can be tested without waiting out a minute. */
  now?: () => number;
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

const corsFor = (origin: string): Record<string, string> => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  // A day, so a board is not asking permission before every question. The
  // preflight cache this feeds is the browser's own, which is keyed by origin
  // already; nothing here is answered to a GET, so no shared cache holds it.
  'access-control-max-age': '86400',
});

/**
 * The route itself, as a plain `Request -> Response` function.
 *
 * Separate from `serveAsk` so the tests can drive it without a socket and
 * without Bun: everything this file decides is decided here, and the server
 * below only supplies the port and the peer address.
 */
export function askRoute({ model, now = Date.now }: AskRouteOptions = {}): AskRoute {
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

    if (new URL(request.url).pathname !== '/api/ask') return refuse(404, 'no such route');

    // The permission question, answered before the real one is refused. A 204
    // without the allow header is how a disallowed origin hears no at the
    // preflight rather than after the question has travelled.
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (!allowed) {
      return refuse(403, origin ? `${origin} may not ask here` : 'an origin is required to ask here');
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
    if (!model) return refuse(503, 'no model configured');

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

    try {
      // The default token ceiling stands: the prompt asks for a short
      // paragraph — but glm-4.6 reasons before it speaks whether or not anyone
      // asked, and the default 800-token ceiling is spent entirely on that
      // reasoning: the live probe of 2026-08-22 got back an empty `content`
      // and nothing else. 16000 is the dev route's measured price for a model
      // that thinks first; the answer itself still ends within a paragraph.
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
