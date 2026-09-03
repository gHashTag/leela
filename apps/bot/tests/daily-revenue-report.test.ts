import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import {
  DEFAULT_REVENUE_REPORT_HOUR,
  composeDailyRevenueReport,
  createDailyRevenueReporter,
  growthFocusFor,
  reportDay,
  revenueReportHour,
  revenueReportLanguage,
  revenueReportRecipients,
} from '../src/daily-revenue-report';
import type { DailyRevenueSnapshot, RevenueReportStore } from '../src/store';
import { DAY_MS } from '../src/stars';

const DAY = 20_000;

function snapshot(
  day: number,
  changed: Partial<DailyRevenueSnapshot> = {},
): DailyRevenueSnapshot {
  return {
    day,
    grossStars: 0,
    refundedStars: 0,
    payments: 0,
    payers: 0,
    refunds: 0,
    funnel: { trial: 0, paywall: 0, invoice: 0, purchase: 0, return: 0 },
    publicStarts: 0,
    publicPosted: false,
    acquisition: [
      { source: 'direct', starts: 0, purchases: 0 },
      { source: 'public', starts: 0, purchases: 0 },
      { source: 'guest', starts: 0, purchases: 0 },
      { source: 'inline', starts: 0, purchases: 0 },
      { source: 'mini_app', starts: 0, purchases: 0 },
    ],
    ...changed,
  };
}

