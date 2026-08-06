import { describe, expect, it } from 'vitest';
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
  staleAmong,
  entriesOf,
  stalePermissions,
  // @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
} from '../../../scripts/lib/records.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const LIB = join(REPO, 'scripts/lib');

type Declaration = {
  module: string;
  name: string;
  kind: 'record' | 'permission' | 'vocabulary';
  askedIn?: string;
  asks?: string;
  namesIn?: string | string[] | null;
  namelessBecause?: string;
  because: string;
};

const declared = DECLARED as Declaration[];

const SCRIPTS = join(REPO, 'scripts');

const listsOnDisk = (): string[] => {
  const found: string[] = [];
  const modules = [
    ...readdirSync(SCRIPTS).filter((name) => name.endsWith('.mjs')),
    ...readdirSync(LIB)
      .filter((name) => name.endsWith('.mjs'))
      .map((name) => `lib/${name}`),
  ];
  for (const module of modules) {
    const source = readFileSync(join(SCRIPTS, module), 'utf8');
    for (const name of exportedLists(source) as string[]) found.push(keyOf(module, name));
  }
  return found;
};

describe('finding the lists', () => {
  it('reads a list, exported or not, and leaves everything else alone', () => {
    const source = [
      'export const RECORDED = [',
      "  'one',",
      '];',
      'export const LONG_ENOUGH = 200;',
      "export const BLIND_TO = 'latin';",
      'export const FUNCTION_WORDS = {',
      '  de: /x/,',
      '};',
      'export function unrecorded(a, b) { return []; }',
      'const PRIVATE = [1, 2];',
      'export const lower = [1];',
    ].join('\n');

    // A threshold is not a set of excused things. Everything list-shaped is,
    // whether written as an array or as an object carrying a reason per entry,
    // and whether exported or kept to the audit that owns it: the two largest
    // excuse lists here are unexported objects, and the first version of this
    // rule was blind to both.
    //
    // This fixture proves the rule over `= [` and `= {` and over nothing else,
    // which is how the rule went on being blind to `new Set(` while a test of
    // it passed. The grid below is the answer to that: a fixture is a sample,
    // and a sample says nothing about the form nobody thought to sample.
    expect(exportedLists(source)).toEqual(['FUNCTION_WORDS', 'PRIVATE', 'RECORDED']);
  });

  /**
   * Every way a list can be written, against the one question this rule asks.
   *
   * The rule was widened twice and stayed blind both times, because each
   * widening was made to fit the list somebody had just found: first to
   * objects, then to unexported ones. Nothing ever asked *what else can a list
   * be written as*, and the answer — `new Set([...])`, which is how a
   * membership test is naturally written — was five audits' worth of excuse
   * lists that `audit-records` reported success over without reading.
   *
   * So the assertion is the shape rather than the cases: over the edges of the
   * declaration form — exported or not, four openers, on one line or wrapped —
   * whatever one form declares a list, the others declare one too. A form
   * added tomorrow is a row added here, and a rule that reads three of the four
   * fails in the cell it cannot see rather than passing in the three it can.
   */
  describe('over every way a list is written', () => {
    const OPENERS = {
      array: { open: '[', close: ']', entry: "'one'," },
      object: { open: '{', close: '}', entry: 'one: 1,' },
      set: { open: 'new Set([', close: '])', entry: "'one'," },
      map: { open: 'new Map([', close: '])', entry: "['one', 'why'],", },
    };

    for (const [form, { open, close, entry }] of Object.entries(OPENERS)) {
      for (const exported of [true, false]) {
        for (const wrapped of [true, false]) {
          const prefix = exported ? 'export const' : 'const';
          const body = wrapped ? `\n  ${entry}\n` : entry.replace(/,$/, '');
          const source = `${prefix} EXCUSED = ${open}${body}${close};\n`;
          const where = `${form}, ${exported ? 'exported' : 'not exported'}, ${
            wrapped ? 'wrapped' : 'one line'
          }`;

          it(`finds a list written as ${where}`, () => {
            expect(exportedLists(source)).toEqual(['EXCUSED']);
          });
        }
      }
    }

    it('does not count a collection built from another list as a list of its own', () => {
      // `new Set(ALLOWED.keys())` is one list read twice, not two lists. The
      // opener has to be followed by a bracket for the same reason the rule is
      // anchored to the start of a line: a name is declared where it is
      // written out, and counting the copy would ask somebody to declare a
      // list that has no entries of its own.
      const source = ['const READERS = new Set(ALLOWED.keys());', 'const ALLOWED = ['].join('\n');

      expect(exportedLists(source)).toEqual(['ALLOWED']);
    });
  });

  it('does not read a list out of a comment or a string', () => {
    const source = [
      '/** Once written as `export const OLD = [` and since removed. */',
      'export const KEPT = [',
      '];',
    ].join('\n');

    expect(exportedLists(source)).toEqual(['KEPT']);
  });
});

