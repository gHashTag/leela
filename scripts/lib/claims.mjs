/**
 * The numbers this repository says about itself.
 *
 * `README.md` carries a table of per-package test counts and a total, and both
 * have been maintained by hand for forty passes. A number kept by hand is a
 * number that will eventually be wrong, and the two passes before this one were
 * both about a confident sentence that had never been checked.
 *
 * The parsing and the comparing are here, away from anything that runs a test
 * suite, so the rules can be asserted without one.
 */

// The workflow reader, borrowed rather than rebuilt. Two functions below ask
// whether a line of a workflow will be executed, and that question already had
// a careful answer next door; asking it a second way here is how they came to
// disagree. See `packagesCheckedByCi`.
import { liveStepsOf } from './runnable.mjs';

/**
 * Where a per-package count lives: one row of the Status table.
 *
 * `| `@leela/engine` | 202 | rules, four variants… |`
 *
 * Written as *prefix, name, digits* with the closing pipe as a lookahead, so
 * the one description of the row serves the reader and the writer both. The
 * alternative — a second regex beside `rewriteClaims` — is the defect this
 * whole file exists to catch, one level up: two hand-kept descriptions of one
 * format, drifting.
 *
 * A fresh regex per call. A module-level `/g` literal carries `lastIndex`
 * between callers, and `matchAll` copies it, so a reader run after a partial
 * scan would silently start in the middle of the table and report a short one.
 */
const row = () => /^(\|\s*`(@leela\/[\w-]+)`\s*\|\s*)(\d+)(?=\s*\|)/gm;

/** Where the stated total lives: "1135 tests, run on every push". */
const total = () => /^(\d[\d,]*)(?= tests, run on every push)/m;

/** A claim the README makes about a package. */
export const claimedCounts = (readme) => {
  const counts = new Map();
  for (const [, , name, count] of readme.matchAll(row())) {
    counts.set(name, Number(count));
  }
  return counts;
};

/** The total the README states in prose: "1135 tests, run on every push". */
export const claimedTotal = (readme) => {
  const match = readme.match(total());
  return match ? Number(match[1].replace(/,/g, '')) : null;
};

/**
 * The same README with the numbers it states replaced by the numbers measured.
 *
 * The check above already knows the truth: it runs all ten suites and counts.
 * Having computed it, the script then asked a person to retype six numbers into
 * a table, and the build stayed red until somebody did. A check whose failure
 * mode is *a human did not retype what the check computed* is red more often
 * than the code is wrong, and a red that is usually not about the code is a red
 * people learn to scroll past. So the answer is not a better reminder; it is
 * not asserting a number the check is holding in its hand.
 *
 * Pure, and narrow on purpose. Rows and the total, nothing else: not the State
 * column's prose, not the links in it, not a blank line, not the trailing
 * newline. Everything outside the digits comes back byte for byte, because a
 * writer that reflows a document is one nobody dares point at README.
 *
 * Two things it deliberately does **not** do, both of which stay a person's
 * job and stay red until that person does them:
 *
 *   - add a row for a package the table has never heard of. The row carries a
 *     sentence about what the package is for, and inventing that is writing,
 *     not arithmetic.
 *   - remove a row for a package that no longer runs anything.
 *
 * `checkCounts` reports both, and it should keep reporting both. What is
 * automated here is only the part that was never a decision.
 *
 * @param readme The document, as written.
 * @param actual `Map<name, count>` — what the suites just ran.
 * @returns The document to write back. The total becomes the sum of the table
 *          *as rewritten*, which is what `checkTotal` compares it against.
 */
export function rewriteClaims(readme, actual) {
  const rows = readme.replace(row(), (whole, prefix, name) =>
    actual.has(name) ? `${prefix}${actual.get(name)}` : whole,
  );

  const sum = [...claimedCounts(rows).values()].reduce((a, b) => a + b, 0);

  // If the README states no total there is nothing to correct and nothing to
  // invent — `checkTotal` says so in its own words, and says it after this ran.
  return rows.replace(total(), String(sum));
}

