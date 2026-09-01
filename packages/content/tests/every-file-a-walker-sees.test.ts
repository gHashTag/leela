/**
 * Which files a check about source actually reads.
 *
 * `lib/claims.mjs` wrote this lesson down at lines 303-306 and then nothing
 * carried it:
 *
 *   > `.tsx` counts. This asked for `.ts` alone, so a workspace whose `src`
 *   > holds only components — which `apps/mobile` is one refactor from being —
 *   > would have been skipped whole, by the same rule that exists to stop a
 *   > workspace being skipped.
 *
 * Underneath that sentence, three audits went on filtering `.ts` alone.
 * `audit-doubles` and `audit-promises` each walked the workspaces with a copy of
 * the same recursive walk and neither of them had ever read a character of
 * `apps/mobile/src/App.tsx` — a thousand lines of shipped code — while printing
 * *every bound is declared once* and *every dependency is handed a broken one*
 * over it. A check that reports success over a file it never opened is worse
 * than no check: it is a check somebody trusts.
 *
 * So the walk is one function now, and this is the test of it. The assertion is
 * the extension rule and not a list of the files that happen to be in the tree:
 * a hand-written expectation is another copy of the thing that went wrong, and
 * it would agree with a walker that had quietly stopped reading components.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
// Typed by `scripts/lib/source.d.mts`, which is why this needs no directive
// where `records.mjs` — which has no declaration beside it — does.
import { sourceFilesUnder } from '../../../scripts/lib/source.mjs';

/**
 * The rule, written once here as three suffixes rather than imported.
 *
 * Importing the module's own regular expression would make this test agree with
 * whatever the module does, including with a module that had dropped `.tsx`.
 * Three suffixes spelled out is a second opinion; the same regex is an echo.
 */
const TYPESCRIPT = ['.ts', '.mts', '.tsx'];
const isSource = (name: string): boolean => TYPESCRIPT.some((end) => name.endsWith(end));

/**
 * A tree with every extension at the edge of the rule, at every depth.
 *
 * `.d.ts` is here because it ends in `.ts` and is therefore included — a
 * decision, not an accident, and one worth a cell of its own so that changing
 * it is a change to this file. `.js` and `.json` are here because a walk that
 * reads them would find declarations in a config and report them as source.
 */
const TREE = [
  'plain.ts',
  'module.mts',
  'component.tsx',
  'types.d.ts',
  'script.js',
  'data.json',
  'README.md',
  'no-extension',
  join('nested', 'deeper.ts'),
  join('nested', 'screen.tsx'),
  join('nested', 'notes.md'),
  join('nested', 'below', 'deepest.mts'),
];

let root = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'walker-'));
  for (const path of TREE) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, '// a file\n');
  }
  // An empty directory, which has no files to contribute and must not throw.
  mkdirSync(join(root, 'empty', 'also-empty'), { recursive: true });
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

const walked = (): string[] =>
  sourceFilesUnder(root).map((path) => relative(root, path)).sort();

describe('every file a walker sees', () => {
  it('returns exactly the TypeScript sources, derived from the extension rule', () => {
    // Both halves, because each is silent alone: a walker that returns too
    // little passes an assertion about what it must not return, and one that
    // returns too much passes an assertion about what it must.
    expect(walked()).toEqual(TREE.filter(isSource).sort());
  });

  it('is missing nothing the rule includes', () => {
    const missing = TREE.filter(isSource).filter((path) => !walked().includes(path));

    expect(missing).toEqual([]);
  });

  it('invents nothing the rule excludes', () => {
    const wrong = walked().filter((path) => !isSource(path));

    expect(wrong).toEqual([]);
  });

  it('reads a component as source, which is the whole of why this exists', () => {
    // The cell that goes red the moment somebody writes `.ts` alone again.
    // Named on its own so the failure says which rule was broken rather than
    // printing two long arrays and leaving the reader to diff them.
    expect(walked()).toContain('component.tsx');
    expect(walked()).toContain(join('nested', 'screen.tsx'));
  });

  it('goes as deep as the tree does', () => {
    // A walk that forgot to recurse would still pass every extension assertion
    // above if the top level held one of each.
    const depths = walked().map((path) => path.split(sep).length);

    expect(Math.max(...depths)).toBe(3);
  });

  it('is empty for a directory with nothing in it, and for one that is not there', () => {
    // Not an error, deliberately: the callers hand in a `src` or `tests` path
    // that a workspace may not have, and a throw there stops the audit at the
    // first workspace missing one — which is a check that goes quiet by
    // crashing rather than by passing.
    expect(sourceFilesUnder(join(root, 'empty'))).toEqual([]);
    expect(sourceFilesUnder(join(root, 'no-such-directory'))).toEqual([]);
  });
});