describe('the two halves, over any list at all', () => {
  /**
   * Asserted as the shape rather than as the seven this repository carries, so
   * it stays true of the eighth somebody writes tomorrow.
   *
   * Over every subset of a set of lists: whatever is declared and not on disk is
   * a stale declaration, whatever is on disk and not declared is undeclared, and
   * neither answer says anything about the other. Keeping them apart is the
   * point — an undeclared list is work for whoever wrote it, a stale declaration
   * is work for whoever keeps the file, and one comparison sends somebody to the
   * wrong one.
   */
  it('separates a list nobody declared from a declaration of nothing', () => {
    const all = ['a.mjs:RECORDED', 'b.mjs:CORRECTIONS', 'c.mjs:LOSSES'];

    for (let mask = 0; mask < 1 << all.length; mask += 1) {
      const onDisk = all.filter((_, i) => (mask >> i) & 1);
      const decls = all.map((line) => {
        const [module, name] = line.split(':');
        return { module, name, kind: 'vocabulary' as const, because: 'x'.repeat(30) };
      });

      expect(staleDeclarations(decls, onDisk)).toEqual(all.filter((l) => !onDisk.includes(l)));
      expect(undeclared(onDisk, decls)).toEqual([]);

      const onlyDeclared = decls.filter((one) => onDisk.includes(keyOf(one.module, one.name)));
      expect(undeclared(all, onlyDeclared)).toEqual(all.filter((l) => !onDisk.includes(l)));
    }
  });

  it('asks nothing of a vocabulary, since it excuses nothing', () => {
    const vocabulary = [
      { module: 'a.mjs', name: 'WORDS', kind: 'vocabulary' as const, because: 'x'.repeat(30) },
    ];
    expect(unasked(vocabulary, () => '')).toEqual([]);
  });

  it('sees an asker that has stopped asking', () => {
    const record = [
      {
        module: 'a.mjs',
        name: 'RECORDED',
        kind: 'record' as const,
        askedIn: 'scripts/audit-a.mjs',
        asks: 'staleRecords',
        because: 'x'.repeat(30),
      },
    ];

    expect(unasked(record, () => 'const gone = staleRecords(RECORDED, found);')).toEqual([]);
    expect(unasked(record, () => 'const gone = RECORDED.filter(byHand);')).toHaveLength(1);
  });

  it('does not count a name that is only imported', () => {
    // The experiment that was meant to prove `unasked` caught nothing the first
    // time: the hand-written filter left `staleRecords` in the import list, and
    // a whole-file search read that as asking.
    const record = [
      {
        module: 'a.mjs',
        name: 'RECORDED',
        kind: 'record' as const,
        askedIn: 'scripts/audit-a.mjs',
        asks: 'staleRecords',
        because: 'x'.repeat(30),
      },
    ];

    const importsOnly = [
      "import { RECORDED, staleRecords } from './lib/a.mjs';",
      'const gone = RECORDED.filter(byHand);',
    ].join('\n');

    expect(unasked(record, () => importsOnly)).toHaveLength(1);
  });

  it('refuses a declaration that does not say why', () => {
    expect(
      unexplained([{ module: 'a.mjs', name: 'X', kind: 'vocabulary', because: 'because' }]),
    ).toEqual(['a.mjs:X']);
  });

  it('cannot be satisfied by an asker that does not exist', () => {
    // A missing file reads as empty, and empty contains nothing, so the record
    // is reported. The alternative — skipping what cannot be read — is the
    // silent excuse this whole check exists to forbid.
    const record = [
      {
        module: 'a.mjs',
        name: 'RECORDED',
        kind: 'record' as const,
        askedIn: 'scripts/gone.mjs',
        asks: 'staleRecords',
        because: 'x'.repeat(30),
      },
    ];
    expect(unasked(record, () => null)).toHaveLength(1);
  });
});

