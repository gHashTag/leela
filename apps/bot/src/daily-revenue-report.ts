/**
 * One aggregate Stars growth brief for each configured payment operator.
 *
 * The database provides completed-day aggregates only; this module never sees
 * a payer, charge or invoice. Telegram's current balance is kept separate from
 * Leela's recorded gross/refunds because other balance movements and external
 * chargebacks can exist.
 */

import {
  LANGUAGES,
  messageFor,
  resolveLanguage,
  type Language,
} from '@leela/content';
import type { StarAmount } from 'grammy/types';
import { msUntilHour } from './initiative';
import { DAY_MS } from './stars';
import type { DailyRevenueSnapshot, RevenueReportStore } from './store';

export const DEFAULT_REVENUE_REPORT_HOUR = 1;
export const DEFAULT_REVENUE_REPORT_LANGUAGE: Language = 'ru';

export function revenueReportHour(
  env: Record<string, string | undefined> = process.env,
): number {
  const written = env.LEELA_REVENUE_REPORT_HOUR?.trim();
  if (!written) return DEFAULT_REVENUE_REPORT_HOUR;
  const hour = Number(written);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23
    ? hour
    : DEFAULT_REVENUE_REPORT_HOUR;
}

export function revenueReportLanguage(
  env: Record<string, string | undefined> = process.env,
): Language {
  const written = (env.LEELA_REVENUE_REPORT_LANGUAGE ?? env.LEELA_PUBLIC_LANGUAGE)?.trim();
  if (!written) return DEFAULT_REVENUE_REPORT_LANGUAGE;
  const primary = written.toLowerCase().split(/[-_]/)[0] ?? '';
  return (LANGUAGES as readonly string[]).includes(primary)
    ? resolveLanguage(primary)
    : DEFAULT_REVENUE_REPORT_LANGUAGE;
}

/** The immediately preceding completed UTC calendar day. */
export function reportDay(at: number): number {
  return Math.floor(at / DAY_MS) - 1;
}

