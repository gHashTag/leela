#!/usr/bin/env node
/**
 * Every package that ships code is held to the same rule.
 *
 * `noUncheckedIndexedAccess` is what would have caught `ruleSetById` returning
 * `undefined` typed as a `RuleSet`, and `currentPlayer` doing the same for a
 * stale turn index — each of which made a chat throw on every command, forever,
 * three files from the row that was wrong.
 *
 * A flag turned on in eight files is a flag that will be missing from the
 * ninth. This checks that every workspace with a `src/` has the strict
 * configuration, that the configuration says what it is supposed to say, and
 * that `package.json` can run it — because a config nobody runs is a comment.
 *
 * Run:  node scripts/audit-configs.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkCiPackages, checkDeployPaths, checkDeployTests, checkLockfiles, workspacesNeededBy, checkManifests, copiedManifests, packagesCheckedByCi, packagesTestedByDeploy } from './lib/claims.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const WORKSPACES = ['packages', 'apps'];

/** Strip comments so a tsconfig with them parses as JSON. */
function readJsonc(path) {
  const text = readFileSync(path, 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(text);
}

const problems = [];
const workspaces = new Set();
let checked = 0;

for (const group of WORKSPACES) {
  const dir = join(ROOT, group);
  if (!existsSync(dir)) continue;

  for (const name of readdirSync(dir)) {
    const pkg = join(dir, name);

    // A workspace is a `package.json`; a directory is not one. `apps/mobile`,
    // `apps/site` and `packages/ui` are empty placeholders waiting for a port —
    // untracked, so they exist on this machine and not in CI, and a check that
    // reads the filesystem would say different things in the two places.
    if (!existsSync(join(pkg, 'package.json'))) continue;

    // Nothing to hold to a rule about shipped code if nothing ships.
    //
    // `.tsx` counts, for the reason `lib/claims.mjs` had already written down
    // one import away and this file went on ignoring: a workspace whose `src`
    // holds only components would otherwise drop out here, and this filter is
    // not local. The `workspaces` set it fills feeds the Dockerfile check and
    // the three CI shell loops below, so a workspace missed here is a workspace
    // missed by all four at once — silently, since every one of them then
    // reports success over a set that no longer contains it.
    const sources = existsSync(join(pkg, 'src'))
      ? readdirSync(join(pkg, 'src')).filter((file) => /\.tsx?$/.test(file))
      : [];
    if (sources.length === 0) continue;

    checked += 1;

    const where = `${group}/${name}`;
    workspaces.add(where);
    const strict = join(pkg, 'tsconfig.src.json');

    if (!existsSync(strict)) {
      problems.push(`${where}: no tsconfig.src.json`);
      continue;
    }

    const config = readJsonc(strict);

    /**
     * The flags the shipped code is held to, each because something got past.
     *
     * `noUncheckedIndexedAccess` is the one this check was written for.
     * `noUnusedLocals` came later, from three functions that died in
     * `packages/db/src/legacy.ts` the moment `stateFromLegacy` began
     * delegating — invisible to `audit-unread`, which reads exports and fields,
     * and a private function is neither. Listed rather than asked for one by
     * one, so a fourth is a line here and not a new branch.
     */
    for (const flag of ['noUncheckedIndexedAccess', 'noUnusedLocals', 'noUnusedParameters']) {
      if (config.compilerOptions?.[flag] !== true) {
        problems.push(`${where}: tsconfig.src.json does not turn on ${flag}`);
      }
    }
    if (!Array.isArray(config.include) || !config.include.includes('src')) {
      problems.push(`${where}: tsconfig.src.json does not cover src`);
    }
    if (config.include?.includes('tests')) {
      // Deliberate: `rows[0]` in a test is a value the test built two lines
      // earlier, and a guard there adds noise rather than truth.
      problems.push(`${where}: tsconfig.src.json covers tests, which are out of scope`);
    }

    /**
     * The three scripts `verify` fans out over, and why losing one is quiet.
     *
     * `bun run --filter '*' <name>` runs the workspaces that declare `<name>`
     * and says NOTHING about the ones that do not. MEASURED 2026-08-06 in a
     * scratch two-workspace monorepo outside this repository, `a` declaring the
     * script and `b` not:
     *
     *   b declares no `test`      -> `a test: A-RAN`, nothing whatever about b,
     *                                exit 0
     *   b declares `test: exit 3` -> `b test: Exited with code 3`, exit 3
     *   neither declares `test`   -> `error: No packages matched the filter`,
     *                                exit 1
     *
     * Losing every workspace is loud. Losing ONE is silent — the asymmetry this
     * repository keeps finding, and the only one of the three that a green
     * `verify` cannot tell you about.
     *
     * Nothing else in the repository can see it, because every other reader
     * bypasses the script rather than running it:
     *
     *   - `audit-claims` walks the filesystem for packages and runs
     *     `npx vitest run` itself, so it would keep printing `@leela/docs … 239`
     *     and confirming README's table for a suite `verify` no longer reaches;
     *   - `.github/workflows/ci.yml` runs `(cd "$pkg" && bunx vitest run)` and
     *     `bunx tsc --noEmit -p tsconfig.src.json` in hard-coded shell loops, so
     *     CI stays green for the same reason;
     *   - `packages/content/tests/a-gate-that-runs-no-audit.test.ts` asks
     *     whether `verify` HAS a test step, never what that step reaches;
     *   - `typecheck:strict` above is checked, and only that.
     *
     * Both legs run through the same filter, so both belong here. The values
     * are pinned rather than merely required to exist: a `test` script that
     * runs something other than the suite is the same silence one step along.
     * `packages/engine/tests/a-suite-the-gate-never-reaches.test.ts` states the
     * rule the other way round — derived from `verify` itself, so an eleventh
     * fanned-out leg is covered the day it is added.
     */
    const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
    if (manifest.scripts?.['typecheck:strict'] !== 'tsc --noEmit -p tsconfig.src.json') {
      problems.push(`${where}: package.json cannot run the strict typecheck`);
    }
    if (manifest.scripts?.test !== 'vitest run') {
      problems.push(
        `${where}: package.json declares no \`test: vitest run\`, so \`bun run --filter '*' test\` ` +
          'skips this workspace in silence and `verify` still exits 0',
      );
    }
    if (manifest.scripts?.typecheck !== 'tsc --noEmit') {
      problems.push(
        `${where}: package.json declares no \`typecheck: tsc --noEmit\`, so ` +
          "`bun run --filter '*' typecheck` skips this workspace in silence and `verify` still exits 0",
      );
    }
  }
}

// The bot's image installs the whole workspace, so its Dockerfile carries a
// hand-written list of every manifest. A package added without a line there
// fails the build with "Workspace dependency not found" — which the CI job
// catches, but a minute later and a push too late.
const dockerfile = join(ROOT, 'apps/bot/Dockerfile');
if (existsSync(dockerfile)) {
  problems.push(
    ...checkManifests(copiedManifests(readFileSync(dockerfile, 'utf8')), workspaces),
  );
}

// One workspace, one lockfile. A second one inside a package is used by
// anything run from that directory, and the two had already forked.
problems.push(
  ...checkLockfiles([
    ...readdirSync(ROOT),
    ...[...workspaces].flatMap((where) =>
      readdirSync(join(ROOT, where)).map((file) => `${where}/${file}`),
    ),
  ]),
);

// The deploy job watches a hand-written list of paths, and the apps it
// publishes are made of packages. A push that touches a package nobody listed
// changes what players run and publishes nothing.
const pages = join(ROOT, '.github/workflows/pages.yml');
if (existsSync(pages)) {
  const workflow = readFileSync(pages, 'utf8');

  /** The `paths:` entries, without their globs. */
  const watched = [...workflow.matchAll(/^\s*- '([^']+)\/\*\*'/gm)].map((found) => found[1]);

  /** One workspace's own `@leela/*` dependencies, as workspace paths. */
  const dependenciesOf = (where) => {
    const manifest = join(ROOT, where, 'package.json');
    if (!existsSync(manifest)) return [];

    const { dependencies = {}, devDependencies = {} } = JSON.parse(readFileSync(manifest, 'utf8'));
    return Object.keys({ ...dependencies, ...devDependencies })
      .filter((name) => name.startsWith('@leela/'))
      .map((name) => `packages/${name.slice('@leela/'.length)}`)
      .filter((path) => existsSync(join(ROOT, path)));
  };

  // What the job builds, read from the job rather than assumed.
  const deployed = [...workflow.matchAll(/--cwd (apps\/[a-z]+)/g)].map((found) => found[1]);
  const needed = workspacesNeededBy([...new Set(deployed)], dependenciesOf);

  problems.push(...checkDeployPaths(watched, needed));

  // The same file states its dependencies a second time, five lines below the
  // first: the loop that tests what is about to be published. Only the `paths:`
  // list above was ever held to the graph, and the two already disagreed — the
  // pass that added `packages/journal` to `paths:` left the loop iterating the
  // four it had before, so the format both surfaces read and write could go red
  // and deploy green.
  problems.push(...checkDeployTests(packagesTestedByDeploy(workflow), needed));
}

// CI iterates a hand-written list in a shell loop, three times over. A package
// missing from it does not turn the build red — it is simply never run, which
// is the failure nobody notices. This pass was pushed with a strict-typecheck
// error precisely because the local check and the CI check were different
// commands; a list that disagrees with the repository is the same problem one
// step further along.
const workflow = join(ROOT, '.github/workflows/ci.yml');
if (existsSync(workflow)) {
  problems.push(
    ...checkCiPackages(packagesCheckedByCi(readFileSync(workflow, 'utf8')), workspaces),
  );
}

console.log(`\nChecked ${checked} workspaces that ship code.\n`);

if (problems.length === 0) {
  console.log('Every one of them is held to the same flags, and can run the check that holds it.');
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log(
    '\nA flag turned on in eight files is a flag that will be missing from the ninth.',
  );
  process.exitCode = 1;
}
