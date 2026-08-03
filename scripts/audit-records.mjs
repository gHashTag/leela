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
 * Three ways it can rot, and all three are checked because each is silent on its
 * own: a list nobody declared, a declaration for a list that is gone, and a
 * declaration whose asker has stopped asking. The last is the quietest — the
 * audit still runs and still passes, and no longer looks.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECLARED,
  exportedLists,
  keyOf,
  staleDeclarations,
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
const mute = unexplained(DECLARED);
const odd = unknownKinds(DECLARED);

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

if (news.length === 0 && gone.length === 0 && silent.length === 0 && mute.length === 0 && odd.length === 0) {
  console.log('Every list is declared, every record is asked, and every asker still asks.');
}
