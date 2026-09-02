import { createHmac } from 'node:crypto';
import { describe as group, expect, it } from 'vitest';

import { askRoute, type Standing } from '../src/serve';

/**
 * The door `specs/009` opens, and everything it must refuse at it.
 *
 * The owner settled the spec's one question on 2026-08-28 — *«да 3D поле
 * везде!»*, yes and the 3D board everywhere — so the board and the chat become
 * one game, and this route is where the board asks for it.
 *
 * Its whole security is `vouched.ts`. The prior art on this disk read the user
 * id out of `initData` in the browser and looked the player up with it, which
 * means anybody could have asked for anybody's game; the tests below are
 * mostly that sentence, written as requests.
 */
const TOKEN = '123456:AAHfake-token-for-tests-only';
const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const ORIGIN = 'https://t27.ai';

const signed = (fields: Record<string, string>, token = TOKEN): string => {
  const checked = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac('sha256', secret).update(checked).digest('hex'),
  }).toString();
};

const launchAs = (id: number, token = TOKEN, startParam?: string) =>
  signed(
    {
      auth_date: String(Math.floor(NOW / 1000) - 60),
      user: JSON.stringify({ id, first_name: 'Mina', language_code: 'ru' }),
      ...(startParam ? { start_param: startParam } : {}),
    },
    token,
  );

const standing: Standing = { plan: 8, waiting: false, won: false };

const ask = (
  initData: string | null,
  options: Parameters<typeof askRoute>[0] = {},
  method = 'GET',
): Promise<Response> =>
  askRoute({ now: () => NOW, token: TOKEN, ...options })(
    new Request('https://leela.example/api/game', {
      method,
      headers: {
        origin: ORIGIN,
        ...(initData === null ? {} : { authorization: `tma ${initData}` }),
      },
    }),
  );

