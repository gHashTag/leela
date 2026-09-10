import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Subscription, type SubscriptionState } from '../src/subscription';
import { tollFor } from '../src/toll';

const OFFER = {
  tiers: [
    { id: 'month', stars: 137, days: 29 },
    { id: 'halfyear', stars: 709, days: 173 },
    { id: 'year', stars: 1301, days: 367 },
  ],
  termsUrl: 'https://t27.ai/leela/docs/en/legal/eula.html',
  entitled: false,
};
const URL = 'https://t.me/$test_invoice';
const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
const flush = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(0); };

function setup() {
  let callback: ((status: unknown) => void) | undefined;
  const app = {
    ready: vi.fn(), expand: vi.fn(), initData: 'signed-menu-launch',
    openInvoice: vi.fn((_url: string, closed: (status: unknown) => void) => { callback = closed; }),
    sendData: vi.fn(), close: vi.fn(), isVersionAtLeast: vi.fn(() => true),
  };
  const fetcher = vi.fn<typeof fetch>(async (url) => response(String(url).endsWith('/api/invoice') ? { url: URL } : OFFER));
  const states: SubscriptionState[] = [];
  const confirmed = vi.fn();
  const payment = new Subscription({
    app: () => app,
    language: () => 'ru',
    fetch: fetcher,
    changed: (state) => states.push(state),
    confirmed,
    requestTimeoutMs: 50,
    invoiceTimeoutMs: 100,
    pollIntervalMs: 10,
    pollAttempts: 3,
  });
  return { app, fetcher, states, payment, confirmed, closed: (status: unknown) => callback?.(status) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
});

async function buy(h: ReturnType<typeof setup>, tier: 'month' | 'halfyear' | 'year' = 'month') {
  await h.payment.start();
  h.payment.select(tier);
  h.payment.accept(true);
  await h.payment.pay();
}

describe('a menu-launch subscription stays in the Mini App', () => {
  it.each(['month', 'halfyear', 'year'] as const)('uses the signed POST contract for %s with explicit consent', async (tier) => {
    (globalThis as { __leelaAsk?: unknown }).__leelaAsk = 'https://bot.example///';
    const h = setup();
    await h.payment.start();
    expect(h.payment.view()).toMatchObject({ stage: 'offer', offers: OFFER, accepted: false, selected: null });
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = h.fetcher.mock.calls[0]!;
    expect(url).toBe('https://bot.example/api/subscription');
    expect(options).toMatchObject({ method: 'POST', headers: { authorization: 'tma signed-menu-launch', 'content-type': 'application/json' }, cache: 'no-store', redirect: 'error' });
    expect(JSON.parse(String(options?.body))).toEqual({ language: 'ru' });
    await h.payment.pay();
    h.payment.select(tier);
    await h.payment.pay();
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    h.payment.accept(true);
    await h.payment.pay();
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    const [invoiceUrl, invoiceOptions] = h.fetcher.mock.calls[1]!;
    expect(invoiceUrl).toBe('https://bot.example/api/invoice');
    expect(invoiceOptions?.method).toBe('POST');
    expect(invoiceOptions?.headers).toEqual({ authorization: 'tma signed-menu-launch', 'content-type': 'application/json' });
    expect(JSON.parse(String(invoiceOptions?.body))).toEqual({ language: 'ru', tier, acceptedTerms: true });
    expect(h.app.openInvoice).toHaveBeenCalledTimes(1);
    expect(h.app.openInvoice.mock.calls[0]![0]).toBe(URL);
    expect(h.app.sendData).not.toHaveBeenCalled();
    expect(h.app.close).not.toHaveBeenCalled();
    expect(h.payment.view().stage).toBe('invoice');
    expect(h.confirmed).not.toHaveBeenCalled();
  });

  it('refuses duplicate operations in every active state, not only disabled buttons', async () => {
    const h = setup();
    const load = h.payment.start();
    await Promise.all([h.payment.start(), h.payment.start()]);
    h.payment.select('year');
    h.payment.accept(true);
    expect(h.payment.view()).toMatchObject({ stage: 'loading', accepted: false, selected: null });
    await load;
    h.payment.select('month');
    // Runtime inputs must still belong to the current offers.
    h.payment.select('bogus' as 'month');
    expect(h.payment.view().selected).toBe('month');
    h.payment.accept(true);
    await Promise.all([h.payment.pay(), h.payment.pay(), h.payment.start(), h.payment.pay()]);
    await h.payment.pay();
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(h.app.openInvoice).toHaveBeenCalledTimes(1);
    h.closed('paid');
    h.closed('paid');
    await h.payment.start();
    await h.payment.pay();
    await vi.runAllTimersAsync();
    expect(h.fetcher).toHaveBeenCalledTimes(5); // offers, invoice, exactly three polls
    expect(h.payment.view()).toMatchObject({ stage: 'error', checkingOnly: true, problem: 'unconfirmed' });
    expect(h.confirmed).not.toHaveBeenCalled();
  });
});

