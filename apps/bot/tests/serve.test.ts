/**
 * The ask route, held to the client that reads it.
 *
 * The contract is not "valid SSE"; it is `askOverHttp` in
 * `apps/webgl/src/ask.ts`, whose parsing loop is ported below rather than
 * paraphrased. Two of its properties are load-bearing and easy to lose in a
 * paraphrase: a frame that does not parse is *skipped*, and its in-stream
 * `{error}` throw is swallowed by the same catch that forgives a half-delivered
 * frame — so nothing said mid-stream can refuse, and every refusal the route
 * makes must be an HTTP status with a JSON `{error}` body, made before the
 * stream begins. The tests assert that shape on every refusal.
 */

import { describe, expect, it, vi } from 'vitest';
import { ModelError, fixedModel, recordingModel, type LanguageModel } from '@leela/ai';
import {
  ALLOWED_ORIGINS,
  ASKS_PER_MINUTE,
  MAX_QUESTION_CHARS,
  MAX_SYSTEM_CHARS,
  MODEL_DEADLINE_MS,
  askRoute,
} from '../src/serve';

const ROUTE = 'http://leela.test/api/ask';
const HOME = 'https://t27.ai';

/** A question as the board sends one: JSON body, `origin` on the request. */
function asked(
  body: unknown,
  { origin = HOME, headers = {} as Record<string, string> } = {},
): Request {
  return new Request(ROUTE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(origin ? { origin } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** What a refusal must look like to reach the player as `Refused(error)`. */
async function refusal(response: Response): Promise<string> {
  const said = (await response.json()) as { error?: string };
  expect(said.error, 'a refusal names its reason').toBeTruthy();
  return said.error as string;
}

/**
 * The board's reading of the wire, ported from `askOverHttp`: bytes joined
 * across reads, frames cut at the blank line, `data:` rows sliced at 5 and
 * trimmed and joined, one JSON object per frame, `{text}` accumulated and the
 * whole trimmed at the end. The catch swallows everything, as the client's
 * does — including the `{error}` throw, which is why the route never relies
 * on an in-stream error.
 */
function boardReads(chunks: readonly Uint8Array[]): { answer: string; thinking: string[] } {
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  const thinking: string[] = [];

  for (const value of chunks) {
    buffer += decoder.decode(value, { stream: true });

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
      if (!data) continue;

      try {
        const event = JSON.parse(data) as {
          text?: string;
          thinking?: string;
          error?: string;
          done?: boolean;
        };
        if (event.error) throw new Error(event.error);
        if (event.thinking) thinking.push(event.thinking);
        if (event.text) answer += event.text;
      } catch {
        // A half-delivered frame is not an error; the next read completes it.
      }
    }
  }

  return { answer: answer.trim(), thinking };
}

describe('the wire the board reads', () => {
  // Hostile on purpose: its own blank line, which cuts frames; a literal
  // `data:` inside the text; and a multi-byte die for the boundary sweep.
  const REPLY = 'Sit with what you met on plan 12.\n\ndata: is just a word here. 🎲 Throw the die.';

  it('answers with exactly the frames the client parses', async () => {
    const handle = askRoute({ model: fixedModel(REPLY) });
    const response = await handle(asked({ system: 'be brief', question: 'what now?' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('access-control-allow-origin')).toBe(HOME);
    // A proxy that buffers "helpfully" turns an answer back into waiting.
    expect(response.headers.get('cache-control')).toContain('no-transform');

    // The exact bytes, not a shape: one JSON object per `data:` row, `{text}`
    // then `{done: true}`, a blank line closing each frame. This is the whole
    // wire format the client knows.
    expect(await response.text()).toBe(
      `data: ${JSON.stringify({ text: REPLY })}\n\n` +
        `data: ${JSON.stringify({ done: true })}\n\n`,
    );
  });

  it('is read back whole by the client algorithm, wherever the network cuts it', async () => {
    const handle = askRoute({ model: fixedModel(REPLY) });
    const response = await handle(asked({ system: 's', question: 'q' }));
    const bytes = new Uint8Array(await response.arrayBuffer());

    // Every split point once, including mid-frame and inside the multi-byte
    // die. A chunk boundary is the network's choice, and the parser owes the
    // same answer at all of them.
    for (let cut = 0; cut <= bytes.length; cut++) {
      const { answer } = boardReads([bytes.slice(0, cut), bytes.slice(cut)]);
      expect(answer, `cut at byte ${cut}`).toBe(REPLY);
    }
  });

  it('hands the model the system and the question, in that order', async () => {
    const model = recordingModel('noted');
    const handle = askRoute({ model });

    await handle(asked({ system: 'THE RULES OF THIS BOARD: ...', question: 'Player now says: hi' }));

    expect(model.calls).toHaveLength(1);
    expect(model.calls[0]?.messages).toEqual([
      { role: 'system', content: 'THE RULES OF THIS BOARD: ...' },
      { role: 'user', content: 'Player now says: hi' },
    ]);
  });
});

describe('a streaming answerer', () => {
  /** Deltas as the Z.AI streamer yields them, from a list. */
  const streamOf =
    (parts: ReadonlyArray<{ text?: string; thinking?: string }>) => async () =>
      (async function* () {
        yield* parts;
      })();

  it('forwards thinking and text deltas in order, then done', async () => {
    const handle = askRoute({
      stream: streamOf([{ thinking: 'weigh ' }, { thinking: 'the plan' }, { text: 'Sit. ' }, { text: 'Throw.' }]),
    });
    const response = await handle(asked({ system: 's', question: 'q' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('access-control-allow-origin')).toBe(HOME);
    expect(response.headers.get('cache-control')).toContain('no-transform');

    expect(await response.text()).toBe(
      `data: ${JSON.stringify({ thinking: 'weigh ' })}\n\n` +
        `data: ${JSON.stringify({ thinking: 'the plan' })}\n\n` +
        `data: ${JSON.stringify({ text: 'Sit. ' })}\n\n` +
        `data: ${JSON.stringify({ text: 'Throw.' })}\n\n` +
        `data: ${JSON.stringify({ done: true })}\n\n`,
    );
  });

  it('is read back by the client algorithm: text accumulated, thinking shown', async () => {
    const handle = askRoute({
      stream: streamOf([{ thinking: 'hm' }, { text: 'A. ' }, { text: 'B.' }]),
    });
    const response = await handle(asked({ system: 's', question: 'q' }));
    const { answer, thinking } = boardReads([new Uint8Array(await response.arrayBuffer())]);
    expect(answer).toBe('A. B.');
    expect(thinking).toEqual(['hm']);
  });

  it('refuses a connection that never opened with a status, not a stream', async () => {
    const handle = askRoute({
      stream: async () => {
        throw new ModelError('the model refused the request (429): out of balance', 429);
      },
    });
    const response = await handle(asked({ system: 's', question: 'q' }));
    expect(response.status).toBe(502);
    const said = await refusal(response);
    expect(said).toBe('companion unavailable');
    expect(said).not.toContain('429');
  });

  it('says which empty it was: a whole budget of thinking and no answer', async () => {
    const handle = askRoute({ stream: streamOf([{ thinking: 'only thought' }]) });
    const response = await handle(asked({ system: 's', question: 'q' }));
    const text = await response.text();
    expect(text).toContain('companion unavailable');
    expect(text).not.toContain('spent the whole budget thinking');
    expect(text.endsWith(`data: ${JSON.stringify({ done: true })}\n\n`)).toBe(true);
  });

  it('says which empty it was: nothing at all', async () => {
    const handle = askRoute({ stream: streamOf([]) });
    const response = await handle(asked({ system: 's', question: 'q' }));
    const text = await response.text();
    expect(text).toContain('companion unavailable');
    expect(text).not.toContain('empty completion');
  });

  it('a failure past the first byte is said in-stream and the stream still ends', async () => {
    const handle = askRoute({
      stream: async () =>
        (async function* () {
          yield { text: 'half an ans' };
          throw new Error('the socket went away');
        })(),
    });
    const response = await handle(asked({ system: 's', question: 'q' }));
    const text = await response.text();
    expect(text).toContain('half an ans');
    expect(text).toContain('companion unavailable');
    expect(text).not.toContain('the socket went away');
    expect(text.endsWith(`data: ${JSON.stringify({ done: true })}\n\n`)).toBe(true);
  });

  it('still refuses bounds and origins before any stream is opened', async () => {
    let opened = 0;
    const handle = askRoute({
      stream: async () => {
        opened += 1;
        return (async function* () {
          yield { text: 'x' };
        })();
      },
    });
    const wrong = await handle(asked({ system: 's', question: 'q' }, { origin: 'https://evil.example' }));
    expect(wrong.status).toBe(403);
    const over = await handle(asked({ system: 's', question: 'q'.repeat(MAX_QUESTION_CHARS + 1) }));
    expect(over.status).toBe(413);
    expect(opened).toBe(0);
  });
});

describe('a question from the wrong origin', () => {
  it('answers the preflight for each allowed origin', async () => {
    const handle = askRoute({ model: fixedModel('yes') });

    for (const origin of ALLOWED_ORIGINS) {
      const response = await handle(new Request(ROUTE, { method: 'OPTIONS', headers: { origin } }));
      expect(response.status, origin).toBe(204);
      expect(response.headers.get('access-control-allow-origin'), origin).toBe(origin);
      expect(response.headers.get('access-control-allow-headers'), origin).toContain('content-type');
    }
  });

  it('gives a disallowed origin nothing at the preflight, so the browser stops there', async () => {
    const handle = askRoute({ model: fixedModel('yes') });
    const response = await handle(
      new Request(ROUTE, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers questions from each allowed origin, echoing it back', async () => {
    const handle = askRoute({ model: fixedModel('yes') });

    for (const origin of ALLOWED_ORIGINS) {
      const response = await handle(asked({ system: 's', question: 'q' }, { origin }));
      expect(response.status, origin).toBe(200);
      expect(response.headers.get('access-control-allow-origin'), origin).toBe(origin);
    }
  });

  it('refuses everyone else with the JSON shape the client throws', async () => {
    const handle = askRoute({ model: fixedModel('yes') });

    // `null` is what the fetch specification writes for a file:// page, and
    // the near-misses are what a lookalike host would send.
    for (const origin of ['https://evil.example', 'null', 'https://t27.ai.evil', 'http://t27.ai']) {
      const response = await handle(asked({ system: 's', question: 'q' }, { origin }));
      expect(response.status, origin).toBe(403);
      expect(response.headers.get('access-control-allow-origin'), origin).toBeNull();
      await refusal(response);
    }
  });

  it('refuses a request with no origin at all', async () => {
    const handle = askRoute({ model: fixedModel('yes') });
    const response = await handle(asked({ system: 's', question: 'q' }, { origin: '' }));

    expect(response.status).toBe(403);
    await refusal(response);
  });
});

describe('asked too much', () => {
  it('takes the largest system the bound allows and refuses one more', async () => {
    const handle = askRoute({ model: fixedModel('yes') });

    const largest = await handle(
      asked({ system: 'x'.repeat(MAX_SYSTEM_CHARS), question: 'q' }),
    );
    expect(largest.status).toBe(200);

    const over = await handle(
      asked({ system: 'x'.repeat(MAX_SYSTEM_CHARS + 1), question: 'q' }),
    );
    expect(over.status).toBe(413);
    expect(await refusal(over)).toContain(String(MAX_SYSTEM_CHARS));
  });

  it('takes the largest question the bound allows and refuses one more', async () => {
    const handle = askRoute({ model: fixedModel('yes') });

    const largest = await handle(
      asked({ system: 's', question: 'q'.repeat(MAX_QUESTION_CHARS) }),
    );
    expect(largest.status).toBe(200);

    const over = await handle(
      asked({ system: 's', question: 'q'.repeat(MAX_QUESTION_CHARS + 1) }),
    );
    expect(over.status).toBe(413);
    expect(await refusal(over)).toContain(String(MAX_QUESTION_CHARS));
  });
});

describe('a provider that fails', () => {
  it('says only that the companion is unavailable when no model is configured', async () => {
    const handle = askRoute({});
    const response = await handle(asked({ system: 's', question: 'q' }));

    expect(response.status).toBe(503);
    expect(await refusal(response)).toBe('companion unavailable');
  });

  it("does not carry the provider's own sentence out as a refusal", async () => {
    const refusing: LanguageModel = {
      id: 'refusing',
      complete: async () => {
        throw new ModelError('the model refused the request (402): insufficient balance', 402);
      },
    };
    const handle = askRoute({ model: refusing });
    const response = await handle(asked({ system: 's', question: 'q' }));

    expect(response.status).toBe(502);
    const said = await refusal(response);
    expect(said).toBe('companion unavailable');
    expect(said).not.toContain('402');
  });

  it('says something even for a failure with no shape', async () => {
    const broken: LanguageModel = {
      id: 'broken',
      complete: async () => {
        throw new Error('kaput');
      },
    };
    const handle = askRoute({ model: broken });
    const response = await handle(asked({ system: 's', question: 'q' }));

    expect(response.status).toBe(502);
    const said = await refusal(response);
    expect(said).toBe('companion unavailable');
    expect(said).not.toContain('kaput');
  });

  it('gives up on a model that never answers', async () => {
    vi.useFakeTimers();
    try {
      const never: LanguageModel = { id: 'never', complete: () => new Promise<string>(() => {}) };
      const handle = askRoute({ model: never });

      const answering = handle(asked({ system: 's', question: 'q' }));
      await vi.advanceTimersByTimeAsync(MODEL_DEADLINE_MS);

      const response = await answering;
      expect(response.status).toBe(504);
      expect(await refusal(response)).toBe('companion unavailable');
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps its deadline inside the client's abort, so the refusal is read", () => {
    // `askOverHttp` aborts at 180 seconds; a refusal after that is written to
    // a connection nobody holds.
    expect(MODEL_DEADLINE_MS).toBeLessThan(180_000);
  });
});

describe('one address asking too fast', () => {
  const question = { system: 's', question: 'q' };

  it(`lets ${ASKS_PER_MINUTE} through in a minute, refuses the next, and forgets in time`, async () => {
    let at = 0;
    const handle = askRoute({ model: fixedModel('yes'), now: () => at });

    // A second apart, so the window has an order to slide over.
    for (let i = 0; i < ASKS_PER_MINUTE; i++) {
      at = i * 1000;
      expect((await handle(asked(question))).status, `ask ${i + 1}`).toBe(200);
    }

    const over = await handle(asked(question));
    expect(over.status).toBe(429);
    await refusal(over);

    // The first ask falls out of the sliding window, and exactly one may pass.
    at = 60_000;
    expect((await handle(asked(question))).status).toBe(200);
    expect((await handle(asked(question))).status).toBe(429);
  });

  it('counts addresses apart, read from the first forwarded hop', async () => {
    const handle = askRoute({ model: fixedModel('yes'), now: () => 0 });
    const from = (chain: string) => asked(question, { headers: { 'x-forwarded-for': chain } });

    for (let i = 0; i < ASKS_PER_MINUTE; i++) {
      expect((await handle(from('7.7.7.7'))).status).toBe(200);
    }

    // The proxy appends itself; the player is the first entry, so a longer
    // chain behind the same player lands in the same spent allowance.
    expect((await handle(from('7.7.7.7, 10.0.0.1'))).status).toBe(429);
    // Another player, untouched by the first exhausting theirs.
    expect((await handle(from('8.8.8.8'))).status).toBe(200);
  });

  it('lets the socket address stand in when nothing is forwarded', async () => {
    const handle = askRoute({ model: fixedModel('yes'), now: () => 0 });

    for (let i = 0; i < ASKS_PER_MINUTE; i++) {
      expect((await handle(asked(question), '9.9.9.9')).status).toBe(200);
    }
    expect((await handle(asked(question), '9.9.9.9')).status).toBe(429);
    // No address at all is its own shared bucket, not a free pass into 9.9.9.9's.
    expect((await handle(asked(question))).status).toBe(200);
  });

  it('spends nothing on the preflight, which precedes every question', async () => {
    const handle = askRoute({ model: fixedModel('yes'), now: () => 0 });
    const preflight = new Request(ROUTE, { method: 'OPTIONS', headers: { origin: HOME } });

    // A browser asks permission before each POST: the pairs must all fit, or
    // the real allowance is half the documented one.
    for (let i = 0; i < ASKS_PER_MINUTE; i++) {
      expect((await handle(preflight.clone())).status).toBe(204);
      expect((await handle(asked(question))).status, `ask ${i + 1}`).toBe(200);
    }
  });
});

describe('what is not a question', () => {
  const handleWith = () => askRoute({ model: fixedModel('yes') });

  it('knows no other route', async () => {
    const response = await handleWith()(
      new Request('http://leela.test/api/other', {
        method: 'POST',
        headers: { origin: HOME },
      }),
    );
    expect(response.status).toBe(404);
    await refusal(response);
  });

  it('answers POST and OPTIONS only', async () => {
    const response = await handleWith()(
      new Request(ROUTE, { method: 'GET', headers: { origin: HOME } }),
    );
    expect(response.status).toBe(405);
    await refusal(response);
  });

  it('refuses a body that is not JSON', async () => {
    const response = await handleWith()(
      new Request(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: HOME },
        body: 'not json',
      }),
    );
    expect(response.status).toBe(400);
    await refusal(response);
  });

  it('refuses JSON that is not {system, question}', async () => {
    for (const body of [null, 'words', 7, [], {}, { system: 's' }, { question: 'q' }, { system: 1, question: 'q' }, { system: 's', question: ['q'] }]) {
      const response = await handleWith()(asked(body));
      expect(response.status, JSON.stringify(body)).toBe(400);
      await refusal(response);
    }
  });

  it('refuses an empty question', async () => {
    const response = await handleWith()(asked({ system: 's', question: '   ' }));
    expect(response.status).toBe(400);
    expect(await refusal(response)).toBe('empty question');
  });
});
