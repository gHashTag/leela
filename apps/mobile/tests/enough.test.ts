import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { CLASSIC, LEGACY_MOBILE, RULESETS, countsAsReport, type RuleSet } from '@leela/engine';
import { EMPTY_PATH, record, takeAccount, type Store } from '../src/journal';

/**
 * How much writing counts as an account.
 *
 * It is a rule of the game. `minReportChars` has been in `RuleSet` since the
 * published app was read for its rules, cited to `yup.string().trim().min(100)`
 * in `CreatePost`, and `audit-variants` holds the flag to that source on every
 * run. The engine has the function that asks it.
 *
 * Three surfaces ask this question and **only the bot asked the engine.** The
 * mini app and this app each wrote `text.trim().length === 0` — `classic`'s
 * answer, spelled out by hand, twice each: once for the control's disabled
 * state and once for the act. A rule that appears outside `@leela/engine` has
 * already drifted or will, and this one had drifted in the only direction that
 * looks like nothing: it was right for the variant being played and wrong for
 * two of the five the engine shipped then — three of the six it ships now,
 * since `telegram` was read out of the bot donor with fifty characters on it.
 *
 * The grid below reads `RULESETS` rather than a list, which is why the sixth
 * variant needed no edit here to be covered. That is the same shape defect
 * this file is about, one level up.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = blank(readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8'));

const nowhere = (): Store => ({ getItem: () => null, setItem: () => undefined });

describe('what counts is the variant\'s answer', () => {
  /**
   * Over every ruleset the engine ships, rather than over the two that happen
   * to carry a minimum today. A sixth variant with a different bound is exactly
   * the case a list of two would not cover — and adding one is what this
   * repository does whenever it reads a donor again.
   */
  const shipped = Object.values(RULESETS) as RuleSet[];

  it.each(shipped.map((rules) => [rules.id, rules] as const))(
    '%s takes what it asks for and refuses less',
    (_id, rules) => {
      const enough = 'x'.repeat(Math.max(rules.minReportChars, 1));
      expect(record(EMPTY_PATH, 30, enough, 1, rules).entries).toHaveLength(1);

      if (rules.minReportChars > 0) {
        const short = 'x'.repeat(rules.minReportChars - 1);
        expect(record(EMPTY_PATH, 30, short, 1, rules).entries, 'one short').toHaveLength(0);
      }
    },
  );

  it('has at least one variant of each kind, or the rule is untested', () => {
    // The guard against a table that proves nothing: if every shipped ruleset
    // asked for the same amount, every case above would be the same case.
    const bounds = new Set(shipped.map((rules) => rules.minReportChars));
    expect(bounds.size, 'variants that differ on this').toBeGreaterThan(1);
  });

  it('follows the number rather than checking it, which is measured and not obvious', () => {
    /**
     * **What this grid cannot fail on.** The obvious sentence — *change a
     * variant's minimum and the boundary grid goes red* — is FALSE, and it was
     * believed for long enough to be written into a work order. MEASURED:
     * `telegram` was added with `minReportChars: 50`, the value was set to 0,
     * and this file stayed green at fifteen tests. It has to: every case above
     * derives its two lengths from the variant's own number, so it is
     * self-consistent at any value and cannot disagree with one.
     *
     * That is the right shape for this file. What it asserts is that the
     * surface asks the engine instead of answering for itself, which is the
     * defect it was written for — three surfaces each spelling out
     * `text.trim().length === 0`. The *number* is somebody else's job:
     * `scripts/audit-variants.mjs` holds `telegram.minReportChars = 50` to
     * `leela-chakra-bot/src/commands/report/index.ts:17` and `legacy-mobile`'s
     * 100 to `CreatePost`, and it is the run that goes red for a changed
     * number — measured too, on the same edit.
     *
     * Written as a test rather than as a paragraph so it stays true: if the
     * grid ever does start checking the number, these two synthetic variants
     * are what will fail.
     */
    for (const minReportChars of [0, 7, 4_000]) {
      const invented = { ...LEGACY_MOBILE, minReportChars } as RuleSet;
      const enough = 'x'.repeat(Math.max(minReportChars, 1));

      expect(record(EMPTY_PATH, 30, enough, 1, invented).entries, `${minReportChars}`).toHaveLength(1);
      if (minReportChars > 0) {
        const short = 'x'.repeat(minReportChars - 1);
        expect(record(EMPTY_PATH, 30, short, 1, invented).entries, `${minReportChars} short`).toHaveLength(0);
      }
    }
  });

  it('is never whitespace, whatever the variant says', () => {
    // A gate opened by spaces is the rule with its point removed.
    for (const rules of shipped) {
      expect(record(EMPTY_PATH, 30, '   \n\t  ', 1, rules).entries, rules.id).toHaveLength(0);
    }
  });

  it('asks the engine rather than answering here', () => {
    // The two must agree by construction, not by two people writing the same
    // comparison. Ninety-nine characters is the interesting length: it is an
    // account under `classic` and not one under the rules the published app
    // ships, and a surface that decided for itself would call it both.
    const ninetyNine = 'x'.repeat(99);

    expect(countsAsReport(ninetyNine, CLASSIC)).toBe(true);
    expect(countsAsReport(ninetyNine, LEGACY_MOBILE)).toBe(false);
    expect(record(EMPTY_PATH, 30, ninetyNine, 1, CLASSIC).entries).toHaveLength(1);
    expect(record(EMPTY_PATH, 30, ninetyNine, 1, LEGACY_MOBILE).entries).toHaveLength(0);
  });
});