describe('the third kind, which was measured rather than assumed', () => {
  /**
   * A permission and a record rot differently, and calling them one thing loses
   * whichever half is wrong. `WRITE_ONLY` asserts a fact about now — this field
   * is written and never read — so an entry suppressing nothing means the fact
   * changed, and twenty-four of thirty-four had. `PUBLIC_API` asserts an intent
   * — this export is a surface whether or not we call it — so an entry
   * suppressing nothing means somebody is calling it today, which withdraws
   * nothing.
   */
  it('asks no staleness of a permission, which is about intent and not about now', () => {
    const permission = [
      {
        module: 'a.mjs',
        name: 'PUBLIC_API',
        kind: 'permission' as const,
        because: 'x'.repeat(30),
      },
    ];
    expect(unasked(permission, () => '')).toEqual([]);
  });

  it('refuses a kind nobody defined, or the rule closes by spelling', () => {
    expect(unknownKinds([{ module: 'a.mjs', name: 'X', kind: 'exception', because: 'y' }]))
      .toHaveLength(1);
    expect(
      unknownKinds([
        { module: 'a.mjs', name: 'X', kind: 'record', because: 'y' },
        { module: 'b.mjs', name: 'Y', kind: 'permission', because: 'y' },
        { module: 'c.mjs', name: 'Z', kind: 'vocabulary', because: 'y' },
      ]),
    ).toEqual([]);
  });

  it('has one primitive under every staleness question', () => {
    // Written once because the third copy was written the day before this, and
    // a rule restated is a rule that will disagree with itself.
    for (let mask = 0; mask < 8; mask += 1) {
      const all = ['a', 'b', 'c'];
      const found = all.filter((_, i) => (mask >> i) & 1);
      expect(staleAmong(all, found)).toEqual(all.filter((x) => !found.includes(x)));
    }
  });
});

/**
 * The other way a list rots, which was written down and never implemented.
 *
 * `lib/records.mjs` has said since it was written that *a permission rots the
 * other way: by naming something that no longer exists*, and for as long as that
 * sentence sat there nothing asked it. `unasked` opens with
 * `.filter((one) => one.kind === 'record')`, so a permission is excluded on the
 * first line; every other check in the file is about the declaration and not
 * about its contents. Seven standing permissions, entries read by nothing, under
 * an audit closing with *every asker still asks* — the shape of defect this whole
 * module exists to find, inside the module.
 *
 * The grid is the assertion rather than the seven, for the reason the grid above
 * it exists: a fixture is a sample, and the last two widenings of this file were
 * each made to fit the one list somebody had just found. Every `kind` crossed
 * with every state an entry can be in, so a state added tomorrow is a row here,
 * and a check that reads one kind fails in the cells it cannot see rather than
 * passing in the ones it can.
 */
