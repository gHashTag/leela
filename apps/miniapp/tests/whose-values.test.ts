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
import { functionsIn, readsTurnHolder, unguardedReaders, unnamedReaders } from '../../../scripts/lib/whose.mjs';
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

/**
 * Every place an expression can stand, with the same expression in it.
 *
 * Written as a grid rather than as a list of the positions that were once
 * wrong, because the list would have been the wrong list. The reader skipped a
 * name followed by `:` in order to leave `{ journal: theirs }` alone, and a
 * ternary's else-colon answered that test too — so `x ? journal : y` was not a
 * read as far as either audit was concerned, while the identical read inside an
 * `if` was. Nobody wrote a rule saying a ternary is exempt; a rule about one
 * thing was silently a rule about two.
 *
 * The claim here is that no syntactic position is privileged: whatever one of
 * them reports, all of them report. A grid catches the next colon nobody
 * thought about, which enumerating today's eight cannot.
 */
const POSITIONS: Array<readonly [string, (put: string) => string]> = [
  ['a bare statement', (put) => `const t = ${put};`],
  ['an if body', (put) => `if (b) { const t = ${put}; }`],
  ['a ternary consequent', (put) => `const t = b ? ${put} : other;`],
  ['a ternary alternate', (put) => `const t = b ? other : ${put};`],
  ['an arrow body', (put) => `const t = () => ${put};`],
  ['a template expression', (put) => 'const t = `${' + put + '}`;'],
  ['an argument', (put) => `send(${put}, seatId);`],
  ['an array element', (put) => `const t = [${put}, other];`],
  ['a returned value', (put) => `return ${put};`],
];

/** The same expression wrapped as a body, so the reader is given what it takes. */
const bodyOf = (statement: string): string => `{\n  ${statement}\n}`;

describe('where the read is written', () => {
  it('makes no difference — every position reports what every other does', () => {
    const answers = POSITIONS.map(
      ([where, put]) => [where, readsTurnHolder(bodyOf(put('journal'))).join(',')] as const,
    );
    const distinct = new Set(answers.map(([, reads]) => reads));

    // Named in the message, so a position that goes blind says which one it is
    // rather than leaving somebody to bisect nine fixtures.
    expect(distinct.size, `positions disagreed: ${JSON.stringify(answers)}`).toBe(1);
    // And they agree that it *is* a read. Nine positions agreeing on nothing
    // would satisfy the line above and prove the opposite of the point.
    expect([...distinct][0]).toBe('journal');
  });

  it('makes no difference to a key either, which is still not a read', () => {
    // The other half, and the reason the colon rule existed at all. Writing a
    // field called `journal` is not reading the module's `journal`, in any of
    // the same nine places — so the fix has to keep telling them apart rather
    // than call everything a read and go quiet a different way.
    const answers = POSITIONS.map(
      ([where, put]) =>
        [where, readsTurnHolder(bodyOf(put('({ journal: theirs })'))).join(',')] as const,
    );
    const distinct = new Set(answers.map(([, reads]) => reads));

    expect(distinct.size, `positions disagreed: ${JSON.stringify(answers)}`).toBe(1);
    expect([...distinct][0]).toBe('');
  });
});

/**
 * Every shape a signature can have, with the same statement inside the body.
 *
 * The body was taken as the first `{` after `function NAME(`, and for a
 * function whose return type is an object that brace opens the *type*.
 * `whatIsBeingWritten(): { plan: number; intention: string }` handed the reader
 * the string `"{ plan: number; intention: string }"` and the six lines it was
 * asked about were never read — so a function that reads two of the turn
 * holder's values on its fallback, and feeds both surfaces this audit exists
 * about, was invisible while the audit printed that every reader was named.
 *
 * A marker statement is placed in the real body and every signature shape is
 * asked to hand it back. The annotation is a type, and a type can be spelled
 * an unbounded number of ways; naming today's five and stopping is how the
 * first brace came to be trusted.
 */