describe('only the server can open the gate', () => {
  it.each(['paid', 'pending'])('%s waits for a validated server entitlement, not the SDK', async (status) => {
    const h = setup();
    let access = { taken: 3, entitled: false, hosted: true };
    const board = { square: 41, reflection: 'words still being written' };
    h.confirmed.mockImplementation(() => { access = { ...access, entitled: true }; });
    await buy(h);
    h.fetcher.mockResolvedValueOnce(response(OFFER)).mockResolvedValueOnce(response({ ...OFFER, entitled: true }));
    h.closed(status);
    expect(h.payment.view().stage).toBe('checking');
    expect(h.confirmed).not.toHaveBeenCalled();
    expect(tollFor(access).mayThrow).toBe(false);
    await flush();
    expect(h.confirmed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.confirmed).toHaveBeenCalledTimes(1);
    expect(h.payment.view().stage).toBe('confirmed');
    expect(tollFor(access).mayThrow).toBe(true);
    expect(board).toEqual({ square: 41, reflection: 'words still being written' });
    h.closed('paid');
    await h.payment.start();
    await h.payment.pay();
    await vi.runAllTimersAsync();
    expect(h.fetcher).toHaveBeenCalledTimes(4);
    expect(h.confirmed).toHaveBeenCalledTimes(1);
  });

  it('an already entitled player never receives a new invoice', async () => {
    const h = setup();
    h.fetcher.mockResolvedValueOnce(response({ ...OFFER, entitled: true }));
    await h.payment.start();
    expect(h.payment.view().stage).toBe('confirmed');
    expect(h.confirmed).toHaveBeenCalledTimes(1);
    await h.payment.pay();
    expect(h.app.openInvoice).not.toHaveBeenCalled();
  });

  it('a confirmation timeout offers checking again, never a second charge', async () => {
    const h = setup();
    await buy(h);
    h.closed('pending');
    await vi.runAllTimersAsync();
    expect(h.payment.view()).toMatchObject({ stage: 'error', checkingOnly: true, accepted: false });
    expect(h.confirmed).not.toHaveBeenCalled();
    h.fetcher.mockResolvedValueOnce(response({ ...OFFER, entitled: true }));
    await h.payment.start();
    expect(h.confirmed).toHaveBeenCalledTimes(1);
    expect(h.app.openInvoice).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/api/invoice'))).toHaveLength(1);
  });

  it('a missing callback times out and late payment news still checks the server', async () => {
    const h = setup();
    await buy(h);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.payment.view()).toMatchObject({ stage: 'error', checkingOnly: true, problem: 'unconfirmed' });
    h.fetcher.mockResolvedValueOnce(response({ ...OFFER, entitled: true }));
    h.closed('paid');
    await flush();
    expect(h.confirmed).toHaveBeenCalledTimes(1);
    expect(h.app.openInvoice).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, true, {}, 'unknown', 'PAID'])('does not trust an unknown callback %s', async (status) => {
    const h = setup();
    await buy(h);
    h.closed(status);
    await flush();
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'unconfirmed', checkingOnly: true });
    expect(h.confirmed).not.toHaveBeenCalled();
    expect(h.fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('failures are recoverable', () => {
  it.each(['cancelled', 'failed'])('%s leaves consent unchecked and allows a fresh attempt', async (status) => {
    const h = setup();
    await buy(h);
    h.closed(status);
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: status, accepted: false, checkingOnly: false });
    expect(h.confirmed).not.toHaveBeenCalled();
    await buy(h, 'year');
    expect(h.app.openInvoice).toHaveBeenCalledTimes(2);
    expect(h.payment.view().stage).toBe('invoice');
  });

  it.each([401, 403, 404, 429, 500, 503])('recovers from HTTP %s on either route', async (status) => {
    for (const route of ['offers', 'invoice']) {
      const h = setup();
      if (route === 'offers') {
        h.fetcher.mockResolvedValueOnce(response({}, status));
        await h.payment.start();
      } else {
        await h.payment.start();
        h.payment.select('month');
        h.payment.accept(true);
        h.fetcher.mockResolvedValueOnce(response({}, status));
        await h.payment.pay();
      }
      expect(h.payment.view()).toMatchObject({ stage: 'error', problem: status === 401 || status === 403 ? 'unauthorized' : 'unavailable', accepted: false });
      expect(h.app.openInvoice).not.toHaveBeenCalled();
      await h.payment.start();
      expect(h.payment.view()).toMatchObject({ stage: 'offer', accepted: false, selected: null });
    }
  });

  it('bounds a stalled fetch and ignores its late response', async () => {
    const h = setup();
    let release!: (response: Response) => void;
    h.fetcher.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
    const start = h.payment.start();
    await vi.advanceTimersByTimeAsync(50);
    await start;
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'timeout' });
    expect(h.fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(true);
    await h.payment.start();
    release(response({ ...OFFER, entitled: true }));
    await flush();
    expect(h.payment.view().stage).toBe('offer');
    expect(h.confirmed).not.toHaveBeenCalled();
  });

  it('bounds a stalled JSON body', async () => {
    const h = setup();
    h.fetcher.mockResolvedValueOnce({ status: 200, json: () => new Promise(() => {}) } as Response);
    const start = h.payment.start();
    await vi.advanceTimersByTimeAsync(50);
    await start;
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'timeout' });
  });

  it('recovers from offline transport, malformed JSON and SDK throws', async () => {
    const h = setup();
    h.fetcher.mockRejectedValueOnce(new Error('offline'));
    await h.payment.start();
    expect(h.payment.view().stage).toBe('error');
    h.fetcher.mockResolvedValueOnce(new Response('<html>not JSON</html>'));
    await h.payment.start();
    expect(h.payment.view().stage).toBe('error');
    h.app.openInvoice.mockImplementationOnce(() => { throw new Error('cannot open'); });
    await buy(h);
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'failed' });
    await buy(h);
    expect(h.payment.view().stage).toBe('invoice');
  });

  it('stops polling on invalid authentication and can recheck without charging', async () => {
    const h = setup();
    await buy(h);
    h.fetcher.mockResolvedValueOnce(response({}, 401));
    h.closed('paid');
    await vi.runAllTimersAsync();
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'unauthorized', checkingOnly: true });
    expect(h.fetcher).toHaveBeenCalledTimes(3);
    h.fetcher.mockResolvedValueOnce(response({ ...OFFER, entitled: true }));
    await h.payment.start();
    expect(h.confirmed).toHaveBeenCalledTimes(1);
    expect(h.app.openInvoice).toHaveBeenCalledTimes(1);
  });

  it('rejects unsigned launches and unsupported versions visibly without requests', async () => {
    const h = setup();
    h.app.initData = '';
    await h.payment.start();
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'outside-telegram' });
    h.app.initData = 'signed';
    h.app.isVersionAtLeast.mockReturnValue(false);
    await h.payment.start();
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'unsupported' });
    expect(h.fetcher).not.toHaveBeenCalled();
    h.app.isVersionAtLeast.mockReturnValue(true);
    await h.payment.start();
    expect(h.payment.view().stage).toBe('offer');
  });
});