describe('the way a permission rots, over every kind and every state', () => {
  const MODULE = 'audit-grid.mjs';
  const PLACE = 'apps/grid/src/main.ts';
  const LIST = "const EXCUSED = new Set(['theThing']);\n";

  const STATES = [
    'its entry is named in the place',
    'its entry is named nowhere there',
    'the named place is not there',
    'it gives no namesIn at all',
    'it names no place and says why',
    'it names no place and does not say why',
  ] as const;

  type State = (typeof STATES)[number];

  const declarationFor = (kind: Declaration['kind'], state: State): Declaration => {
    const base = { module: MODULE, name: 'EXCUSED', kind, because: 'x'.repeat(30) };

    if (state === 'it gives no namesIn at all') return base;
    if (state === 'it names no place and says why') {
      return { ...base, namesIn: null, namelessBecause: 'no single file holds these names' };
    }
    if (state === 'it names no place and does not say why') return { ...base, namesIn: null };
    return { ...base, namesIn: PLACE };
  };

  const readerFor = (state: State) => {
    const asked: string[] = [];

    const findIn = (path: string): string | null => {
      asked.push(path);
      if (path === `scripts/${MODULE}`) return LIST;
      if (path !== PLACE) return null;
      if (state === 'the named place is not there') return null;
      return state === 'its entry is named nowhere there'
        ? 'export function somethingElse() { return 1; }\n'
        : 'export function theThing() { return 1; }\n';
    };

    return { asked, findIn };
  };

  // A permission is the only kind with an entry that can rot this way, and the
  // states that rot are the three where the name cannot be found and the one
  // where nobody said where to look. Everything else in the grid is silence.
  const rots = (kind: Declaration['kind'], state: State) =>
    kind === 'permission' && state !== 'its entry is named in the place' &&
    state !== 'it names no place and says why';

  for (const kind of ['record', 'permission', 'vocabulary'] as const) {
    for (const state of STATES) {
      it(`${rots(kind, state) ? 'reports' : 'says nothing of'} a ${kind} where ${state}`, () => {
        const { asked, findIn } = readerFor(state);
        const found: string[] = stalePermissions([declarationFor(kind, state)], findIn);

        if (!rots(kind, state)) expect(found).toEqual([]);
        else expect(found).toHaveLength(1);

        // Whatever is reported says which list, so the reader is not sent to
        // hunt through seven permissions for the one that rotted.
        for (const line of found) expect(line).toContain(`${MODULE}:EXCUSED`);

        // A kind that is not a permission is not read at all, and neither is a
        // permission that names no place: there is nothing to compare against,
        // and opening the file anyway is how a check acquires an opinion about
        // a list it was told not to have one about.
        if (kind !== 'permission' || state.startsWith('it names no place') || state.startsWith('it gives no'))
          expect(asked).toEqual([]);
      });
    }
  }

  it('names the entry that rotted, not merely the list holding it', () => {
    const { findIn } = readerFor('its entry is named nowhere there');
    const found: string[] = stalePermissions(
      [declarationFor('permission', 'its entry is named nowhere there')],
      findIn,
    );

    expect(found[0]).toContain("'theThing'");
    expect(found[0]).toContain(PLACE);
  });

  /**
   * A list shrinking is the outcome this whole file argues for, so it cannot be
   * the thing that fails. Only the entries that are there are asked about: an
   * emptied list has nothing to ask, and a place naming things the list never
   * excused is a place doing its job.
   */
  it('cannot be failed by a list that shrank, or by a place naming more than the list', () => {
    const declaration = {
      module: MODULE,
      name: 'EXCUSED',
      kind: 'permission' as const,
      namesIn: PLACE,
      because: 'x'.repeat(30),
    };

    const emptied = (path: string) =>
      path === `scripts/${MODULE}` ? 'const EXCUSED = new Set([]);\n' : 'export function theThing() {}\n';
    expect(stalePermissions([declaration], emptied)).toEqual([]);

    const generous = (path: string) =>
      path === `scripts/${MODULE}`
        ? LIST
        : 'export function theThing() {}\nexport function andAnother() {}\n';
    expect(stalePermissions([declaration], generous)).toEqual([]);
  });

  it('refuses a token sentence where a reason for naming no place is required', () => {
    const declaration = {
      module: MODULE,
      name: 'EXCUSED',
      kind: 'permission' as const,
      namesIn: null,
      namelessBecause: 'because',
      because: 'x'.repeat(30),
    };

    expect(stalePermissions([declaration], () => null)).toHaveLength(1);
  });

  /**
   * A list nobody can read is reported rather than skipped. Treating an
   * unreadable list as an empty one is the quiet failure this module is about:
   * the check would pass, over a permission it never opened.
   */
  it('reports a list it could not read rather than passing over it', () => {
    const declaration = {
      module: MODULE,
      name: 'EXCUSED',
      kind: 'permission' as const,
      namesIn: PLACE,
      because: 'x'.repeat(30),
    };

    const threshold = (path: string) =>
      path === `scripts/${MODULE}` ? 'const EXCUSED = 200;\n' : 'export function theThing() {}\n';

    expect(stalePermissions([declaration], threshold)).toHaveLength(1);
    expect(stalePermissions([declaration], threshold)[0]).toContain('could not be read');
  });

  /**
   * Found by breaking the rule rather than by thinking about it. The experiment
   * meant to prove this check renamed `draw` to `redraw` in `audit-whose`'s
   * `ALLOWED` and the check said nothing — `redraw` is written four times in
   * `apps/miniapp/src/main.ts`, every one of them in prose about redrawing. A
   * permission is granted to something that exists in code, and a file talking
   * about a name is not the name being there.
   */
  it('does not accept a name that the place only talks about', () => {
    const declaration = {
      module: MODULE,
      name: 'EXCUSED',
      kind: 'permission' as const,
      namesIn: PLACE,
      because: 'x'.repeat(30),
    };

    const onlyInProse = (path: string) =>
      path === `scripts/${MODULE}`
        ? LIST
        : ['/** theThing used to live here. */', '// theThing again, in a line comment.', 'export function other() {}'].join('\n');

    expect(stalePermissions([declaration], onlyInProse)).toHaveLength(1);
    expect(stalePermissions([declaration], onlyInProse)[0]).toContain("'theThing'");
  });

  it('does not accept a longer name as the name it was looking for', () => {
    const declaration = {
      module: MODULE,
      name: 'EXCUSED',
      kind: 'permission' as const,
      namesIn: PLACE,
      because: 'x'.repeat(30),
    };

    const nearly = (path: string) =>
      path === `scripts/${MODULE}`
        ? "const EXCUSED = new Set(['draw']);\n"
        : 'export function drawing() {}\nconst redrawn = 1;\n';

    expect(stalePermissions([declaration], nearly)).toHaveLength(1);
  });

  /**
   * The four forms a list is written in differ in where the entry sits and agree
   * on nothing else, which is how this repository's rule went on being blind to
   * `new Set(` for five audits while a test of it passed. So the entries are
   * asked of every form, and a form added tomorrow is a row here.
   */
  describe('reading the entries out of every form a list is written in', () => {
    const FORMS = {
      array: "const EXCUSED = ['one', 'two'];",
      object: 'const EXCUSED = {\n  one: "why",\n  // a comment between two entries\n  two: "why",\n};',
      set: "const EXCUSED = new Set(['one', 'two']);",
      map: "const EXCUSED = new Map([\n  ['one', 'why (a bracket) in prose'],\n  ['two', 'why'],\n]);",
    };

    for (const [form, source] of Object.entries(FORMS)) {
      it(`reads both entries out of a list written as ${form}`, () => {
        expect(entriesOf(source, 'EXCUSED')).toEqual(['one', 'two']);
      });

      it(`asks the named place about both entries of a ${form}`, () => {
        const declaration = {
          module: MODULE,
          name: 'EXCUSED',
          kind: 'permission' as const,
          namesIn: PLACE,
          because: 'x'.repeat(30),
        };

        const half = (path: string) =>
          path === `scripts/${MODULE}` ? source : 'export function one() {}\n';

        expect(stalePermissions([declaration], half)).toHaveLength(1);
        expect(stalePermissions([declaration], half)[0]).toContain("'two'");
      });
    }

    it('reads nothing out of a constant that is not a list', () => {
      expect(entriesOf('const EXCUSED = 200;', 'EXCUSED')).toBeNull();
      expect(entriesOf("const OTHER = ['one'];", 'EXCUSED')).toBeNull();
      expect(entriesOf('const EXCUSED = [1, 2];', 'EXCUSED')).toBeNull();
    });
  });

  it('asks every place a permission names, and is satisfied by any of them', () => {
    // Measured rather than assumed: two of this repository's four placed
    // permissions name two files, so a rule written for one path would have
    // reported half of each as rotted on the day it was added.
    const declaration = {
      module: MODULE,
      name: 'EXCUSED',
      kind: 'permission' as const,
      namesIn: ['apps/grid/src/one.ts', 'apps/grid/src/two.ts'],
      because: 'x'.repeat(30),
    };

    const split = (path: string) => {
      if (path === `scripts/${MODULE}`) return "const EXCUSED = new Set(['here', 'there']);";
      if (path === 'apps/grid/src/one.ts') return 'export function here() {}\n';
      return 'export function there() {}\n';
    };

    expect(stalePermissions([declaration], split)).toEqual([]);
  });
});

