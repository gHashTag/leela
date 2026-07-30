import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL,
  DEFAULT_OPENAI_MODEL,
  ModelError,
  fixedModel,
  openAI,
  openRouter,
  recordingModel,
} from '../src';

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

/**
 * Two providers, one contract.
 *
 * OpenRouter was ported first because the newest of the six generations used
 * it (`NeuroLeelaAgent/services/openRouterService.ts`). The *published* app
 * called OpenAI directly — `leela/src/constants.ts` posts to
 * `api.openai.com/v1/chat/completions` with `gpt-4-1106-preview`. Both speak
 * the same wire format, which is why there is one client behind both.
 *
 * These tests are written against the contract rather than against either
 * provider, so a third one has a suite waiting for it and cannot be added with
 * a subtly different idea of what a `LanguageModel` does.
 */
describe.each([
  {
    name: 'openRouter',
    make: (fetch?: typeof globalThis.fetch, model?: string) =>
      openRouter({ apiKey: 'secret', fetch, model }),
    host: 'openrouter.ai',
    prefix: 'openrouter:',
    defaultModel: DEFAULT_MODEL,
    ceiling: 'max_tokens',
  },
  {
    name: 'openAI',
    make: (fetch?: typeof globalThis.fetch, model?: string) =>
      openAI({ apiKey: 'secret', fetch, model }),
    host: 'api.openai.com',
    prefix: 'openai:',
    defaultModel: DEFAULT_OPENAI_MODEL,
    ceiling: 'max_completion_tokens',
  },
])('$name, as a provider', (provider) => {
  /** Capture one request without performing it. */
  function capturing() {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify(ok), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    return { seen, fetch };
  }

  it('refuses to be configured without a key, rather than failing mid-conversation', () => {
    const withoutKey = () =>
      provider.name === 'openAI' ? openAI({ apiKey: '' }) : openRouter({ apiKey: '' });
    expect(withoutKey).toThrow(ModelError);
    // Named, so an operator reading the log knows which key is missing.
    expect(withoutKey).toThrow(provider.name === 'openAI' ? /OpenAI/ : /OpenRouter/);
  });

  it('says which provider and model it is', () => {
    expect(provider.make().id).toBe(`${provider.prefix}${provider.defaultModel}`);
    expect(provider.make(undefined, 'a-model').id).toBe(`${provider.prefix}a-model`);
  });

  it('talks to its own host', async () => {
    const { seen, fetch } = capturing();
    await provider.make(fetch).complete(messages);
    expect(seen[0].url).toContain(provider.host);
    expect(seen[0].url).toContain('/chat/completions');
  });

  it('sends the key as a bearer token and nothing else as one', async () => {
    const { seen, fetch } = capturing();
    await provider.make(fetch).complete(messages);
    const headers = seen[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');
    expect(JSON.stringify(seen[0].init.body)).not.toContain('secret');
  });

  it('names the reply ceiling the way its own API does', async () => {
    // OpenAI has deprecated `max_tokens` and rejects it for reasoning models,
    // where OpenRouter normalises it across everything it fronts. One guess
    // for both would be a 400 that reads like a bad key.
    const { seen, fetch } = capturing();
    await provider.make(fetch).complete(messages, { maxTokens: 111 });
    const body = JSON.parse(seen[0].init.body as string);
    expect(body[provider.ceiling]).toBe(111);
    expect(Object.keys(body)).not.toContain(
      provider.ceiling === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens',
    );
  });

  it('returns the text', async () => {
    expect(await provider.make(fetchReturning(ok)).complete(messages)).toBe('an answer');
  });

  it('reports a refusal with its status, so a bad key reads differently from an outage', async () => {
    for (const status of [401, 429, 503]) {
      const model = provider.make(fetchReturning({ error: 'no' }, status));
      await expect(model.complete(messages)).rejects.toMatchObject({ status });
    }
  });

  it('treats an empty reply as a failure rather than answering with nothing', async () => {
    const empty = provider.make(fetchReturning({ choices: [{ message: { content: '  ' } }] }));
    await expect(empty.complete(messages)).rejects.toThrow(ModelError);
  });

  it('passes the abort signal through, so a slow model does not hold a turn', async () => {
    const { seen, fetch } = capturing();
    const controller = new AbortController();
    await provider.make(fetch).complete(messages, { signal: controller.signal });
    expect(seen[0].init.signal).toBe(controller.signal);
  });
});

describe('the attribution headers belong to one provider only', () => {
  function capturing() {
    const seen: RequestInit[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      seen.push(init);
      return new Response(JSON.stringify(ok), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    return { seen, fetch };
  }

  it('sends HTTP-Referer and X-Title to OpenRouter, which asked for them', async () => {
    const { seen, fetch } = capturing();
    await openRouter({ apiKey: 'k', fetch, referer: 'https://t27.ai', title: 'Leela' }).complete(
      messages,
    );
    const headers = seen[0].headers as Record<string, string>;
    expect(headers['HTTP-Referer']).toBe('https://t27.ai');
    expect(headers['X-Title']).toBe('Leela');
  });

  it('sends neither to OpenAI, which has no use for them', async () => {
    const { seen, fetch } = capturing();
    await openAI({ apiKey: 'k', fetch }).complete(messages);
    const headers = seen[0].headers as Record<string, string>;
    expect(headers['HTTP-Referer']).toBeUndefined();
    expect(headers['X-Title']).toBeUndefined();
  });
});