describe('a refusal says which refusal it is', () => {
  /**
   * *Nothing was written* and *not enough was* are two different things to be
   * told. One boolean would leave a player who typed ninety characters under
   * `legacy-mobile` staring at a control that declines and says nothing —
   * which is the app ending somebody's turn without telling them, the shape
   * this surface has now been caught by three times.
   */
  it('names an empty draft', () => {
    const taken = takeAccount(EMPTY_PATH, 30, '   ', 1, nowhere(), LEGACY_MOBILE);

    expect(taken.written).toBe(false);
    expect(taken.refusal).toBe('empty');
    expect(taken.gateOpens, 'and the gate stays shut').toBe(false);
  });

  it('names one that is short of what the variant asks', () => {
    const taken = takeAccount(EMPTY_PATH, 30, 'x'.repeat(99), 1, nowhere(), LEGACY_MOBILE);

    expect(taken.written).toBe(false);
    expect(taken.refusal).toBe('too-short');
  });

  it('names nothing when the account was taken', () => {
    const taken = takeAccount(EMPTY_PATH, 30, 'x'.repeat(100), 1, nowhere(), LEGACY_MOBILE);

    expect(taken.written).toBe(true);
    expect(taken.refusal).toBe(null);
    expect(taken.gateOpens).toBe(true);
  });

  it('is said to the player, both ways round', () => {
    // The bot's sentence, not a second copy of it. `report.tooShort` names no
    // command and reads the same on any surface; a duplicate would be the
    // seventh restated list in this repository.
    expect(APP).toContain("messageFor(language, 'report.tooShort', { count: game.rules.minReportChars })");
    expect(APP).toContain("messageFor(language, 'app.reportEmpty')");
  });
});

describe('the control and the act ask one question', () => {
  it('draws the button from the engine, not from a length written here', () => {
    /**
     * A dimmed control is a drawing and a drawing refuses nothing — asked
     * twice, as `throwDie` re-asks `mayThrow`. What matters is that both times
     * it is the *same* question: the disabled state used to be
     * `writing.trim().length === 0` and the act used to be `record`'s own copy
     * of the same literal, which is one rule written twice on one screen.
     */
    expect(APP).toContain('const enough = countsAsReport(writing, game.rules)');
    expect(APP).toContain('disabled={!enough}');
    expect(APP, 'the act is handed the variant too').toContain(
      'takeAccount(journal, here, writing, Date.now(), store, game.rules)',
    );
  });

  it('leaves no length comparison on the writing anywhere in the screen', () => {
    // The shape rather than the two call sites that had it.
    expect(APP).not.toMatch(/writing\s*\.\s*trim\(\)\s*\.\s*length/);
    expect(APP).not.toMatch(/draft\s*\.\s*trim\(\)\s*\.\s*length/);
  });
});
