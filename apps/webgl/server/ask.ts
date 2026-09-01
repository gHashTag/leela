import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * The route the board asks, in one place, for every host that serves it.
 *
 * It lived inside `vite.config.ts`, which meant it existed only where Vite was
 * running - a developer's laptop. The app now ships the board in its own bundle
 * and has nowhere to send a question, so the same handler has to be able to run
 * as an ordinary server too. Moved rather than copied: two implementations of
 * one route agree on the day they are written and drift from the first change
 * after it, and this one holds the key handling.
 *
 * `Ask` in `companion.ts` deliberately takes no API key: a key in a static page
 * is readable by anyone who opens the source, so the browser never holds one.
 * This is the other half - the key lives in this process and never reaches the
 * bundle.
 *
 * Absent key is not an error. The companion treats no answer as its supported
 * offline mode and says so on screen, which is better than a page that refuses
 * to load because a secret is missing.
 */

const ZAI_CODING = 'https://api.z.ai/api/coding/paas/v4';
const ZAI_DEFAULT = 'https://api.z.ai/api/paas/v4';
const MODEL = 'glm-4.6';

/** Coding-plan keys are rejected by the default host, and the reverse. */
const baseUrl = (): string =>
  (process.env.ZAI_PLAN ?? '').trim() === 'coding' ? ZAI_CODING : ZAI_DEFAULT;

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

/**
 * Let a page that is not on this origin ask.
 *
 * The app loads the board from the phone's own filesystem, so its origin is
 * `file://` — which the fetch specification reports as the string `null`, and
 * which matches no allow-list. A POST carrying `content-type: application/json`
 * is not a simple request, so the browser sends `OPTIONS` first; this route
 * answered `405 POST only` and the question never left the phone. The board
 * showed nothing at all, because a preflight failure is not an error the page
 * gets to see.
 *
 * `*` rather than an origin list: there is nothing to protect here by origin.
 * No cookie, no session and no credential is involved — the key lives on this
 * side and is never sent to the page — so an allow-list would only be a list of
 * every host the board might one day be opened from.
 */
const allowCrossOrigin = (res: ServerResponse): void => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  // A day, so a phone is not asking permission before every question.
  res.setHeader('access-control-max-age', '86400');
};

const send = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  allowCrossOrigin(res);
  res.end(JSON.stringify(body));
};

export const askHandler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> => {
    if (!req.url?.startsWith('/api/ask')) return next();

    // The permission question, answered before the real one is refused.
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      allowCrossOrigin(res);
      res.end();
      return;
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

    /*
     * Three names, because this repository already uses two of them.
     *
     * `apps/bot/.env` carries the same provider's key as `ZAI_API_KEY`, and
     * this route read only `ZAI_KEY` - so a machine that had the key had it
     * under a name the board did not look for, and the companion was offline
     * on a laptop where the bot was answering fine.
     */
    const key = (
      process.env.ZAI_KEY ??
      process.env.ZAI_API_KEY ??
      process.env.OPEN_AI_KEY ??
      ''
    ).trim();
    if (!key) {
      // 503, not 500: the service is simply not configured here, and the page
      // falls back to reading the plan rather than showing an error.
      return send(res, 503, { error: 'no model configured' });
    }

    try {
      const { system, question } = JSON.parse(await readBody(req)) as {
        system?: string;
        question?: string;
      };
      if (!question?.trim()) return send(res, 400, { error: 'empty question' });

      const upstream = await fetch(`${baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.ZAI_MODEL ?? MODEL,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: question },
          ],
          /*
           * Room for the thinking *and* the answer.
           *
           * This was 1200, and with `thinking` enabled the reasoning is spent
           * from the same budget: measured against this model, a question about
           * one plan produced 11,227 characters of reasoning, `finish_reason:
           * length`, and an answer of exactly nothing. The companion then said
           * it was unavailable, which was true and useless - the model had been
           * reached, had thought at length, and was cut off before it spoke.
           *
           * At 6000 the same question finished on `stop` once - 7,198
           * characters of reasoning, an answer of 1,828 - and on a second run
           * thought for 21,234 and again answered nothing. The length of a
           * think is not something this model can be asked for, so the budget
           * has to be large enough that a long one still leaves room to speak.
           */
          max_tokens: 16000,
          temperature: 0.6,
          // Streamed, so the page can show the answer forming rather than a
          // spinner for twenty seconds. `thinking` asks the model for its
          // reasoning as a separate field; the page shows it while it works and
          // drops it when the answer arrives.
          stream: true,
          thinking: { type: 'enabled' },
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const detail = upstream.ok ? 'no body' : await upstream.text();
        return send(res, 502, { error: `upstream ${upstream.status}`, detail });
      }

      // Server-sent events, forwarded as they arrive. `no-transform` matters:
      // a proxy that buffers this to be helpful turns streaming back into
      // waiting, silently.
      res.statusCode = 200;
      // The streaming answer needs the same permission the refusals get: this
      // is the response the app actually reads.
      allowCrossOrigin(res);
      res.setHeader('content-type', 'text/event-stream; charset=utf-8');
      res.setHeader('cache-control', 'no-cache, no-transform');
      res.setHeader('connection', 'keep-alive');
      res.flushHeaders?.();

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sawAnything = false;
      // Reasoning alone is not an answer: this model spends `max_tokens` on
      // both, and a long think can leave nothing for the reply.
      let saidAnyText = false;

      // The client hanging up mid-answer must stop the upstream read, or the
      // key keeps paying for tokens nobody will see.
      let closed = false;
      req.on('close', () => {
        closed = true;
        void reader.cancel().catch(() => {});
      });

      const say = (event: Record<string, unknown>): void => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line; a partial one waits for more.
        let cut = buffer.indexOf('\n\n');
        while (cut !== -1) {
          const frame = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          cut = buffer.indexOf('\n\n');

          const data = frame
            .split('\n')
            .filter((row) => row.startsWith('data:'))
            .map((row) => row.slice(5).trim())
            .join('');

          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string; reasoning_content?: string };
              }>;
            };
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.reasoning_content) {
              sawAnything = true;
              say({ thinking: delta.reasoning_content });
            }
            if (delta?.content) {
              sawAnything = true;
              saidAnyText = true;
              say({ text: delta.content });
            }
          } catch {
            // A half-delivered frame is not an error; the next read completes it.
          }
        }
      }

      // An empty completion is not an answer. Saying so lets the companion use
      // its fallback instead of leaving an empty bubble on screen - and saying
      // *which* empty tells whoever reads the note whether the model refused or
      // simply ran out of room mid-thought.
      if (!sawAnything) {
        say({ error: 'empty completion' });
      } else if (!saidAnyText) {
        say({ error: 'the model spent the whole budget thinking and never answered' });
      }
      say({ done: true });
      res.end();
      return;
    } catch (error) {
      return send(res, 502, { error: String(error) });
    }
  };