/**
 * Whether a record's asker is asked of code or merely of prose, over every record.
 *
 * `unasked` used to be `.includes` over the asker's source with only the imports
 * cut out, so a sentence naming the asker satisfied it. The measurement: delete
 * the `mended` staleness check out of `audit-offers.mjs` — the filter that builds
 * it and the line that reports it — and the old check still said nothing, because
 * one line survives the deletion, a comment written by the round that closed the
 * all-clear defect and which happens to say the word. A comment about a check was
 * accepted as the check.
 *
 * Twelve lines below it in the same module, `namedIn` had already learned this
 * for permissions and said so in its own doc-comment: a rename to `redraw` hid
 * inside four sentences about redrawing, so the entries of a permission are
 * looked for in `codeIn(source)`. The file knew the lesson for one of its two
 * questions. This grid is the other one.
 *
 * The assertion is the shape and not the case, so it stays true of the record
 * declared tomorrow. For EVERY declared record: take the real source of the file
 * that claims to ask, delete the lines where the asker appears as a word in code
 * and leave every line where it appears only in prose, and the record must be
 * reported; leave the code alone and nothing must be. Plus the mirror — a source
 * that says the word only in comments and only inside longer identifiers is not
 * asking either. No record is named here; the rows come out of `DECLARED`.
 */
