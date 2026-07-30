#!/usr/bin/env bun
/**
 * The generated dataset, against the languages the package declares.
 *
 * This replaces an inline check in CI that read the languages out of the
 * manifest and then verified those — so a manifest listing nothing passed it,
 * silently, by iterating zero times. That is not hypothetical: a stray rebuild
 * from an empty source directory emptied `rules.json` and the manifest, and the
 * job would have gone green on it.
 *
 * `LANGUAGES` in `packages/content/src` is the promise this holds the data to.
 * Reading it from the source rather than repeating the number here is the
 * difference between a check and a second copy of the claim.
 *
 * Runs under bun, not node: it imports TypeScript, and the engine imports
 * `./board` without an extension.
 *
 * Run:  bun scripts/audit-dataset.mjs
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES } from '../packages/content/src/index.ts';
import { TOTAL_PLANS } from '../packages/engine/src/index.ts';
import { checkCoverage, coverageOf } from './lib/coverage.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA = join(ROOT, 'packages/content/data');

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

const manifest = read(join(DATA, 'manifest.json'));
const coverage = coverageOf(manifest);
const problems = checkCoverage([...LANGUAGES], coverage, TOTAL_PLANS);

// The manifest is a summary the generator wrote; the plan files are the thing
// itself. Checking only the summary would trust the same process twice.
for (const language of coverage.keys()) {
  let plans;
  try {
    plans = read(join(DATA, `plans.${language}.json`));
  } catch {
    problems.push(`${language}: the manifest counts it and plans.${language}.json cannot be read`);
    continue;
  }

  if (plans.length !== coverage.get(language)) {
    problems.push(
      `${language}: the manifest says ${coverage.get(language)} plans, the file holds ${plans.length}`,
    );
  }

  for (const [index, plan] of plans.entries()) {
    if (plan.plan !== index + 1) {
      problems.push(`${language}: plan ${index + 1} is out of order`);
      break;
    }
    if (!plan.title?.trim() || !plan.body?.trim()) {
      problems.push(`${language}: plan ${plan.plan} has no title or no body`);
      break;
    }
  }
}

console.log(`\nChecked ${coverage.size} languages against the ${LANGUAGES.length} declared.\n`);

if (problems.length === 0) {
  console.log(`Every declared language has all ${TOTAL_PLANS} plans, in order, with text.`);
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log('\nA check that reads its subject out of the thing under test cannot fail on an absence.');
  process.exitCode = 1;
}
