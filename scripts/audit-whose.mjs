#!/usr/bin/env node
/**
 * Which functions read the seat holding the turn, and whether they said so.
 *
 * The mini app keeps three module-level values for the seat whose turn it is:
 * `state`, `journal`, `intention`. They are right for the board, the die and
 * the line underneath — that surface *is* the turn holder's — and wrong
 * everywhere the app talks about somebody else, which it does more often than
 * it looks.
 *
 * Three passes running, that produced a defect. Share and Ask sent the turn
 * holder's square with the writer's words and a third seat's question. A chip
 * in Player 2's section opened Player 1's private accounts. "Save a copy" wrote
 * a file of whoever held the turn, in a view showing every seat, for a player to
 * carry away as their own.
 *
 * Every one of them was harmless the day before by accident. So this is the
 * rule instead: **a function that reads the turn holder's values has said that
 * it means to.** A new one has to be added here, with a sentence saying why —
 * which is the moment to notice that it has a seat of its own.
 *
 * Run:  node scripts/audit-whose.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unguardedReaders, unnamedReaders } from './lib/whose.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN = join(HERE, '..', 'apps', 'miniapp', 'src', 'main.ts');

/**
 * Functions whose subject really is the seat holding the turn.
 *
 * Two of these were added the day the reader stopped being blind, and it is
 * worth saying which day that was. For every pass until now this file printed
 * *"Every one of the 13 that read the turn holder’s values says why"* and
 * exited 0 — and the sentence was false. `readsTurnHolder` skipped a name
 * followed by a colon, to leave object keys alone, and a ternary's else-colon
 * answered that test: `x ? journal : y` was not a read as far as this audit was
 * concerned. Separately, a function's body was taken as the first `{` after its
 * name, and for `whatIsBeingWritten(): { plan: number; intention: string }` that
 * brace opens the *return type* — the six lines underneath were never read at
 * all.
 *
 * So a check written to backstop a prose waiver was reporting success on
 * failure, which is worse than not existing: the passing line is what anybody
 * reads. `openPlan` and `whatIsBeingWritten` are here now because the reader
 * can finally see them, not because anything in the app changed.
 */
const ALLOWED = new Map([
  ['takeSeat', 'sets them — it is what "the seat holding the turn" means here'],
  ['draw', 'the board, the die and the line underneath are that seat’s'],
  ['roll', 'the throw is the turn holder’s, by definition'],
  ['openPlans', 'the list is opened from the header by whoever is looking at the board'],
  ['openPlan', 'reads it only on the fast path where the seat it was asked about is the turn holder — and the second question below proves that, rather than believing this line'],
  ['whatIsBeingWritten', 'reads them only on the `!writer` fallback: `writingFor` is null unless a box is open, so that branch is the case where no box is open for anybody, and the turn holder is then the only seat the app has to be about'],
  ['askIntention', 'asks the seat about to throw'],
  ['saveTheIntention', 'answers for the seat that was asked'],
  ['startOver', 'restarts the seat holding the turn and nobody else'],
  ['showWriterHint', 'falls back to it only when no box is open for anybody'],
  ['saveReport', 'keeps the account in hand when the writer is the turn holder'],
  ['openPath', 'reads it for the one-seat heading, and says so when there are more'],
  ['exportPath', 'reads it only for the seat it was asked about'],
  ['takeThePastedSquare', 'files into the seat holding the phone, and the box says whose'],
  ['importPath', 'brings a path back to the seat holding the phone'],
]);

const source = readFileSync(MAIN, 'utf8');
const unnamed = unnamedReaders(source, new Set(ALLOWED.keys()));

/**
 * The second question, because the first one takes a sentence at its word.
 *
 * `exportPath` is on the list above with the reason *"reads it only for the
 * seat it was asked about"*, and for a while that was not true: two lines below
 * the download it copied the turn holder's whole path to the clipboard, and
 * this audit passed, reading the waiver. A reason is prose and prose is not a
 * claim anything checks.
 *
 * What can be checked is the shape the reason describes: a function handed a
 * seat reads those values only inside `seat === currentPlayer(session).id ? ...`
 * — the fast path for the seat already in hand. Anywhere else it is talking
 * about one player and reading another's.
 */
const unguarded = unguardedReaders(source);

console.log('\nChecked every function in apps/miniapp/src/main.ts for whose values it reads.\n');

if (unguarded.length > 0) {
  console.log('Given a seat, and reading the turn holder’s values outside the guard:\n');
  for (const fn of unguarded) console.log(`  ${fn.name} reads ${fn.reads.join(', ')}`);
  console.log('\nA function that was handed a seat is talking about that seat.');
  process.exitCode = 1;
}

if (unnamed.length === 0 && unguarded.length === 0) {
  console.log(
    `Every one of the ${ALLOWED.size} that read the turn holder’s values says why, ` +
      'and every one handed a seat reads them only for it.',
  );
} else if (unnamed.length > 0) {
  for (const fn of unnamed) {
    console.log(`  ${fn.name} reads ${fn.reads.join(', ')}`);
  }
  console.log('\nA function that reads the turn holder’s values either means to — and says so');
  console.log('here — or has a seat of its own and has not asked for it.');
  process.exitCode = 1;
}
