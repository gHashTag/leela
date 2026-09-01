import { describe, expect, it } from 'vitest';
import { messageFor, planFor } from '@leela/content';
import {
  DOORSTEP_WORDS,
  FRESH_START_UNTIL_MS,
  LAPSED_AFTER_MS,
  compose,
  eligible,
  excerptsOf,
  type Candidate,
  type Verdict,
} from '../src/initiative';

/**
 * The third arm, and the proof that adding it did not blur the other two.
 *
 * It exists because of one line of production output: the initiative's first
 * real tick, 2026-08-23 06:00 UTC, read `sent 0; skipped: not-standing 1`. The
 * engine was right and the design was not — a player who took a seat and never
 * threw a six stands on no plan, and `not-standing` is not a passing state but
 * a permanent one, so exactly the person likeliest to be lost was answered
 * with silence for ever.
 *
 * The risk of a third arm is that two of them fire for one player, or that one
 * of them starts firing where another used to. So the first test below is not
 * an example: it is the whole cross-product of the facts `eligible` reads,
 * each answer checked against an oracle written from the spec's table rather
 * than from the implementation.
 */

const DAY = 24 * 60 * 60 * 1000;
/** A Friday, so the fresh-start Monday has to be asked for deliberately. */
const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);
/** 2026-08-24, the Monday after it. */
const MONDAY = Date.UTC(2026, 7, 24, 12, 0, 0);

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    standing: 12,
    finished: false,
    reachable: true,
    lastActiveAt: NOW - DAY,
    quieted: false,
    lastNudgedAt: null,
    doorstepsSent: 0,
    ...overrides,
  };
}