/**
 * Everything wrong with the numbers.
 *
 * Three kinds, and the third is the one a person would not notice: a package
 * that runs tests and is not in the table at all. A table that is *correct
 * about what it lists* can still be a table that leaves things out.
 */
export function checkCounts(claimed, actual) {
  const problems = [];

  for (const [name, count] of actual) {
    if (!claimed.has(name)) {
      problems.push(`${name} runs ${count} tests and is not in the table`);
      continue;
    }
    const said = claimed.get(name);
    if (said !== count) {
      problems.push(`${name}: the table says ${said}, the suite runs ${count}`);
    }
  }

  for (const name of claimed.keys()) {
    if (!actual.has(name)) {
      problems.push(`${name} is in the table and ran nothing`);
    }
  }

  return problems;
}

/**
 * Whether the stated total is the sum of the table.
 *
 * Checked against the *sum* rather than against the suites: a total that agrees
 * with the suites but not with the table above it is still two numbers in one
 * document disagreeing, and a reader adds the column.
 */
export function checkTotal(claimed, total) {
  const sum = [...claimed.values()].reduce((a, b) => a + b, 0);

  if (total === null) return ['the README states no total'];
  if (total !== sum) return [`the total says ${total}, the table adds up to ${sum}`];
  return [];
}

/**
 * Which workspaces a Dockerfile copies a manifest for.
 *
 * The list is written by hand — Docker cannot glob a path and keep it — and a
 * package added without a line here fails the image build with "Workspace
 * dependency not found". That happened the first time a ninth package was
 * added, and the CI job caught it, which is the good version of this story. The
 * cheap version is checking the list.
 */
export const copiedManifests = (dockerfile) => {
  const copied = new Set();
  for (const [, path] of dockerfile.matchAll(/^COPY\s+((?:packages|apps)\/[\w-]+)\/package\.json/gm)) {
    copied.add(path);
  }
  return copied;
};

/** Workspaces the image installs for, against the ones that exist. */
export function checkManifests(copied, workspaces) {
  const problems = [];

  for (const workspace of workspaces) {
    if (!copied.has(workspace)) {
      problems.push(`${workspace} has a package.json the Dockerfile does not copy`);
    }
  }

  for (const path of copied) {
    if (!workspaces.has(path)) {
      problems.push(`the Dockerfile copies ${path}/package.json, which does not exist`);
    }
  }

  return problems;
}

/**
 * Which workspaces the CI workflow names.
 *
 * The three steps that matter — loose typecheck, strict typecheck, tests — each
 * iterate a `for pkg in …` list written by hand, because a shell loop cannot
 * ask the repository what its workspaces are. A tenth package added without
 * touching that line is a package CI silently never runs: not a red build, an
 * absent one, which is the failure nobody notices.
 *
 * Returns one set per loop, so a package added to two of the three is caught as
 * readily as one added to none.
 *
 * **It reads the workflow as YAML, and only inside a step that will run.** It
 * used to read it as text: one `matchAll` for the loop header anywhere in the
 * file. MEASURED on 2026-08-06, on this repository, with nothing edited on
 * disk: against `.github/workflows/ci.yml` it returned three loops, and with
 * every one of those three lines prefixed with `#` — that is, with all three
 * loops commented out and CI typechecking and testing nothing at all — it
 * returned three loops again, all ten workspaces in each, and
 * `checkCiPackages` reported full coverage.
 *
 * That is worth spelling out, because of what this particular guard is for. A
 * `for pkg in` line that no runner will execute is a line that described full
 * coverage to the one check whose entire subject is *coverage nobody notices is
 * absent*. Every other failure in this repository is at worst a red build; this
 * one is a green one, and it reads identically to the day the list was right.
 * The guard against silent absence was itself silently absent.
 *
 * `liveStepsOf` is the same reader `auditsRunByCi` uses one file over, where
 * this class of mistake — a step behind a `#`, behind `if: false`, behind a
 * job's `if: false`, or with `continue-on-error: true` — was closed for audits
 * and left open here. It is imported rather than rewritten: a second
 * description of "will this text be executed" is precisely the drift this file
 * exists to catch, one level up.
 */
