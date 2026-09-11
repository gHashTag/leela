import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ReadableStream } from 'node:stream/web';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGES } from '@leela/content';
import { ALLOWED_ORIGINS, askRoute, type AskRouteOptions } from '../src/serve';
import { termsUrl } from '../src/purchase-care';
import { invoiceFor, offering } from '../src/stars';
import { FRESH_FOR_MS } from '../src/vouched';
import { blank } from '../../../scripts/lib/source.mjs';

const TOKEN = '123456:only-a-test-token';
const NOW = Date.UTC(2026, 8, 10);
const HOME = 'https://t27.ai';
const LINK = 'https://t.me/$test-invoice';
const TIERS = offering({
  LEELA_STARS_MONTH: '150',
  LEELA_STARS_HALFYEAR: '700',
  LEELA_STARS_YEAR: '1200',
})!;
const PATHS = ['/api/subscription', '/api/invoice'] as const;

function signed(id = 7, at = NOW, token = TOKEN): string {
  const fields = {
    auth_date: String(Math.floor(at / 1000)),
    user: JSON.stringify({ id, first_name: 'Player', language_code: 'ru' }),
  };
  const checked = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac('sha256', secret).update(checked).digest('hex'),
  }).toString();
}

const bodyFor = (path: string) => path === '/api/invoice'
  ? { language: 'ru', tier: 'month', acceptedTerms: true }
  : { language: 'ru' };

function request(path: string, options: {
  body?: unknown;
  raw?: string;
  method?: string;
  headers?: Record<string, string>;
} = {}): Request {
  const method = options.method ?? 'POST';
  return new Request(`https://leela.test${path}`, {
    method,
    headers: {
      origin: HOME,
      'content-type': 'application/json',
      authorization: `tma ${signed()}`,
      ...options.headers,
    },
    ...(!['GET', 'HEAD', 'OPTIONS'].includes(method)
      ? { body: options.raw ?? JSON.stringify(options.body ?? bodyFor(path)) }
      : {}),
  });
}

function setup(options: AskRouteOptions = {}) {
  const entitled = vi.fn(async (_userId: string, _at: number) => false);
  const createLink = vi.fn(async (_invoice: ReturnType<typeof invoiceFor>, _signal: AbortSignal) => LINK);
  const payments = { tiers: TIERS, entitled, createLink };
  const route = askRoute({
    token: TOKEN, now: () => NOW, serving: () => null, running: () => null,
    payments, ...options,
  });
  return { route, entitled, createLink, payments };
}

afterEach(() => vi.useRealTimers());

describe('the Mini App payment contract', () => {
  it('returns the server offering, terms in every language, and verified entitlement without a game', async () => {
    for (const language of LANGUAGES) {
      const { route, entitled, createLink } = setup();
      entitled.mockResolvedValue(true);
      const response = await route(request(PATHS[0], { body: { language } }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ tiers: TIERS, termsUrl: termsUrl(language), entitled: true });
      expect(entitled).toHaveBeenCalledTimes(1);
      expect(entitled).toHaveBeenCalledWith('7', NOW);
      expect(createLink).not.toHaveBeenCalled();
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('vary')).toContain('Origin');
    }
  });

  it('uses the current offer and v2 invoice builder for every tier and language', async () => {
    for (const tier of TIERS) {
      for (const language of LANGUAGES) {
        const { route, createLink, entitled } = setup();
        const response = await route(request(PATHS[1], {
          body: { language, tier: tier.id, acceptedTerms: true },
        }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ url: LINK });
        expect(createLink).toHaveBeenCalledTimes(1);
        expect(createLink).toHaveBeenCalledWith(
          invoiceFor(language, TIERS, tier.id), expect.any(AbortSignal),
        );
        expect(createLink.mock.calls[0]?.[0]).toMatchObject({
          currency: 'XTR', payload: `leela:pro:${tier.id}:v2`,
          prices: [{ amount: tier.stars }],
        });
        expect(entitled).not.toHaveBeenCalled();
        expect(response.headers.get('cache-control')).toBe('no-store');
      }
    }
  });

  it('reports no entitlement when the server has none, irrespective of the signed language', async () => {
    const { route } = setup();
    const response = await route(request(PATHS[0], { body: { language: 'en' } }));
    expect(await response.json()).toEqual({ tiers: TIERS, termsUrl: termsUrl('en'), entitled: false });
  });

  it('still reports settled entitlement after prices disappear, without issuing new invoices', async () => {
    for (const tiers of [null, []]) {
      for (const held of [true, false]) {
        const { payments } = setup();
        payments.entitled.mockResolvedValue(held);
        const { route } = setup({ payments: { ...payments, tiers } });
        const response = await route(request(PATHS[0]));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ tiers: [], termsUrl: termsUrl('ru'), entitled: held });
        expect(payments.entitled).toHaveBeenCalledWith('7', NOW);
        const invoice = await route(request(PATHS[1]));
        expect(invoice.status).toBe(503);
        expect(await invoice.json()).toEqual({ error: 'payments unavailable' });
        expect(payments.createLink).not.toHaveBeenCalled();
      }
    }
  });
});

