import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// A plain module, shared with the scripts that use it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { checkCiPackages, checkCounts, checkDeployPaths, checkDeployTests, checkLockfiles, workspacesNeededBy, workspaceSources, checkManifests, checkTotal, claimedCounts, claimedTotal, copiedManifests, packagesCheckedByCi, packagesTestedByDeploy, rewriteClaims } from '../../../scripts/lib/claims.mjs';

/**
 * One `for pkg in …; do … done` loop, as `packagesCheckedByCi` returns it.
 *
 * The names alone answered "is every workspace listed"; the body answers "is
 * this a loop that runs anything", which is the question a workflow with its
 * test step deleted got away with because nobody asked it.
 */
type Loop = { names: Set<string>; body: string };

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

describe('writing back what the check already measured', () => {
  /**
   * The check ran all ten suites, learned the true counts, and then failed and
   * asked a person to retype six numbers into a table. Its commonest failure
   * was therefore *nobody retyped what the check computed* — a red that is not
   * about the code, on a build where a red that is not about the code teaches
   * people to scroll past the ones that are.
   *
   * These assert the two properties that make the writer safe to point at
   * README, over a generated grid rather than over a handful of remembered
   * cases:
   *
   *   1. the writer and the readers cannot drift apart. Whatever the writer
   *      produces, the readers must find nothing wrong with it — including the
   *      total, which is the half a writer forgets, because rows are what you
   *      are thinking about and the total is one line further down.
   *   2. it moves digits and nothing else. The State column's prose and its
   *      links live on the *same line* as a count, so "changed only the row" is
   *      not a strong enough claim; the skeleton of the document with every run
   *      of digits blanked has to come back identical.
   *
   * Invented packages, and a fixture that carries the things a careless rewrite
   * eats: a link with punctuation, an em dash, a version number that is not a
   * claim about tests, blank lines, and a trailing newline.
   */
  const README = [
    '# Something',
    '',
    'Runs on `oven/bun:1.3.12-slim`, which is a number and not a claim.',
    '',
    '| Package | Tests | State |',
    '|---|---|---|',
    '| `@leela/alpha` | 41 | the rules — [readme](packages/alpha/README.md) |',
    '| `@leela/beta` | 7 | 22 languages of plans, 2 of the game’s own voice |',
    '| `@leela/gamma` | 128 | the board on a phone (Expo) |',
    '| `@leela/delta` | 3 | group play, durable on SQLite |',
    '| everything else | — | not yet ported |',
    '',
    '179 tests, run on every push by [CI](.github/workflows/ci.yml), which also',
    'builds the image and starts it.',
    '',
  ].join('\n');

  const NAMES = ['@leela/alpha', '@leela/beta', '@leela/gamma', '@leela/delta'];
  // Grown, shrunk, gone to zero, unchanged, and — across four packages drawn
  // from one list — the same value in two rows at once, which is the case a
  // writer keyed on the *number* rather than the row gets wrong.
  const VALUES = [0, 1, 7, 41, 128, 999];

  /** Every combination of those counts across those packages. */
  const grid = () => {
    let maps: Map<string, number>[] = [new Map()];
    for (const name of NAMES) {
      maps = maps.flatMap((counts) =>
        VALUES.map((value) => new Map([...counts, [name, value] as [string, number]])),
      );
    }
    return maps;
  };

  /** The line-carries-a-number question, asked of the readers themselves. */
  const carriesANumber = (line: string) =>
    claimedCounts(line).size > 0 || claimedTotal(line) !== null;

  it('leaves the readers with nothing to report, rows and total alike', () => {
    for (const actual of grid()) {
      const rewritten = rewriteClaims(README, actual);
      const claimed = claimedCounts(rewritten);

      const rows = checkCounts(claimed, actual);
      expect(rows, [...actual].join(' ')).toEqual([]);

      // The half that is one line further down, and the half a writer forgets.
      const total = checkTotal(claimed, claimedTotal(rewritten));
      expect(total, [...actual].join(' ')).toEqual([]);
    }
  });

  it('is byte-identical outside the lines that carry a number', () => {
    for (const actual of grid()) {
      const rewritten = rewriteClaims(README, actual);

      const before = README.split('\n');
      const after = rewritten.split('\n');
      expect(after, [...actual].join(' ')).toHaveLength(before.length);

      for (const [index, line] of before.entries()) {
        if (line === after[index]) continue;
        // A line that changed and holds no claim — the bun version, a blank
        // line, the `everything else` row, the prose after the total.
        expect(carriesANumber(line), `${line}\n${after[index]}`).toBe(true);
      }

      // And within the lines that do carry one: only the digits moved. The
      // State column's prose shares a line with its count, so "the right lines
      // changed" is not on its own a promise that the prose survived.
      const skeleton = (text: string) => text.replace(/\d+/g, '#');
      expect(skeleton(rewritten), [...actual].join(' ')).toBe(skeleton(README));
    }
  });

  it('does not invent a row for a package the table has never heard of', () => {
    /**
     * The deliberate limit, asserted so it is a decision rather than an
     * oversight. A row carries a sentence about what the package is *for*, and
     * writing that is not arithmetic — so the writer leaves it, and the check
     * stays red until a person says the sentence.
     */
    const actual = new Map([...NAMES.map((name) => [name, 1] as [string, number]), ['@leela/new', 5]]);
    const rewritten = rewriteClaims(README, actual);

    expect(claimedCounts(rewritten).has('@leela/new')).toBe(false);
    const problems = checkCounts(claimedCounts(rewritten), actual);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('not in the table');
  });

  it('does not delete a row for a package that ran nothing', () => {
    // The other direction, and the same reason: removing a line from a document
    // is an edit somebody should make on purpose.
    const actual = new Map(NAMES.slice(1).map((name) => [name, 2] as [string, number]));
    const rewritten = rewriteClaims(README, actual);

    expect(claimedCounts(rewritten).get(NAMES[0] as string)).toBe(41);
    expect(checkCounts(claimedCounts(rewritten), actual)[0]).toContain('ran nothing');
  });

  it('writes nothing at all when the numbers already agree', () => {
    // Idempotence, which is what makes it safe to put in front of a commit: a
    // second run must not produce a diff.
    const truth = claimedCounts(README);
    const once = rewriteClaims(README, truth);
    expect(once).toBe(README);
    expect(rewriteClaims(once, truth)).toBe(README);
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

/**
 * One job, one `steps:`, and whatever is put under it.
 *
 * The fixtures below were shell fragments floating at column six until the
 * reader stopped being a text search and became a structural one. The structure
 * is now the claim — a loop is only run if it is inside a step of a job — and a
 * fixture that has no step in it would be asserting nothing about a reader that
 * looks for steps. The same sentence is written above `workflowOf` in
 * `runnable.test.ts`, where the neighbouring reader learned this first.
 */
const jobWith = (steps: string) => `name: CI
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
${steps}
`;

describe('the packages CI actually runs', () => {
  /**
   * The three steps each iterate a `for pkg in …` list written by hand, because
   * a shell loop cannot ask the repository what its workspaces are. A package
   * missing from that line does not turn the build red — it is simply never
   * run, and an absent check reads exactly like a passing one.
   *
   * This pass was pushed with a strict-typecheck error for the neighbouring
   * reason: the command run locally and the command run by CI were different.
   */
  const WORKFLOW = jobWith(`      - name: Typecheck
        run: |
          for pkg in packages/engine apps/bot; do
            (cd "$pkg" && bunx tsc --noEmit)
          done

      - name: Test
        run: |
          for pkg in packages/engine apps/bot; do
            (cd "$pkg" && bunx vitest run)
          done`);

  it('reads every loop, not just the first', () => {
    const loops: Loop[] = packagesCheckedByCi(WORKFLOW);
    expect(loops).toHaveLength(2);
    expect([...(loops[0]?.names ?? [])].sort()).toEqual(['apps/bot', 'packages/engine']);
  });

  it('carries each loop body, not only the names it iterates', () => {
    // The names cannot say whether a loop runs anything. Every loop in this
    // fixture is a real command, and one of them is the only one that tests.
    const loops: Loop[] = packagesCheckedByCi(WORKFLOW);
    expect(loops.filter((loop) => /vitest/.test(loop.body))).toHaveLength(1);
    expect(loops.every((loop) => loop.body.includes('cd "$pkg"'))).toBe(true);
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
    const halfway = WORKFLOW.replace(
      'for pkg in packages/engine apps/bot; do\n            (cd "$pkg" && bunx vitest run)',
      'for pkg in packages/engine apps/bot packages/new; do\n            (cd "$pkg" && bunx vitest run)',
    );
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

  it('says so when every loop is perfect and none of them tests', () => {
    // The whole list, twice over, and not one suite run: the per-loop questions
    // are answered completely and the workflow is worthless. Measured in this
    // shape on the real file — see the grid at the end of this suite.
    const typechecksOnly = jobWith(`      - name: Typecheck
        run: |
          for pkg in packages/engine apps/bot; do
            (cd "$pkg" && bunx tsc --noEmit)
          done

      - name: Typecheck what ships
        run: |
          for pkg in packages/engine apps/bot; do
            (cd "$pkg" && bunx tsc --noEmit -p tsconfig.src.json)
          done`);

    const problems = checkCiPackages(
      packagesCheckedByCi(typechecksOnly),
      new Set(['packages/engine', 'apps/bot']),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('test runner');
  });

  it('is quiet when the list is the repository', () => {
    expect(checkCiPackages(packagesCheckedByCi(WORKFLOW), new Set(['packages/engine', 'apps/bot']))).toEqual([]);
  });
});

describe('where an audit looks for source', () => {
  /**
   * `audit-unread.mjs` walked a hand-written array of directories, and
   * `packages/journal/src` was not in it — so the shared file format between
   * the bot and the mini app had never been checked for a field nobody reads
   * or an export nobody calls, while the audit said "Every export has at least
   * one caller".
   *
   * The fourth hand-kept list here to be wrong, and the second to be wrong by
   * *omission* — the kind that reads as a pass.
   *
   * Asserted against a made-up tree, because a test that read this repository
   * would pass until the day somebody adds a tenth package, which is the day
   * it needs to fail.
   */
  const treeOf = (paths: string[]) => ({
    exists: (path: string) => paths.includes(path) || paths.some((p) => p.startsWith(`${path}/`)),
    // A path with something under it. The reader's own docstring has always
    // named this, and nothing supplied it until a workspace's second source
    // directory needed telling from a file.
    isDirectory: (path: string) => paths.some((p) => p.startsWith(`${path}/`)),
    entries: (path: string) =>
      [
        ...new Set(
          paths
            .filter((p) => p.startsWith(`${path}/`))
            .map((p) => p.slice(path.length + 1).split('/')[0]),
        ),
      ] as string[],
  });

  it('finds every workspace that ships TypeScript', () => {
    const tree = treeOf([
      'packages/engine/package.json',
      'packages/engine/src/index.ts',
      'packages/journal/package.json',
      'packages/journal/src/index.ts',
      'apps/bot/package.json',
      'apps/bot/src/bot.ts',
    ]);

    expect(workspaceSources(tree)).toEqual([
      'packages/engine/src',
      'packages/journal/src',
      'apps/bot/src',
    ]);
  });

  it('skips a directory that is not a workspace', () => {
    // A folder without a manifest is not a package; a check that walked it
    // would report on somebody's scratch directory.
    const tree = treeOf(['packages/notes/src/thoughts.ts']);
    expect(workspaceSources(tree)).toEqual([]);
  });

  it('skips a workspace that ships nothing', () => {
    // `apps/site` and `packages/ui` are untracked placeholders waiting for a
    // port. They exist on one machine and not in CI, and an audit that
    // disagreed with itself in the two places would be worse than none.
    const tree = treeOf(['packages/ui/package.json', 'packages/ui/README.md']);
    expect(workspaceSources(tree)).toEqual([]);
  });

  it('skips a src that holds no TypeScript', () => {
    const tree = treeOf(['apps/site/package.json', 'apps/site/src/index.html']);
    expect(workspaceSources(tree)).toEqual([]);
  });

  it('is in a stable order, so a report does not shuffle between runs', () => {
    const tree = treeOf([
      'packages/zeta/package.json',
      'packages/zeta/src/a.ts',
      'packages/alpha/package.json',
      'packages/alpha/src/a.ts',
    ]);
    expect(workspaceSources(tree)).toEqual(['packages/alpha/src', 'packages/zeta/src']);
  });

  it('finds nothing where there is nothing, rather than throwing', () => {
    expect(workspaceSources(treeOf([]))).toEqual([]);
  });
});

describe('one workspace, one lockfile', () => {
  /**
   * `packages/engine/bun.lock` was committed with the first unification and
   * nobody looked at it again. A bun workspace resolves from the lockfile beside
   * the root manifest; a second one inside a package is what anything run *from
   * that directory* uses — and the two had already come apart. The root pinned
   * vite 6.4.3 and esbuild 0.25.12, this package's pinned 5.4.21 and 0.21.5, so
   * the one package every surface depends on could be tested by a different
   * bundler than the surfaces are, and CI installs at the root and would never
   * have seen it.
   *
   * The same shape as the published app one repository over, from the other
   * side: a missing lockfile lets versions drift, a spare one lets them fork.
   */
  it('accepts a repository with only a lockfile at the root', () => {
    expect(checkLockfiles(['package.json', 'bun.lock', 'packages/engine/package.json'])).toEqual([]);
  });

  it('names a lockfile inside a workspace, whatever it is called', () => {
    // Four package managers, and a repository can acquire any of them by
    // somebody running the wrong install in the wrong directory once.
    for (const stray of [
      'packages/engine/bun.lock',
      'packages/engine/bun.lockb',
      'apps/bot/package-lock.json',
      'apps/miniapp/yarn.lock',
      'packages/db/pnpm-lock.yaml',
    ]) {
      const said = checkLockfiles(['bun.lock', stray]);
      expect(said, stray).toHaveLength(1);
      expect(said[0], stray).toContain(stray);
    }
  });

  it('says so when there is no lockfile at all', () => {
    /**
     * The other end of the same rule, and the one that cost the published app
     * three years: with nothing pinned, every install resolves its caret ranges
     * fresh. It is a different sentence because it is a different repair.
     */
    expect(checkLockfiles(['package.json', 'src/index.ts'])).toEqual([
      'no lockfile at all: every install resolves fresh',
    ]);
  });

  it('is not fooled by a file that merely has the word in it', () => {
    // `podlock.mjs`, `scripts/lib/podlock.d.mts`, a test called `lockfile.ts` —
    // this repository has all three, and none of them pins anything.
    expect(
      checkLockfiles([
        'bun.lock',
        'scripts/lib/podlock.mjs',
        'apps/mobile/tests/podlock.test.ts',
        'docs/lockfiles.md',
      ]),
    ).toEqual([]);
  });
});

describe('what the deploy job watches', () => {
  /**
   * `pages.yml` publishes the mini app on a push that touches one of a
   * hand-written list of paths: the two apps, `packages/engine` and
   * `packages/content`. The mini app also declares and imports
   * **`@leela/journal`** — the format every surface reads and writes, and the
   * package two of the last ten passes changed. A push that touched only it
   * changed what players run and published nothing, with nothing to say so.
   *
   * The same shape as `checkCiPackages` one job over: a hand-written list
   * beside a dependency graph is a list that will disagree with it.
   */
  it('names a package a deployed app needs and the job does not watch', () => {
    const said = checkDeployPaths(
      ['apps/miniapp', 'apps/docs', 'packages/engine', 'packages/content'],
      new Set(['apps/miniapp', 'packages/content', 'packages/engine', 'packages/journal']),
    );

    expect(said).toHaveLength(1);
    expect(said[0]).toContain('packages/journal');
  });

  it('says nothing when the list covers the graph', () => {
    expect(
      checkDeployPaths(
        ['apps/miniapp', 'packages/engine', 'packages/journal'],
        new Set(['apps/miniapp', 'packages/engine', 'packages/journal']),
      ),
    ).toEqual([]);
  });

  it('does not mind a path watched that nothing needs', () => {
    // Watching more than is needed costs a deploy nobody wanted, which is a
    // different thing from shipping nothing. Only the gap is a defect.
    expect(
      checkDeployPaths(['apps/miniapp', 'packages/db'], new Set(['apps/miniapp'])),
    ).toEqual([]);
  });

  it('follows the graph rather than the first step of it', () => {
    /**
     * The reason this is computed and not listed: `apps/miniapp` depends on
     * `@leela/journal`, which depends on `@leela/engine`. A reader that took
     * only what the app declares would miss whatever its dependencies declare,
     * and the deploy would go stale one level down.
     */
    const graph: Record<string, string[]> = {
      'apps/miniapp': ['packages/journal'],
      'packages/journal': ['packages/engine'],
      'packages/engine': [],
    };

    expect(
      [...workspacesNeededBy(['apps/miniapp'], (where: string) => graph[where] ?? [])].sort(),
    ).toEqual([
      'apps/miniapp',
      'packages/engine',
      'packages/journal',
    ]);
  });

  it('stops rather than circling when two packages need each other', () => {
    // Nothing in this repository does, and a reader that looped would hang CI
    // rather than fail it — the worst way for a check to be wrong.
    const graph: Record<string, string[]> = { a: ['b'], b: ['a'] };
    expect([...workspacesNeededBy(['a'], (where: string) => graph[where] ?? [])].sort()).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('what the deploy job tests before it publishes', () => {
  /**
   * The same file says what the app is made of **twice**: in `paths:`, which
   * decides whether a push deploys at all, and in a `for pkg in …` loop, which
   * decides what is tested before it does. Only the first was ever asked
   * whether it agreed with the dependency graph, and the two had already come
   * apart — a package added up there, the loop below still iterating the list
   * it had before. A suite that is never run is not a red build; it is an
   * absent one, and an absent check reads exactly like a passing one.
   *
   * The graph here is deliberately not this repository's, and the workflow text
   * is generated from it rather than written out. Naming today's workspaces
   * would make this file a second hand-kept copy of the very list under
   * suspicion — the reason given at the top of this file for not asserting
   * today's numbers, applied to a list instead of a total.
   */

  /** A shape, not this repository's: two apps, one shared package, one orphan. */
  const GRAPH: Record<string, string[]> = {
    'apps/one': ['packages/alpha'],
    'apps/two': ['packages/beta', 'packages/alpha'],
    'packages/alpha': ['packages/gamma'],
    'packages/beta': [],
    'packages/gamma': [],
    // Ships code, and nothing the job publishes reaches it.
    'packages/delta': ['packages/gamma'],
  };

  const DEPLOYED = ['apps/one', 'apps/two'];

  const needed = (): Set<string> =>
    workspacesNeededBy(DEPLOYED, (where: string) => GRAPH[where] ?? []);

  /** The job the graph implies: a loop that tests a list, then the builds. */
  const workflowFor = (loop: string[]) =>
    jobWith(`      - name: Test what is being shipped
        run: |
          for pkg in ${loop.join(' ')}; do
            (cd "$pkg" && bunx vitest run)
          done

      - name: Build
        run: |
${DEPLOYED.map((app) => `          bun run --cwd ${app} build`).join('\n')}`);

  const said = (loop: string[]): string[] =>
    checkDeployTests(packagesTestedByDeploy(workflowFor(loop)), needed());

  it('is quiet when the loop runs what the graph says the apps are made of', () => {
    expect(said([...needed()])).toEqual([]);
  });

  it('names whichever workspace the graph makes necessary and the loop drops', () => {
    // Over the edge of every column: each package the graph reaches, dropped in
    // turn. A test that dropped one chosen package would prove the checker can
    // see that package, which is not the claim.
    const caught = Object.fromEntries(
      [...needed()].map((dropped) => {
        const problems = said([...needed()].filter((where) => where !== dropped));
        return [dropped, problems.length === 1 && (problems[0] ?? '').includes(dropped)];
      }),
    );

    expect(caught).toEqual(Object.fromEntries([...needed()].map((where) => [where, true])));
  });

  it('does not demand a package the graph does not make necessary', () => {
    // `packages/delta` ships code and is nobody's dependency here. Demanding it
    // would be a check the job could only satisfy by testing the whole
    // repository on every deploy — which is `ci.yml`'s job, and why
    // `checkCiPackages` was never pointed at this workflow.
    const orphan = Object.keys(GRAPH).filter((where) => !needed().has(where));
    expect(orphan.length).toBeGreaterThan(0);

    for (const problem of said([...needed()])) {
      for (const where of orphan) expect(problem).not.toContain(where);
    }
    expect(said([...needed()])).toEqual([]);
  });

  it('does not mind a loop that tests more than is shipped', () => {
    // Testing something the deploy does not need costs a minute; shipping
    // something untested costs a player. Only the gap is a defect, which is
    // what `checkDeployPaths` decided one job over.
    expect(said([...needed(), ...Object.keys(GRAPH).filter((w) => !needed().has(w))])).toEqual([]);
  });

  it('holds the loop that tests and not the loop that builds', () => {
    // A deploy job legitimately builds a subset. Were every loop held to the
    // graph — `checkCiPackages`' rule — this correct workflow would go red, and
    // a check that cries wolf is one somebody deletes rather than obeys.
    const both = jobWith(`      - name: Test what is being shipped
        run: |
          for pkg in ${[...needed()].join(' ')}; do
            (cd "$pkg" && bunx vitest run)
          done

      - name: Build
        run: |
          for pkg in ${DEPLOYED.join(' ')}; do
            (cd "$pkg" && bun run build)
          done`);

    expect(packagesTestedByDeploy(both)).toHaveLength(1);
    expect(checkDeployTests(packagesTestedByDeploy(both), needed())).toEqual([]);
  });

  it('says so when nothing in the job runs tests at all', () => {
    // The failure this whole pass is about is a check that is absent rather
    // than red. A loop renamed out of recognition must not read as covered.
    const buildsOnly = jobWith(`      - name: Build
        run: |
          for pkg in ${DEPLOYED.join(' ')}; do
            (cd "$pkg" && bun run build)
          done`);

    expect(packagesTestedByDeploy(buildsOnly)).toEqual([]);
    expect(checkDeployTests(packagesTestedByDeploy(buildsOnly), needed())).toHaveLength(1);
  });

  it('says so when the job has no loop at all', () => {
    expect(checkDeployTests(packagesTestedByDeploy('jobs: {}'), needed())).toHaveLength(1);
  });
});

/**
 * A `for pkg in` line that no runner will execute, and what the guard made of
 * it.
 *
 * MEASURED on 2026-08-06, on this repository, with nothing edited on disk:
 * `packagesCheckedByCi` regexed the loop header out of the raw workflow string.
 * Against `.github/workflows/ci.yml` it returned three loops. With every one of
 * those three lines prefixed with `#` — all three loops commented out, CI
 * typechecking and testing nothing at all — it returned three loops again, ten
 * workspaces in each, and `checkCiPackages` reported full coverage.
 * `packagesTestedByDeploy` shared the source string and so shared the defect:
 * one live test loop in `pages.yml`, whether or not the step existed.
 *
 * That is worth a grid rather than three examples, because of what this guard
 * is for. Its whole subject is *coverage nobody notices is absent* — a tenth
 * workspace added to the repository and left out of CI. Every other failure
 * here is at worst a red build; this one is a green one that reads exactly like
 * the day the list was right.
 *
 * So: the real workflows, every live step that holds a loop, and in turn each
 * way YAML has of taking that step out of the run. Not the three ways it was
 * measured wrong — a test that enumerated those would pass the day somebody
 * invents a fourth. Every cell says the same thing: whatever the runner will
 * not execute, the reader does not count.
 *
 * The inverse is asserted in the same breath, because 'return nothing' passes
 * every cell above. Against the untouched files the reader must agree, loop for
 * loop, with the text search it replaced: the two can only disagree where a
 * step is disabled, and neither workflow disables anything today. The day one
 * does, this assertion is where it shows, and the disagreement will be the
 * point rather than a fault. `runnable.test.ts` holds `auditsRunByCi` to its
 * own naive twin the same way and for the same reason.
 *
 * Every mutation is a string in memory. Nothing here writes a workflow.
 */
describe('a loop inside a step that will not run', () => {
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
  const WORKFLOWS = ['.github/workflows/ci.yml', '.github/workflows/pages.yml'];

  const indentOf = (line: string) => line.length - line.trimStart().length;

  /**
   * The readers under test, each beside the text search it replaced.
   *
   * The naive twin is the old body, kept deliberately: it is both the baseline
   * the fixed reader must match on a workflow that disables nothing, and the
   * exact thing every cell of the grid must now distinguish itself from.
   *
   * `packagesCheckedByCi` returns `{ names, body }` per loop and its neighbour
   * returns the names alone, so it is wrapped here down to the shape this grid
   * compares. The wrapper drops the body and nothing else: what a cell asserts
   * is which loops a reader still sees once a step cannot run, and the body is
   * a different question — asked, on the real file, by the grid below.
   */
  const READERS = [
    {
      reader: 'packagesCheckedByCi',
      read: (workflow: string): Set<string>[] =>
        packagesCheckedByCi(workflow).map((loop: Loop) => loop.names),
      asText: (workflow: string) =>
        [...workflow.matchAll(/for pkg in ([^;\n]+); do/g)].map(([, list]) => list ?? ''),
    },
    {
      reader: 'packagesTestedByDeploy',
      read: packagesTestedByDeploy,
      asText: (workflow: string) =>
        [...workflow.matchAll(/for pkg in ([^;\n]+); do([\s\S]*?)\bdone\b/g)]
          .filter(([, , body]) => /\b(vitest|jest|playwright|bun\s+test|run\s+test)\b/.test(body ?? ''))
          .map(([, list]) => list ?? ''),
    },
  ];

  /** One loop's list, in a form two lists can be compared by. */
  const named = (list: string) => list.trim().split(/\s+/).sort().join(' ');
  const signature = (loops: Set<string>[]) =>
    loops.map((loop) => [...loop].sort().join(' ')).sort();
  const textSignature = (lists: string[]) => lists.map(named).sort();

  /** One step of one job: where it starts, where it ends, and whose it is. */
  type Step = { job: string; jobAt: number; from: number; to: number };

  /**
   * Every step in a workflow, found by indentation.
   *
   * Written here rather than borrowed from `runnable.mjs`, on purpose and for
   * once: the reader under test answers *which steps are live*, and a grid that
   * asked the reader where the steps are would be asking the suspect to mark
   * its own paper. This walk knows nothing about `if:` or `#`; it finds list
   * items under a `steps:` key and stops.
   */
  const stepsIn = (text: string): Step[] => {
    const lines = text.split('\n');
    const found: Step[] = [];

    let job = '';
    let jobAt = -1;
    let inJobs = false;
    let stepsAt: number | null = null;

    for (let at = 0; at < lines.length; at += 1) {
      const line = lines[at] ?? '';
      if (line.trim() === '' || line.trimStart().startsWith('#')) continue;

      if (/^jobs:\s*$/.test(line)) {
        inJobs = true;
        continue;
      }
      if (inJobs && indentOf(line) === 2 && /^[A-Za-z][\w-]*:\s*$/.test(line.trim())) {
        job = line.trim().slice(0, -1);
        jobAt = at;
        stepsAt = null;
        continue;
      }
      if (inJobs && /^steps:\s*$/.test(line.trim())) {
        stepsAt = indentOf(line);
        continue;
      }
      if (stepsAt === null) continue;

      const indent = indentOf(line);
      if (indent <= stepsAt || !/^-(\s|$)/.test(line.trim())) continue;

      let to = at + 1;
      while (to < lines.length) {
        const next = lines[to] ?? '';
        if (next.trim() !== '' && indentOf(next) <= indent) break;
        to += 1;
      }

      found.push({ job, jobAt, from: at, to });
    }

    return found;
  };

  /** The step on its own, so a reader can be asked what that one step is worth. */
  const onlyThisStep = (lines: string[], step: Step) => {
    const dash = indentOf(lines[step.from] ?? '');
    const pad = (width: number) => ' '.repeat(Math.max(width, 1));
    return `jobs:\n${pad(dash - 4)}j:\n${pad(dash - 2)}steps:\n${lines
      .slice(step.from, step.to)
      .join('\n')}\n`;
  };

  /** The job on its own, for the removal that takes the whole job out. */
  const onlyThisJob = (lines: string[], step: Step) => {
    const indent = indentOf(lines[step.jobAt] ?? '');

    let to = step.jobAt + 1;
    while (to < lines.length) {
      const next = lines[to] ?? '';
      if (next.trim() !== '' && indentOf(next) <= indent) break;
      to += 1;
    }

    return `jobs:\n${lines.slice(step.jobAt, to).join('\n')}\n`;
  };

  /** The last line of a step that holds anything. */
  const lastOf = (lines: string[], step: Step) => {
    let at = step.to;
    while (at > step.from && (lines[at - 1] ?? '').trim() === '') at -= 1;
    return at;
  };

  /**
   * The ways a step stops being a step, each as a string edit.
   *
   * Three, and the grid is over these rather than about them: a hash in front
   * of every line, a false condition on the step, a false condition on the job
   * that holds it. A fourth belongs here the day YAML grows one.
   *
   * `scope` is what the edit takes away, and it is not decoration. Disabling
   * the job that holds a step disables the job's other steps too — `ci.yml`'s
   * `test` job holds all three loops — so the reader is right to drop three
   * there and would be wrong to drop one. An expectation that ignored this
   * would have demanded the defect back.
   */
  const REMOVALS = [
    {
      removal: 'commented out, line by line',
      scope: 'step' as const,
      apply: (lines: string[], step: Step) =>
        lines.map((line, at) =>
          at >= step.from && at < step.to && line.trim() !== ''
            ? line.replace(/^(\s*)/, '$1# ')
            : line,
        ),
    },
    {
      removal: 'if: false on the step',
      scope: 'step' as const,
      apply: (lines: string[], step: Step) => {
        const copy = lines.slice();
        // At the end of the step and at its keys' indentation: a sibling key,
        // which also closes the `run: |` block above it. Put after the dash it
        // would land inside that block on a step written `- run: |`.
        copy.splice(lastOf(lines, step), 0, `${' '.repeat(indentOf(lines[step.from] ?? '') + 2)}if: false`);
        return copy;
      },
    },
    {
      removal: 'if: false on the job that holds it',
      scope: 'job' as const,
      apply: (lines: string[], step: Step) => {
        const copy = lines.slice();
        copy.splice(step.jobAt + 1, 0, `${' '.repeat(indentOf(lines[step.jobAt] ?? '') + 2)}if: false`);
        return copy;
      },
    },
  ];

  /** Every (workflow, reader, step that holds a loop that reader counts). */
  const PLACES = WORKFLOWS.flatMap((workflow) => {
    const text = readFileSync(join(ROOT, workflow), 'utf8');
    const lines = text.split('\n');

    return stepsIn(text).flatMap((step) =>
      READERS.flatMap(({ reader, read, asText }) => {
        // What this one step is worth to this one reader, asked of the step on
        // its own rather than by subtracting: a reader that answered nothing to
        // everything would otherwise agree with itself.
        const mine = signature(read(onlyThisStep(lines, step)));
        if (mine.length === 0) return [];

        return [
          {
            workflow,
            reader,
            job: step.job,
            step,
            label: (lines[step.from] ?? '').trim(),
            read,
            asText,
            text,
            lines,
            mine,
            itsJob: signature(read(onlyThisJob(lines, step))),
          },
        ];
      }),
    );
  });

  const CELLS = PLACES.flatMap((place) =>
    REMOVALS.map(({ removal, scope, apply }) => ({
      ...place,
      removal,
      gone: scope === 'job' ? place.itsJob : place.mine,
      without: apply(place.lines, place.step).join('\n'),
    })),
  );

  it.each(CELLS)(
    '$workflow $reader: $job / $label, $removal',
    ({ read, text, mine, gone, without }) => {
      const before = signature(read(text));

      // Whatever else the edit took with it, it took this step's loop.
      expect(gone).toEqual(expect.arrayContaining(mine));

      // What the file says once that step cannot run: everything it said
      // before, minus one occurrence of each loop the edit removed. `ci.yml`
      // runs the same ten workspaces in three loops, so this is a count going
      // down rather than a name going missing.
      const expected = before.slice();
      for (const loop of gone) {
        const at = expected.indexOf(loop);
        expect(at).toBeGreaterThanOrEqual(0);
        expected.splice(at, 1);
      }

      expect(signature(read(without))).toEqual(expected);
    },
  );

  it('has a cell for every loop in both workflows, so the grid is not thin', () => {
    // The grid is built from the files, and a walk that found nothing would
    // make every row above vacuous by simply not existing. Each loop the reader
    // returns has to be some step's contribution, in both files and for both
    // readers.
    for (const workflow of WORKFLOWS) {
      const text = readFileSync(join(ROOT, workflow), 'utf8');

      for (const { reader, read } of READERS) {
        const here = PLACES.filter(
          (place) => place.workflow === workflow && place.reader === reader,
        );

        expect(signature(read(text)).length).toBeGreaterThan(0);
        expect(here.flatMap((place) => place.mine).sort()).toEqual(signature(read(text)));
      }
    }

    expect(CELLS).toHaveLength(PLACES.length * REMOVALS.length);
  });

  it('reads the untouched workflows exactly as the text search it replaced did', () => {
    // The other direction, and the one that stops the fix being 'return
    // nothing'. The structural reader and the naive one can only disagree where
    // a step is disabled, and neither file disables anything today.
    for (const workflow of WORKFLOWS) {
      const text = readFileSync(join(ROOT, workflow), 'utf8');

      for (const { read, asText } of READERS) {
        expect(textSignature(asText(text)).length).toBeGreaterThan(0);
        expect(signature(read(text))).toEqual(textSignature(asText(text)));
      }
    }
  });

  /**
   * The other axis: not a step that will not run, but a step that is not there.
   *
   * The grid above is over the ways YAML has of switching a step off, and every
   * one of them leaves the step on the page. Nothing asked what happens when
   * the step is simply gone — and the answer, MEASURED on 2026-08-06 against a
   * copy of the real `.github/workflows/ci.yml` with the whole `- name: Test`
   * step deleted, was: `packagesCheckedByCi` returned 2 loops instead of 3,
   * `checkCiPackages` returned `problems: []`, and `vitest` did not appear
   * anywhere in the file. Two typecheck loops naming all ten workspaces
   * answered both of the questions this checker asked, so a CI workflow that
   * ran no test in the repository was reported as fully covered. Its neighbour
   * `checkDeployTests` had refused a deploy job with no test loop for passes:
   * `pages.yml` was guarded against publishing untested code and `ci.yml` was
   * not guarded against testing nothing.
   *
   * So this is nested here rather than written beside the fixtures: it is the
   * limit case of the same grid, and it wants the same walk over the real file.
   * The variants are built from `ci.yml` as it is on disk — one per `for pkg in`
   * loop it contains, with the step holding that loop removed — because the
   * claim is about shape and not about the three step names this repository
   * happens to have today. A fourth loop added tomorrow gets a row for free,
   * and a run that disagrees with the last one should be read against
   * `git diff .github/workflows/ci.yml` before it is read as a fault here.
   *
   * Steps that hold no loop cannot move it, and that is measured rather than
   * assumed: on 2026-08-06, with `- run: node scripts/audit-unread.mjs`
   * replaced by a lint step in a copy of the file, this walk produced the same
   * four variants and the same four verdicts, byte for byte.
   *
   * `checkDeployTests` is not consulted for what the sentence should say. The
   * two jobs fail for different reasons — one ships unchecked code to players,
   * the other leaves every suite unrun on every push — and a person reading one
   * red line has to be able to tell which job spoke, so that is asserted below
   * rather than left to whoever edits the wording next.
   *
   * BROKEN ON PURPOSE, 2026-08-06: with the `RUNS_TESTS` condition dropped from
   * `checkCiPackages`, three cases went red and seventy-three stayed green —
   *   × ci.yml without '- name: Test'
   *     → expected 0 to be greater than or equal to 1
   *   × does not tell a workflow with no loops what it tells one that never tests
   *     → expected [] to have a length of 1 but got +0
   *   × the packages CI actually runs > says so when every loop is perfect and
   *     none of them tests
   *     → expected [] to have a length of 1 but got +0
   * — which is the point: removing the only step that runs a suite left every
   * other assertion in this file satisfied. Restored, and all seventy-six pass.
   * Nothing here writes a workflow; every variant is a string in memory.
   */
  describe('the step that is not there', () => {
    // `checkCiPackages` is only ever pointed at this one workflow, by
    // `audit-configs.mjs`. `pages.yml` is `checkDeployTests`' subject and has
    // its own suite above.
    const CI = '.github/workflows/ci.yml';
    const text = readFileSync(join(ROOT, CI), 'utf8');
    const lines = text.split('\n');

    /**
     * Whether a workflow runs a package loop through a test runner, said again.
     *
     * A second, deliberately naive statement of the rule under test, in the
     * register the readers above already established: asking the checker
     * whether the checker thinks tests are run would be the suspect marking its
     * own paper. It is only ever applied to variants in which nothing is
     * disabled, so it has no need of the structural walk.
     */
    const runsTests = (workflow: string) =>
      [...workflow.matchAll(/for pkg in [^;\n]+; do([\s\S]*?)\bdone\b/g)].some(([, body]) =>
        /\b(vitest|jest|playwright|bun\s+test|run\s+test)\b/.test(body ?? ''),
      );

    /** Every step of the real file that holds a package loop, by plain text. */
    const LOOP_STEPS = stepsIn(text).filter((step) =>
      /for pkg in /.test(lines.slice(step.from, step.to).join('\n')),
    );

    const dropping = (steps: Step[]) =>
      lines
        .filter((_, at) => !steps.some((step) => at >= step.from && at < step.to))
        .join('\n');

    /**
     * What the surviving loops name, used as the repository they are held to.
     *
     * Taking the workspace set from the variant itself silences the two
     * questions this checker already asked — every name is listed and every
     * listed name exists, by construction — so anything it says about a variant
     * is the new question speaking. If the loops of `ci.yml` ever come to
     * disagree with each other this control goes red, and that is the older
     * finding rather than a fault in this grid.
     */
    const said = (workflow: string) => {
      const loops: Loop[] = packagesCheckedByCi(workflow);
      return checkCiPackages(
        loops,
        new Set(loops.flatMap((loop) => [...loop.names])),
      ) as string[];
    };

    const VARIANTS = [
      ...LOOP_STEPS.map((step) => ({
        removed: (lines[step.from] ?? '').trim(),
        workflow: dropping([step]),
      })),
      { removed: 'every step that holds a loop', workflow: dropping(LOOP_STEPS) },
    ];

    it.each(VARIANTS)('ci.yml without $removed', ({ workflow }) => {
      const problems = said(workflow);

      if (runsTests(workflow)) {
        // Removing a loop that only typechecks leaves a workflow that still
        // runs the suites. Quiet, or the check cries wolf on correct code.
        expect(problems).toEqual([]);
      } else {
        // A workflow that runs no test is never silent. What it says is
        // asserted below; that it says something is the shape.
        expect(problems.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('has a variant on each side of the question', () => {
      // Both branches above are reachable, or the row that matters is vacuous.
      expect(VARIANTS.filter(({ workflow }) => runsTests(workflow)).length).toBeGreaterThan(0);
      expect(VARIANTS.filter(({ workflow }) => !runsTests(workflow)).length).toBeGreaterThan(0);
      // And the file on disk still runs tests, which is what makes the removals
      // a removal of something.
      expect(runsTests(text)).toBe(true);
      expect(LOOP_STEPS.length).toBeGreaterThan(1);
      expect(said(text)).toEqual([]);
    });

    it('does not tell a workflow with no loops what it tells one that never tests', () => {
      const noLoops = said(dropping(LOOP_STEPS));
      const neverTests = VARIANTS.filter(
        ({ workflow }) => !runsTests(workflow) && packagesCheckedByCi(workflow).length > 0,
      ).map(({ workflow }) => said(workflow));

      expect(noLoops).toHaveLength(1);
      expect(neverTests.length).toBeGreaterThan(0);
      for (const problems of neverTests) {
        expect(problems).toHaveLength(1);
        expect(problems).not.toContain(noLoops[0]);
      }
    });

    it('does not answer in the deploy job words', () => {
      // Two jobs, two reasons, and one line each to say which. Reusing the
      // neighbour's sentence would leave a reader of a red build guessing.
      const deploy = checkDeployTests([], new Set(['packages/engine'])) as string[];
      expect(deploy).toHaveLength(1);

      for (const { workflow } of VARIANTS) {
        for (const problem of said(workflow)) expect(deploy).not.toContain(problem);
      }
    });
  });
});