describe('a record asked of code and not of prose, over every record on the tree', () => {
  const records = declared.filter((one) => one.kind === 'record');

  const readOr = (path: string): string | null => {
    try {
      return readFileSync(join(REPO, path), 'utf8');
    } catch {
      return null;
    }
  };

  const wordFor = (asks: string) =>
    new RegExp(`(?<![\\w$])${asks.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`);

  /**
   * The source with its comments blanked, one array entry per line of the original.
   *
   * `codeIn` itself cannot be used to decide WHICH line a name is on: it replaces
   * a block comment with a single space, so a nine-line doc-comment becomes one
   * character and every line number after it moves. This keeps the alignment by
   * blanking a block comment in place instead.
   *
   * It is a helper for building the mutant, not a second copy of the rule under
   * test, and the two failure directions are not symmetric. Blank too much and a
   * prose line gets deleted as though it were code — the mutant loses an
   * occurrence it was meant to keep, and the row still fails as it should. Blank
   * too little and a real code line survives into the mutant, and then the first
   * assertion below goes red and says so. A disagreement with `codeIn` therefore
   * shows up as a failing row rather than as a quiet pass.
   */
  const codeLines = (source: string): string[] =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''));

  it('has records to ask about, or the grid below is empty and proves nothing', () => {
    expect(records.length).toBeGreaterThan(0);
  });

  for (const one of records) {
    const where = keyOf(one.module, one.name);

    it(`sees the question gone from ${one.askedIn} for ${where}, prose about it notwithstanding`, () => {
      const source = readOr(one.askedIn!);
      expect(source, one.askedIn).not.toBeNull();

      const word = wordFor(one.asks!);
      const code = codeLines(source!);
      const kept = source!
        .split('\n')
        .filter((_line, at) => !word.test(code[at]))
        .join('\n');

      // The mutant has to have removed something, or the row is asserting over an
      // untouched file and would pass whatever `unasked` did.
      expect(kept.split('\n').length, `${where} names ${one.asks} in no line of code`)
        .toBeLessThan(source!.split('\n').length);

      const gone: string[] = unasked([one], () => kept);
      expect(gone, `${where}: the asker is deleted and nothing noticed`).toHaveLength(1);
      expect(gone[0]).toContain(where);

      // The control: with the code left alone the same row says nothing, so the
      // failure above is the deletion and not the row being unsatisfiable.
      expect(unasked([one], () => source), where).toEqual([]);
    });

    it(`is not answered for ${where} by a comment or by a longer name`, () => {
      const asks = one.asks!;
      const talkOnly = [
        `/** ${asks} was asked here once, and this sentence is all that is left of it. */`,
        `// ${asks} again, in a line comment about ${asks}.`,
        `const un${asks}Yet = RECORDED.filter(byHand);`,
        `report({ count: ${asks}Count });`,
      ].join('\n');

      expect(unasked([one], () => talkOnly), where).toHaveLength(1);

      // And the same source with one bare use of the word does ask, so the row
      // above fails for the boundary rather than for anything else in the fixture.
      expect(unasked([one], () => `${talkOnly}\nconst gone = ${asks};`), where).toEqual([]);
    });
  }
});

