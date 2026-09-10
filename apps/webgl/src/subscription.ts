import type { Language } from '@leela/content';

import { invoiceSupport, invoiceUrl, launchOf, openTelegramInvoice, type TelegramInvoiceProblem, type telegramOf } from './telegram';

/** Prices and durations belong to the server, never to this screen. */
export interface SubscriptionTier {
  readonly id: 'month' | 'halfyear' | 'year';
  readonly stars: number;
  readonly days: number;
}

interface Offers {
  readonly tiers: readonly SubscriptionTier[];
  readonly termsUrl: string;
  readonly entitled: boolean;
}

export type SubscriptionProblem = TelegramInvoiceProblem | 'unavailable' | 'unauthorized' | 'timeout' | 'cancelled' | 'failed' | 'unconfirmed';

export interface SubscriptionState {
  readonly stage: 'idle' | 'loading' | 'offer' | 'creating' | 'invoice' | 'checking' | 'error' | 'confirmed';
  readonly offers: Offers | null;
  readonly selected: SubscriptionTier['id'] | null;
  readonly accepted: boolean;
  readonly problem: SubscriptionProblem | null;
  /** Retry after a possibly completed payment only checks access; it never charges again. */
  readonly checkingOnly: boolean;
}

type Result<T> = { ok: true; value: T } | { ok: false; problem: SubscriptionProblem };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const offersIn = (value: unknown): Offers | null => {
  if (!record(value) || !Array.isArray(value.tiers) || typeof value.entitled !== 'boolean') return null;
  if (typeof value.termsUrl !== 'string' || value.termsUrl.trim() !== value.termsUrl) return null;
  try {
    const terms = new URL(value.termsUrl);
    if (terms.protocol !== 'https:' || !terms.hostname || terms.username || terms.password || /[\s\\]/.test(value.termsUrl)) return null;
  } catch {
    return null;
  }
  const tiers: SubscriptionTier[] = [];
  for (const tier of value.tiers) {
    if (!record(tier)) return null;
    // Decode the foreign spelling into our canonical vocabulary, rather than
    // carrying the server field through the model after comparing it.
    const id = tier.id === 'month' ? 'month' : tier.id === 'halfyear' ? 'halfyear' : tier.id === 'year' ? 'year' : null;
    if (id === null || !positiveInteger(tier.stars) || !positiveInteger(tier.days)) return null;
    if (tiers.some((prior) => prior.id === id)) return null;
    tiers.push({ id, stars: tier.stars, days: tier.days });
  }
  return { tiers, termsUrl: value.termsUrl, entitled: value.entitled };
};

