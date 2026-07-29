import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, ModelError, fixedModel, openRouter, recordingModel } from '../src';

/** A fetch that answers with whatever it is given. */
function fetchReturning(body: unknown, status = 200): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof globalThis.fetch;
}

const ok = { choices: [{ message: { content: 'an answer' } }] };
const messages = [{ role: 'user' as const, content: 'hello' }];

describe('openRouter', () => {
  it('refuses to be configured without a key, rather than failing mid-conversation', () => {
    // The service this replaces read process.env inside the call and threw on
    // the first message a player sent.
    expect(() => openRouter({ apiKey: '' })).toThrow(ModelError);
  });

  it('returns the model’s text', async () => {
    const model = openRouter({ apiKey: 'k', fetch: fetchReturning(ok) });
    expect(await model.complete(messages)).toBe('an answer');
  });

  it('names which model it is, for logs and for telling two apart', () => {
    expect(openRouter({ apiKey: 'k' }).id).toBe(`openrouter:${DEFAULT_MODEL}`);
    expect(openRouter({ apiKey: 'k', model: 'x/y' }).id).toBe('openrouter:x/y');
  });

  it('sends the key, the model and the messages', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const model = openRouter({
      apiKey: 'secret',
      model: 'x/y',
      fetch: (async (url: string, init: RequestInit) => {
        captured = { url, init };
        return new Response(JSON.stringify(ok), { status: 200 });
      }) as unknown as typeof globalThis.fetch,
    });

    await model.complete(messages, { maxTokens: 100, temperature: 0.2 });

    expect(captured!.url).toContain('/chat/completions');
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');

    const body = JSON.parse(captured!.init.body as string);
    expect(body.model).toBe('x/y');
    expect(body.messages).toEqual(messages);
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.2);
  });

  it('reports the status, so a bad key reads differently from a rate limit', async () => {
    for (const status of [401, 429, 500]) {
      const model = openRouter({ apiKey: 'k', fetch: fetchReturning({}, status) });
      await expect(model.complete(messages)).rejects.toMatchObject({ status });
    }
  });

  it('treats a reply with no text as a failure rather than returning nothing', async () => {
    for (const body of [{}, { choices: [] }, { choices: [{ message: {} }] }, { choices: [{ message: { content: '   ' } }] }]) {
      const model = openRouter({ apiKey: 'k', fetch: fetchReturning(body) });
      await expect(model.complete(messages)).rejects.toThrow(ModelError);
    }
  });

  it('passes the abort signal through, so a timeout can cut the request', async () => {
    let sawSignal = false;
    const model = openRouter({
      apiKey: 'k',
      fetch: (async (_url: string, init: RequestInit) => {
        sawSignal = init.signal instanceof AbortSignal;
        return new Response(JSON.stringify(ok), { status: 200 });
      }) as unknown as typeof globalThis.fetch,
    });

    await model.complete(messages, { signal: new AbortController().signal });
    expect(sawSignal).toBe(true);
  });

  it('sends attribution headers only when they are given', async () => {
    const headersFor = async (options: Record<string, string>) => {
      let captured: Record<string, string> = {};
      const model = openRouter({
        apiKey: 'k',
        ...options,
        fetch: (async (_url: string, init: RequestInit) => {
          captured = init.headers as Record<string, string>;
          return new Response(JSON.stringify(ok), { status: 200 });
        }) as unknown as typeof globalThis.fetch,
      });
      await model.complete(messages);
      return captured;
    };

    expect(await headersFor({})).not.toHaveProperty('HTTP-Referer');
    expect(await headersFor({ referer: 'https://leela.app' })).toMatchObject({
      'HTTP-Referer': 'https://leela.app',
    });
  });
});

describe('test doubles', () => {
  it('fixedModel says one thing, which is enough to run with no key', async () => {
    expect(await fixedModel('always this').complete(messages)).toBe('always this');
  });

  it('recordingModel keeps what it was asked', async () => {
    const model = recordingModel('noted');
    await model.complete(messages, { temperature: 0.1 });

    expect(model.calls).toHaveLength(1);
    expect(model.calls[0].messages).toEqual(messages);
    expect(model.calls[0].options?.temperature).toBe(0.1);
  });
});