describe.each(PATHS)('%s security boundary', (path) => {
  it('rejects absent, forged, stale, altered, wrong-scheme and oversized launch data', async () => {
    const changed = new URLSearchParams(signed());
    changed.set('user', JSON.stringify({ id: 999 }));
    for (const authorization of [
      '', signed(), `Bearer ${signed()}`, `tma ${signed(7, NOW, 'another-bot')}`,
      `tma ${signed(7, NOW - FRESH_FOR_MS - 1000)}`, `tma ${changed}`,
      `tma ${'a'.repeat(16_385)}`,
    ]) {
      const { route, entitled, createLink } = setup();
      const response = await route(request(path, { headers: { authorization } }));
      expect(response.status, authorization.slice(0, 20)).toBe(401);
      expect(entitled).not.toHaveBeenCalled();
      expect(createLink).not.toHaveBeenCalled();
      expect(response.headers.get('access-control-allow-origin')).toBe(HOME);
    }
    expect((await setup({ token: undefined }).route(request(path))).status).toBe(401);
  });

  it('allows every configured origin and the browser authorization preflight without doing payment work', async () => {
    for (const origin of ALLOWED_ORIGINS) {
      const { route, entitled, createLink } = setup();
      const response = await route(request(path, {
        method: 'OPTIONS',
        headers: {
          origin, authorization: '',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization, content-type',
        },
      }));
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
      expect(response.headers.get('access-control-allow-headers')).toContain('authorization');
      expect(response.headers.get('access-control-allow-headers')).toContain('content-type');
      expect(entitled).not.toHaveBeenCalled();
      expect(createLink).not.toHaveBeenCalled();
      expect((await route(request(path, { headers: { origin } }))).status).toBe(200);
    }
  });

  it('rejects missing and foreign origins and does not grant their preflights', async () => {
    for (const origin of ['', 'null', 'https://t27.ai.attacker.test', 'https://other.test']) {
      const { route, entitled, createLink } = setup();
      expect((await route(request(path, { headers: { origin } }))).status).toBe(403);
      const preflight = await route(request(path, { method: 'OPTIONS', headers: { origin } }));
      expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
      expect(entitled).not.toHaveBeenCalled();
      expect(createLink).not.toHaveBeenCalled();
    }
  });

  it('refuses every non-POST action before reading payment capabilities', async () => {
    const { route, entitled, createLink } = setup();
    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']) {
      expect((await route(request(path, { method }))).status).toBe(405);
    }
    expect(entitled).not.toHaveBeenCalled();
    expect(createLink).not.toHaveBeenCalled();
  });

  it('rejects non-JSON, non-object, missing, unknown and client-authoritative fields', async () => {
    for (const raw of ['', '{', 'null', '[]', '"ru"', '5', 'true']) {
      const { route, entitled, createLink } = setup();
      expect((await route(request(path, { raw }))).status, raw).toBe(400);
      expect(entitled).not.toHaveBeenCalled();
      expect(createLink).not.toHaveBeenCalled();
    }
    for (const body of [
      {}, { ...bodyFor(path), language: 'invalid' }, { ...bodyFor(path), language: 1 },
      { ...bodyFor(path), language: null },
      ...['userId', 'id', 'amount', 'stars', 'days', 'entitled', 'url', 'payload', 'currency', 'paid']
        .map((field) => ({ ...bodyFor(path), [field]: 'untrusted' })),
    ]) {
      const { route, entitled, createLink } = setup();
      expect((await route(request(path, { body }))).status, JSON.stringify(body)).toBe(400);
      expect(entitled).not.toHaveBeenCalled();
      expect(createLink).not.toHaveBeenCalled();
    }
    for (const contentType of ['', 'text/plain', 'application/x-www-form-urlencoded']) {
      const { route } = setup();
      expect((await route(request(path, { headers: { 'content-type': contentType } }))).status).toBe(415);
    }
    expect((await setup().route(request(path, {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }))).status).toBe(200);
  });

  it('bounds bytes while reading, including chunks without an honest Content-Length', async () => {
    for (const headers of [{}, { 'content-length': '1' }, { 'content-length': '999999' }] as Record<string, string>[]) {
      const { route, createLink } = setup();
      expect((await route(request(path, {
        raw: JSON.stringify({ ...bodyFor(path), extra: 'я'.repeat(512) }),
        headers,
      }))).status).toBe(413);
      expect(createLink).not.toHaveBeenCalled();
    }
    const cancelled = vi.fn();
    let chunks = 0;
    const stream = new ReadableStream({
      pull(controller) {
        chunks += 1;
        controller.enqueue(new TextEncoder().encode(' '.repeat(256)));
      },
      cancel: cancelled,
    });
    const streamed = new Request(`https://leela.test${path}`, {
      method: 'POST',
      headers: { origin: HOME, authorization: `tma ${signed()}`, 'content-type': 'application/json' },
      body: stream, duplex: 'half',
    } as RequestInit);
    expect((await setup().route(streamed)).status).toBe(413);
    expect(chunks).toBeLessThan(6);
    expect(cancelled).toHaveBeenCalled();
  });

  it('bounds a stalled body and refuses a body that throws without leaking its detail', async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    const make = (body: ReadableStream) => new Request(`https://leela.test${path}`, {
      method: 'POST',
      headers: { origin: HOME, authorization: `tma ${signed()}`, 'content-type': 'application/json' },
      body, duplex: 'half',
    } as RequestInit);
    const pending = setup().route(make(new ReadableStream({ cancel: cancelled })));
    await vi.advanceTimersByTimeAsync(5001);
    expect((await pending).status).toBe(408);
    expect(cancelled).toHaveBeenCalled();
    const response = await setup().route(make(new ReadableStream({
      start(controller) { controller.error(new Error(TOKEN)); },
    })));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(TOKEN);
  });

  it('fails closed with a sanitized 503 for absent payment capability', async () => {
    const response = await setup({ payments: undefined }).route(request(path));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'payments unavailable' });
  });
});

