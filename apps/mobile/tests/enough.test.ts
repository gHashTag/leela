import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLASSIC, LEGACY_MOBILE, RULESETS, countsAsReport, type RuleSet } from '@leela/engine';
import { EMPTY, record, takeAccount, type Store } from '../src/journal';

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
 * two of the five the engine ships.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8');

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
      expect(record(EMPTY, 30, enough, 1, rules).entries).toHaveLength(1);

      if (rules.minReportChars > 0) {
        const short = 'x'.repeat(rules.minReportChars - 1);
        expect(record(EMPTY, 30, short, 1, rules).entries, 'one short').toHaveLength(0);
      }
    },
  );

  it('has at least one variant of each kind, or the rule is untested', () => {
    // The guard against a table that proves nothing: if every shipped ruleset
    // asked for the same amount, every case above would be the same case.
    const bounds = new Set(shipped.map((rules) => rules.minReportChars));
    expect(bounds.size, 'variants that differ on this').toBeGreaterThan(1);
  });

  it('is never whitespace, whatever the variant says', () => {
    // A gate opened by spaces is the rule with its point removed.
    for (const rules of shipped) {
      expect(record(EMPTY, 30, '   \n\t  ', 1, rules).entries, rules.id).toHaveLength(0);
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
    expect(record(EMPTY, 30, ninetyNine, 1, CLASSIC).entries).toHaveLength(1);
    expect(record(EMPTY, 30, ninetyNine, 1, LEGACY_MOBILE).entries).toHaveLength(0);
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
    const taken = takeAccount(EMPTY, 30, '   ', 1, nowhere(), LEGACY_MOBILE);

    expect(taken.written).toBe(false);
    expect(taken.refusal).toBe('empty');
    expect(taken.gateOpens, 'and the gate stays shut').toBe(false);
  });

  it('names one that is short of what the variant asks', () => {
    const taken = takeAccount(EMPTY, 30, 'x'.repeat(99), 1, nowhere(), LEGACY_MOBILE);

    expect(taken.written).toBe(false);
    expect(taken.refusal).toBe('too-short');
  });

  it('names nothing when the account was taken', () => {
    const taken = takeAccount(EMPTY, 30, 'x'.repeat(100), 1, nowhere(), LEGACY_MOBILE);

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
