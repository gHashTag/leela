#!/usr/bin/env node
/**
 * Every recorded exception is asked whether it still describes anything.
 *
 * Three times this repository learned that a record outliving its reason is a
 * licence issued for something else, and three times it fixed the one list in
 * front of it. `lib/numbers.mjs` was the proof that fixing the instance is not
 * closing the class: its sibling had been hardened, the lesson written down one
 * section away, and it still printed *take these out of RECORDED* and exited
 * zero for a hundred and ninety-nine passes.
 *
 * So the rule is a check now, in the shape `audit-scripts` and `audit-whose`
 * already use here: every exported list of excused things is declared, a
 * declaration says what asks the staleness question, and the asking is verified
 * in the file that claims to do it. A list written tomorrow fails until somebody
 * says which of the two it is.
 *
 * Four ways it can rot, and all four are checked because each is silent on its
 * own: a list nobody declared, a declaration for a list that is gone, a
 * declaration whose asker has stopped asking, and a permission naming something
 * that no longer exists. The third is the quietest — the audit still runs and
 * still passes, and no longer looks.
 *
 * The fourth was the loudest and the last found, because this file was printing
 * the all-clear over it. `lib/records.mjs` has said since it was written that *a
 * permission rots the other way: by naming something that no longer exists*, and
 * nothing implemented that sentence: seven standing permissions had their entries
 * read by no check at all, while this audit closed with *every asker still asks*
 * — true of the records, silent about the permissions, and printed as though it
 * covered both.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECLARED,
  exportedLists,
  keyOf,
  staleDeclarations,
  stalePermissions,
  unasked,
  undeclared,
  unexplained,
  unknownKinds,
} from './lib/records.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const SCRIPTS = HERE;
const LIB = join(HERE, 'lib');

const readOr = (path) => {
  try {
    return readFileSync(join(REPO, path), 'utf8');
  } catch {
    return null;
  }
};

/**
 * Both the readers and the audits that own them.
 *
 * The first version read `scripts/lib` only and found eight lists where there
 * are thirty-one. `audit-numbers.mjs` had held its own `RECORDED` until the pass
 * before, which is to say the rule was written to look everywhere except the
 * place the defect had just been found.
 */
const modules = [
  ...readdirSync(SCRIPTS)
    .filter((name) => name.endsWith('.mjs'))
    .sort(),
  ...readdirSync(LIB)
    .filter((name) => name.endsWith('.mjs'))
    .sort()
    .map((name) => `lib/${name}`),
];

const found = [];
for (const module of modules) {
  const source = readFileSync(join(SCRIPTS, module), 'utf8');
  for (const name of exportedLists(source)) found.push(keyOf(module, name));
}

const news = undeclared(found, DECLARED);
const gone = staleDeclarations(DECLARED, found);
const silent = unasked(DECLARED, readOr);
const withdrawn = stalePermissions(DECLARED, readOr);
const mute = unexplained(DECLARED);
const odd = unknownKinds(DECLARED);

const permissions = DECLARED.filter((one) => one.kind === 'permission');
const placed = permissions.filter((one) => one.namesIn !== null && one.namesIn !== undefined);

console.log(
  `\nRead ${modules.length} modules for exported lists of excused things: ` +
    `${found.length} found, ${DECLARED.filter((one) => one.kind === 'record').length} records, ` +
    `${DECLARED.filter((one) => one.kind === 'permission').length} standing permissions ` +
    `and ${DECLARED.filter((one) => one.kind === 'vocabulary').length} vocabulary.\n`,
);

if (news.length > 0) {
  console.log('These lists are not declared:');
  for (const line of news) console.log(`  ${line}`);
  console.log(
    '\nSay in scripts/lib/records.mjs which it is. A record is a set of excused\n' +
      'things and needs something asking whether each entry still matches; a\n' +
      'vocabulary excuses nothing and needs a sentence saying so.',
  );
  process.exitCode = 1;
}

if (gone.length > 0) {
  console.log('\nThese declarations describe a list that is no longer there:');
  for (const line of gone) console.log(`  ${line}`);
  console.log('\nThe rule turned on itself: a declaration is a record too. Drop the entry.');
  process.exitCode = 1;
}

if (silent.length > 0) {
  console.log('\nThese records name an asker that no longer asks:');
  for (const line of silent) console.log(`  ${line}`);
  console.log(
    '\nThe quietest of the three. The audit still runs, still passes, and has\n' +
      'stopped looking at whether its excuses describe anything.',
  );
  process.exitCode = 1;
}

if (withdrawn.length > 0) {
  console.log('\nThese permissions name something that is no longer there:');
  for (const line of withdrawn) console.log(`  ${line}`);
  console.log(
    '\nThe way a permission rots, which this repository stated and did not check.\n' +
      'A record excuses a fact about today and goes stale when the fact changes; a\n' +
      'permission excuses an intent, and nothing about being called withdraws it. What\n' +
      'withdraws it is the thing it was granted to disappearing — a function renamed, a\n' +
      'member deleted, a union moved. The entry then excuses nothing, and the next thing\n' +
      'given that name inherits a permission nobody granted it.',
  );
  process.exitCode = 1;
}

if (mute.length > 0) {
  console.log('\nThese declarations do not say why:');
  for (const line of mute) console.log(`  ${line}`);
  process.exitCode = 1;
}

if (odd.length > 0) {
  console.log('\nThese declarations name a kind that does not exist:');
  for (const line of odd) console.log(`  ${line}`);
  console.log('\nThree kinds are defined. A fourth spelled by hand lets a list through.');
  process.exitCode = 1;
}

if (
  news.length === 0 &&
  gone.length === 0 &&
  silent.length === 0 &&
  withdrawn.length === 0 &&
  mute.length === 0 &&
  odd.length === 0
) {
  // Counted rather than asserted, because the sentence that used to close this
  // audit was the defect: it said *every asker still asks* over seven permissions
  // no asker had ever read. What is not covered is named here in the all-clear.
  console.log('Every list is declared, every record is asked, and every asker still asks.');
  console.log(
    `Of ${permissions.length} standing permissions, ${placed.length} name a place their entries must ` +
      `still be\nfound in and every entry is found there. The other ` +
      `${permissions.length - placed.length} say why no single place can be\nnamed, and nothing ` +
      'checks their entries.',
  );
}
