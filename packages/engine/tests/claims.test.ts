import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain module, shared with the script that uses it.
import { checkCounts, checkTotal, claimedCounts, claimedTotal } from '../../../scripts/lib/claims.mjs';

/**
 * The numbers this repository says about itself.
 *
 * `README.md` carries a table of per-package test counts and a total, and both
 * were maintained by hand for forty passes. The two passes before this one were
 * each about a confident sentence that had never been checked — a bot that
 * "dies without a volume" and did not, a contract "permanently deployed" to a
 * network shut down in 2024. A hand-kept number is the same kind of sentence,
 * waiting.
 *
 * These assert the rules the check follows, not the numbers in today's README:
 * the numbers change every pass, and a test that repeated them would be a
 * second hand-kept copy of the thing under suspicion.
 */

const TABLE = `
| Package | Tests | State |
|---|---|---|
| \`@leela/engine\` | 202 | rules |
| \`@leela/content\` | 145 | languages |

1135 tests, run on every push by CI.
`;

describe('reading what the README says', () => {
  it('finds every package in the table', () => {
    const claimed = claimedCounts(TABLE);
    expect(claimed.get('@leela/engine')).toBe(202);
    expect(claimed.get('@leela/content')).toBe(145);
    expect(claimed.size).toBe(2);
  });

  it('finds the total stated in prose', () => {
    expect(claimedTotal(TABLE)).toBe(1135);
    expect(claimedTotal('1,135 tests, run on every push by CI.')).toBe(1135);
  });

  it('says so when there is no total, rather than assuming one', () => {
    expect(claimedTotal('no numbers here')).toBeNull();
    expect(checkTotal(new Map([['a', 1]]), null)).toHaveLength(1);
  });

  it('is not fooled by a number that is not a claim', () => {
    // Prose mentioning a package, and a table row that is not one.
    const noise = '`@leela/engine` has 202 tests.\n| Source | 19 | markdown |\n';
    expect(claimedCounts(noise).size).toBe(0);
  });
});

describe('what counts as wrong', () => {
  it('is a number that differs, named with both values', () => {
    const problems = checkCounts(new Map([['@leela/engine', 200]]), new Map([['@leela/engine', 202]]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('200');
    expect(problems[0]).toContain('202');
  });

  it('is a package that runs tests and is not in the table', () => {
    // The one a person would not notice: a table correct about everything it
    // lists can still leave something out.
    const problems = checkCounts(new Map(), new Map([['@leela/new', 7]]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('@leela/new');
    expect(problems[0]).toContain('not in the table');
  });

  it('is a package in the table that ran nothing', () => {
    const problems = checkCounts(new Map([['@leela/gone', 12]]), new Map());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('ran nothing');
  });

  it('is a total that does not add up', () => {
    const claimed = new Map([
      ['@leela/a', 10],
      ['@leela/b', 5],
    ]);
    expect(checkTotal(claimed, 15)).toEqual([]);
    const wrong = checkTotal(claimed, 16);
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toContain('16');
    expect(wrong[0]).toContain('15');
  });

  it('is nothing at all when everything agrees', () => {
    const same = new Map([['@leela/engine', 202]]);
    expect(checkCounts(same, new Map(same))).toEqual([]);
    expect(checkTotal(same, 202)).toEqual([]);
  });
});

describe('the total is checked against the table, not against the suites', () => {
  it('catches a total that agrees with reality and not with the column above it', () => {
    // Two numbers in one document disagreeing is still wrong, and a reader
    // adds the column rather than running the tests.
    const claimed = new Map([
      ['@leela/a', 10],
      ['@leela/b', 5],
    ]);
    expect(checkTotal(claimed, 20)).toHaveLength(1);
  });
});