export const packagesCheckedByCi = (workflow) => {
  const loops = [];

  for (const { run } of liveStepsOf(workflow)) {
    if (run === null) continue;
    for (const [, list] of run.matchAll(new RegExp(LOOP_HEADER, 'g'))) {
      loops.push(namesIn(list));
    }
  }

  return loops;
};

/**
 * One `for pkg in …; do` header, and the list it iterates.
 *
 * A source string rather than a literal because two readers here want it: the
 * one above, which wants only the list, and `packagesTestedByDeploy`, which
 * wants the list *and the body* so it can tell a loop that runs tests from a
 * loop that builds. Written twice they would drift, and this file's whole
 * subject is two descriptions of one thing drifting apart.
 */
const LOOP_HEADER = String.raw`for pkg in ([^;\n]+); do`;

/** The workspaces one loop header iterates. */
const namesIn = (list) => new Set(list.trim().split(/\s+/));

/** A loop body that runs a test runner, as opposed to building or copying. */
const RUNS_TESTS = /\b(vitest|jest|playwright|bun\s+test|run\s+test)\b/;

/**
 * Which workspaces the deploy job's **test** loop runs.
 *
 * The same source string and the same walk as `packagesCheckedByCi` — the list
 * is the same shape in both workflows, and a second parser for it would be the
 * defect this file is about. What that reader cannot do is *choose* a loop: it
 * returns one set per `for pkg in …` in every live step, and the rule its
 * consumer applies is "every workspace in every loop". That rule is right for
 * `ci.yml`, where every job is meant to cover the repository, and wrong for a
 * deploy job, which legitimately handles a subset — the apps it publishes and
 * what they are made of. Pointing `checkCiPackages` here would have cried wolf
 * on correct code.
 *
 * So this narrows: the loops whose body runs a test runner. A build loop over
 * the apps alone is not asked to cover the graph.
 *
 * It shares the other reader's blindness and its cure both. It used to match the
 * loop against the raw file, so it reported one live test loop in `pages.yml`
 * whether or not the step holding it existed — MEASURED on 2026-08-06 by
 * commenting the loop out and watching the count stay at one. A deploy job that
 * tests nothing must not read as a deploy job that tests everything it ships.
 *
 * If a rewrite makes the test loop unrecognisable, this returns nothing and
 * `checkDeployTests` says so out loud. An unrecognised loop must not read as a
 * covered one — that is the failure this pass exists to close, one level up.
 */
export const packagesTestedByDeploy = (workflow) => {
  const loops = [];
  const block = new RegExp(`${LOOP_HEADER}([\\s\\S]*?)\\bdone\\b`, 'g');

  for (const { run } of liveStepsOf(workflow)) {
    if (run === null) continue;
    for (const [, list, body] of run.matchAll(block)) {
      if (RUNS_TESTS.test(body)) loops.push(namesIn(list));
    }
  }

  return loops;
};

/**
 * What the deploy job tests, against what the deployed apps are made of.
 *
 * `pages.yml` states its dependencies **twice**, five lines apart: once in
 * `paths:`, which decides whether a push deploys at all, and once in a
 * `for pkg in …` loop, which decides what is tested before it does. Only the
 * first was ever asked whether it agreed with the dependency graph —
 * `checkDeployPaths` has read it since the pass that added `packages/journal`
 * to it, and the loop five lines below still iterated the four it had before.
 * So the shared file format both surfaces read and write could go red and
 * deploy green, and the file that knew the package mattered was the same file
 * that skipped it.
 *
 * The comparison is against `workspacesNeededBy(deployed, …)` rather than
 * against every workspace, for the reason spelled out on
 * `packagesTestedByDeploy`: the bot and the phone app are not in this artifact
 * and demanding them here would be a check nobody could satisfy.
 *
 * A loop entry the graph does not make necessary is **not** reported, matching
 * `checkDeployPaths` one function up: testing more than is shipped costs a
 * minute, and shipping something untested costs a player. Only the gap is a
 * defect. Whether an entry names a workspace that exists at all is
 * `checkCiPackages`' question, and it asks it of the workflow that iterates
 * everything.
 *
 * @param loops  One set per test loop, from `packagesTestedByDeploy`.
 * @param needed Every workspace a deployed app depends on, transitively.
 */
