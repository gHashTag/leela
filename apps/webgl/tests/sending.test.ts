import { describe as group, expect, it } from 'vitest';

import type { Report } from '@leela/journal';

import { SEND_TIMEOUT_MS, reportsUrl, sendMyPath } from '../src/sending';

/**
 * Offering this board's path to the chat.
 *
 * The other end of `POST /api/reports`. What matters here is what it sends,
 * what it declines to send, and that nothing it meets can stop the board — the
 * merge itself belongs to the bot and to `@leela/journal`, both of which have
 * their own suites, and restating it here would be the duplication this
 * repository keeps finding.
 */
const LAUNCH = 'auth_date=1&user=%7B%22id%22%3A7%7D&hash=abc';

const path: Report[] = [
  { plan: 8, text: 'Greed showed itself as impatience.', at: Date.UTC(2026, 7, 20, 9) },
  { plan: 12, text: 'Delusion, and I did not see it until later.', at: Date.UTC(2026, 7, 21, 9) },
];

const answering = (status: number, body?: unknown): typeof globalThis.fetch =>
  (async () =>
    new Response(body === undefined ? null : JSON.stringify(body), { status })) as unknown as typeof globalThis.fetch;

group('what it sends', () => {
  it('reports how much of the path was new to the chat', async () => {
    const answer = await sendMyPath({ initData: LAUNCH, entries: path, fetch: answering(200, { added: 2 }) });

    expect(answer).toEqual({ kind: 'sent', added: 2 });
  });

  it('sends the document `@leela/journal` writes, not one assembled here', async () => {
    let sent: { body?: unknown; headers?: Headers } = {};
    const spy = (async (_url: string, init?: RequestInit) => {
      sent = { body: init?.body, headers: new Headers(init?.headers) };
      return new Response(JSON.stringify({ added: 2 }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await sendMyPath({ initData: LAUNCH, entries: path, fetch: spy });

    const document = JSON.parse(String(sent.body)) as { app: string; entries: Report[] };

    // The wire shape the bot's reader expects — asserted here so a change to
    // the writer fails on the surface that has to travel over it.
    expect(document.app).toBe('leela');
    expect(document.entries.map((one) => one.plan).sort((a, b) => a - b)).toEqual([8, 12]);
    // The moments of WRITING travel, or the bot stamps the import and the same
    // path arrives as new for ever.
    expect(document.entries.map((one) => one.at)).toContain(Date.UTC(2026, 7, 20, 9));
    expect(sent.headers?.get('authorization')).toBe(`tma ${LAUNCH}`);
  });
});

group('what it does not send', () => {
  it('spends no request on an empty path', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{"added":0}', { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const answer = await sendMyPath({ initData: LAUNCH, entries: [], fetch: spy });

    expect(called).toBe(false);
    // Not a failure and not a send: a phone should not pay for a POST that can
    // only ever answer zero.
    expect(answer).toEqual({ kind: 'nothing-to-send' });
  });

  it('sends nothing at all from a plain browser', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{"added":0}', { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const answer = await sendMyPath({ initData: '', entries: path, fetch: spy });

    expect(called).toBe(false);
    expect(answer.kind).toBe('unasked');
  });
});

group('nothing it meets can stop the board', () => {
  it('reports a refusal as unasked rather than as a send', async () => {
    for (const status of [401, 413, 500, 503]) {
      const answer = await sendMyPath({ initData: LAUNCH, entries: path, fetch: answering(status) });
      expect(answer.kind, String(status)).toBe('unasked');
    }
  });

  it('does not read a body of the wrong shape as a send', async () => {
    for (const body of [{ added: 'two' }, {}, null, [2]]) {
      const answer = await sendMyPath({ initData: LAUNCH, entries: path, fetch: answering(200, body) });
      expect(answer.kind, JSON.stringify(body)).toBe('unasked');
    }
  });

  it('survives a fetch that throws, because a phone network does', async () => {
    const broken = (async () => {
      throw new Error('Load failed');
    }) as unknown as typeof globalThis.fetch;

    expect((await sendMyPath({ initData: LAUNCH, entries: path, fetch: broken })).kind).toBe('unasked');
  });

  it('gives up rather than holding on', async () => {
    const never = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const stop = new Error('aborted');
          stop.name = 'AbortError';
          reject(stop);
        });
      })) as unknown as typeof globalThis.fetch;

    const answer = await sendMyPath({ initData: LAUNCH, entries: path, fetch: never, timeoutMs: 5 });

    expect(answer.kind === 'unasked' && answer.why).toContain('in time');
    expect(SEND_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});

group('where it sends', () => {
  it('is relative in a browser, and absolute where a host named an origin', () => {
    const page = globalThis as { __leelaAsk?: unknown };
    const before = page.__leelaAsk;

    try {
      page.__leelaAsk = undefined;
      expect(reportsUrl()).toBe('/api/reports');

      page.__leelaAsk = 'https://leela.example/';
      expect(reportsUrl()).toBe('https://leela.example/api/reports');
    } finally {
      page.__leelaAsk = before;
    }
  });
});
