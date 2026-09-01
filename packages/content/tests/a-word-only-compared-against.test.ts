/**
 * A word only ever compared against is not a word anything said.
 *
 * `scripts/lib/reachable.mjs` has stated its rule out loud since it was
 * written: *the check is produced, not handled — a value that appears only in a
 * `switch` arm or a comparison is being received rather than made.* Underneath
 * that paragraph, `unsaidIn` was `return body.includes("'x'")`. Any occurrence
 * counted. `x === 'x'` read as the word being said, and so did a `case` arm, a
 * `.includes`, and the word standing in somebody else's type annotation.
 *
 * MEASURED, on the tree, before this file existed: `packages/ai/src/prompts.ts`
 * declares `export type Arrival = 'standing' | 'received';`, and inside
 * `packages/ai/src` — the only scope the check reads, by design — the word
 * `received` occurs three times: the declaration, a doc-comment, and
 * `arrival === 'received'` at line 346. Not one of them makes the value. The
 * one producer is `apps/bot/src/bot.ts:966`, in a package this audit
 * deliberately does not read. `node scripts/audit-reachable.mjs` exited 0 and
 * printed *Every word a type declares is a word something says.* Half the union
 * was real and it read as whole.
 *
 * `Arrival` is the same shape as `role`, which needed an entry in `RECEIVED` to
 * pass. `Arrival` passed without one, for the wrong reason. And the defect the
 * whole audit was written for — `TurnBlockedReason.finished`, declared by the
 * engine and returned by nothing in it — would be invisible today if any engine
 * file had happened to write `reason === 'finished'`.
 *
 * ## Why this file exists at all, and not just the fix
 *
 * MEASURED, second cause: `reachable.mjs` was the one module in `scripts/lib`
 * with no suite anywhere — `runnable`, `records`, `claims`, `source`,
 * `corrections`, `copies`, `report` and `unread` all have one. Its reader had
 * never been shown a shape it has to tell apart. The audit run over the tree is
 * not that evidence: on a clean tree it passes without having decided anything,
 * and it did, for four months, over a union that was half unsaid.
 *
 * ## What is asserted
 *
 * Synthetic sources, never the tree, in a grid. Every column is one place a
 * word can appear — returned, assigned, handed to a call, an object-literal
 * value, an array element, the right of `??`, compared with `===`, a `case`
 * arm, a `.includes`, a `.has`, a type annotation, quoted in a comment,
 * produced in another package — and every row is a different word. The claim is
 * that the verdict is a property of the COLUMN alone: whatever one word is
 * ruled, every other word in the same position is ruled the same, so the
 * reader cannot be right about `finished` by accident and wrong about the next
 * word somebody adds.
 *
 * The words are chosen to be awkward on purpose: one is a method name (`has`),
 * one carries a dot, one an emoji, one a hyphen, one is a single character that
 * a text search would find inside other words.
 *
 * Four declaration shapes are swept alongside, because the same pass widened
 * the scan: both of the regular expressions this replaced required the ENTIRE
 * right-hand side to be string literals, so `'yes' | 'no' | TurnBlockedReason`
 * and `'empty' | 'too-short' | null` were not seen as unions at all. Those are
 * not hypothetical spellings — they are `apps/miniapp/src/view.ts`,
 * `apps/mobile/src/game.ts` and `apps/mobile/src/journal.ts`, which is to say
 * the two per-surface re-answers of `TurnBlockedReason`, the exact defect this
 * audit exists for, sitting outside its gaze.
 *
 * HONEST NEGATIVE, and it is the point of writing it down: every member of
 * those three unions IS produced today. Widening the scan closed no live
 * defect. It only means the guard is now watching the two files it was written
 * for, which it never was.
 */

import { describe, expect, it } from 'vitest';
import {
  codeIn,
  unionsIn,
  unsaidIn,
  // @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
} from '../../../scripts/lib/reachable.mjs';

type Union = { name: string; members: string[]; file: string; at: [number, number] };
type Source = { file: string; code: string };

const OWN = 'packages/one/src';
const ELSEWHERE = 'packages/two/src';

