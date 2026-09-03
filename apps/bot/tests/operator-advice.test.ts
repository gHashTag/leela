/**
 * The operator block: what is broken, and what to do about it.
 *
 * Written after the owner discovered a companion that had been refusing since
 * before 06:00 by typing into the chat and getting the same canned line twice.
 * The daily report he reads every morning carried the money and one sentence of
 * direction, and no errors at all.
 *
 * The ordering is the opinion under test here, not the wording. Reach is ranked
 * below repair on purpose: a mailing multiplies whatever the funnel does to a
 * person, and multiplying a leak sends more people through it. So the cases
 * below check that a broken product SUPPRESSES the advice to reach, which is
 * the one recommendation a machine can make that costs something irreversible.
 */

import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import { healthLines, operatorBlock, salesAdvice, type Health } from '../src/operator-advice';
import type { DailyRevenueSnapshot } from '../src/store';

const WELL: Health = { companion: { ok: true, said: 'answered', provider: 'z.ai' } };
const REFUSING: Health = {
  companion: {
    ok: false,
    said: 'Insufficient balance or no resource package. Please recharge.',
    provider: 'z.ai',
  },
};
const UNASKED: Health = { companion: null };

const day = (over: Partial<DailyRevenueSnapshot> = {}): DailyRevenueSnapshot => ({
  day: 20_700,
  grossStars: 0,
  refundedStars: 0,
  payments: 0,
  payers: 0,
  refunds: 0,
  funnel: { trial: 0, paywall: 0, invoice: 0, purchase: 0, return: 0 },
  publicStarts: 0,
  publicPosted: false,
  acquisition: [],
  ...over,
});

const arrivals = (starts: number, purchases = 0) => [
  { source: 'direct' as const, starts, purchases },
];

const kinds = (h: Health, c: DailyRevenueSnapshot, p = day()) =>
  salesAdvice('ru', c, p, h).map((one) => one.kind);

describe('the operator block', () => {
  describe('errors', () => {
    it('says nothing when the companion answers', () => {
      expect(healthLines('ru', WELL)).toEqual([]);
    });

    it('repeats the provider verbatim when it refuses', () => {
      const [line] = healthLines('ru', REFUSING);
      expect(line).toContain('Insufficient balance');
      expect(line).toContain('z.ai');
    });

    it('calls an unasked companion unknown rather than well', () => {
      // The distinction the whole monitor exists for. Silence here would be a
      // green tick for a question nobody put.
      const [line] = healthLines('ru', UNASKED);
      expect(line).toBe(messageFor('ru', 'ops.companion.unknown'));
      expect(healthLines('ru', UNASKED)).toHaveLength(1);
    });
  });

  describe('advice', () => {
    it('puts repairing the companion first, above everything', () => {
      const busy = day({ funnel: { trial: 9, paywall: 9, invoice: 9, purchase: 0, return: 0 } });
      const [first] = salesAdvice('ru', busy, day(), REFUSING);
      expect(first?.text).toBe(messageFor('ru', 'ops.advice.companion'));
      expect(first?.kind).toBe('fix');
    });

    it('names the price step when invoices went unpaid', () => {
      const c = day({ funnel: { trial: 5, paywall: 5, invoice: 5, purchase: 1, return: 0 } });
      expect(salesAdvice('ru', c, day(), WELL)[0]?.text)
        .toBe(messageFor('ru', 'ops.advice.checkout'));
    });

    it('names the offer when the wall produced no invoice', () => {
      const c = day({ funnel: { trial: 5, paywall: 5, invoice: 0, purchase: 0, return: 0 } });
      expect(salesAdvice('ru', c, day(), WELL)[0]?.text)
        .toBe(messageFor('ru', 'ops.advice.offer'));
    });

    it('names the first session when people arrived and none reached the third move', () => {
      const c = day({ acquisition: arrivals(12) });
      const [one] = salesAdvice('ru', c, day(), WELL);
      expect(one?.text).toContain('12');
      expect(one?.kind).toBe('fix');
    });

    it('advises reach ONLY when the product is not visibly losing people', () => {
      // The rule this file is really about. Same empty day twice; the only
      // difference is whether something upstream is broken.
      const quiet = day();
      expect(kinds(WELL, quiet)).toContain('reach');
      expect(kinds(REFUSING, quiet)).not.toContain('reach');
    });

    it('tells a leaking funnel to stop before reaching', () => {
      const leaking = day({ funnel: { trial: 4, paywall: 0, invoice: 0, purchase: 0, return: 0 } });
      const said = salesAdvice('ru', leaking, day(), WELL).map((one) => one.text);
      expect(said).toContain(messageFor('ru', 'ops.advice.fixBeforeReach'));
      expect(kinds(WELL, leaking)).not.toContain('reach');
    });

    it('separates a post that reached nobody from a post that never went out', () => {
      const posted = day({ publicPosted: true });
      const silent = day({ publicPosted: false });
      expect(salesAdvice('ru', posted, day(), WELL)[0]?.text)
        .toBe(messageFor('ru', 'ops.advice.postedNobodyCame'));
      expect(salesAdvice('ru', silent, day(), WELL)[0]?.text)
        .toBe(messageFor('ru', 'ops.advice.nothingWentOut'));
    });

    it('never returns more than three', () => {
      const everything = day({
        funnel: { trial: 9, paywall: 8, invoice: 7, purchase: 1, return: 0 },
        acquisition: arrivals(30),
      });
      expect(salesAdvice('ru', everything, day(), REFUSING).length).toBeLessThanOrEqual(3);
    });

    it('always says something, even on a day where nothing happened', () => {
      expect(salesAdvice('ru', day(), day(), WELL).length).toBeGreaterThan(0);
    });
  });

  describe('the whole block', () => {
    it('states in every rendering that the bot sends nothing itself', () => {
      // Not once at the top of a file, not in a comment: on every report. A
      // mailing went to every subscriber once because a sender was run by hand,
      // and the boundary between advice and action is the thing that failed.
      for (const health of [WELL, REFUSING, UNASKED]) {
        for (const snapshot of [day(), day({ acquisition: arrivals(4) })]) {
          expect(operatorBlock('ru', snapshot, day(), health))
            .toContain(messageFor('ru', 'ops.nothingIsSent'));
        }
      }
    });

    it('omits the errors heading entirely on a clean day', () => {
      expect(operatorBlock('ru', day(), day(), WELL))
        .not.toContain(messageFor('ru', 'ops.errors'));
      expect(operatorBlock('ru', day(), day(), REFUSING))
        .toContain(messageFor('ru', 'ops.errors'));
    });

    it('renders in both operator languages', () => {
      for (const language of ['ru', 'en'] as const) {
        const text = operatorBlock(language, day(), day(), REFUSING);
        expect(text).toContain(messageFor(language, 'ops.advice'));
        expect(text).toContain(messageFor(language, 'ops.nothingIsSent'));
        expect(text).not.toContain('undefined');
        expect(text).not.toContain('{');
      }
    });
  });
});
