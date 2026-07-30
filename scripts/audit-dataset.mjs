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
import { LANGUAGES, couldBe, dominantScript, scriptOf } from '../packages/content/src/index.ts';
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

// The rules book, which nothing had ever looked at. English shipped a seventh
// chapter written in Russian — `game-logic.md`, filed among six numbered
// English files in a donor repository and mapped straight through. A reader
// notices in a second; nothing else did, because nothing knew what a language
// is supposed to look like.
let rules = {};
try {
  rules = read(join(DATA, 'rules.json'));
} catch {
  problems.push('rules.json cannot be read');
}

for (const [language, chapters] of Object.entries(rules)) {
  for (const chapter of chapters) {
    for (const [part, text] of [
      ['title', chapter.title ?? ''],
      ['body', (chapter.body ?? '').slice(0, 2000)],
    ]) {
      if (couldBe(language, text)) continue;
      problems.push(
        `${language}/${chapter.slug}: the ${part} is written in ${dominantScript(text)}, and ${language} is ${scriptOf(language)}`,
      );
    }
  }
}

console.log(
  `\nChecked ${coverage.size} languages against the ${LANGUAGES.length} declared, and ${Object.values(rules).flat().length} rules chapters against their scripts.\n`,
);

if (problems.length === 0) {
  console.log(
    `Every declared language has all ${TOTAL_PLANS} plans, in order, with text, and every rules chapter is written in the language it is filed under.`,
  );
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log(
    '\nA check that reads its subject out of the thing under test cannot fail on an absence.',
  );
  process.exitCode = 1;
}
