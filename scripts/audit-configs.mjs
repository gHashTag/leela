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
import { checkCiPackages, checkLockfiles, checkManifests, copiedManifests, packagesCheckedByCi } from './lib/claims.mjs';

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
    const sources = existsSync(join(pkg, 'src'))
      ? readdirSync(join(pkg, 'src')).filter((file) => file.endsWith('.ts'))
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
    if (config.compilerOptions?.noUncheckedIndexedAccess !== true) {
      problems.push(`${where}: tsconfig.src.json does not turn on noUncheckedIndexedAccess`);
    }
    if (!Array.isArray(config.include) || !config.include.includes('src')) {
      problems.push(`${where}: tsconfig.src.json does not cover src`);
    }
    if (config.include?.includes('tests')) {
      // Deliberate: `rows[0]` in a test is a value the test built two lines
      // earlier, and a guard there adds noise rather than truth.
      problems.push(`${where}: tsconfig.src.json covers tests, which are out of scope`);
    }

    const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
    if (manifest.scripts?.['typecheck:strict'] !== 'tsc --noEmit -p tsconfig.src.json') {
      problems.push(`${where}: package.json cannot run the strict typecheck`);
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
  console.log('Every one of them is held to noUncheckedIndexedAccess.');
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log(
    '\nA flag turned on in eight files is a flag that will be missing from the ninth.',
  );
  process.exitCode = 1;
}
