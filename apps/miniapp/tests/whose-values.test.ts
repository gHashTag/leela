/**
 * The reader behind `audit-whose`, which had none of its own.
 *
 * Two audits rest on this module and nothing asked whether it works. That is
 * the state `source.test.ts` exists about one shelf over — *"everything else
 * rests on it"* — and this is the same shelf, unswept.
 *
 * It matters more than a helper usually would, because the audit it feeds was
 * **passing on a live defect**. `exportPath` is on its allowed list with the
 * reason *"reads it only for the seat it was asked about"*, and for a while
 * that sentence was untrue: two lines below the download it copied the turn
 * holder's whole path to the clipboard, and the audit read the waiver and said
 * everything was named. A reason is prose, and prose is not a claim anything
 * checks.
 *
 * So the module grew a second question — a function *handed a seat* may read
 * those values only inside the guard that says the seat is the turn holder —
 * and both questions are held here, each against the shape it is about rather
 * than against the app as it happens to be today.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error -- a plain .mjs module with no types, deliberately.
import { readsTurnHolder, unguardedReaders, unnamedReaders } from '../../../scripts/lib/whose.mjs';
import { blank } from '../../../scripts/lib/source.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// Blanked, because the guard below asserts that a signature is *written* in
// the app — and a signature quoted in a comment would satisfy it. The reader
// blanks again inside; blanking is idempotent and keeps every offset.
const MAIN = blank(readFileSync(join(HERE, '..', 'src', 'main.ts'), 'utf8'));

/** The shape the defect had: a seat given, and the turn holder read anyway. */
const asItWas = `
function exportPath(seatId = currentPlayer(session).id): void {
  const theirs = seatId === currentPlayer(session).id ? journal : loadJournalFor(localStorage, seatId);
  download(theirs);
  void navigator.clipboard?.writeText(toText(journal, (plan) => planFor(plan).title));
}
`;

/** The same function once the clipboard asked the same seat. */
const asItIs = asItWas.replace('toText(journal,', 'toText(theirs,');

describe('a bare read of the turn holder’s values', () => {
  it('is found where it is written', () => {
    expect(readsTurnHolder('{ return journal.entries; }')).toEqual(['journal']);
    expect(readsTurnHolder('{ return intention.trim(); }')).toEqual(['intention']);
  });

  it('is not a property of something else, or a longer name', () => {
    // `theirs.journal` is somebody else's, `loadJournalFor` is a call, and
    // `journal:` is a field being written rather than the module's own value.
    expect(readsTurnHolder('{ return theirs.journal; }')).toEqual([]);
    expect(readsTurnHolder('{ return loadJournalFor(storage, id); }')).toEqual([]);
    expect(readsTurnHolder('{ return { journal: theirs }; }')).toEqual([]);
  });

  it('is not a word in a comment', () => {
    // Half of this repository's lines are prose about what went wrong, and
    // `journal` is in a great many of them.
    expect(readsTurnHolder('{ /* it used to read journal here */ return theirs; }')).toEqual([]);
    expect(readsTurnHolder('{ // journal, once\n  return theirs; }')).toEqual([]);
  });
});

describe('a function handed a seat', () => {
  it('is caught reading the turn holder’s values outside the guard', () => {
    // The defect exactly as it was, which is what makes this a check and not a
    // restatement of the code.
    expect(unguardedReaders(asItWas)).toEqual([{ name: 'exportPath', reads: ['journal'] }]);
  });

  it('is left alone when every read is inside the guard', () => {
    // The other half. A rule that flags the fast path as well would be switched
    // off within a week, which is this repository's stated reason for not
    // writing checks that block on a judgement call.
    expect(unguardedReaders(asItIs)).toEqual([]);
  });

  it('is only asked of functions that were given one', () => {
    // `draw` and `roll` have no seat parameter: the board and the die *are* the
    // turn holder's, and the first question is the one that covers them.
    const board = `
function draw(): void {
  paint(state.loka, journal, intention);
}
`;

    expect(unguardedReaders(board)).toEqual([]);
    expect(readsTurnHolder(board).length, 'the first question still sees it').toBeGreaterThan(0);
  });

  it('reads past a bracket closed inside the guard’s own arguments', () => {
    // The mistake three checks in this repository have made. The guard ends at
    // a `;`, and `loadJournalFor(localStorage, seatId)` closes a bracket before
    // it — a pattern that stops at the first one reads a shorter statement than
    // the one written, and then reports the rest of it as unguarded.
    const nested = `
function openPlan(plan: number, seatId = currentPlayer(session).id): void {
  const theirs =
    seatId === currentPlayer(session).id ? journal : loadJournalFor(localStorage, seatId);
  show(theirs, plan);
}
`;

    expect(unguardedReaders(nested)).toEqual([]);
  });
});

describe('the app as it stands', () => {
  it('has every function that reads them named, and every seat-taker guarded', () => {
    // Over the real file, because a reader that works on fixtures and not on
    // the thing it was written for is worth nothing.
    expect(unguardedReaders(MAIN)).toEqual([]);
    expect(unnamedReaders(MAIN, new Set(['draw']))).not.toEqual([]);
  });

  it('finds seat-taking functions at all, or this proves nothing', () => {
    // The guard against a parameter pattern that has stopped matching: silence
    // would read exactly like agreement.
    expect(MAIN).toMatch(/function exportPath\(seatId/);
    expect(MAIN).toMatch(/function openPlan\([^)]*seatId/);
  });
});