function netOf(day: DailyRevenueSnapshot): number {
  return day.grossStars - day.refundedStars;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function changeFor(
  language: Language,
  current: DailyRevenueSnapshot,
  previous: DailyRevenueSnapshot,
): string {
  const net = netOf(current);
  const before = netOf(previous);
  const delta = net - before;
  if (before === 0 && net > 0) {
    return messageFor(language, 'revenue.changeNew', { delta: signed(delta) });
  }
  if (before <= 0) {
    return messageFor(language, 'revenue.changeNA', { delta: signed(delta) });
  }
  const percent = before === 0 ? 0 : Math.round((delta / Math.abs(before)) * 100);
  return messageFor(language, 'revenue.changePercent', {
    delta: signed(delta),
    percent: signed(percent),
  });
}

function decimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function balanceFor(language: Language, balance: StarAmount | undefined): string {
  if (!balance) return messageFor(language, 'revenue.balanceUnavailable');
  const billion = 1_000_000_000n;
  const total = BigInt(balance.amount) * billion + BigInt(balance.nanostar_amount ?? 0);
  const sign = total < 0n ? '-' : '';
  const absolute = total < 0n ? -total : total;
  const whole = absolute / billion;
  const fraction = String(absolute % billion).padStart(9, '0').replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''} XTR`;
}

export function growthFocusFor(
  language: Language,
  current: DailyRevenueSnapshot,
  previous: DailyRevenueSnapshot,
): string {
  const f = current.funnel;
  if (f.invoice > f.purchase) return messageFor(language, 'revenue.focus.checkout');
  if (f.paywall > f.invoice) return messageFor(language, 'revenue.focus.offer');
  if (f.purchase > f.return) return messageFor(language, 'revenue.focus.return');
  if (f.trial > f.paywall) return messageFor(language, 'revenue.focus.fourth');
  if (current.publicPosted && current.publicStarts === 0) {
    return messageFor(language, 'revenue.focus.public');
  }
  if (netOf(current) === 0) return messageFor(language, 'revenue.focus.acquire');
  if (netOf(current) > netOf(previous)) return messageFor(language, 'revenue.focus.momentum');
  return messageFor(language, 'revenue.focus.protect');
}

export function composeDailyRevenueReport(
  language: Language,
  current: DailyRevenueSnapshot,
  previous: DailyRevenueSnapshot,
  balance: StarAmount | undefined,
): string {
  const average = current.payments === 0 ? 0 : current.grossStars / current.payments;
  return messageFor(language, 'revenue.report', {
    date: new Date(current.day * DAY_MS).toISOString().slice(0, 10),
    balance: balanceFor(language, balance),
    net: netOf(current),
    change: changeFor(language, current, previous),
    gross: current.grossStars,
    refunded: current.refundedStars,
    refunds: current.refunds,
    payments: current.payments,
    payers: current.payers,
    average: decimal(average),
    trial: current.funnel.trial,
    paywall: current.funnel.paywall,
    invoice: current.funnel.invoice,
    purchase: current.funnel.purchase,
    return: current.funnel.return,
    publicStarts: current.publicStarts,
    focus: growthFocusFor(language, current, previous),
  });
}

interface RevenueApi {
  getMyStarBalance(): Promise<StarAmount>;
  sendMessage(chatId: string, text: string): Promise<unknown>;
}

export interface DailyRevenueReporterOptions {
  api: RevenueApi;
  reports: RevenueReportStore;
  recipients: readonly string[];
  language: Language;
  hour?: number;
  now?: () => number;
  schedule?: (run: () => void, inMs: number) => () => void;
  log?: (message: string) => void;
}

export interface RevenueTick {
  day: number;
  sent: number;
  skipped: number;
}

export interface DailyRevenueReporter {
  runTick(at: number): Promise<RevenueTick>;
  start(): Promise<void>;
  stop(): void;
}

export function createDailyRevenueReporter({
  api,
  reports,
  recipients,
  language,
  hour = DEFAULT_REVENUE_REPORT_HOUR,
  now = Date.now,
  schedule = (run, inMs) => {
    const timer = setTimeout(run, inMs);
    timer.unref?.();
    return () => clearTimeout(timer);
  },
  log = console.log,
}: DailyRevenueReporterOptions): DailyRevenueReporter {
  let armed = false;
  let cancel: (() => void) | undefined;
  const sending = new Set<string>();
  const delivered = new Set<string>();

  const runTick = async (at: number): Promise<RevenueTick> => {
    const day = reportDay(at);
    const candidates: Array<{ recipient: string; key: string }> = [];
    let skipped = 0;

    for (const recipient of recipients) {
      const key = `${day}:${recipient}`;
      if (sending.has(key) || delivered.has(key)) {
        skipped += 1;
        continue;
      }
      candidates.push({ recipient, key });
    }

    if (candidates.length === 0) return { day, sent: 0, skipped };

    let current: DailyRevenueSnapshot;
    let previous: DailyRevenueSnapshot;
    try {
      [current, previous] = await Promise.all([reports.day(day), reports.day(day - 1)]);
    } catch {
      log('[revenue] aggregate snapshot could not be read; no report was sent.');
      return { day, sent: 0, skipped: skipped + candidates.length };
    }

    let balance: StarAmount | undefined;
    try {
      balance = await api.getMyStarBalance();
    } catch {
      log('[revenue] Telegram balance is unavailable; local aggregates will still be sent.');
    }
    const text = composeDailyRevenueReport(language, current, previous, balance);
    let sent = 0;

    for (const candidate of candidates) {
      // Claim only when this recipient is about to cross into Telegram. A
      // crash or blocked earlier recipient must leave every later recipient
      // available to another Railway process. This synchronous lock still
      // collapses overlapping ticks in this process before the durable await.
      if (sending.has(candidate.key) || delivered.has(candidate.key)) {
        skipped += 1;
        continue;
      }
      sending.add(candidate.key);
      try {
        if (!(await reports.claimDelivery(day, candidate.recipient, at))) {
          sending.delete(candidate.key);
          skipped += 1;
          continue;
        }
      } catch {
        sending.delete(candidate.key);
        log('[revenue] a delivery claim could not be kept; that recipient was skipped.');
        skipped += 1;
        continue;
      }

      try {
        await api.sendMessage(candidate.recipient, text);
      } catch {
        log('[revenue] a private operator report was not delivered; it remains available for retry.');
        try {
          await reports.releaseDelivery(day, candidate.recipient);
        } catch {
          log('[revenue] a refused delivery claim could not be released.');
        }
        skipped += 1;
        sending.delete(candidate.key);
        continue;
      }

      delivered.add(candidate.key);
      sent += 1;
      try {
        await reports.recordDelivery(day, candidate.recipient, at);
      } catch {
        log('[revenue] an operator report was delivered, but its marker could not be kept.');
      } finally {
        sending.delete(candidate.key);
      }
    }

    if (sent > 0) log(`[revenue] delivered ${sent} aggregate daily report(s) for UTC day ${day}.`);
    return { day, sent, skipped };
  };

  const arm = (from = now()): void => {
    if (!armed) return;
    cancel = schedule(() => {
      cancel = undefined;
      void runTick(now()).finally(() => {
        if (armed) arm();
      });
    }, msUntilHour(from, hour));
  };

  return {
    runTick,
    async start(): Promise<void> {
      if (armed || recipients.length === 0) return;
      armed = true;
      const startedAt = now();
      if (new Date(startedAt).getUTCHours() >= hour) {
        await runTick(startedAt);
        arm();
      } else {
        // Use the same clock sample for the hour decision and timer. Starting
        // one millisecond before the hour must not accidentally skip a day.
        arm(startedAt);
      }
    },
    stop(): void {
      cancel?.();
      cancel = undefined;
      armed = false;
    },
  };
}
