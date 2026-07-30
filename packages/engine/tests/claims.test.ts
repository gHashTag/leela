import { describe, expect, it } from 'vitest';
// A plain module, shared with the scripts that use it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { checkCiPackages, checkCounts, checkManifests, checkTotal, claimedCounts, claimedTotal, copiedManifests, packagesCheckedByCi } from '../../../scripts/lib/claims.mjs';

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

describe('the manifests a Dockerfile copies', () => {
  /**
   * Docker cannot glob a path and keep it, so the bot's image carries a
   * hand-written line per workspace. A ninth package was added and the line was
   * not, and the image build failed with "Workspace dependency not found" —
   * caught by CI, a minute late and a push too far. A hand-kept list is the
   * same thing as a hand-kept number.
   */
  const DOCKERFILE = `
FROM oven/bun:1.3.12-slim
COPY package.json bun.lock ./
COPY packages/engine/package.json packages/engine/
COPY packages/journal/package.json packages/journal/
COPY apps/bot/package.json apps/bot/
RUN bun install --frozen-lockfile --production
COPY packages packages
`;

  it('reads every manifest line and nothing else', () => {
    const copied = copiedManifests(DOCKERFILE);
    expect([...copied].sort()).toEqual(['apps/bot', 'packages/engine', 'packages/journal']);
    // `COPY packages packages` is not a manifest line.
    expect(copied.has('packages')).toBe(false);
  });

  it('names a workspace the image would not install', () => {
    const problems = checkManifests(
      copiedManifests(DOCKERFILE),
      new Set(['apps/bot', 'packages/engine', 'packages/journal', 'packages/new']),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('packages/new');
  });

  it('names a line for something that is not there', () => {
    // The other direction: a package removed leaves a COPY that fails the
    // build with a message about a missing file rather than a missing package.
    const problems = checkManifests(copiedManifests(DOCKERFILE), new Set(['apps/bot']));
    expect(problems.filter((problem: string) => problem.includes('does not exist'))).toHaveLength(2);
  });

  it('is quiet when the list is the truth', () => {
    const workspaces = new Set(['apps/bot', 'packages/engine', 'packages/journal']);
    expect(checkManifests(copiedManifests(DOCKERFILE), workspaces)).toEqual([]);
  });
});

describe('the packages CI actually runs', () => {
  /**
   * The three jobs each iterate a `for pkg in …` list written by hand, because
   * a shell loop cannot ask the repository what its workspaces are. A package
   * missing from that line does not turn the build red — it is simply never
   * run, and an absent check reads exactly like a passing one.
   *
   * This pass was pushed with a strict-typecheck error for the neighbouring
   * reason: the command run locally and the command run by CI were different.
   */
  const WORKFLOW = `
      for pkg in packages/engine apps/bot; do
        (cd "$pkg" && bunx tsc --noEmit)
      done
      for pkg in packages/engine apps/bot; do
        (cd "$pkg" && bunx vitest run)
      done
`;

  it('reads every loop, not just the first', () => {
    const loops = packagesCheckedByCi(WORKFLOW);
    expect(loops).toHaveLength(2);
    expect([...(loops[0] ?? [])].sort()).toEqual(['apps/bot', 'packages/engine']);
  });

  it('names a package that ships and is never run', () => {
    const problems = checkCiPackages(
      packagesCheckedByCi(WORKFLOW),
      new Set(['packages/engine', 'apps/bot', 'packages/new']),
    );
    // Once per loop: added to the tests and not the typecheck is still a gap.
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('packages/new');
  });

  it('catches a package added to one loop and not the other', () => {
    const halfway = WORKFLOW.replace('for pkg in packages/engine apps/bot; do\n        (cd "$pkg" && bunx vitest run)', 'for pkg in packages/engine apps/bot packages/new; do\n        (cd "$pkg" && bunx vitest run)');
    const problems = checkCiPackages(
      packagesCheckedByCi(halfway),
      new Set(['packages/engine', 'apps/bot', 'packages/new']),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('loop 1');
  });

  it('names a loop entry that ships nothing, which fails the job by cd', () => {
    const problems = checkCiPackages(packagesCheckedByCi(WORKFLOW), new Set(['packages/engine']));
    expect(problems.filter((problem: string) => problem.includes('does not ship code'))).toHaveLength(2);
  });

  it('says so when a workflow iterates nothing at all', () => {
    // A refactor that replaces the loops with something else should be noticed
    // rather than silently reported as "everything is covered".
    expect(checkCiPackages(packagesCheckedByCi('jobs: {}'), new Set(['packages/engine']))).toHaveLength(1);
  });

  it('is quiet when the list is the repository', () => {
    expect(checkCiPackages(packagesCheckedByCi(WORKFLOW), new Set(['packages/engine', 'apps/bot']))).toEqual([]);
  });
});