describe('every server value is untrusted', () => {
  const badOffers = [
    undefined, null, true, [], {}, { ...OFFER, entitled: 'true' }, { ...OFFER, entitled: 1 },
    { ...OFFER, tiers: null }, { ...OFFER, tiers: 'month' },
    ...[null, {}, [], { ...OFFER.tiers[0], id: 'week' }, { ...OFFER.tiers[0], id: { toString: () => 'month' } }].map((tier) => ({ ...OFFER, tiers: [tier] })),
    ...['stars', 'days'].flatMap((key) => [undefined, null, '30', 0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1].map((value) => ({ ...OFFER, tiers: [{ ...OFFER.tiers[0], [key]: value }] }))),
    { ...OFFER, tiers: [OFFER.tiers[0], OFFER.tiers[0]] },
    ...[null, {}, '', 'javascript:alert(1)', 'http://t27.ai/terms', '/terms', 'https://u:p@t27.ai/terms', ' https://t27.ai/terms', 'https://t27.ai/terms\n'].map((termsUrl) => ({ ...OFFER, termsUrl })),
  ];
  it.each(badOffers.map((value, index) => ({ value, index })))('rejects malformed offer shape $index, even if it claims entitlement', async ({ value }) => {
    const h = setup();
    h.fetcher.mockResolvedValueOnce(response(value));
    await h.payment.start();
    expect(h.payment.view().stage).toBe('error');
    expect(h.app.openInvoice).not.toHaveBeenCalled();
    expect(h.confirmed).not.toHaveBeenCalled();
    await h.payment.start();
    expect(h.payment.view()).toMatchObject({ stage: 'offer', accepted: false });
  });

  it('a deployment with no tiers reports unavailable without inventing a price', async () => {
    const h = setup();
    h.fetcher.mockResolvedValueOnce(response({ ...OFFER, tiers: [] }));
    await h.payment.start();
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'unavailable' });
    expect(h.app.openInvoice).not.toHaveBeenCalled();
  });

  it.each([null, {}, [], { url: null }, { url: '' }, { url: 'javascript:alert(1)' }, { url: 'https://evil.test/$invoice' }, { url: 'https://t.me/$invoice?redirect=evil' }])('refuses malformed invoice %s without opening anything', async (value) => {
    const h = setup();
    await h.payment.start();
    h.payment.select('month');
    h.payment.accept(true);
    h.fetcher.mockResolvedValueOnce(response(value));
    await h.payment.pay();
    expect(h.payment.view()).toMatchObject({ stage: 'error', problem: 'unreadable' });
    expect(h.app.openInvoice).not.toHaveBeenCalled();
    expect(h.confirmed).not.toHaveBeenCalled();
  });
});

