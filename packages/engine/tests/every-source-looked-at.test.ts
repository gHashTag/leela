/**
 * A workspace is not only its `src`.
 *
 * `workspaceSources` was written because `audit-unread.mjs` walked a
 * hand-written array of directories and `packages/journal/src` was not in it —
 * so the file format shared by the bot and the mini app was never checked while
 * the audit reported that every export had a caller. Its comment says the fix
 * means "a tenth package cannot be missed the same way".
 *
 * It returned one directory per package, and two workspaces keep sources
 * somewhere else:
 *
 *   - `apps/miniapp/scripts/smoke-run.ts` — the post-deploy check CI runs on
 *     every release, and the only caller of three exports;
 *   - `apps/mobile/index.ts` — the whole of what the phone runs.
 *
 * Neither was looked at. The three exports carried hand-written waivers reading
 * `smoke-run.ts`, naming a file the audit could not see: a waiver that names a
 * file nobody checks is one that outlives the file. Deleting `smoke-run.ts`
 * would have left three dead exports permanently exempt, with the reason still
 * pointing at it. The waivers are gone now, and the audit finds the caller
 * itself — 110 files scanned before, 115 after.
 *
 * These assert the rule rather than those two paths. The made-up trees state
 * what counts as a workspace's source, and the last one asks the repository:
 * for every source file any workspace ships, something is looking at it.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - untyped .mjs, shared with the scripts that use it
import { workspaceSources } from '../../../scripts/lib/claims.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const treeOf = (paths: string[]) => ({
  exists: (path: string) => paths.includes(path) || paths.some((p) => p.startsWith(`${path}/`)),
  isDirectory: (path: string) => paths.some((p) => p.startsWith(`${path}/`)),
  entries: (path: string) => [
    ...new Set(
      paths
        .filter((p) => p.startsWith(`${path}/`))
        .map((p) => p.slice(path.length + 1).split('/')[0] as string),
    ),
  ],
});

describe('what counts as a workspace’s source', () => {
  it('includes another directory of it, beside src', () => {
    const tree = treeOf([
      'apps/miniapp/package.json',
      'apps/miniapp/src/main.ts',
      'apps/miniapp/scripts/smoke-run.ts',
    ]);

    expect(workspaceSources(tree)).toEqual(['apps/miniapp/src', 'apps/miniapp/scripts']);
  });

  it('includes a file at its root, which is where an entry point lives', () => {
    const tree = treeOf([
      'apps/mobile/package.json',
      'apps/mobile/src/App.tsx',
      'apps/mobile/index.ts',
    ]);

    expect(workspaceSources(tree)).toEqual(['apps/mobile/src', 'apps/mobile/index.ts']);
  });

  it('leaves tests out, because several waivers turn on that difference', () => {
    // *Used by its tests* is a real answer and a weaker one than *used by the
    // game*. Folding tests in would turn every one of those waivers into a pass
    // without anybody deciding to.
    const tree = treeOf([
      'packages/engine/package.json',
      'packages/engine/src/index.ts',
      'packages/engine/tests/rules.test.ts',
    ]);

    expect(workspaceSources(tree)).toEqual(['packages/engine/src']);
  });

  it('leaves out what a build left behind', () => {
    const tree = treeOf([
      'apps/docs/package.json',
      'apps/docs/src/build.ts',
      'apps/docs/dist/index.js',
      'apps/docs/coverage/report.ts',
      'apps/docs/node_modules/thing/index.ts',
    ]);

    expect(workspaceSources(tree)).toEqual(['apps/docs/src']);
  });

  it('leaves out a directory holding no source at all', () => {
    const tree = treeOf([
      'apps/miniapp/package.json',
      'apps/miniapp/src/main.ts',
      'apps/miniapp/public/404.html',
    ]);

    expect(workspaceSources(tree)).toEqual(['apps/miniapp/src']);
  });

  it('still refuses a folder that is not a workspace', () => {
    // Unchanged: a directory without a manifest is somebody's scratch space,
    // and widening what a workspace *contains* must not widen what one *is*.
    expect(workspaceSources(treeOf(['packages/notes/scripts/thoughts.ts']))).toEqual([]);
  });
});

describe('this repository, asked directly', () => {
  /** Every source file a workspace ships, tests and build output aside. */
  function shipped(): string[] {
    const skip = new Set(['node_modules', 'dist', 'build', 'coverage', 'tests', '.expo']);
    const found: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (skip.has(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|mjs)$/.test(entry)) found.push(relative(ROOT, full));
      }
    };

    for (const group of ['packages', 'apps']) {
      for (const name of readdirSync(join(ROOT, group))) {
        const workspace = join(ROOT, group, name);
        if (!existsSync(join(workspace, 'package.json'))) continue;
        walk(workspace);
      }
    }

    return found;
  }

  it('has nothing a workspace ships that nothing is looking at', () => {
    // The assertion that would have caught it. `smoke-run.ts` was shipped, run
    // by CI on every release, and outside every path the audit walked.
    const looked: string[] = workspaceSources({
      exists: (path: string) => existsSync(join(ROOT, path)),
      entries: (path: string) => readdirSync(join(ROOT, path)),
      isDirectory: (path: string) => statSync(join(ROOT, path)).isDirectory(),
    });

    const unlooked = shipped().filter(
      (file) => !looked.some((where) => file === where || file.startsWith(`${where}/`)),
    );

    expect(unlooked).toEqual([]);
  });

  it('is looking at more than one path in the workspaces that have more', () => {
    // Otherwise the test above passes on a repository where every workspace
    // happens to keep everything in `src`, which is what it used to assume.
    const looked: string[] = workspaceSources({
      exists: (path: string) => existsSync(join(ROOT, path)),
      entries: (path: string) => readdirSync(join(ROOT, path)),
      isDirectory: (path: string) => statSync(join(ROOT, path)).isDirectory(),
    });

    expect(looked.filter((where) => !where.endsWith('/src')).length).toBeGreaterThan(0);
  });
});
