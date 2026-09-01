/**
 * The same function, written twice, under whatever it was called each time.
 *
 * `audit-doubles` compares the *names* of constants, and says why: two numbers
 * that happen to be 500 are not a duplicate. A function body is the other way
 * round — nobody writes eighty identical characters of logic by coincidence,
 * and the copy is usually made under a different name, which is precisely what
 * makes it invisible to a check that reads names.
 *
 * Two were found by hand, and both were made while *removing* a duplication:
 *
 *   - `within`, the five-second clock the phone's two stores share, copied word
 *     for word into the second of them on the day the second was written;
 *   - `directionFromStatus` in `packages/db` and `directionOf` in
 *     `packages/engine` — one switch under two names, left behind when the rule
 *     moved and called by nothing afterwards.
 *
 * The second is the shape worth naming. It was **dead in one file and live in
 * the other**, and neither audit could see it: `audit-unread` reads exports and
 * fields, and a private function is neither; `audit-doubles` read names, and
 * the names differed.
 *
 * These assert the rule against made-up sources, and then ask this repository
 * whether it holds one now.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - untyped .mjs, shared with the script that uses it
import { A_FUNCTION, functionsIn, repeated } from '../../../scripts/lib/doubles.mjs';
// @ts-expect-error - untyped .mjs
import { workspacePackages } from '../../../scripts/lib/claims.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** A body long enough to be an idea rather than a shape. */
const AN_IDEA = `{
  const kept = value.filter((one) => one.plan >= 1 && one.plan <= 72);
  const order = [...kept].sort((a, b) => a.at - b.at);
  return { entries: order, dropped: value.length - kept.length };
}`;

const source = (name: string, body = AN_IDEA) => `export function ${name}(value) ${body}`;

const found = (files: Array<[string, string]>) =>
  repeated(files.flatMap(([file, text]) => functionsIn(text, file)));

describe('a function written in more than one place', () => {
  it('is reported however differently the two were named', () => {
    // The shape. A check reading names finds nothing here, which is how the
    // real one lived in two packages for two passes.
    const copies = found([
      ['packages/db/src/legacy.ts', source('directionFromStatus')],
      ['packages/engine/src/published.ts', source('directionOf')],
    ]);

    expect(copies).toHaveLength(1);
    expect(copies[0]?.names.sort()).toEqual(['directionFromStatus', 'directionOf']);
    expect(copies[0]?.renamed).toBe(true);
  });

  it('is reported when the two kept the same name', () => {
    const copies = found([
      ['apps/mobile/src/journal.ts', source('within')],
      ['apps/mobile/src/game-store.ts', source('within')],
    ]);

    expect(copies).toHaveLength(1);
    expect(copies[0]?.renamed).toBe(false);
  });

  it('is one copy however differently the two were commented', () => {
    // A copy explained twice is still a copy, and the explanations are usually
    // where the two first start to disagree.
    const copies = found([
      ['a/one.ts', `/** Read a path. */\n${source('read')}`],
      [
        'b/two.ts',
        `// Read a path — the same rule, said again.\nexport function read(value) ${AN_IDEA.replace(
          'const kept',
          '// the squares that are on the board\n  const kept',
        )}`,
      ],
    ]);

    expect(copies).toHaveLength(1);
  });

  it('is not a function that merely resembles another', () => {
    const copies = found([
      ['a/one.ts', source('read')],
      ['b/two.ts', source('read').replace('a.at - b.at', 'b.at - a.at')],
    ]);

    expect(copies).toEqual([]);
  });

  it('is not a shape short enough to be written twice by anyone', () => {
    // A one-line getter is not an idea, and a check that flags them is a check
    // somebody turns off.
    const small = '{ return value.plan; }';
    expect(small.length).toBeLessThan(A_FUNCTION);

    expect(
      found([
        ['a/one.ts', source('planOf', small)],
        ['b/two.ts', source('squareOf', small)],
      ]),
    ).toEqual([]);
  });

  it('is not one function counted twice inside a file', () => {
    // The subject is a copy that crossed a module boundary. A file that
    // declares something once is not a duplicate of itself.
    expect(found([['a/one.ts', `${source('read')}\n${source('read')}`]])).toEqual([]);
  });
});

describe('this repository, asked directly', () => {
  it('writes each of its functions once', () => {
    // The live assertion. Both real copies were made while removing another
    // duplication, which is when nobody is looking for one.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) files.push(full);
      }
    };

    for (const workspace of workspacePackages({
      exists: (path: string) => existsSync(join(ROOT, path)),
      entries: (path: string) => readdirSync(join(ROOT, path)),
      isDirectory: (path: string) => statSync(join(ROOT, path)).isDirectory(),
    }) as Array<{ src: string }>) {
      walk(join(ROOT, workspace.src));
    }

    const copies = repeated(
      files.flatMap((file) => functionsIn(readFileSync(file, 'utf8'), relative(ROOT, file))),
    ) as Array<{ names: string[]; where: Array<{ file: string }> }>;

    expect(
      copies.map((copy) => `${copy.names.join(' / ')} in ${copy.where.map((one) => one.file).join(', ')}`),
    ).toEqual([]);
  });
});