export function checkDeployTests(loops, needed) {
  if (loops.length === 0) {
    return [
      'the deploy job runs no test loop at all: whatever it publishes reaches players unchecked',
    ];
  }

  const problems = [];

  for (const [index, named] of loops.entries()) {
    for (const where of [...needed].sort()) {
      if (named.has(where)) continue;
      problems.push(
        `${where}: a deployed app depends on it and test loop ${index + 1} of the deploy job does not run it — its suite can be red and the deploy still goes green`,
      );
    }
  }

  return problems;
}

/**
 * What the deploy job watches, against what the deployed apps are made of.
 *
 * `pages.yml` publishes the mini app on a push that touches one of four paths,
 * written by hand: the two apps, `packages/engine` and `packages/content`. The
 * mini app also declares and imports **`@leela/journal`** — the format every
 * surface reads and writes, and the package two of the last ten passes changed.
 * A push that touches only it changes what players run and deploys nothing, so
 * the live site keeps the old code with nothing to say it does.
 *
 * The same shape as `checkCiPackages` one job over: a hand-written list beside a
 * dependency graph is a list that will disagree with it.
 *
 * @param watched The paths the workflow lists, without their globs.
 * @param needed Every workspace a deployed app depends on, transitively.
 */
export function checkDeployPaths(watched, needed) {
  const seen = new Set(watched);

  return [...needed]
    .filter((where) => !seen.has(where))
    .sort()
    .map(
      (where) =>
        `${where}: a deployed app depends on it and the deploy job does not watch it — a push that touches only this changes what players run and publishes nothing`,
    );
}

/**
 * Every workspace a set of apps depends on, following the graph rather than
 * naming it.
 *
 * @param roots Where to start, as workspace paths.
 * @param dependenciesOf Reads one workspace's `@leela/*` dependencies, as paths.
 */
export function workspacesNeededBy(roots, dependenciesOf) {
  const needed = new Set();
  const queue = [...roots];

  while (queue.length > 0) {
    const where = queue.shift();
    if (where === undefined || needed.has(where)) continue;

    needed.add(where);
    queue.push(...dependenciesOf(where));
  }

  return needed;
}

/**
 * One workspace, one lockfile.
 *
 * `packages/engine/bun.lock` was committed in the first unification commit and
 * nobody looked at it again. A bun workspace resolves from the lockfile beside
 * the root manifest; a second one inside a package is used by anything run
 * *from that directory* — and the two had already come apart. The root pinned
 * vite 6.4.3 and esbuild 0.25.12, the engine's pinned 5.4.21 and 0.21.5, so the
 * one package every surface depends on could be tested by a different bundler
 * than the surfaces are, and CI — which installs at the root — would never see
 * it.
 *
 * The same shape as the app one repository over, from the other side: there a
 * missing lockfile let versions drift, here a spare one let them fork.
 *
 * @param files Every file the repository tracks, as repo-relative paths.
 */
