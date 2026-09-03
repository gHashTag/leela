/**
 * What an operator needs to see, and what to do about it.
 *
 * The daily report already carried the money and `growthFocusFor` already
 * carried one sentence of direction. Two things were missing from it, and the
 * owner found both the hard way: **errors were nowhere on it**, so a companion
 * that had been refusing since before 06:00 was discovered by typing into the
 * chat and getting a canned line twice; and the one sentence of direction never
 * distinguished a product problem from a distribution one, which are opposite
 * instructions.
 *
 * ## This module never sends anything
 *
 * It returns text. Sending is the caller's, and the caller is a schedule that
 * shipped. That boundary is not decoration: a mailing went to every subscriber
 * once because a sender was run by hand to see what it would do, and "to see
 * what it would do" is not a schedule. An advisor that could also send would
 * make that mistake reachable from a recommendation.
 *
 * So every line here is phrased as advice to a person, and the block ends by
 * saying so out loud — because an operator reading a machine-written
 * recommendation should know which half of it already happened.
 *
 * ## Why a mailing is usually the wrong answer
 *
 * The ranking below puts product repairs above reach, and that ordering is the
 * opinion worth arguing with. A mailing to people who arrive at a broken thing
 * spends the one asset that does not regenerate — their willingness to open the
 * next one. So while the companion is refusing, or the fourth move is a wall
 * with no door, the advice is to fix and not to send, and it says why.
 */

import { messageFor, type Language } from '@leela/content';
import type { DailyRevenueSnapshot } from './store';

/** What the operator surface knows about the machine, as opposed to the money. */
export interface Health {
  /**
   * The companion's provider, asked rather than inferred. `null` when nothing
   * asked it — reported as unknown, never as healthy.
   */
  readonly companion: {
    readonly ok: boolean;
    readonly said: string;
    readonly provider: string;
  } | null;
}

/** One thing to do, and the measurement it rests on. */
export interface Advice {
  /** `fix` changes the product; `reach` sends something to people. */
  readonly kind: 'fix' | 'reach';
  readonly text: string;
}

const starts = (s: DailyRevenueSnapshot): number =>
  s.acquisition.reduce((total, one) => total + one.starts, 0);

/**
 * The health block: what is broken right now, in the operator's language.
 *
 * Returns no lines at all when nothing is wrong, so a healthy day's report is
 * not padded with green ticks nobody reads. An unknown companion DOES produce a
 * line, because "nobody asked" and "it is fine" are different and only one of
 * them is safe to skip.
 */
export function healthLines(language: Language, health: Health): string[] {
  const lines: string[] = [];
  if (health.companion === null) {
    lines.push(messageFor(language, 'ops.companion.unknown'));
  } else if (!health.companion.ok) {
    lines.push(
      messageFor(language, 'ops.companion.refusing', {
        provider: health.companion.provider,
        said: health.companion.said,
      }),
    );
  }
  return lines;
}

/**
 * Up to three things to do, worst first.
 *
 * Ranked by where the loss is, not by how easy the answer is. A funnel step
 * that loses everyone outranks reach, because reach multiplies whatever the
 * funnel does to a person and multiplying zero is still zero.
 */
export function salesAdvice(
  language: Language,
  current: DailyRevenueSnapshot,
  previous: DailyRevenueSnapshot,
  health: Health,
): Advice[] {
  const out: Advice[] = [];
  const f = current.funnel;
  const arrived = starts(current);

  if (health.companion !== null && !health.companion.ok) {
    out.push({ kind: 'fix', text: messageFor(language, 'ops.advice.companion') });
  }
  if (f.invoice > f.purchase) {
    out.push({ kind: 'fix', text: messageFor(language, 'ops.advice.checkout') });
  } else if (f.paywall > f.invoice) {
    out.push({ kind: 'fix', text: messageFor(language, 'ops.advice.offer') });
  } else if (f.trial > f.paywall) {
    out.push({ kind: 'fix', text: messageFor(language, 'ops.advice.fourth') });
  } else if (arrived > 0 && f.trial === 0) {
    out.push({
      kind: 'fix',
      text: messageFor(language, 'ops.advice.thirdMove', { starts: arrived }),
    });
  }

  // Reach comes last and only when the product is not visibly losing people.
  const productIsLosingPeople = out.some((one) => one.kind === 'fix');
  if (!productIsLosingPeople && arrived === 0) {
    out.push({
      kind: 'reach',
      text: current.publicPosted
        ? messageFor(language, 'ops.advice.postedNobodyCame')
        : messageFor(language, 'ops.advice.nothingWentOut'),
    });
  } else if (productIsLosingPeople && arrived === 0) {
    out.push({ kind: 'fix', text: messageFor(language, 'ops.advice.fixBeforeReach') });
  }

  if (out.length === 0) {
    out.push({
      kind: current.payers > previous.payers ? 'reach' : 'fix',
      text:
        current.payers > previous.payers
          ? messageFor(language, 'ops.advice.momentum')
          : messageFor(language, 'ops.advice.hold'),
    });
  }

  return out.slice(0, 3);
}

/** The whole operator block, or an empty string when there is nothing to add. */
export function operatorBlock(
  language: Language,
  current: DailyRevenueSnapshot,
  previous: DailyRevenueSnapshot,
  health: Health,
): string {
  const problems = healthLines(language, health);
  const advice = salesAdvice(language, current, previous, health);
  const parts: string[] = [];
  if (problems.length > 0) {
    parts.push(`${messageFor(language, 'ops.errors')}\n${problems.join('\n')}`);
  }
  parts.push(
    `${messageFor(language, 'ops.advice')}\n` +
      advice
        .map((one) => `${messageFor(language, `ops.kind.${one.kind}`)} ${one.text}`)
        .join('\n'),
  );
  // Said every time, not once: the boundary is the point.
  parts.push(messageFor(language, 'ops.nothingIsSent'));
  return parts.join('\n\n');
}
