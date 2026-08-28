import { toDocument, type Report } from '@leela/journal';

/**
 * The board's own path, offered to the bot.
 *
 * The other end of the wire `apps/bot/src/serve.ts` opened: `POST /api/reports`
 * takes the document this game already knows how to write and merges it into
 * the player's path in the chat. `specs/001-shared-reports` P1 — *what I wrote
 * should be one path, wherever I wrote it* — and the file the mini app saves
 * has been that bridge, carried by hand, since `take-in.ts`.
 *
 * **This needs none of the decision `specs/009` step 4 is waiting on.** That
 * question is about the GAME: a player with a game in the browser and a game in
 * the chat, and which of the two wins. A path is not a game. The merge is a
 * union keyed on when each report was written, so nothing is replaced, nothing
 * is chosen between, and sending the same path twice adds nothing the second
 * time — which the bot's own tests assert and which was proved against
 * production. There is no conflict here to have an opinion about.
 *
 * Everything is a shape and nothing throws, for the reason `mine.ts` gives: a
 * board that fails to sync should be a board, not a black screen.
 */

/** What offering the path produced. */
export type Sent =
  | { kind: 'sent'; added: number }
  /** Nothing written here yet, so nothing to offer. Not a failure. */
  | { kind: 'nothing-to-send' }
  | { kind: 'unasked'; why: string };

/** The same bound the reader uses; a board must draw whatever the network does. */
export const SEND_TIMEOUT_MS = 8_000;

/**
 * Where the bot takes a path.
 *
 * The same rule `gameUrl` and `askUrl` follow — relative in a browser, and
 * appended to `window.__leelaAsk` where a host names the origin.
 */
export const reportsUrl = (): string => {
  const base = (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
  return typeof base === 'string' && base !== ''
    ? `${base.replace(/\/+$/, '')}/api/reports`
    : '/api/reports';
};

/**
 * Offer this board's writings to the chat.
 *
 * `entries` comes from `readAll`, which is what the board already keeps. The
 * document is built by `@leela/journal`'s own writer rather than assembled
 * here, so the two surfaces cannot describe a path differently — the bot reads
 * it with that package's reader.
 */
export async function sendMyPath({
  initData,
  entries,
  fetch: send,
  timeoutMs = SEND_TIMEOUT_MS,
}: {
  initData: string;
  entries: readonly Report[];
  fetch: typeof globalThis.fetch;
  timeoutMs?: number;
}): Promise<Sent> {
  if (initData === '') return { kind: 'unasked', why: 'this board was not opened from Telegram' };
  // Asked before anything is sent: an empty path is a POST that can only ever
  // answer zero, and a phone should not spend a request on it.
  if (entries.length === 0) return { kind: 'nothing-to-send' };

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);

  try {
    const answer = await send(reportsUrl(), {
      method: 'POST',
      headers: { authorization: `tma ${initData}`, 'content-type': 'application/json' },
      body: JSON.stringify(toDocument(entries)),
      signal: stop.signal,
    });

    if (answer.status !== 200) return { kind: 'unasked', why: `the bot answered ${answer.status}` };

    const said = (await answer.json().catch(() => null)) as { added?: unknown } | null;
    return typeof said?.added === 'number'
      ? { kind: 'sent', added: said.added }
      : { kind: 'unasked', why: 'the bot answered something this board cannot read' };
  } catch (error) {
    return {
      kind: 'unasked',
      why:
        error instanceof Error && error.name === 'AbortError'
          ? 'the bot did not answer in time'
          : 'the bot could not be reached',
    };
  } finally {
    clearTimeout(timer);
  }
}
