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
    expect(exportedLists(source)).toEqual(['FUNCTION_WORDS', 'PRIVATE', 'RECORDED']);
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

  it('declares its own list, because a declaration is a record too', () => {
    const own = declared.find((one) => one.module === 'lib/records.mjs' && one.name === 'DECLARED');

    expect(own).toBeDefined();
    expect(own?.kind).toBe('record');
  });
});
