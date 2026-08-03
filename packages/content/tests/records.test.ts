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
  // @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
} from '../../../scripts/lib/records.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const LIB = join(REPO, 'scripts/lib');

type Declaration = {
  module: string;
  name: string;
  kind: 'record' | 'vocabulary';
  askedIn?: string;
  asks?: string;
  because: string;
};

const declared = DECLARED as Declaration[];

const listsOnDisk = (): string[] => {
  const found: string[] = [];
  for (const module of readdirSync(LIB).filter((name) => name.endsWith('.mjs'))) {
    const source = readFileSync(join(LIB, module), 'utf8');
    for (const name of exportedLists(source) as string[]) found.push(keyOf(module, name));
  }
  return found;
};

describe('finding the lists', () => {
  it('reads an exported array and leaves everything else alone', () => {
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

    // A threshold and a lookup table excuse nothing, so they are not records.
    // A private list is not somebody else's to rely on, and a lowercase export
    // is a value rather than a set of excused things.
    expect(exportedLists(source)).toEqual(['RECORDED']);
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
  });

  it('declares its own list, because a declaration is a record too', () => {
    const own = declared.find((one) => one.module === 'records.mjs' && one.name === 'DECLARED');

    expect(own).toBeDefined();
    expect(own?.kind).toBe('record');
  });
});