describe('invoice consent and resource bounds', () => {
  it('requires exactly true consent and an available tier', async () => {
    for (const acceptedTerms of [false, 'true', 1, null, [], {}, undefined]) {
      const { route, createLink } = setup();
      expect((await route(request(PATHS[1], {
        body: { language: 'en', tier: 'month', acceptedTerms },
      }))).status).toBe(400);
      expect(createLink).not.toHaveBeenCalled();
    }
    for (const tier of ['MONTH', 'week', '', 1, null, {}, '__proto__', undefined]) {
      const { route, createLink } = setup();
      expect((await route(request(PATHS[1], {
        body: { language: 'en', tier, acceptedTerms: true },
      }))).status).toBe(400);
      expect(createLink).not.toHaveBeenCalled();
    }
    const { payments } = setup();
    const route = setup({ payments: { ...payments, tiers: TIERS.filter((tier) => tier.id !== 'year') } }).route;
    expect((await route(request(PATHS[1], {
      body: { language: 'en', tier: 'year', acceptedTerms: true },
    }))).status).toBe(400);
    expect(payments.createLink).not.toHaveBeenCalled();
  });

  it('counts attempts per verified user, not spoofed IP, and refreshes after a minute', async () => {
    let now = NOW;
    const { route, createLink } = setup({ now: () => now });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await route(request(PATHS[1], { headers: { 'x-forwarded-for': `10.0.0.${attempt}` } }))).status).toBe(200);
    }
    expect((await route(request(PATHS[1]))).status).toBe(429);
    expect(createLink).toHaveBeenCalledTimes(4);
    expect((await route(request(PATHS[1], { headers: { authorization: `tma ${signed(8)}` } }))).status).toBe(200);
    expect((await route(request(PATHS[0]))).status).toBe(200);
    now += 60_000;
    expect((await route(request(PATHS[1]))).status).toBe(200);
  });

  it('also bounds subscription reads and counts malformed authenticated requests, but not forgeries', async () => {
    const { route, createLink } = setup();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect((await route(request(PATHS[1], {
        headers: { authorization: `tma ${signed(7, NOW, 'wrong-token')}` },
      }))).status).toBe(401);
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await route(request(PATHS[1], { raw: '{' }))).status).toBe(400);
    }
    expect((await route(request(PATHS[1]))).status).toBe(429);
    expect(createLink).not.toHaveBeenCalled();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await route(request(PATHS[0]))).status).toBe(200);
    }
    expect((await route(request(PATHS[0]))).status).toBe(429);
  });

  it('reuses the capped allowance rather than retaining every verified user forever', async () => {
    const { route } = setup();
    for (let id = 1; id <= 10_001; id += 1) {
      expect((await route(request(PATHS[1], {
        headers: { authorization: `tma ${signed(id)}` }, raw: '{',
      }))).status).toBe(400);
    }
    // The oldest id was evicted, so it has a complete allowance again.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await route(request(PATHS[1], {
        headers: { authorization: `tma ${signed(1)}` },
      }))).status).toBe(200);
    }
    expect((await route(request(PATHS[1], {
      headers: { authorization: `tma ${signed(1)}` },
    }))).status).toBe(429);
  }, 30_000);

  it('sanitizes synchronous throws, rejections and invalid link results', async () => {
    for (const createLink of [
      () => { throw new Error(TOKEN); },
      async () => { throw new Error(`https://api.telegram.org/bot${TOKEN}/createInvoiceLink`); },
      async () => 'javascript:alert(1)',
      async () => 'https://attacker.test/',
      async () => '',
    ]) {
      const { payments } = setup();
      const response = await setup({ payments: { ...payments, createLink } }).route(request(PATHS[1]));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'payments unavailable' });
    }
    for (const entitled of [
      () => { throw new Error(TOKEN); },
      async () => { throw new Error(TOKEN); },
    ]) {
      const response = await setup({ payments: { ...setup().payments, entitled } }).route(request(PATHS[0]));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'payments unavailable' });
    }
  });

  it('times out and aborts a stalled upstream, bounds concurrency, and releases slots', async () => {
    vi.useFakeTimers();
    const { payments } = setup();
    payments.createLink.mockImplementation(() => new Promise(() => undefined));
    const { route } = setup({ payments });
    const pending = Array.from({ length: 8 }, (_, index) => route(request(PATHS[1], {
      headers: { authorization: `tma ${signed(index + 1)}` },
    })));
    await vi.advanceTimersByTimeAsync(0);
    expect(payments.createLink).toHaveBeenCalledTimes(8);
    const overloaded = await route(request(PATHS[1], {
      headers: { authorization: `tma ${signed(99)}` },
    }));
    expect(overloaded.status).toBe(503);
    await vi.advanceTimersByTimeAsync(8001);
    for (const response of await Promise.all(pending)) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'payments unavailable' });
    }
    for (const [, signal] of payments.createLink.mock.calls) expect(signal.aborted).toBe(true);
    payments.createLink.mockResolvedValue(LINK);
    expect((await route(request(PATHS[1], {
      headers: { authorization: `tma ${signed(99)}` },
    }))).status).toBe(200);
  });

  it('also bounds a stalled entitlement lookup', async () => {
    vi.useFakeTimers();
    const { payments } = setup();
    payments.entitled.mockImplementation(() => new Promise(() => undefined));
    const pending = setup({ payments }).route(request(PATHS[0]));
    await vi.advanceTimersByTimeAsync(8001);
    expect((await pending).status).toBe(503);
  });
});

