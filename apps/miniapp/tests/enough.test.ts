import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLASSIC, LEGACY_MOBILE, RULESETS, countsAsReport, type RuleSet } from '@leela/engine';
import { EMPTY, record } from '../src/reports';

/**
 * How much writing counts as an account.
 *
 * It is a rule of the game. `minReportChars` has been in `RuleSet` since the
 * published app was read for its rules — `yup.string().trim().min(100)` in
 * `CreatePost` — and `audit-variants` holds the flag to that source on every
 * run. The engine has the function that asks it.
 *
 * Three surfaces ask this question and **only the bot asked the engine.** This
 * one wrote `trimmed.length === 0` in `record`, which is `classic`'s answer
 * spelled out by hand: right for the variant being played and wrong for two of
 * the five the engine ships. A rule that appears outside `@leela/engine` has
 * already drifted or will.
 */

const MAIN = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');

describe('what counts is the variant\'s answer', () => {
  /**
   * Over every ruleset the engine ships, not the two that carry a minimum
   * today. A sixth variant with a different bound is exactly the case a list of
   * two would not cover, and reading a donor again is how this repository keeps
   * gaining them.
   */
  const shipped = Object.values(RULESETS) as RuleSet[];

  it.each(shipped.map((rules) => [rules.id, rules] as const))(
    '%s takes what it asks for and refuses less',
    (_id, rules) => {
      const enough = 'x'.repeat(Math.max(rules.minReportChars, 1));
      expect(record(EMPTY, 30, enough, 1, rules).entries).toHaveLength(1);

      if (rules.minReportChars > 0) {
        expect(
          record(EMPTY, 30, 'x'.repeat(rules.minReportChars - 1), 1, rules).entries,
          'one short',
        ).toHaveLength(0);
      }
    },
  );

  it('has at least one variant of each kind, or the rule is untested', () => {
    expect(new Set(shipped.map((rules) => rules.minReportChars)).size).toBeGreaterThan(1);
  });

  it('is never whitespace, whatever the variant says', () => {
    for (const rules of shipped) {
      expect(record(EMPTY, 30, '  \n\t ', 1, rules).entries, rules.id).toHaveLength(0);
    }
  });

  it('asks the engine rather than answering here', () => {
    // Ninety-nine characters is the interesting length: an account under
    // `classic`, not one under the rules the published app ships. A surface
    // deciding for itself would call it both.
    const ninetyNine = 'x'.repeat(99);

    expect(countsAsReport(ninetyNine, CLASSIC)).toBe(true);
    expect(countsAsReport(ninetyNine, LEGACY_MOBILE)).toBe(false);
    expect(record(EMPTY, 30, ninetyNine, 1, CLASSIC).entries).toHaveLength(1);
    expect(record(EMPTY, 30, ninetyNine, 1, LEGACY_MOBILE).entries).toHaveLength(0);
  });

  it('still opens the gate on the account it takes', () => {
    // `record` sets `reported`, which is what `draw` reads. A refusal must not
    // set it, or the writing box would close on words that were never kept.
    expect(record(EMPTY, 30, 'x'.repeat(99), 1, LEGACY_MOBILE).reported).toBe(EMPTY.reported);
    expect(record(EMPTY, 30, 'x'.repeat(100), 1, LEGACY_MOBILE).reported).toBe(true);
  });
});

describe('a refusal says which refusal it is', () => {
  it('tells a player who wrote nothing, and one who wrote too little, apart', () => {
    /**
     * The screen said *A report is something written. Nothing was.* to both,
     * which is untrue of the second and unhelpful to them: it names no amount,
     * so a player under `legacy-mobile` who typed ninety characters is told
     * their writing does not exist.
     *
     * The bot's own sentence, not a copy of it — `report.tooShort` names no
     * command and reads the same on any surface.
     */
    expect(MAIN).toContain("messageFor(language, 'app.reportEmpty')");
    expect(MAIN).toContain("messageFor(language, 'report.tooShort', { count: CLASSIC.minReportChars })");
  });
});
