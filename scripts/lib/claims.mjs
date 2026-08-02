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

/** A claim the README makes about a package. */
export const claimedCounts = (readme) => {
  const counts = new Map();
  // `| `@leela/engine` | 202 | rules, four variants… |`
  for (const [, name, count] of readme.matchAll(/^\|\s*`(@leela\/[\w-]+)`\s*\|\s*(\d+)\s*\|/gm)) {
    counts.set(name, Number(count));
  }
  return counts;
};

/** The total the README states in prose: "1135 tests, run on every push". */
export const claimedTotal = (readme) => {
  const match = readme.match(/^(\d[\d,]*) tests, run on every push/m);
  return match ? Number(match[1].replace(/,/g, '')) : null;
};

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
 * The three jobs that matter — loose typecheck, strict typecheck, tests — each
 * iterate a `for pkg in …` list written by hand, because a shell loop cannot
 * ask the repository what its workspaces are. A tenth package added without
 * touching that line is a package CI silently never runs: not a red build, an
 * absent one, which is the failure nobody notices.
 *
 * Returns one set per loop, so a package added to two of the three is caught as
 * readily as one added to none.
 */
export const packagesCheckedByCi = (workflow) => {
  const loops = [];
  for (const [, list] of workflow.matchAll(/for pkg in ([^;\n]+); do/g)) {
    loops.push(new Set(list.trim().split(/\s+/)));
  }
  return loops;
};

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
