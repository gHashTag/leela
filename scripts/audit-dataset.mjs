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
import { LANGUAGES, couldBe, dominantScript, scriptOf, writtenIn } from '../packages/content/src/index.ts';
import { TOTAL_PLANS } from '../packages/engine/src/index.ts';
import { CORRECTIONS } from './lib/corrections.mjs';
import {
  BLIND_TO,
  FUNCTION_WORDS,
  RECORDED,
  against,
  nameOf,
  untranslatedIn,
  wrongLanguageIn,
} from './lib/untranslated.mjs';
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

/**
 * Every correction the generator states, in the data it generated.
 *
 * The one entry in `CORRECTIONS` was a hand edit to three generated files for a
 * while, and the next rebuild put the false sum back — a repair living in an
 * artifact, with a countdown on it. Moving it into the generator is the fix;
 * this is what notices if the two ever come apart again.
 *
 * It cannot rebuild to compare — the donor repositories are not in CI, and
 * checking a *generated* file against its generator is exactly what needs them.
 * What it can do is hold the shipped data to the corrections that are written
 * down: the corrected form present, the donor's form gone, in the languages the
 * entry names and no others. A hand edit that reverts one fails this. A
 * correction quietly deleted from the generator fails it too.
 */
for (const fix of CORRECTIONS) {
  for (const language of coverage.keys()) {
    let plan;
    try {
      plan = read(join(DATA, `plans.${language}.json`)).find((one) => one.plan === fix.plan);
    } catch {
      continue; // Already reported above.
    }
    if (!plan) continue;

    const named = fix.languages.includes(language);

    // A repair stated as a change to the body rather than as one string for
    // another states what must be true afterwards, and that is what is asked
    // here. Asking whether running the repair again changes anything is a check
    // that cannot fail — a repair that has stopped firing changes nothing
    // either — and it passed eighteen broken translations before this line was
    // written the second time.
    if (named && fix.holds) {
      if (!fix.holds(plan.body)) {
        problems.push(
          `${language}/${fix.plan}: the correction is stated and the data does not carry it — ${fix.where}`,
        );
      }
      continue;
    }

    if (named && plan.body.includes(fix.from)) {
      problems.push(
        `${language}/${fix.plan}: still says \`${fix.from}\` — ${fix.where}`,
      );
    }
    if (named && !plan.body.includes(fix.to)) {
      problems.push(
        `${language}/${fix.plan}: the correction is stated and the data does not carry it — ${fix.where}`,
      );
    }
  }
}

/**
 * A language whose every plan is one paragraph.
 *
 * Every reader splits a plan on blank lines. Three languages had none at all —
 * `leela/src/locales/<lang>` separates paragraphs with a single newline and the
 * markdown donors use a blank line — so 216 pages of the book rendered as one
 * unbroken wall of text, in Arabic, Malay and Ukrainian.
 *
 * Nothing could see it. Every check here asks whether a plan has *text*, and a
 * wall of text is text. This asks whether it has *paragraphs*, which is the
 * question a reader asks by looking at the page.
 *
 * A handful genuinely are one paragraph — they are short. Seventy-two of
 * seventy-two is a donor in a shape the generator does not know.
 */
const SOLID_ENOUGH_TO_WORRY = 10;

for (const language of coverage.keys()) {
  let plans;
  try {
    plans = read(join(DATA, `plans.${language}.json`));
  } catch {
    continue; // Already reported above.
  }

  const solid = plans.filter((plan) => !(plan.body ?? '').includes('\n\n')).length;
  if (solid >= SOLID_ENOUGH_TO_WORRY) {
    problems.push(
      `${language}: ${solid} of ${plans.length} plans have no paragraph break — the whole book reads as one block`,
    );
  }
}

// The plans, in the script of the language they are filed under. The check
// below this one has run over the rules book since the day the English edition
// was found to have a Russian chapter in it — six chapters a language, a manual
// a player may never open — and never over the seventy-two squares the game
// puts on the screen on every throw. Ten titles were sitting in it.
const findings = [];
let unseeable = 0;
let byWords = 0;

for (const language of coverage.keys()) {
  let plans;
  try {
    plans = read(join(DATA, `plans.${language}.json`));
  } catch {
    continue; // Already reported above.
  }

  if (scriptOf(language) === BLIND_TO) {
    // An English title left in German has every letter a German title has, so
    // the script test says nothing here. The words a language cannot write a
    // paragraph without say it instead — measured at 329 of 341 on English fed
    // in as German, and none on German. A Latin-script language with no list is
    // still unseen, and `unseeable` is now that and only that.
    if (!FUNCTION_WORDS[language]) {
      unseeable += 1;
      continue;
    }

    byWords += 1;
    findings.push(...wrongLanguageIn(plans, language));
    continue;
  }

  findings.push(...untranslatedIn(plans, language, writtenIn));
}

const { fresh, rotted } = against(findings);

for (const finding of fresh) {
  problems.push(`${nameOf(finding)} — untranslated, and not recorded in lib/untranslated.mjs`);
}

for (const line of rotted) {
  problems.push(
    `recorded as untranslated and no longer there: "${line}" — the donor was fixed, or the text moved`,
  );
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
  `\nChecked ${coverage.size} languages against the ${LANGUAGES.length} declared, ${Object.values(rules).flat().length} rules chapters against their scripts, and ${CORRECTIONS.length} stated correction(s) against the data.`,
);

// Said on a green run as well as a red one. A check that cannot see eleven of
// the twenty-two languages must not be read as having passed them, and the
// count of what it recorded is the thing that makes an eleventh loud.
console.log(
  `Read the plans of ${coverage.size - unseeable} languages for text left in the language it was translated from; ` +
    `${byWords} of them by the words their language cannot do without, the rest by script; ` +
    `${unseeable} written in the Latin script can be read by neither. ` +
    `${RECORDED.length} part(s) are recorded as untranslated.\n`,
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