/**
 * The word every union in this file carries beside the one under test, and
 * which is always produced in the declaring package.
 *
 * A union needs two members to be a union at all, and a fixture where BOTH
 * members are unsaid cannot tell "the reader found this word" from "the reader
 * fell over and reported everything". The anchor is the control: it must come
 * back said in every single case, and an assertion says so.
 */
const ANCHOR = 'anchor';
const anchorSource: Source = {
  file: `${OWN}/anchor.ts`,
  code: codeIn(`export function anchored(): string {\n  return '${ANCHOR}';\n}\n`),
};

/**
 * Awkward on purpose.
 *
 * `has` is a method name, so a reader that looks at what precedes a literal has
 * to not confuse the word with the call. `writer.full` and `step 🚶🏼` are real
 * members of real unions here — `packages/journal` and `packages/engine`
 * declare them — and neither is an identifier. `w` is one character, which any
 * reader working over text rather than syntax will find inside other words.
 */
const WORDS = ['standing', 'finished', 'has', 'writer.full', 'step 🚶🏼', 'too-short', 'w'];

/** Where a word can stand, and whether standing there means anything made it. */
type Column = {
  what: string;
  said: boolean;
  /** The file that mentions the word, and what it says. */
  mention: (word: string) => Source;
};

const own = (name: string, body: string): Source => ({
  file: `${OWN}/${name}`,
  code: codeIn(body),
});

const COLUMNS: Column[] = [
  {
    what: 'returned',
    said: true,
    mention: (word) => own('use.ts', `export function make(): Kind {\n  return '${word}';\n}\n`),
  },
  {
    what: 'assigned',
    said: true,
    mention: (word) => own('use.ts', `const chosen: Kind = '${word}';\nexport const held = chosen;\n`),
  },
  {
    what: 'passed as an argument',
    said: true,
    mention: (word) => own('use.ts', `export const tell = () => announce('${word}');\n`),
  },
  {
    // The founding shape. `apps/bot` says `{ say: 'finished' }`, and that one
    // object-literal value is the whole reason the first version of this check
    // could not be allowed to search the repository instead of the package.
    what: 'an object-literal value',
    said: true,
    mention: (word) => own('use.ts', `export const tell = () => report({ say: '${word}' });\n`),
  },
  {
    what: 'an array element',
    said: true,
    mention: (word) => own('use.ts', `export const every = ['${word}'];\n`),
  },
  {
    // `packages/ai/src/prompts.ts:337`, which is the one production `Arrival`
    // has: `const arrival: Arrival = context.arrival ?? 'standing';`
    what: 'the right of a default',
    said: true,
    mention: (word) => own('use.ts', `export const pick = (k?: Kind): Kind => k ?? '${word}';\n`),
  },
  {
    what: 'compared with ===',
    said: false,
    mention: (word) => own('use.ts', `export const is = (k: Kind) => k === '${word}';\n`),
  },
  {
    what: 'compared with !==',
    said: false,
    mention: (word) => own('use.ts', `export const isNot = (k: Kind) => k !== '${word}';\n`),
  },
  {
    what: 'in a case arm',
    said: false,
    mention: (word) =>
      own(
        'use.ts',
        `export function weigh(k: Kind): number {\n` +
          `  switch (k) {\n` +
          `    case '${word}':\n` +
          `      return 1;\n` +
          `    default:\n` +
          `      return 0;\n` +
          `  }\n` +
          `}\n`,
      ),
  },
  {
    what: 'asked of a list with includes',
    said: false,
    mention: (word) => own('use.ts', `export const known = (all: Kind[]) => all.includes('${word}');\n`),
  },
  {
    what: 'asked of a set with has',
    said: false,
    mention: (word) => own('use.ts', `export const known = (all: Set<Kind>) => all.has('${word}');\n`),
  },
  {
    what: 'in a type annotation',
    said: false,
    mention: (word) => own('use.ts', `export function only(k: '${word}'): void {\n  void k;\n}\n`),
  },
  {
    what: 'quoted in a comment',
    said: false,
    mention: (word) =>
      own(
        'use.ts',
        `/**\n` +
          ` * Nothing here returns '${word}'. This paragraph is about the word, and\n` +
          ` * a paragraph is not a use of it:\n` +
          ` *\n` +
          ` *   return '${word}';\n` +
          ` */\n` +
          `// return '${word}';\n` +
          `export const nothing = () => undefined;\n`,
      ),
  },
  {
    // The reason the search is package-scoped, stated as a fixture rather than
    // only as a paragraph. Reaching across would find `apps/bot`'s
    // `{ say: 'finished' }` and take the founding defect green with it.
    what: 'produced in another package',
    said: false,
    mention: (word) => ({
      file: `${ELSEWHERE}/make.ts`,
      code: codeIn(`export function make(): string {\n  return '${word}';\n}\n`),
    }),
  },
  {
    what: 'nowhere at all',
    said: false,
    mention: () => own('use.ts', `export const nothing = () => undefined;\n`),
  },
];