it('the production entry point wires the actual Bot API and read-only entitlement store', async () => {
  const source = ts.createSourceFile('index.ts',
    blank(readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')),
    ts.ScriptTarget.Latest, true);
  let expression: string | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'serveAsk') {
      const options = node.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        const payments = options.properties.find((property) =>
          ts.isPropertyAssignment(property) && property.name.getText(source) === 'payments');
        if (payments && ts.isPropertyAssignment(payments)) expression = payments.initializer.getText(source);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(expression, 'serveAsk must receive the production payments capability').toBeDefined();
  const js = ts.transpile(`const wiring = (${expression});`, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
  });
  const createInvoiceLink = vi.fn(async () => LINK);
  const subscribed = vi.fn(async () => NOW + 1);
  const record = vi.fn();
  const payments = new Function('bot', 'storage', 'stars', `${js}; return wiring;`)(
    { api: { createInvoiceLink } }, { entitlements: { subscribed, record } }, TIERS,
  ) as NonNullable<AskRouteOptions['payments']>;
  const { route } = setup({ payments });
  expect((await route(request(PATHS[0]))).status).toBe(200);
  expect(subscribed).toHaveBeenCalledTimes(1);
  expect(subscribed).toHaveBeenCalledWith('7', NOW);
  for (const tier of TIERS) {
    const response = await route(request(PATHS[1], {
      body: { language: 'ru', tier: tier.id, acceptedTerms: true },
    }));
    expect(response.status).toBe(200);
    const invoice = invoiceFor('ru', TIERS, tier.id);
    expect(createInvoiceLink).toHaveBeenLastCalledWith(
      invoice.title, invoice.description, invoice.payload, '', 'XTR', invoice.prices,
      undefined, expect.any(AbortSignal),
    );
  }
  expect(record).not.toHaveBeenCalled();
});
