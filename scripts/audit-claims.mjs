#!/usr/bin/env node
/**
 * Check the numbers this repository says about itself.
 *
 * `README.md` carries a table of per-package test counts and a total, and both
 * have been maintained by hand for forty passes. The two passes before this one
 * were each about a confident sentence that had never been checked — a bot that
 * "dies without a volume" and did not, a contract "permanently deployed" to a
 * network that was shut down in 2024. A hand-kept number is the same kind of
 * sentence, waiting.
 *
 * Runs every package's suite and compares. Slower than the other audits and
 * worth it: this is the number a reader trusts most.
 *
 *   node scripts/audit-claims.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkCounts, checkTotal, claimedCounts, claimedTotal } from './lib/claims.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/** Every workspace that ships code and runs tests. */
function packages() {
  const found = [];
  for (const group of ['packages', 'apps']) {
    const dir = join(ROOT, group);
    if (!existsSync(dir)) continue;

    for (const name of readdirSync(dir)) {
      const at = join(dir, name);
      if (!existsSync(join(at, 'package.json'))) continue;
      if (!existsSync(join(at, 'tests'))) continue;

      const manifest = JSON.parse(readFileSync(join(at, 'package.json'), 'utf8'));
      found.push({ name: manifest.name, at });
    }
  }
  return found;
}

/** How many tests a package actually runs. */
function run(at) {
  const output = execFileSync('npx', ['vitest', 'run', '--reporter=json'], {
    cwd: at,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });

  // The reporter prints JSON, sometimes after other lines. Take the object.
  const start = output.indexOf('{');
  const report = JSON.parse(output.slice(start));
  return report.numTotalTests;
}

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const claimed = claimedCounts(readme);

const actual = new Map();
for (const { name, at } of packages()) {
  process.stdout.write(`  ${name} … `);
  const count = run(at);
  actual.set(name, count);
  console.log(count);
}

const problems = [...checkCounts(claimed, actual), ...checkTotal(claimed, claimedTotal(readme))];

console.log(`\nChecked ${actual.size} packages against the table in README.md.\n`);

if (problems.length === 0) {
  console.log('Every number the README states is the number the suites run.');
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log('\nA number kept by hand is a number that will eventually be wrong.');
  process.exitCode = 1;
}