describe('returning to the board cancels only a checkout not yet opened', () => {
  it('dismiss during creation ignores the late invoice and resets consent on reopen', async () => {
    const h = setup();
    await h.payment.start();
    h.payment.select('month');
    h.payment.accept(true);
    let release!: (response: Response) => void;
    h.fetcher.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
    const creating = h.payment.pay();
    expect(h.payment.view().stage).toBe('creating');
    h.payment.dismiss();
    expect(h.payment.view()).toMatchObject({ stage: 'idle', accepted: false, selected: null, checkingOnly: false });
    await h.payment.start();
    expect(h.payment.view()).toMatchObject({ stage: 'offer', accepted: false, selected: null });
    release(response({ url: URL }));
    await creating;
    expect(h.app.openInvoice).not.toHaveBeenCalled();
    h.payment.select('year');
    await h.payment.pay();
    expect(h.app.openInvoice).not.toHaveBeenCalled();
    h.payment.accept(true);
    await h.payment.pay();
    expect(h.app.openInvoice).toHaveBeenCalledTimes(1);
    expect(h.confirmed).not.toHaveBeenCalled();
  });

  it('dismiss during loading ignores late offers and entitlement claims', async () => {
    const h = setup();
    let release!: (response: Response) => void;
    h.fetcher.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
    const loading = h.payment.start();
    h.payment.dismiss();
    release(response({ ...OFFER, entitled: true }));
    await loading;
    expect(h.payment.view().stage).toBe('idle');
    expect(h.confirmed).not.toHaveBeenCalled();
    await h.payment.start();
    expect(h.payment.view()).toMatchObject({ stage: 'offer', accepted: false, selected: null });
  });

  it('dismiss after opening keeps a single invoice and accepts late server confirmation', async () => {
    const h = setup();
    await buy(h);
    h.payment.dismiss();
    expect(h.payment.view()).toMatchObject({ stage: 'invoice', checkingOnly: true, accepted: false });
    await h.payment.start();
    await h.payment.pay();
    expect(h.app.openInvoice).toHaveBeenCalledTimes(1);
    h.fetcher.mockResolvedValueOnce(response({ ...OFFER, entitled: true }));
    h.closed('paid');
    await flush();
    expect(h.confirmed).toHaveBeenCalledTimes(1);
    expect(h.payment.view().stage).toBe('confirmed');
  });

  it('dismiss after a missing callback still only offers checking, never a new invoice', async () => {
    const h = setup();
    await buy(h);
    await vi.advanceTimersByTimeAsync(100);
    h.payment.dismiss();
    expect(h.payment.view()).toMatchObject({ stage: 'error', checkingOnly: true, accepted: false });
    const checking = h.payment.start();
    await vi.runAllTimersAsync();
    await checking;
    expect(h.app.openInvoice).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/api/invoice'))).toHaveLength(1);
    expect(h.confirmed).not.toHaveBeenCalled();
  });
});