export function checkLockfiles(files) {
  const locks = files.filter((path) => /(^|\/)(bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(path));
  const stray = locks.filter((path) => path.includes('/'));

  if (locks.length === 0) return ['no lockfile at all: every install resolves fresh'];

  return stray.map(
    (path) =>
      `${path}: a second lockfile inside a workspace — the root's is the one an install at the root uses, and these two can pin different versions of the same tool`,
  );
}

/** Workspaces CI iterates, against the ones that exist. */
export function checkCiPackages(loops, workspaces) {
  const problems = [];

  if (loops.length === 0) return ['the CI workflow iterates no packages at all'];

  for (const [index, named] of loops.entries()) {
    for (const workspace of workspaces) {
      if (!named.has(workspace)) {
        problems.push(`${workspace} exists and CI loop ${index + 1} does not run it`);
      }
    }
    for (const name of named) {
      if (!workspaces.has(name)) {
        problems.push(`CI loop ${index + 1} runs ${name}, which does not ship code`);
      }
    }
  }

  return problems;
}

/**
 * Every workspace that ships TypeScript, found rather than listed.
 *
 * `audit-unread.mjs` walked a hand-written array of source directories, and
 * `packages/journal/src` was not in it — so the shared file format between the
 * bot and the mini app had never been checked for a field nobody reads or an
 * export nobody calls, while the audit said "Every export has at least one
 * caller". That is the fourth hand-kept list in this repository to be wrong,
 * and the second to be wrong by *omission*, which is the kind that reads as a
 * pass.
 *
 * Same rule as `audit-configs`: a workspace is a `package.json` with a `src`
 * that holds TypeScript. `apps/site` and `packages/ui` are untracked
 * placeholders — they exist on one machine and not in CI, and a check that
 * disagreed with itself in the two places would be worse than none.
 *
 * **And a workspace is not only its `src`.** Having stopped a package being
 * missed, this returned one directory per package and missed the rest of two of
 * them: `apps/miniapp/scripts/smoke-run.ts`, the post-deploy check CI runs on
 * every release, and `apps/mobile/index.ts`, the phone app's entry point. Both
 * are readers, and the audit could not see them reading — so three exports
 * carried hand-written waivers naming a file the audit was not looking at, and
 * a waiver that names a file nobody checks is one that outlives the file.
 *
 * `tests` is deliberately not here. Several waivers say *used by its tests*,
 * which is a real and weaker answer than *used by the game*, and folding tests
 * in would silently turn every one of those into a pass.
 *
 * @param read  `{ entries(dir), isDirectory(path), exists(path) }` — injected
 *              so the rule can be asserted against a made-up tree.
 */

/**
 * Every workspace, with where its source and its tests live.
 *
 * `workspaceSources` answers *what to read for declarations*; three other
 * audits want the same set for their own questions and each kept its own array
 * of it. Two were wrong on the day this was written, both by omission:
 * `audit-doubles` listed nine of the ten and never saw the phone app, which
 * holds four constants declared twice — including an `EMPTY` that means two
 * different things; `audit-promises` listed five, and the five it left out hold
 * injected dependencies nothing has ever handed a broken one.
 *
 * That is the sixth and seventh hand-kept list here to be wrong, in a
 * repository whose fix for the fifth is one function above this one. A rule
 * that closes a class of omission has to be *used* by everything in the class.
 *
 * @param read  The same injected reader `workspaceSources` takes.
 */
export function workspacePackages(read, groups = ['packages', 'apps']) {
  return workspaceSources(read, groups)
    .filter((path) => path.endsWith('/src'))
    .map((src) => {
      const path = src.slice(0, -'/src'.length);
      const tests = `${path}/tests`;
      return { path, src, tests: read.exists(tests) ? tests : null };
    });
}

/** Directories that are not a workspace's own source, whatever they hold. */
const NOT_SOURCE = new Set(['node_modules', 'dist', 'build', 'coverage', 'tests', '.expo']);

export function workspaceSources(read, groups = ['packages', 'apps']) {
  const found = [];

  for (const group of groups) {
    if (!read.exists(group)) continue;

    for (const name of read.entries(group).sort()) {
      const pkg = `${group}/${name}`;
      if (!read.exists(`${pkg}/package.json`)) continue;
      if (!read.exists(`${pkg}/src`)) continue;
      // `.tsx` counts. This asked for `.ts` alone, so a workspace whose `src`
      // holds only components — which `apps/mobile` is one refactor from being
      // — would have been skipped whole, by the same rule that exists to stop a
      // workspace being skipped.
      if (!read.entries(`${pkg}/src`).some((file) => /\.tsx?$/.test(file))) continue;

      found.push(`${pkg}/src`);

      // Whatever else the workspace ships: another directory of sources, or a
      // file at its root. Paths rather than directories, because an entry point
      // is usually one file beside the folders.
      for (const entry of read.entries(pkg).sort()) {
        if (entry === 'src' || NOT_SOURCE.has(entry)) continue;

        const path = `${pkg}/${entry}`;
        if (/\.(ts|tsx|mjs)$/.test(entry)) {
          found.push(path);
          continue;
        }

        if (!read.isDirectory?.(path)) continue;
        if (read.entries(path).some((file) => /\.(ts|tsx|mjs)$/.test(file))) found.push(path);
      }
    }
  }

  return found;
}
