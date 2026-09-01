import { describe, expect, it } from 'vitest';
// A plain module, shared with the script that uses it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { checkClaim } from '../../../scripts/lib/variants.mjs';

/**
 * Holding a variant to the app it claims to reproduce.
 *
 * `packages/contracts` holds `onchain` to the Solidity, because the contract is
 * vendored here and a test can read it. `legacy-mobile` and `online` reproduce
 * the published mobile app, which is not — so their rules were written by
 * reading `leela-src`, and after that the reading was a memory.
 *
 * `onchain` is what a memory is worth: it carried `classic`'s value for all
 * five flags added after it was written, and one of them was wrong. These two
 * were written the same way and had never been checked again.
 *
 * These assert the checking, against invented claims and invented sources.
 * Asserting against the donor clones would make the test say different things
 * on a machine that has them and a machine that does not — which is the
 * failure the audit itself is built to avoid.
 */

const rules = { id: 'legacy-mobile', minReportChars: 100, threeSixesReset: false } as const;

const claim = {
  flag: 'minReportChars',
  value: 100,
  file: 'app/form.tsx',
  must: /\.min\(100,/,
  why: 'the form refuses anything shorter',
};

const source = (text: string) => () => text;

describe('a claim about a variant', () => {
  it('passes when the flag and the app agree', () => {
    expect(checkClaim(rules, claim, source('yup.string().min(100, t("few"))'))).toEqual([]);
  });

  it('names a flag that no longer matches its evidence', () => {
    // Half the point: somebody changing the value has to change the citation.
    const [problem] = checkClaim({ ...rules, minReportChars: 0 }, claim, source('.min(100,'));

    expect(problem).toContain('minReportChars');
    expect(problem).toContain('0');
    expect(problem).toContain('100');
  });

  it('names evidence that has gone out of the app', () => {
    // The other half: somebody upstream changing the app has to be noticed.
    const [problem] = checkClaim(rules, claim, source('// rewritten'));

    expect(problem).toContain('app/form.tsx');
    expect(problem).toContain('no longer shows');
  });

  it('checks an absence too, because a missing rule is a claim', () => {
    // `threeSixesReset: false` says the app has no such rule. If the fields
    // turn up, the claim is wrong even though nothing here changed.
    const absent = {
      flag: 'threeSixesReset',
      value: false,
      file: 'app/helper.ts',
      mustNot: /consecutiveSixes/,
      why: 'the app has no three-sixes rule at all',
    };

    expect(checkClaim(rules, absent, source('const plan = 1'))).toEqual([]);
    expect(checkClaim(rules, absent, source('player.consecutiveSixes += 1'))[0]).toContain(
      'says is absent',
    );
  });

  it('names a file it could not read, rather than passing', () => {
    // The failure this whole repository keeps meeting: a check that reads as a
    // pass because it did not look. A missing donor file is not agreement.
    const [problem] = checkClaim(rules, claim, () => null);

    expect(problem).toContain('not there to check against');
  });

  it('reports the flag before the file, since a wrong flag needs no file', () => {
    // A value that disagrees with its own citation is wrong whatever the app
    // says, and reading the app would only add noise to the message.
    const problems = checkClaim({ ...rules, minReportChars: 7 }, claim, () => null);

    expect(problems).toHaveLength(1);
    expect(problems[0]).not.toContain('not there');
  });
});