const routeUrl = (path: string): string => {
  const base = (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
  return typeof base === 'string' && base !== '' ? `${base.replace(/\/+$/, '')}${path}` : path;
};

/**
 * A payment is a small state machine, not a delayed `sendData` that closes the
 * board. Every operation refuses duplicate taps itself; disabled buttons only
 * draw that decision. No callback can grant access: only a validated server
 * response with `entitled: true` reaches `confirmed`.
 */
export class Subscription {
  private state: SubscriptionState = {
    stage: 'idle', offers: null, selected: null, accepted: false, problem: null, checkingOnly: false,
  };
  private operation = 0;

  constructor(private readonly deps: {
    app: () => ReturnType<typeof telegramOf>;
    language: () => Language;
    fetch: typeof globalThis.fetch;
    changed: (state: SubscriptionState) => void;
    confirmed: () => void;
    requestTimeoutMs?: number;
    invoiceTimeoutMs?: number;
    pollIntervalMs?: number;
    pollAttempts?: number;
  }) {}

  view(): SubscriptionState { return this.state; }

  private busy(): boolean {
    return ['loading', 'creating', 'invoice', 'checking'].includes(this.state.stage);
  }

  private update(patch: Partial<SubscriptionState>): void {
    this.state = { ...this.state, ...patch };
    this.deps.changed(this.state);
  }

  private fail(problem: SubscriptionProblem): void {
    this.operation += 1;
    this.update({ stage: 'error', problem, accepted: false });
  }

  private confirm(): void {
    this.operation += 1;
    this.update({ stage: 'confirmed', problem: null, accepted: false, checkingOnly: false });
    this.deps.confirmed();
  }

  /** Both the network AND JSON body are bounded, even if a host ignores abort. */
  private async post(path: string, body: object): Promise<Result<unknown>> {
    const initData = launchOf(this.deps.app());
    if (initData.trim() === '') return { ok: false, problem: 'outside-telegram' };
    const stop = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<Result<unknown>>((resolve) => {
      timer = setTimeout(() => {
        resolve({ ok: false, problem: 'timeout' });
        stop.abort();
      }, this.deps.requestTimeoutMs ?? 8_000);
    });
    const request = async (): Promise<Result<unknown>> => {
      try {
        const response = await this.deps.fetch(routeUrl(path), {
          method: 'POST',
          headers: { authorization: `tma ${initData}`, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
          redirect: 'error',
          signal: stop.signal,
        });
        if (response.status !== 200) {
          return { ok: false, problem: response.status === 401 || response.status === 403 ? 'unauthorized' : 'unavailable' };
        }
        return { ok: true, value: await response.json() };
      } catch {
        return { ok: false, problem: stop.signal.aborted ? 'timeout' : 'unavailable' };
      }
    };
    try {
      return await Promise.race([request(), timedOut]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async offers(): Promise<Result<Offers>> {
    const response = await this.post('/api/subscription', { language: this.deps.language() });
    if (!response.ok) return response;
    const offers = offersIn(response.value);
    return offers === null ? { ok: false, problem: 'unreadable' } : { ok: true, value: offers };
  }

  async start(): Promise<void> {
    if (this.busy() || this.state.stage === 'offer' || this.state.stage === 'confirmed') return;
    if (this.state.checkingOnly) return this.checkEntitlement();
    const operation = ++this.operation;
    this.update({ stage: 'loading', offers: null, selected: null, accepted: false, problem: null });
    const support = invoiceSupport(this.deps.app());
    if (support !== null) return this.fail(support);
    const response = await this.offers();
    if (operation !== this.operation) return;
    if (!response.ok) return this.fail(response.problem);
    if (response.value.entitled) return this.confirm();
    if (response.value.tiers.length === 0) return this.fail('unavailable');
    this.update({ stage: 'offer', offers: response.value });
  }

  /** Leaving before the SDK opens an invoice cancels that UI operation. */
  dismiss(): void {
    if (this.state.checkingOnly || this.state.stage === 'confirmed') {
      // An opened invoice may still be paid. Keep its callback/polling and
      // checking-only retry; hiding the sheet must never permit a second charge.
      this.update({ accepted: false });
      return;
    }
    this.operation += 1;
    this.update({
      stage: 'idle', offers: null, selected: null, accepted: false, problem: null, checkingOnly: false,
    });
  }

  select(id: SubscriptionTier['id']): void {
    if (this.state.stage !== 'offer' || !this.state.offers?.tiers.some((tier) => tier.id === id)) return;
    this.update({ selected: id });
  }

  accept(accepted: boolean): void {
    if (this.state.stage === 'offer') this.update({ accepted: accepted === true });
  }

  async pay(): Promise<void> {
    if (this.state.stage !== 'offer' || !this.state.accepted || this.state.selected === null) return;
    const support = invoiceSupport(this.deps.app());
    if (support !== null) return this.fail(support);
    const operation = ++this.operation;
    this.update({ stage: 'creating', problem: null });
    const response = await this.post('/api/invoice', {
      language: this.deps.language(), tier: this.state.selected, acceptedTerms: true,
    });
    if (operation !== this.operation) return;
    if (!response.ok) return this.fail(response.problem);
    const url = record(response.value) ? invoiceUrl(response.value.url) : null;
    if (url === null) return this.fail('unreadable');

    this.update({ stage: 'invoice', checkingOnly: true });
    let closed = false;
    const timer = setTimeout(() => {
      // A missing SDK callback is NOT a cancellation. Retry only checks access,
      // so a slow invoice can never lead to a second checkout or a double charge.
      if (!closed && this.state.stage === 'invoice') this.fail('unconfirmed');
    }, this.deps.invoiceTimeoutMs ?? 120_000);
    const problem = openTelegramInvoice(this.deps.app(), url, (status) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      if (this.state.stage === 'confirmed') return;
      if (status === 'paid' || status === 'pending') {
        void this.checkEntitlement();
      } else if (status === 'unknown') {
        this.fail('unconfirmed');
      } else {
        this.update({ checkingOnly: false });
        this.fail(status === 'cancelled' ? 'cancelled' : 'failed');
      }
    });
    if (problem !== null && !closed) {
      closed = true;
      clearTimeout(timer);
      this.update({ checkingOnly: false });
      this.fail(problem);
    }
  }

  private async checkEntitlement(): Promise<void> {
    if (this.state.stage === 'checking' || this.state.stage === 'confirmed') return;
    const operation = ++this.operation;
    this.update({ stage: 'checking', problem: null, checkingOnly: true });
    // At most eight requests, each bounded to eight seconds, with seven short
    // gaps. No interval survives success/failure, no background retry is endless.
    const attempts = this.deps.pollAttempts ?? 8;
    let problem: SubscriptionProblem = 'unconfirmed';
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await this.offers();
      if (operation !== this.operation) return;
      if (response.ok && response.value.entitled) return this.confirm();
      if (!response.ok) {
        problem = response.problem;
        if (problem === 'unauthorized' || problem === 'outside-telegram' || problem === 'unreadable') break;
      } else {
        problem = 'unconfirmed';
      }
      if (attempt + 1 < attempts) {
        await new Promise<void>((resolve) => setTimeout(resolve, this.deps.pollIntervalMs ?? 1_500));
        if (operation !== this.operation) return;
      }
    }
    this.fail(problem);
  }
}