function memoryReports(
  values: Map<number, DailyRevenueSnapshot> = new Map(),
): RevenueReportStore & { delivered: Set<string>; claimed: Set<string> } {
  const delivered = new Set<string>();
  const claimed = new Set<string>();
  return {
    delivered,
    claimed,
    async day(day) {
      return values.get(day) ?? snapshot(day);
    },
    async claimDelivery(day, recipient) {
      const key = `${day}:${recipient}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
    async releaseDelivery(day, recipient) {
      claimed.delete(`${day}:${recipient}`);
    },
    async recordDelivery(day, recipient) {
      delivered.add(`${day}:${recipient}`);
    },
  };
}

describe('daily revenue report arithmetic', () => {
  it('selects the immediately preceding complete UTC day', () => {
    expect(reportDay(Date.parse('2026-09-02T01:00:00Z'))).toBe(
      Math.floor(Date.parse('2026-09-01T00:00:00Z') / DAY_MS),
    );
  });

  it('takes only a valid configured UTC hour', () => {
    expect(revenueReportHour({})).toBe(DEFAULT_REVENUE_REPORT_HOUR);
    expect(revenueReportHour({ LEELA_REVENUE_REPORT_HOUR: '9' })).toBe(9);
    for (const refused of ['-1', '24', '1.5', 'later', '']) {
      expect(revenueReportHour({ LEELA_REVENUE_REPORT_HOUR: refused })).toBe(
        DEFAULT_REVENUE_REPORT_HOUR,
      );
    }
  });

  it('defaults operator copy to Russian and can follow an explicit or public locale', () => {
    expect(revenueReportLanguage({})).toBe('ru');
    expect(revenueReportLanguage({ LEELA_PUBLIC_LANGUAGE: 'en-US' })).toBe('en');
    expect(revenueReportLanguage({ LEELA_PUBLIC_LANGUAGE: 'en', LEELA_REVENUE_REPORT_LANGUAGE: 'ru' })).toBe('ru');
    expect(revenueReportLanguage({ LEELA_REVENUE_REPORT_LANGUAGE: 'unknown' })).toBe('ru');
  });

  it('uses a report-only recipient list without granting refund authority', () => {
    expect(revenueReportRecipients({}, ['11'])).toEqual(['11']);
    expect(revenueReportRecipients({ LEELA_REVENUE_REPORT_RECIPIENTS: '22, 33' }, ['11']))
      .toEqual(['22', '33']);
    expect(revenueReportRecipients({ LEELA_REVENUE_REPORT_RECIPIENTS: '22,22' }, ['11']))
      .toEqual(['22']);
  });

  it('refuses an explicitly malformed report recipient list instead of falling back', () => {
    for (const refused of ['', '0', '-1', '11,user', '1e3']) {
      expect(revenueReportRecipients({ LEELA_REVENUE_REPORT_RECIPIENTS: refused }, ['11']))
        .toEqual([]);
    }
  });

  it('names recorded XTR, day-over-day growth, payer average and exact Telegram balance', () => {
    const text = composeDailyRevenueReport(
      'ru',
      snapshot(DAY, {
        grossStars: 300,
        refundedStars: 50,
        payments: 3,
        payers: 2,
        refunds: 1,
        funnel: { trial: 9, paywall: 7, invoice: 4, purchase: 3, return: 2 },
        publicStarts: 5,
        publicPosted: true,
        acquisition: [
          { source: 'direct', starts: 2, purchases: 1 },
          { source: 'public', starts: 5, purchases: 2 },
          { source: 'guest', starts: 3, purchases: 1 },
          { source: 'inline', starts: 4, purchases: 0 },
          { source: 'mini_app', starts: 6, purchases: 2 },
        ],
      }),
      snapshot(DAY - 1, { grossStars: 100, payments: 1, payers: 1 }),
      { amount: 123, nanostar_amount: 500_000_000 },
    );

    expect(text).toContain('250 XTR');
    expect(text).toContain('+150 XTR (+150%)');
    expect(text).toContain('300 XTR');
    expect(text).toContain('50 XTR');
    expect(text).toContain('3');
    expect(text).toContain('2');
    expect(text).toContain('100 XTR');
    expect(text).toContain('9 → 7 → 4 → 3 → 2');
    expect(text).toContain('5');
    expect(text).toContain('123.5 XTR');
    expect(text).toContain('UTC');
    expect(text).toContain('зафиксировано Leela');
    expect(text).toContain('лимит → пейвол → счёт → покупка → возврат в игру');
    expect(text).toContain('гостевой режим: 3 → 1');
    expect(text).toContain('инлайн-режим: 4 → 0');
    expect(text).toContain('главное мини-приложение: 6 → 2');
    expect(text).not.toMatch(/trial|paywall|invoice|purchase|return|gross|checkout|hook|CTA|\bnet\b/i);
    expect(text).not.toMatch(/user|charge|payload/i);
  });

  it('does not invent a percentage when the previous net is zero or negative', () => {
    const fromZero = composeDailyRevenueReport(
      'ru',
      snapshot(DAY, { grossStars: 150, payments: 1, payers: 1 }),
      snapshot(DAY - 1),
      undefined,
    );
    expect(fromZero).toContain('+150 XTR (новый рост)');
    expect(fromZero).toContain('Текущий баланс Telegram: недоступен');
    expect(composeDailyRevenueReport('en', snapshot(DAY), snapshot(DAY - 1), undefined))
      .toContain('0 XTR (n/a)');

    const fromNegative = composeDailyRevenueReport(
      'en',
      snapshot(DAY, { grossStars: 10, payments: 1, payers: 1 }),
      snapshot(DAY - 1, { refundedStars: 20, refunds: 1 }),
      { amount: -1, nanostar_amount: -250_000_000 },
    );
    expect(fromNegative).toContain('+30 XTR (n/a)');
    expect(fromNegative).toContain('-1.25 XTR');
  });

  it('grounds every growth focus in an observable aggregate and never claims conversion', () => {
    const prior = snapshot(DAY - 1);
    const cases: Array<[Partial<DailyRevenueSnapshot>, string]> = [
      [{ funnel: { trial: 3, paywall: 3, invoice: 3, purchase: 1, return: 1 } }, 'счетов'],
      [{ funnel: { trial: 3, paywall: 3, invoice: 1, purchase: 1, return: 1 } }, 'пейволов'],
      [{ payments: 2, funnel: { trial: 2, paywall: 2, invoice: 2, purchase: 2, return: 0 } }, 'платных возвратов'],
      [{ funnel: { trial: 4, paywall: 1, invoice: 1, purchase: 1, return: 1 } }, 'четвёртого хода'],
      [{ publicPosted: true, publicStarts: 0 }, 'Публичный пост'],
      [{}, 'новых игроков'],
      [{ grossStars: 150, payments: 1, payers: 1, funnel: { trial: 1, paywall: 1, invoice: 1, purchase: 1, return: 1 } }, 'Положительная динамика'],
      [{ grossStars: 50, payments: 1, payers: 1, funnel: { trial: 1, paywall: 1, invoice: 1, purchase: 1, return: 1 } }, 'сохранить итог'],
    ];

    const growingPrior = snapshot(DAY - 1, { grossStars: 100, payments: 1, payers: 1 });
    for (const [changed, phrase] of cases) {
      const base = phrase === 'сохранить итог' ? growingPrior : prior;
      expect(growthFocusFor('ru', snapshot(DAY, changed), base)).toContain(phrase);
    }
  });
});

describe('daily revenue report delivery', () => {
  it('arms nothing and touches nothing when there are no trusted recipients', async () => {
    let touched = false;
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { touched = true; return { amount: 0 }; },
        async sendMessage() { touched = true; return {}; },
      },
      reports: {
        async day(day) { touched = true; return snapshot(day); },
        async claimDelivery() { touched = true; return true; },
        async releaseDelivery() { touched = true; },
        async recordDelivery() { touched = true; },
      },
      recipients: [],
      language: 'ru',
      schedule() { touched = true; return () => undefined; },
    });

    await reporter.start();
    expect(touched).toBe(false);
  });

  it('still sends the money when the companion probe throws, and says it is unknown', async () => {
    // The probe is a network call to somebody else's service on the one morning
    // an operator reads the numbers. If it can take the report down, the report
    // is worth less than the probe — and the numbers are the part that cannot
    // be reconstructed later, while an unknown companion is a printable state.
    //
    // `audit-promises` demanded this case by name: every injected dependency
    // needs a test that hands it a broken implementation.
    const now = (DAY + 1) * DAY_MS + 2 * 60 * 60 * 1000;
    const said: string[] = [];
    const logged: string[] = [];
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage(_recipient, text) { said.push(text); return {}; },
      },
      reports: memoryReports(new Map([[DAY, snapshot(DAY)], [DAY - 1, snapshot(DAY - 1)]])),
      recipients: ['11'],
      language: 'ru',
      hour: 1,
      now: () => now,
      schedule: () => () => undefined,
      log: (line) => { logged.push(line); },
      health: async () => { throw new Error('the provider went away'); },
    });

    const tick = await reporter.runTick(now);
    expect(tick.sent).toBe(1);
    expect(said[0]).toContain(messageFor('ru', 'ops.companion.unknown'));
    expect(logged.some((line) => line.includes('companion could not be asked'))).toBe(true);
    // And the money it was sent for is still in it.
    expect(said[0]).toContain(messageFor('ru', 'ops.advice'));
  });

  it('never treats a probe that hangs as a healthy companion', async () => {
    // A probe that never returns is the other broken implementation, and it
    // must not be able to print a green line. Resolved as unknown rather than
    // awaited forever: the caller owns the timeout, and what matters here is
    // that "no answer" and "answered" are not the same word.
    const now = (DAY + 1) * DAY_MS + 2 * 60 * 60 * 1000;
    const said: string[] = [];
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage(_recipient, text) { said.push(text); return {}; },
      },
      reports: memoryReports(new Map([[DAY, snapshot(DAY)], [DAY - 1, snapshot(DAY - 1)]])),
      recipients: ['11'],
      language: 'ru',
      hour: 1,
      now: () => now,
      schedule: () => () => undefined,
      health: async () => ({ companion: null }),
    });

    await reporter.runTick(now);
    expect(said[0]).toContain(messageFor('ru', 'ops.companion.unknown'));
    expect(said[0]).not.toContain('answered');
  });

  it('waits until the configured hour when startup happens before it', async () => {
    const scheduled: Array<{ run: () => void; inMs: number }> = [];
    const sent: string[] = [];
    const now = Date.parse('2026-09-02T00:30:00Z');
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage(recipient) { sent.push(recipient); return {}; },
      },
      reports: memoryReports(),
      recipients: ['11'],
      language: 'ru',
      hour: 1,
      now: () => now,
      schedule(run, inMs) {
        scheduled.push({ run, inMs });
        return () => undefined;
      },
    });

    await reporter.start();
    expect(sent).toEqual([]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.inMs).toBe(30 * 60 * 1000);
    reporter.stop();
  });

  it('catches up after the hour, sends every operator once and survives a restart', async () => {
    const now = (DAY + 1) * DAY_MS + 2 * 60 * 60 * 1000;
    const reports = memoryReports(new Map([
      [DAY, snapshot(DAY, { grossStars: 150, payments: 1, payers: 1 })],
      [DAY - 1, snapshot(DAY - 1)],
    ]));
    const sent: string[] = [];
    const api = {
      async getMyStarBalance() { return { amount: 150 }; },
      async sendMessage(recipient: string) { sent.push(recipient); return {}; },
    };
    const options = {
      api,
      reports,
      recipients: ['11', '22'],
      language: 'ru' as const,
      hour: 1,
      now: () => now,
      schedule: () => () => undefined,
    };

    await createDailyRevenueReporter(options).start();
    await createDailyRevenueReporter(options).start();

    expect(sent).toEqual(['11', '22']);
    expect([...reports.delivered]).toEqual([`${DAY}:11`, `${DAY}:22`]);
  });

  it('collapses concurrent ticks before Telegram receives a duplicate', async () => {
    const reports = memoryReports();
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const sent: string[] = [];
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage(recipient) { sent.push(recipient); await blocked; return {}; },
      },
      reports,
      recipients: ['11'],
      language: 'ru',
      schedule: () => () => undefined,
    });

    const first = reporter.runTick((DAY + 1) * DAY_MS);
    const second = reporter.runTick((DAY + 1) * DAY_MS);
    await Promise.resolve();
    await Promise.resolve();
    release?.();
    await Promise.all([first, second]);

    expect(sent).toEqual(['11']);
  });

  it('uses the durable claim to collapse overlapping reporter processes', async () => {
    const reports = memoryReports();
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const sent: string[] = [];
    const options = {
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage(recipient: string) { sent.push(recipient); await blocked; return {}; },
      },
      reports,
      recipients: ['11'],
      language: 'ru' as const,
      schedule: () => () => undefined,
    };
    const first = createDailyRevenueReporter(options);
    const overlappingDeploy = createDailyRevenueReporter(options);

    const a = first.runTick((DAY + 1) * DAY_MS);
    const b = overlappingDeploy.runTick((DAY + 1) * DAY_MS);
    await Promise.resolve();
    await Promise.resolve();
    release?.();
    await Promise.all([a, b]);

    expect(sent).toEqual(['11']);
  });

  it('claims an operator only when its own Telegram send is about to start', async () => {
    const reports = memoryReports();
    let release: (() => void) | undefined;
    let announceFirst: (() => void) | undefined;
    const firstSend = new Promise<void>((resolve) => { release = resolve; });
    const firstStarted = new Promise<void>((resolve) => { announceFirst = resolve; });
    const started: string[] = [];
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage(recipient) {
          started.push(recipient);
          if (recipient === '11') {
            announceFirst?.();
            await firstSend;
          }
          return {};
        },
      },
      reports,
      recipients: ['11', '22'],
      language: 'ru',
      schedule: () => () => undefined,
    });

    const tick = reporter.runTick((DAY + 1) * DAY_MS);
    await firstStarted;

    expect(started).toEqual(['11']);
    expect([...reports.claimed]).toEqual([`${DAY}:11`]);
    release?.();
    await tick;
    expect(started).toEqual(['11', '22']);
    expect([...reports.claimed]).toEqual([`${DAY}:11`, `${DAY}:22`]);
  });

  it('uses one startup clock sample when startup crosses the report hour', async () => {
    const scheduled: Array<{ run: () => void; inMs: number }> = [];
    const samples = [
      Date.parse('2026-09-02T00:59:59.999Z'),
      Date.parse('2026-09-02T01:00:00.000Z'),
    ];
    let reads = 0;
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage() { return {}; },
      },
      reports: memoryReports(),
      recipients: ['11'],
      language: 'ru',
      hour: 1,
      now: () => samples[Math.min(reads++, samples.length - 1)] ?? samples[0]!,
      schedule(run, inMs) {
        scheduled.push({ run, inMs });
        return () => undefined;
      },
    });

    await reporter.start();
    expect(reads).toBe(1);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.inMs).toBe(1);
    reporter.stop();
  });

  it('does not re-arm after stop while a scheduled tick is in flight', async () => {
    const scheduled: Array<() => void> = [];
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage() { await blocked; return {}; },
      },
      reports: memoryReports(),
      recipients: ['11'],
      language: 'ru',
      hour: 1,
      now: () => Date.parse('2026-09-02T00:30:00Z'),
      schedule(run) {
        scheduled.push(run);
        return () => undefined;
      },
    });

    await reporter.start();
    scheduled[0]?.();
    await Promise.resolve();
    await Promise.resolve();
    reporter.stop();
    release?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(scheduled).toHaveLength(1);
  });

  it('isolates recipient failures and retries only the undelivered recipient', async () => {
    const reports = memoryReports();
    const sent: string[] = [];
    let firstFails = true;
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage(recipient) {
          sent.push(recipient);
          if (recipient === '11' && firstFails) throw new Error('403');
          return {};
        },
      },
      reports,
      recipients: ['11', '22'],
      language: 'ru',
      schedule: () => () => undefined,
      log: () => undefined,
    });

    await reporter.runTick((DAY + 1) * DAY_MS);
    firstFails = false;
    await reporter.runTick((DAY + 1) * DAY_MS);

    expect(sent).toEqual(['11', '22', '11']);
    expect([...reports.delivered]).toEqual([`${DAY}:22`, `${DAY}:11`]);
  });

  it('stays duplicate-safe when a marker read fails for one recipient', async () => {
    const base = memoryReports();
    const logs: string[] = [];
    const sent: string[] = [];
    const reports: RevenueReportStore = {
      ...base,
      async claimDelivery(day, recipient, at) {
        if (recipient === '11') throw new Error('database path must not be logged');
        return base.claimDelivery(day, recipient, at);
      },
    };
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { throw new Error('secret-shaped provider error'); },
        async sendMessage(recipient, text) { sent.push(recipient); expect(text).toContain('недоступен'); return {}; },
      },
      reports,
      recipients: ['11', '22'],
      language: 'ru',
      schedule: () => () => undefined,
      log: (line) => logs.push(line),
    });

    await reporter.runTick((DAY + 1) * DAY_MS);
    expect(sent).toEqual(['22']);
    expect(logs.join('\n')).not.toContain('11');
    expect(logs.join('\n')).not.toContain('secret-shaped');
    expect(logs.join('\n')).not.toContain('database path');
  });

  it('does not duplicate in-process after Telegram accepted a message whose marker failed', async () => {
    const base = memoryReports();
    const reports: RevenueReportStore = {
      ...base,
      async recordDelivery() { throw new Error('disk detail'); },
    };
    let sends = 0;
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage() { sends += 1; return {}; },
      },
      reports,
      recipients: ['11'],
      language: 'ru',
      schedule: () => () => undefined,
      log: () => undefined,
    });

    await reporter.runTick((DAY + 1) * DAY_MS);
    await reporter.runTick((DAY + 1) * DAY_MS);
    expect(sends).toBe(1);
  });

  it('sends nothing when aggregate financial storage cannot be read', async () => {
    const logs: string[] = [];
    let sends = 0;
    const reports: RevenueReportStore = {
      async day() { throw new Error('private database detail'); },
      async claimDelivery() { return true; },
      async releaseDelivery() { return; },
      async recordDelivery() { return; },
    };
    const reporter = createDailyRevenueReporter({
      api: {
        async getMyStarBalance() { return { amount: 0 }; },
        async sendMessage() { sends += 1; return {}; },
      },
      reports,
      recipients: ['11'],
      language: 'ru',
      schedule: () => () => undefined,
      log: (line) => logs.push(line),
    });

    await reporter.runTick((DAY + 1) * DAY_MS);
    expect(sends).toBe(0);
    expect(logs).toEqual(['[revenue] aggregate snapshot could not be read; no report was sent.']);
  });
});