group('a game served to whoever Telegram says owns it', () => {
  it('accepts the signed same-origin GET shape browsers send without Origin', async () => {
    const answer = await askRoute({ now: () => NOW, token: TOKEN, gameOf: async () => standing })(
      new Request('https://leela.example/api/game', {
        headers: { authorization: `tma ${launchAs(1)}` },
      }),
    );

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual(standing);
    expect(answer.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers the caller their own game, and asks for it by the vouched id', async () => {
    const asked: Array<{ id: string; startParam: string | null }> = [];
    const answer = await ask(launchAs(8675309, TOKEN, 'inline'), {
      gameOf: async (who) => {
        asked.push({ id: who.id, startParam: who.startParam });
        return standing;
      },
    });

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual(standing);
    // The id came from the signature, not from anything the caller could set
    // separately — there is nowhere else in this request it could have come
    // from, which is the point.
    expect(asked).toEqual([{ id: '8675309', startParam: 'inline' }]);
  });

  it('attributes only a validly signed Main Mini App launch before serving its game', async () => {
    const attributed: Array<{ id: string; startParam: string | null }> = [];
    const answer = await ask(launchAs(7, TOKEN, 'guest'), {
      gameOf: async () => standing,
      openedFromMiniApp: async (who) => attributed.push({ id: who.id, startParam: who.startParam }),
    });
    expect(answer.status).toBe(200);
    expect(attributed).toEqual([{ id: '7', startParam: 'guest' }]);

    const forged = await ask(launchAs(7, 'not-our-token', 'inline'), {
      gameOf: async () => standing,
      openedFromMiniApp: async (who) => attributed.push({ id: who.id, startParam: who.startParam }),
    });
    expect(forged.status).toBe(401);
    expect(attributed).toHaveLength(1);
  });

  it('carries the permission header, or the browser hides the answer', async () => {
    const answer = await ask(launchAs(1), { gameOf: async () => standing });

    expect(answer.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });
});

group('what it refuses at the door', () => {
  it('refuses a launch signed with somebody else’s token', async () => {
    const forged = launchAs(8675309, '999999:not-our-token');
    const answer = await ask(forged, { gameOf: async () => standing });

    expect(answer.status).toBe(401);
    expect(await answer.json()).toEqual({ error: 'the signature does not match' });
  });

  it('refuses a request carrying no authorization at all', async () => {
    expect((await ask(null, { gameOf: async () => standing })).status).toBe(401);
  });

  it('refuses a bare token that is not announced as one', async () => {
    // The scheme name is checked, so an `Authorization: <initData>` — which is
    // the mistake a client makes once — is refused rather than half-read.
    const answer = await askRoute({ now: () => NOW, token: TOKEN, gameOf: async () => standing })(
      new Request('https://leela.example/api/game', {
        headers: { origin: ORIGIN, authorization: launchAs(1) },
      }),
    );

    expect(answer.status).toBe(401);
  });

  it('refuses everybody when the deployment has no token to check against', async () => {
    const answer = await ask(launchAs(1), { token: undefined, gameOf: async () => standing });

    expect(answer.status).toBe(401);
    // Not a 500 and not a silent 200: a deployment that cannot name its caller
    // serves nobody's game.
    expect(await answer.json()).toEqual({
      error: 'this deployment has no bot token to check against',
    });
  });

  it('refuses an origin that is not ours before it looks at the signature', async () => {
    const answer = await askRoute({ now: () => NOW, token: TOKEN, gameOf: async () => standing })(
      new Request('https://leela.example/api/game', {
        headers: { origin: 'https://somebody.else', authorization: `tma ${launchAs(1)}` },
      }),
    );

    expect(answer.status).toBe(403);
  });

  it('does not turn the GET exception into no-origin model or mutation access', async () => {
    const noOrigin = (path: string, method: string) =>
      askRoute({ now: () => NOW, token: TOKEN })(
        new Request(`https://leela.example${path}`, {
          method,
          headers: path === '/api/ask'
            ? { 'content-type': 'application/json' }
            : { authorization: `tma ${launchAs(1)}` },
          body: path === '/api/ask' ? JSON.stringify({ system: 's', question: 'q' }) : undefined,
        }),
      );

    expect((await noOrigin('/api/ask', 'POST')).status).toBe(403);
    expect((await noOrigin('/api/roll', 'POST')).status).toBe(403);
    expect((await noOrigin('/api/reports', 'POST')).status).toBe(403);
  });

  it('answers a preflight without a body, as the ask route does', async () => {
    const answer = await ask(null, { gameOf: async () => standing }, 'OPTIONS');

    expect(answer.status).toBe(204);
    expect(answer.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });

  it('takes GET and nothing else', async () => {
    expect((await ask(launchAs(1), { gameOf: async () => standing }, 'POST')).status).toBe(405);
  });
});

group('what it says when there is nothing to say', () => {
  it('says so when this deployment keeps no games', async () => {
    const answer = await ask(launchAs(1));

    expect(answer.status).toBe(503);
    expect(await answer.json()).toEqual({ error: 'this deployment keeps no games to serve' });
  });

  it('tells a verified player with no table apart from one it cannot serve', async () => {
    const answer = await ask(launchAs(1), { gameOf: async () => null });

    // 404, not 503: the difference between "you have no game" and "this
    // process has no games" is the difference between starting one and
    // reporting an outage.
    expect(answer.status).toBe(404);
    expect(await answer.json()).toEqual({ error: 'no game of yours here yet' });
  });

  it('tells the player something when the store throws, rather than only surviving', async () => {
    const answer = await ask(launchAs(1), {
      gameOf: async () => {
        throw new Error('the database is on fire');
      },
    });

    // What is SAID, not merely that nothing crashed: a route that swallows a
    // failure and returns an empty 200 would pass a test that only asserted it
    // did not throw, and the board would draw a player standing on nothing.
    const said = await answer.json();

    expect(answer.status).toBe(404);
    expect(said).toEqual({ error: 'no game of yours here yet' });
    // And the reason the operator needs stays out of the reply to the player.
    expect(JSON.stringify(said)).not.toContain('fire');
  });
});

group('and the route it stands beside is untouched', () => {
  it('still 404s a path that is neither', async () => {
    const answer = await askRoute({ now: () => NOW })(
      new Request('https://leela.example/api/anything', { headers: { origin: ORIGIN } }),
    );

    expect(answer.status).toBe(404);
  });
});