/** How the union itself is written, which must not change any verdict. */
type Declaration = {
  what: string;
  /** The name `unionsIn` should report it under. */
  name: string;
  source: (word: string) => string;
};

const DECLARATIONS: Declaration[] = [
  {
    what: 'a type alias of two literals',
    name: 'Kind',
    source: (word) => `export type Kind = '${word}' | '${ANCHOR}';\n`,
  },
  {
    what: 'a field of an interface',
    name: 'kind',
    source: (word) => `export interface Thing {\n  kind: '${word}' | '${ANCHOR}';\n}\n`,
  },
  {
    // `apps/miniapp/src/view.ts` and `apps/mobile/src/game.ts`, both of which
    // spell `ThrowRefusal` this way, and neither of which the old scan saw.
    what: 'an alias mixing literals with a named type',
    name: 'Kind',
    source: (word) => `export type Kind = '${word}' | '${ANCHOR}' | TurnBlockedReason;\n`,
  },
  {
    // `apps/mobile/src/journal.ts:243`, where a single `| null` was enough to
    // hide the declaration from the field pattern entirely.
    what: 'a field whose union admits null',
    name: 'refusal',
    source: (word) => `export interface Account {\n  refusal: '${word}' | '${ANCHOR}' | null;\n}\n`,
  },
];

/** The union a declaration declares, insisted upon rather than assumed. */
function declared(declaration: Declaration, word: string): { union: Union; source: Source } {
  const source: Source = {
    file: `${OWN}/kind.ts`,
    code: codeIn(declaration.source(word)),
  };
  const found = unionsIn(source.code, source.file) as Union[];

  expect(found.length, `${declaration.what}: exactly one union`).toBe(1);
  expect(found[0].name, `${declaration.what}: the name it is reported under`).toBe(
    declaration.name,
  );
  expect([...found[0].members].sort(), `${declaration.what}: both words`).toEqual(
    [word, ANCHOR].sort(),
  );

  return { union: found[0], source };
}

/**
 * The three files one cell of the grid is made of: the declaration, the anchor
 * that must always come back said, and the one file that mentions the word.
 *
 * The declaration lives in its own file on purpose. `unsaidIn` cuts the
 * declaration's own span out of the search only in the file that declares it,
 * and a fixture that put the mention there too would be exercising that cut
 * instead of the classification — which the 'nowhere at all' column does, once,
 * deliberately.
 */
function cell(declaration: Declaration, column: Column, word: string): [Union, Source[]] {
  const { union, source } = declared(declaration, word);
  return [union, [source, anchorSource, column.mention(word)]];
}

/** What the reader says about one word in one place, under one declaration. */
function verdict(declaration: Declaration, column: Column, word: string): string[] {
  const [union, sources] = cell(declaration, column, word);
  return (unsaidIn(union, sources) as string[]).slice().sort();
}

/**
 * The rule as it was: any occurrence of the quoted word in the package counts.
 *
 * Kept here, spelled out, so the difference between the two readers is a thing
 * this file measures rather than a thing its header claims. A test whose
 * subject has never been seen to answer differently is not evidence that
 * anything changed.
 */
