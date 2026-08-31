import { describe as group, expect, it } from 'vitest';

import { ASK_TIMEOUT_MS, gameUrl, myGame, askForARoll } from '../src/mine';

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

/**
 * Asking the chat's die to turn — `specs/009` step 4, ADOPT.
 *
 * The board reads the game and then must not throw its own die, or there are
 * two games again one roll later. These hold the asking half to the three
 * answers it has to keep apart, and to the one thing it must never send.
 */
group('asking the chat to throw', () => {
  const ROLLED = {
    roll: 4,
    rollsAgain: false,
    standing: {
      plan: 12,
      waiting: false,
      won: false,
      state: {
        loka: 12,
        previous_loka: 8,
        direction: 'step 🚶🏼',
        consecutive_sixes: 0,
        position_before_three_sixes: 8,
        is_finished: false,
      },
      yourTurn: false,
    },
  };

  const answering = (status: number, body: unknown, seen?: { init?: RequestInit }) =>
    (async (_url: string, init?: RequestInit) => {
      if (seen) seen.init = init;
      return {
        status,
        json: async () => body,
      } as unknown as Response;
    }) as unknown as typeof globalThis.fetch;

  it('SENDS NOTHING BUT THE SIGNATURE — the value is the bot’s to choose', async () => {
    /*
     * The whole reason this is a bare POST. Every player can sign a launch for
     * their own game, so a board that sent `{roll: 6}` would be a board that
     * always threw sixes.
     */
    const seen: { init?: RequestInit } = {};
    await askForARoll({ initData: 'x', fetch: answering(200, ROLLED, seen) });

    expect(seen.init?.method).toBe('POST');
    expect(seen.init?.body, 'the board sent a body, and a body can carry a roll').toBeUndefined();
  });

  it('reads a throw the route documents', async () => {
    const answer = await askForARoll({ initData: 'x', fetch: answering(200, ROLLED) });

    expect(answer).toEqual({ kind: 'rolled', rolled: ROLLED });
  });

  it('KEEPS “not yet” APART FROM “could not ask”, and carries the bot’s own words', async () => {
    /*
     * A waiting player told *the bot could not be reached* is told the wrong
     * thing about a working game. The sentence comes from the bot because the
     * bot has it in the player's language.
     */
    const refused = await askForARoll({
      initData: 'x',
      fetch: answering(409, { error: 'write what this plan brings up first' }),
    });

    expect(refused).toEqual({ kind: 'refused', why: 'write what this plan brings up first' });

    const down = await askForARoll({ initData: 'x', fetch: answering(503, {}) });
    expect(down.kind).toBe('unasked');
  });

  it('REFUSES A FACE IT CANNOT DRAW, rather than walking on it', async () => {
    /*
     * `0` is what the route answers when it found no move event — a shape that
     * means something went wrong, not that the die showed nothing. Seven is a
     * die this game does not have. Either walked would move a token to a square
     * the engine never chose.
     */
    for (const roll of [0, 7, 2.5, -1]) {
      const answer = await askForARoll({ initData: 'x', fetch: answering(200, { ...ROLLED, roll }) });
      expect(answer.kind, `roll ${roll} was accepted`).toBe('unasked');
    }
  });

  it('refuses a throw whose standing is not one', async () => {
    const answer = await askForARoll({
      initData: 'x',
      fetch: answering(200, { ...ROLLED, standing: { plan: 'twelve' } }),
    });

    expect(answer.kind).toBe('unasked');
  });

  it('asks nothing at all outside Telegram', async () => {
    // A plain browser has nobody to roll for, and a request without a signature
    // is a 401 the player cannot act on.
    let called = false;
    const answer = await askForARoll({
      initData: '',
      fetch: (() => {
        called = true;
        return Promise.reject(new Error('should not be called'));
      }) as unknown as typeof globalThis.fetch,
    });

    expect(called).toBe(false);
    expect(answer.kind).toBe('unasked');
  });
});