describe('the repository as it stands', () => {
  it('has every list declared, and no declaration of a list that is gone', () => {
    const onDisk = listsOnDisk();

    expect(undeclared(onDisk, declared)).toEqual([]);
    expect(staleDeclarations(declared, onDisk)).toEqual([]);
  });

  it('has every record still asked, in the file that claims to ask it', () => {
    const readOr = (path: string) => {
      try {
        return readFileSync(join(REPO, path), 'utf8');
      } catch {
        return null;
      }
    };

    expect(unasked(declared, readOr)).toEqual([]);
    expect(unexplained(declared)).toEqual([]);
    expect(unknownKinds(declared)).toEqual([]);
  });

  it('has every standing permission still naming something that is there', () => {
    const readOr = (path: string) => {
      try {
        return readFileSync(join(REPO, path), 'utf8');
      } catch {
        return null;
      }
    };

    expect(stalePermissions(declared, readOr)).toEqual([]);
  });

  /**
   * The check would be satisfied by seven permissions whose lists it failed to
   * read, since an unreadable list reports and an empty one has nothing to
   * report. So the entries are counted here as well: a permission that names a
   * place is a permission whose entries were actually opened and looked for.
   */
  it('reads real entries out of every permission that names a place', () => {
    const readOr = (path: string) => {
      try {
        return readFileSync(join(REPO, path), 'utf8');
      } catch {
        return null;
      }
    };

    const placed = declared.filter((one) => one.kind === 'permission' && one.namesIn);
    expect(placed.length).toBeGreaterThan(0);

    for (const one of placed) {
      const entries = entriesOf(readOr(`scripts/${one.module}`) ?? '', one.name);
      expect(entries, `${one.module}:${one.name}`).not.toBeNull();
      expect(entries.length, `${one.module}:${one.name}`).toBeGreaterThan(0);
    }
  });

  it('makes every permission answer where its entries are named, or why nowhere is', () => {
    for (const one of declared.filter((d) => d.kind === 'permission')) {
      expect(one, `${one.module}:${one.name}`).toHaveProperty('namesIn');
      if (one.namesIn === null) {
        expect(one.namelessBecause?.trim().length ?? 0, `${one.module}:${one.name}`).toBeGreaterThan(19);
      }
    }
  });

  it('declares its own list, because a declaration is a record too', () => {
    const own = declared.find((one) => one.module === 'lib/records.mjs' && one.name === 'DECLARED');

    expect(own).toBeDefined();
    expect(own?.kind).toBe('record');
  });
});