function unsaidByOccurrence(union: Union, sources: Source[]): string[] {
  const own = (file: string) => file.split('/').slice(0, 2).join('/');
  return union.members
    .filter((member) => {
      const quoted = `'${member}'`;
      return !sources.some(({ file, code }) => {
        if (own(file) !== own(union.file)) return false;
        const body =
          file === union.file ? code.slice(0, union.at[0]) + code.slice(union.at[1]) : code;
        return body.includes(quoted);
      });
    })
    .sort();
}

describe('a word only compared against', () => {
  it('has a grid to sweep', () => {
    // The inputs are built here rather than found, but a loop over an empty
    // list still passes, and that is how two checks in this repository went
    // green over nothing.
    expect(WORDS.length).toBeGreaterThan(4);
    expect(COLUMNS.length).toBeGreaterThan(10);
    expect(DECLARATIONS.length).toBe(4);
  });

  it('rules on the place a word stands, not on the word', () => {
    for (const declaration of DECLARATIONS) {
      for (const column of COLUMNS) {
        const answers = WORDS.map((word) => ({
          word,
          unsaid: verdict(declaration, column, word),
        }));

        for (const { word, unsaid } of answers) {
          const expected = column.said ? [] : [word];
          expect(unsaid, `${declaration.what} / ${column.what} / '${word}'`).toEqual(expected);
        }
      }
    }
  });

  it('never loses the word that is plainly produced', () => {
    // The control. If a fixture ever comes back with the anchor unsaid, the
    // reader fell over rather than found something, and every other verdict in
    // this file is worth nothing.
    for (const declaration of DECLARATIONS) {
      for (const column of COLUMNS) {
        for (const word of WORDS) {
          expect(
            verdict(declaration, column, word),
            `${declaration.what} / ${column.what} / '${word}': the anchor`,
          ).not.toContain(ANCHOR);
        }
      }
    }
  });

  it('does not count the declaration as its own producer', () => {
    // Without this the check proves every union it reads. It used to be done by
    // cutting the declaration's text out of the search; it is now true twice
    // over, because a literal standing in a type is not a production site to
    // begin with. Both halves are asserted by the same fixture: the word is
    // declared, mentioned nowhere else, and must come back unsaid.
    for (const declaration of DECLARATIONS) {
      const nowhere = COLUMNS.find((one) => one.what === 'nowhere at all');
      expect(nowhere).toBeDefined();
      for (const word of WORDS) {
        expect(verdict(declaration, nowhere as Column, word), declaration.what).toEqual([word]);
      }
    }
  });

  it('answers differently from the rule it replaced', () => {
    // The falsification, run rather than asserted in prose. On the columns that
    // are HANDLING, the old occurrence-counting reader said the word was said —
    // that is the whole defect — and the new one says it was not. If this ever
    // stops holding, either the fix has been undone or these fixtures no longer
    // contain the shape.
    //
    // Two columns are left out because the old reader was already right about
    // them, and saying otherwise would be a claim this file has measured to be
    // false. The package scope it had from the start, and prose it had from the
    // start: `codeIn` took the comments out before the search, so a word quoted
    // in a paragraph never counted. MEASURED, by asserting the difference over
    // every column and watching this one fail. The old rule's defect was
    // syntactic and only syntactic: it could not tell a value being made from a
    // value being asked about.
    const alreadyRight = new Set([
      'produced in another package',
      'nowhere at all',
      'quoted in a comment',
    ]);
    const handled = COLUMNS.filter((one) => !one.said && !alreadyRight.has(one.what));
    expect(handled.length).toBeGreaterThan(4);

    for (const column of handled) {
      for (const word of WORDS) {
        const [union, sources] = cell(DECLARATIONS[0], column, word);

        expect(
          unsaidByOccurrence(union, sources),
          `${column.what} / '${word}': the old reader called it said`,
        ).toEqual([]);
        expect(
          (unsaidIn(union, sources) as string[]).slice().sort(),
          `${column.what} / '${word}': the new reader does not`,
        ).toEqual([word]);
      }
    }
  });

  /**
   * `Arrival`, both as it is and as it would be with its one producer removed.
   *
   * The first is the state of `packages/ai/src/prompts.ts` today, transcribed:
   * `'standing'` is made once, by the default at line 337, and `'received'` is
   * only ever compared against at line 346. That is why `Arrival` is now in
   * `RECEIVED` — the producer is `apps/bot/src/bot.ts:966`, another package.
   *
   * The second is that file with line 337 turned into a comparison, which is
   * how it was originally written and what an earlier pass repaired. Both words
   * then have no producer, and the reader must say so. It is asserted here, on
   * a copy, rather than by editing the shipped file: this repository has
   * already lost an hour to a mutation left behind in
   * `packages/ai/src/prompts.ts` by a run that was killed part-way, and a test
   * that edits shipped source to prove a point is that hour waiting to happen
   * again.
   */
  const arrival = (producer: string) =>
    [
      {
        file: `${OWN}/prompts.ts`,
        code: codeIn(`export type Arrival = 'standing' | 'received';\n`),
      },
      {
        file: `${OWN}/systemPrompt.ts`,
        code: codeIn(
          `${producer}\n` +
            `export function lines(context: PlanContext): string[] {\n` +
            `  return [\n` +
            `    arrival === 'received' ? handedOver(context) : standingOn(context),\n` +
            `  ];\n` +
            `}\n`,
        ),
      },
    ] as Source[];

  const arrivalUnion = (sources: Source[]): Union =>
    (unionsIn(sources[0].code, sources[0].file) as Union[])[0];

  it('finds the half of Arrival that nothing in its package makes', () => {
    const sources = arrival(`const arrival: Arrival = context.arrival ?? 'standing';`);
    expect(arrivalUnion(sources).members).toEqual(['standing', 'received']);
    expect(unsaidIn(arrivalUnion(sources), sources)).toEqual(['received']);
  });

  it('finds both halves when the default is written as a comparison', () => {
    // Break what the guard protects. With the default gone there is no
    // production of either word in the package, and a reader that let a
    // comparison count would report neither.
    const sources = arrival(
      `const arrival: Arrival = context.arrival === 'standing' ? context.arrival : context.arrival;`,
    );
    expect((unsaidIn(arrivalUnion(sources), sources) as string[]).slice().sort()).toEqual(
      ['received', 'standing'].sort(),
    );
    expect(unsaidByOccurrence(arrivalUnion(sources), sources)).toEqual([]);
  });

  /**
   * Comments are removed before anything is read, and nothing else is.
   *
   * `codeIn` was two regular expressions — strip block comments, then strip
   * from `//` to the end of the line — and the second cut into string
   * literals. MEASURED over the sixty-nine sources this audit reads: four files
   * that parse without a single error came back with 5, 8, 2 and 4 syntax
   * errors after stripping, because a URL carries `//`. One of the four is
   * `apps/bot/src/bot.ts`, which is where `{ say: 'finished' }` lives — the one
   * production site the founding defect turns on. A comment stripper that
   * damages code is worse than no comment stripper.
   */
  it('takes the comments out and leaves the strings alone', () => {
    const source =
      `const home = 'https://example.test/a//b';\n` +
      `// return 'gone';\n` +
      `const shown = 'kept'; /* return 'gone'; */ const also = "kept too";\n` +
      `const pattern = /\\/\\//g;\n` +
      `const message = \`a \${shown} b // not a comment\`;\n`;
    const stripped = codeIn(source) as string;

    expect(stripped.length, 'offsets are preserved').toBe(source.length);
    expect(stripped.split('\n').length, 'lines are preserved').toBe(source.split('\n').length);
    expect(stripped, 'the URL survives whole').toContain(`'https://example.test/a//b'`);
    expect(stripped, 'so do the strings around the comments').toContain(`'kept'`);
    expect(stripped, 'and the double-quoted one').toContain(`"kept too"`);
    expect(stripped, 'a slash inside a template is not a comment').toContain('// not a comment');
    expect(stripped, 'the word quoted in prose is gone').not.toContain(`'gone'`);
  });
});
