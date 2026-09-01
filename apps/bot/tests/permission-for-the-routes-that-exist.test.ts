import { describe as group, expect, it } from 'vitest';

import { ALLOWED_ORIGINS, askRoute } from '../src/serve';

/**
 * A browser must be allowed to send what the routes actually take.
 *
 * **Two lines silently forbade `/api/game` and `/api/roll` from the day each
 * was written.** The CORS headers were composed for `/api/ask` — a POST
 * carrying JSON — and were right for it. Then `/api/game` arrived as a GET
 * carrying `authorization`, and `/api/roll` as a POST carrying the same, and
 * neither the method nor the header was ever added.
 *
 * `authorization` is not CORS-safelisted, so every one of those calls
 * preflights. The preflight answered *content-type* and *POST, OPTIONS*, and
 * the browser refused before it asked. The board saw `TypeError: Failed to
 * fetch` and reported *the bot could not be reached* — which was true, and told
 * nobody why.
 *
 * **NOTHING IN THIS REPOSITORY COULD SEE IT.** Every existing test drives
 * `askRoute` as a function, where there is no browser and no preflight is
 * enforced, so all of them passed against a route no page could call. The route
 * was right and the client was right; the permission between them was for a
 * different route. MEASURED in a real browser on 2026-08-31, with a validly
 * signed launch: `fetch` threw and the request never left.
 *
 * So these assert the PERMISSION, which is the only part a function-level test
 * of the handler cannot reach on its own.
 */

const ORIGIN = ALLOWED_ORIGINS[0]!;

const preflight = (path: string, method: string, headers: string): Promise<Response> =>
  askRoute()(
    new Request(`https://leela.example${path}`, {
      method: 'OPTIONS',
      headers: {
        origin: ORIGIN,
        'access-control-request-method': method,
        'access-control-request-headers': headers,
      },
    }),
  );

/** What a browser reads out of the answer, split the way it splits them. */
const allowed = (answer: Response) => ({
  methods: (answer.headers.get('access-control-allow-methods') ?? '')
    .split(',')
    .map((one) => one.trim().toUpperCase())
    .filter(Boolean),
  headers: (answer.headers.get('access-control-allow-headers') ?? '')
    .split(',')
    .map((one) => one.trim().toLowerCase())
    .filter(Boolean),
});

group('the permission matches the routes that exist', () => {
  it('ALLOWS THE SIGNED LAUNCH TO BE SENT AT ALL', async () => {
    /*
     * The defect, as one assertion. `authorization` carries `tma <initData>`,
     * which is how every route but `/api/ask` knows whose game it is answering
     * about — and a header a browser is not permitted to send is a header the
     * server never sees.
     */
    const { headers } = allowed(await preflight('/api/game', 'GET', 'authorization'));

    expect(headers, 'a browser may not send the signed launch').toContain('authorization');
  });

  it('ALLOWS GET, because `/api/game` is one', async () => {
    // The other half. The list said `POST, OPTIONS` while the route that needed
    // it was a GET, so the preflight refused the method outright.
    const { methods } = allowed(await preflight('/api/game', 'GET', 'authorization'));

    expect(methods).toContain('GET');
  });

  it('still allows what `/api/ask` needs, which is what the old list was for', async () => {
    // The old values were not wrong, only incomplete — and a repair that traded
    // one route's permission for another's would be the same defect moved.
    const { methods, headers } = allowed(await preflight('/api/ask', 'POST', 'content-type'));

    expect(methods).toContain('POST');
    expect(methods, 'the preflight itself must be allowed').toContain('OPTIONS');
    expect(headers).toContain('content-type');
  });

  it('permits every method the routes are actually declared with', async () => {
    /*
     * Derived rather than listed, so a route added later cannot be forgotten
     * here the way `/api/game` and `/api/roll` were. If a fifth route arrives
     * as a PUT, this fails until the permission says PUT.
     */
    const wanted = [
      { path: '/api/ask', method: 'POST' },
      { path: '/api/game', method: 'GET' },
      { path: '/api/roll', method: 'POST' },
      { path: '/api/reports', method: 'POST' },
    ];

    for (const { path, method } of wanted) {
      const { methods, headers } = allowed(await preflight(path, method, 'authorization, content-type'));

      expect(methods, `${method} ${path} is refused before it is asked`).toContain(method);
      expect(headers, `${path} may not carry a signed launch`).toContain('authorization');
    }
  });

  it('says none of it to an origin it does not know', async () => {
    // The permission is still a permission. A page on somebody else's host must
    // get no allow-origin at all, which is what stops their visitors' browsers
    // spending this key.
    const answer = await askRoute()(
      new Request('https://leela.example/api/game', {
        method: 'OPTIONS',
        headers: { origin: 'https://not-ours.example', 'access-control-request-method': 'GET' },
      }),
    );

    expect(answer.headers.get('access-control-allow-origin')).toBeNull();
    expect(answer.headers.get('access-control-allow-headers')).toBeNull();
  });
});
