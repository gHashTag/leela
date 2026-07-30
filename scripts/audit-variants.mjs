#!/usr/bin/env bun
/**
 * Every rule `legacy-mobile` and `online` claim, against the app they claim it
 * from.
 *
 * `packages/contracts` holds `onchain` to the Solidity, because the contract is
 * vendored into this repository and a test can read it. The two variants that
 * reproduce the published mobile app had nothing of the kind: they were written
 * by reading `leela-src`, and after that the reading was a memory.
 *
 * That is not hypothetical. `onchain` carried `classic`'s value for all five
 * flags added after it was written — filled in by copying — and one of them was
 * wrong. These two were written the same way and never checked again.
 *
 * So each claim carries the line it came from, and both halves are checked: the
 * flag still holds the value the evidence supports, and the evidence is still
 * in the app. Change either and this fails, which is the point — a citation
 * nobody re-reads is a comment.
 *
 * Needs: the donor clones in ../leela-src, which CI does not check out.
 *
 * Run:  bun scripts/audit-variants.mjs [--src ../leela-src]
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_MOBILE, ONLINE } from '../packages/engine/src/index.ts';
import { checkClaim } from './lib/variants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const srcFlag = process.argv.indexOf('--src');
const SRC = srcFlag > -1 ? process.argv[srcFlag + 1] : join(HERE, '..', '..', 'leela-src');

/**
 * What the published app says, and where it says it.
 *
 * `must` is a pattern the file has to contain; `mustNot` one it has to lack —
 * an absence is a claim too, and `threeSixesReset: false` is exactly that.
 */
const CLAIMS = [
  {
    flag: 'extraTurnOnSix',
    value: true,
    file: 'leela/src/store/helper.ts',
    must: /if \(count === 6\)/,
    why: 'a six is handled apart from every other throw, and the turn comes back',
  },
  {
    flag: 'threeSixesReset',
    value: false,
    file: 'leela/src/store/helper.ts',
    mustNot: /consecutiveSixes|positionBeforeThreeSixes/,
    why: 'the app has no three-sixes rule at all — the fields do not appear',
  },
  {
    flag: 'rerollOnRepeat',
    value: true,
    file: 'leela/src/store/DiceStore.ts',
    must: /if \(get === DiceStore\.count\)/,
    why: 'the die throws again when it repeats itself, which is not traditional',
  },
  {
    flag: 'reportAfterSix',
    value: false,
    file: 'leela/src/screens/helper.ts',
    must: /if \(values\.count !== 6\)/,
    why: 'createHistory writes a six and nothing else: no report, no day begun',
  },
  {
    flag: 'refusedThrowStartsCooldown',
    value: false,
    file: 'leela/src/store/helper.ts',
    must: /case plan > 72:\s*\n\s*return undefined/,
    why: 'a throw past 72 produces no history, so nothing starts',
  },
  {
    flag: 'mayReenterAfterWinning',
    value: false,
    file: 'leela/src/store/helper.ts',
    must: /stepCount === 6 && !isFinished/,
    why: 'entering needs a six *and* an unfinished game',
  },
  {
    flag: 'cooldownFrom',
    value: 'report',
    file: 'leela/src/components/CreatePost/index.tsx',
    must: /startStepTimer\(\)/,
    why: 'the day between throws begins where the report is written',
  },
  {
    flag: 'minReportChars',
    value: 100,
    file: 'leela/src/components/CreatePost/index.tsx',
    must: /\.min\(100,/,
    why: 'the form refuses anything shorter',
  },
  {
    flag: 'reportOnWinningSquare',
    value: true,
    file: 'leela/src/store/helper.ts',
    must: /stepCount !== 6 \|\| plan === 68/,
    why: 'the winning square is the app’s one exception to its own six rule',
  },
];

/** Claims that hold for `online` alone — the offline game has no gate and no wait. */
const ONLINE_ONLY = [
  {
    flag: 'requireReportBeforeRoll',
    value: true,
    file: 'leela/src/components/Dice/index.tsx',
    must: /DiceStore\.online && !OnlinePlayer\.store\.isReported/,
    why: 'the die is refused online until the report is filed',
  },
  {
    flag: 'turnCooldownMs',
    value: 86_400_000,
    file: 'leela/src/hooks/useLeftTimeForStep.ts',
    must: /86400000/,
    why: 'a day, in milliseconds, as the app counts it',
  },
];

if (!existsSync(SRC)) {
  console.error(`No source directory at ${SRC}. Clone the repositories, or pass --src.`);
  process.exit(1);
}

const problems = [];
let checked = 0;

const read = (file) => {
  const path = join(SRC, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

/** Hold one variant to one claim, both halves of it. */
function check(rules, claim) {
  checked += 1;
  problems.push(...checkClaim(rules, claim, read));
}

for (const claim of CLAIMS) {
  check(LEGACY_MOBILE, claim);
  check(ONLINE, claim);
}
for (const claim of ONLINE_ONLY) check(ONLINE, claim);

console.log(`\nChecked ${checked} claims against ${SRC}.\n`);

if (problems.length === 0) {
  console.log('Every rule these two variants claim is still in the app they claim it from.');
} else {
  for (const problem of problems) console.log(`  ${problem}`);
  console.log('\nA citation nobody re-reads is a comment.');
  process.exitCode = 1;
}