describe('the three arms are one fork', () => {
  /**
   * What the spec's table says, written again from the table.
   *
   * Deliberately a second implementation rather than a call into the first:
   * a test that asks the code what the code does proves only that it is
   * deterministic. This says, in the spec's own terms, which word each row
   * deserves — and the sweep below makes the two agree on every row there is.
   */
  function oracle(one: Candidate, at: number): 'daily' | 'freshStart' | 'doorstep' | 'none' {
    if (one.finished || !one.reachable || one.quieted) return 'none';
    if (one.lastNudgedAt !== null && Math.floor(one.lastNudgedAt / DAY) === Math.floor(at / DAY)) {
      return 'none';
    }
    if (one.standing === null) return one.doorstepsSent < DOORSTEP_WORDS ? 'doorstep' : 'none';

    const silence = one.lastActiveAt === null ? Infinity : at - one.lastActiveAt;
    if (silence <= LAPSED_AFTER_MS) return 'daily';
    if (silence <= FRESH_START_UNTIL_MS && new Date(at).getUTCDay() === 1) return 'freshStart';
    return 'none';
  }

  const wordOf = (verdict: Verdict): string => (verdict.send ? verdict.word : 'none');

  it('answers every combination of the facts it reads with exactly one word or none', () => {
    const standings = [null, 12, 68];
    const ages = [null, DAY, LAPSED_AFTER_MS + DAY, FRESH_START_UNTIL_MS + DAY];
    const doorsteps = [0, DOORSTEP_WORDS - 1, DOORSTEP_WORDS, DOORSTEP_WORDS + 1];
    const flags = [false, true];

    const disagreements: string[] = [];
    let rows = 0;

    // Every day of one week, so the fresh-start arm's Monday is asked in both
    // directions rather than assumed.
    for (let day = 0; day < 7; day += 1) {
      const at = MONDAY + day * DAY;
      for (const standing of standings) {
        for (const lastActiveAt of ages) {
          for (const doorstepsSent of doorsteps) {
            for (const finished of flags) {
              for (const reachable of flags) {
                for (const quieted of flags) {
                  for (const lastNudgedAt of [null, at - 2 * DAY, at]) {
                    const one = candidate({
                      standing,
                      lastActiveAt: lastActiveAt === null ? null : at - lastActiveAt,
                      doorstepsSent,
                      finished,
                      reachable,
                      quieted,
                      lastNudgedAt,
                    });
                    rows += 1;

                    const said = wordOf(eligible(one, at));
                    const expected = oracle(one, at);
                    if (said !== expected) {
                      disagreements.push(
                        `${JSON.stringify({ ...one, at })}: said ${said}, table says ${expected}`,
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(rows).toBe(7 * 3 * 4 * 4 * 2 * 2 * 2 * 3);
    expect(disagreements.slice(0, 5)).toEqual([]);
  });

  it('never sends the doorstep word to a player who stands somewhere', () => {
    const wrong = [12, 68, 1, 72]
      .flatMap((standing) => [null, DAY, 20 * DAY, 40 * DAY].map((age) => ({ standing, age })))
      .flatMap(({ standing, age }) =>
        [MONDAY, NOW].map((at) => ({
          at,
          verdict: eligible(
            candidate({ standing, lastActiveAt: age === null ? null : at - age }),
            at,
          ),
        })),
      )
      .filter(({ verdict }) => verdict.send && verdict.word === 'doorstep');

    expect(wrong).toEqual([]);
  });

  it('never sends a plan-shaped word to a player who stands nowhere', () => {
    const wrong = [null, DAY, 20 * DAY, 40 * DAY]
      .flatMap((age) =>
        [MONDAY, NOW].map((at) =>
          eligible(candidate({ standing: null, lastActiveAt: age === null ? null : at - age }), at),
        ),
      )
      .filter((verdict) => verdict.send && verdict.word !== 'doorstep');

    expect(wrong).toEqual([]);
  });
});

describe('the doorstep bound', () => {
  it('sends the third and refuses the fourth', () => {
    const said = [0, 1, 2, 3, 4].map((doorstepsSent) =>
      wordFor(candidate({ standing: null, doorstepsSent })),
    );

    expect(said).toEqual(['doorstep', 'doorstep', 'doorstep', 'doorstep-spent', 'doorstep-spent']);
  });

  it('spends nothing while the player is quiet, blocked or already knocked today', () => {
    // The bound is spent by a word arriving, not by a morning passing: each of
    // these skips leaves the allowance untouched, and the driver only records
    // a doorstep when the send succeeded.
    const stopped: Array<[string, Candidate]> = [
      ['quieted', candidate({ standing: null, quieted: true })],
      ['no-channel', candidate({ standing: null, reachable: false })],
      ['nudged-today', candidate({ standing: null, lastNudgedAt: NOW })],
    ];

    for (const [because, one] of stopped) expect(wordFor(one)).toBe(because);
  });

  function wordFor(one: Candidate): string {
    const verdict = eligible(one, NOW);
    return verdict.send ? verdict.word : verdict.because;
  }
});

describe('what the doorstep word says', () => {
  const plan = planFor('en', 12);

  it('names no plan, because the player is on none', () => {
    const word = compose('en', plan, null, { firstNudge: false, word: 'doorstep' });

    expect(word.text).not.toContain('standing on');
    expect(word.text).not.toContain(excerptsOf(plan.body)[0]);
    expect(word.text).toContain(messageFor('en', 'nudge.doorstep'));
    expect(word.text).toContain('/roll');
  });

  it('leaves the excerpt cursor exactly where it found it', () => {
    // A doorstep word carries no excerpt, so it must not spend one: a player
    // who enters after two of them starts the daily word where the cursor was.
    expect(compose('en', plan, 3, { firstNudge: false, word: 'doorstep' }).excerpt).toBe(3);
    expect(compose('en', plan, null, { firstNudge: false, word: 'doorstep' }).excerpt).toBe(0);
  });

  it('carries the way out the first time and not after', () => {
    const first = compose('en', plan, null, { firstNudge: true, word: 'doorstep' });
    const second = compose('en', plan, null, { firstNudge: false, word: 'doorstep' });

    expect(first.text).toContain('/quiet');
    expect(second.text).not.toContain('/quiet');
  });

  it('is translated, not fallen back to, in Russian', () => {
    for (const key of ['nudge.doorstep', 'nudge.doorstepCta'] as const) {
      const english = messageFor('en', key);
      const russian = messageFor('ru', key);

      expect(english.length).toBeGreaterThan(0);
      expect(russian).not.toBe(english);
      expect(russian).toMatch(/[а-яё]/i);
    }

    // And the Russian word is a Russian word all through: the call keeps the
    // command, which is not translated anywhere in this catalogue.
    expect(messageFor('ru', 'nudge.doorstepCta')).toContain('/roll');
  });
});