const SIGNATURES: Array<readonly [string, string]> = [
  ['no annotation', 'function f(a: number)'],
  ['a primitive annotation', 'function f(a: number): void'],
  ['an object-literal annotation', 'function f(a: number): { plan: number; intention: string }'],
  ['a generic annotation', 'function f(a: number): Promise<{ plan: number }>'],
  ['a union annotation', 'function f(a: number): { plan: number } | undefined'],
  ['a function-type annotation', 'function f(a: number): (x: number) => { plan: number }'],
  ['a destructured parameter', 'function f({ board, die }: Parts): void'],
  ['a call in a default', 'function f(seatId = currentPlayer(session).id): void'],
];

describe('where the body begins', () => {
  const MARKER = 'const marker = journal;';

  it('is after the signature, whatever the signature is made of', () => {
    const missed = SIGNATURES.filter(([, signature]) => {
      const [fn] = functionsIn(`${signature} {\n  ${MARKER}\n}\n`);
      return !fn || !String(fn.body).includes(MARKER);
    }).map(([where]) => where);

    expect(missed, 'these signature shapes hid their own bodies').toEqual([]);
  });

  it('excludes the annotation itself, or the reader is reading a type', () => {
    // Containing the marker is not enough on its own: a body that began at the
    // annotation would contain it too, and would also carry `plan: number` —
    // which is a field of a type and reads to any of these checks like code.
    const [fn] = functionsIn(
      `function f(): { plan: number; intention: string } {\n  ${MARKER}\n}\n`,
    );

    expect(String(fn.body)).toBe(`{\n  ${MARKER}\n}`);
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

  it('is found by its own name and not by a longer one declared above it', () => {
    // Measured in the app. The parameters were looked up with
    // `indexOf('function ' + name)`, and `indexOf('function openPlan')` lands
    // on `function openPlans()` a hundred lines earlier — which takes no seat.
    // So `openPlan`, the one function in the app that is handed a seat *and*
    // reads the turn holder's journal, was read as having no parameters and
    // skipped whole. A prefix is not a name, and the order two functions happen
    // to be written in is not a rule about either.
    const both = `
function openPlans(): void {
  show(everything);
}

function openPlan(plan: number, seatId = currentPlayer(session).id): void {
  show(journal, plan, seatId);
}
`;

    expect(unguardedReaders(both)).toEqual([{ name: 'openPlan', reads: ['journal'] }]);
  });
});

describe('the app as it stands', () => {
  it('has every function that reads them named, and every seat-taker guarded', () => {
    // Over the real file, because a reader that works on fixtures and not on
    // the thing it was written for is worth nothing.
    expect(unguardedReaders(MAIN)).toEqual([]);
    expect(unnamedReaders(MAIN, new Set(['draw']))).not.toEqual([]);
  });

  it('reads the body of the function whose return type is an object', () => {
    // The anchor for the defect this all began with, over the real file rather
    // than a fixture. `whatIsBeingWritten` is written
    // `(): { plan: number; intention: string }`, and what came back as its body
    // was that annotation — thirty-four characters of type, in place of the
    // lines that read `state` and `intention` on the `!writer` fallback.
    const fn = functionsIn(MAIN).find(
      (each: { name: string }) => each.name === 'whatIsBeingWritten',
    );

    expect(fn, 'the function this check exists about has been renamed').toBeDefined();
    expect(String(fn.body)).toContain('writingSeat()');
    expect(readsTurnHolder(String(fn.body)).sort()).toEqual(['intention', 'state']);
  });

  it('finds seat-taking functions at all, or this proves nothing', () => {
    // The guard against a parameter pattern that has stopped matching: silence
    // would read exactly like agreement.
    expect(MAIN).toMatch(/function exportPath\(seatId/);
    expect(MAIN).toMatch(/function openPlan\([^)]*seatId/);
  });
});
