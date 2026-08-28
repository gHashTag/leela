import { describe as group, expect, it } from 'vitest';

import { ASK_TIMEOUT_MS, gameUrl, myGame } from '../src/mine';

/**
 * Asking the bot where the chat says this player stands.
 *
 * The half of `specs/009` step 3 that can be held still. What it must never do
 * is collapse *you have no game* into *I could not ask*: the board runs in
 * somebody else's webview on a phone, so failing to ask is the common case, and
 * a surface that reports it as an empty chat game tells the player their game
 * is gone every time a tunnel drops.
 */
const answering = (status: number, body?: unknown): typeof globalThis.fetch =>
  (async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof globalThis.fetch;

const LAUNCH = 'auth_date=1&user=%7B%22id%22%3A7%7D&hash=abc';

group('what the bot said', () => {
  it('reads a standing the route documents', async () => {
    const answer = await myGame({
      initData: LAUNCH,
      fetch: answering(200, { plan: 8, waiting: false, won: false }),
    });

    expect(answer).toEqual({ kind: 'standing', standing: { plan: 8, waiting: false, won: false } });
  });

  it('carries the launch as the scheme the bot checks', async () => {
    let sent: string | null = null;
    const spy = (async (_url: string, init?: RequestInit) => {
      sent = new Headers(init?.headers).get('authorization');
      return new Response(JSON.stringify({ plan: 1, waiting: true, won: false }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await myGame({ initData: LAUNCH, fetch: spy });

    // `tma <initData>`, which is what `vouched.ts` will accept and nothing else.
    expect(sent).toBe(`tma ${LAUNCH}`);
  });

  it('reads a 404 as this player having no table, which is a real answer', async () => {
    expect(await myGame({ initData: LAUNCH, fetch: answering(404, { error: 'no game of yours here yet' }) })).toEqual({
      kind: 'none',
    });
  });
});

group('what it refuses to call an answer', () => {
  it('does not turn a refusal into an empty game', async () => {
    // THE DISTINCTION THIS FILE EXISTS FOR. 401 is the bot declining to say;
    // reporting it as "no game" would tell a player with a game that they have
    // none.
    const answer = await myGame({ initData: LAUNCH, fetch: answering(401, { error: 'the signature does not match' }) });

    expect(answer.kind).toBe('unasked');
    expect(answer.kind === 'unasked' && answer.why).toContain('401');
  });

  it('does not turn an outage into an empty game either', async () => {
    for (const status of [500, 502, 503]) {
      expect((await myGame({ initData: LAUNCH, fetch: answering(status) })).kind).toBe('unasked');
    }
  });

  it('does not read a body of the wrong shape', async () => {
    // A proxy's HTML error page parses as nothing, and a 200 carrying somebody
    // else's JSON must not become a plan number.
    for (const body of [{ plan: 'eight' }, { plan: 8 }, { waiting: false, won: false }, [8], null, 'ok']) {
      const answer = await myGame({ initData: LAUNCH, fetch: answering(200, body) });
      expect(answer.kind, JSON.stringify(body)).toBe('unasked');
    }
  });

  it('survives a fetch that throws, because a phone network does', async () => {
    const broken = (async () => {
      throw new Error('Load failed');
    }) as unknown as typeof globalThis.fetch;

    const answer = await myGame({ initData: LAUNCH, fetch: broken });

    expect(answer.kind).toBe('unasked');
    expect(answer.kind === 'unasked' && answer.why).toContain('could not be reached');
  });

  it('gives up rather than holding the board', async () => {
    const never = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const stop = new Error('aborted');
          stop.name = 'AbortError';
          reject(stop);
        });
      })) as unknown as typeof globalThis.fetch;

    const answer = await myGame({ initData: LAUNCH, fetch: never, timeoutMs: 5 });

    expect(answer.kind === 'unasked' && answer.why).toContain('in time');
  });

  it('waits a bounded time by default, and the bound is short', async () => {
    // The board must draw whether or not the bot answers: this runs on the
    // boot path, and a boot that waits on a network is a black screen.
    expect(ASK_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});

group('a plain browser has nobody to ask about', () => {
  it('asks nothing at all without a launch, and says which of the two that is', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const answer = await myGame({ initData: '', fetch: spy });

    expect(called).toBe(false);
    // `unasked`, never `none`: outside Telegram this board has not learned that
    // the player has no chat game, it has learned nothing.
    expect(answer.kind).toBe('unasked');
  });
});

group('where it asks', () => {
  it('is relative in a browser, and absolute where a host named an origin', () => {
    const page = globalThis as { __leelaAsk?: unknown };
    const before = page.__leelaAsk;

    try {
      page.__leelaAsk = undefined;
      expect(gameUrl()).toBe('/api/game');

      page.__leelaAsk = 'https://leela.example/';
      expect(gameUrl()).toBe('https://leela.example/api/game');

      // Anything that is not a string is a page somebody else wrote into.
      page.__leelaAsk = 42;
      expect(gameUrl()).toBe('/api/game');
    } finally {
      page.__leelaAsk = before;
    }
  });
});
