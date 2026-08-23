import { readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build, type Rollup } from 'vite';
import { blank } from '../../../scripts/lib/source.mjs';

/**
 * The per-language split, asserted against the artifact rather than the intent.
 *
 * The 3D board carried plan text in twenty-two languages until 2026-08-23 —
 * 6,624,622 bytes decoded to a reader of one — and the split that fixed it is
 * held together by two things a future change can undo without noticing.
 *
 * The first is a **static import that defeats a dynamic one**. A module that
 * is statically reachable cannot be moved into a chunk however many `import()`
 * calls point at it, and Rollup says so in a warning nobody reads. That is not
 * a hypothetical: the 2D board next door shipped 8.1 MB for a hundred and
 * twelve commits with exactly that defect, while its docblock and its README
 * both described the split it no longer had.
 *
 * The second is **the load point**. `boot.ts` fetches the language and then
 * imports `main.ts`; a change that imports `main` statically would put the
 * whole board back in the entry, and every test in this app would still pass.
 *
 * Neither is visible to the suite, and the deployment ceilings that do see
 * them only see them *after* a deploy. This builds the thing and looks.
 *
 * What is asserted is the **shape**, plus one ceiling loose enough that only a
 * collapse of the split can cross it — a tight one is a number somebody raises
 * the day it fails.
 */

/** Where Rollup says a dynamic import was defeated by a static one. */
const DEFEATED = 'dynamic import will not move module into another chunk';

/** A word from a plan text that exists in exactly one language. */
const RUSSIAN_PLAN = 'Рождение';
/**
 * And one from the rules book, which no board should carry at all.
 *
 * `Johari` — Harish Johari, whose edition the rules chapters are drawn from —
 * because it appears in `rules.json` and in **none** of the twenty-two plan
 * files. The obvious candidate was `Vaikuntha`, which is what the 2D board's
 * version of this test uses, and it is wrong: `Vaikuntha` is in plan 68's
 * English text. That assertion has never tested the thing its message names;
 * it was fixed there in the same commit as this.
 */
const RULES_ONLY = 'Johari';

async function buildOnce(): Promise<{ warnings: string[]; chunks: Map<string, number>; entry: string }> {
  const outDir = join(tmpdir(), `leela-webgl-bundle-${process.pid}`);
  const warnings: string[] = [];

  await build({
    root: join(import.meta.dirname, '..'),
    logLevel: 'silent',
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        onwarn(warning: Rollup.RollupLog) {
          warnings.push(warning.message ?? String(warning));
        },
      },
    },
  });

  const assets = join(outDir, 'assets');
  const chunks = new Map(
    readdirSync(assets)
      .filter((name) => name.endsWith('.js'))
      .map((name) => [name, statSync(join(assets, name)).size]),
  );

  /**
   * The entry is what `index.html` names, and since the split it is the only
   * file the page names — everything else hangs off it.
   *
   * Read as a document: an asset reference written inside an HTML comment is
   * not an asset the page loads, and the repo-wide sweep in
   * `apps/mobile/tests/source.test.ts` requires the blanking outright. It
   * caught this file the day it was written.
   */
  const page = blank(readFileSync(join(outDir, 'index.html'), 'utf8'), 'html');
  const named = /src="\.\/assets\/([A-Za-z0-9._-]+\.js)"/.exec(page)?.[1] ?? '';

  /**
   * The entry itself is read raw, deliberately.
   *
   * It is minified output with no comments in it, so blanking would change
   * nothing — and the assertions over it are `not.toContain`, which blanking
   * could only ever make *easier* to satisfy. A guard weakened to satisfy a
   * convention is a guard that no longer guards.
   */
  const entry = named === '' ? '' : readFileSync(join(assets, named), 'utf8');

  return { warnings, chunks, entry };
}

/**
 * One build, awaited by every test below.
 *
 * The timeout is generous because a real bundle is built inside it, and under
 * a full run with nine other packages beside it the first test to await pays
 * for the whole build. A bound that fits an idle machine is a bound that fails
 * on a busy one — which this repository has now learned twice.
 */
const built = buildOnce();

describe('the board ships one language, not twenty-two', { timeout: 120_000 }, () => {
  it('gives every language a chunk of its own', async () => {
    const { chunks } = await built;
    const languages = [...chunks.keys()].filter((name) => name.startsWith('plans.'));

    // Twenty-one, because English is static on purpose: it is the catalogue's
    // fallback, and a fallback that has to be fetched is not one.
    expect(languages.length).toBe(21);
    expect(languages.some((name) => name.startsWith('plans.ru-'))).toBe(true);
  });

  it('leaves no dynamic import defeated by a static one', async () => {
    const { warnings } = await built;
    const defeated = warnings.filter((said) => said.includes(DEFEATED));

    expect(defeated, defeated.slice(0, 3).join('\n')).toEqual([]);
  });

  it('keeps the board out of the entry, so the entry is the boot', async () => {
    const { chunks, entry } = await built;

    expect(entry, 'the page named no entry chunk').not.toBe('');
    // `main` is a chunk because `boot.ts` imports it dynamically. If it stops
    // being one, the whole board is in the first request again.
    expect([...chunks.keys()].some((name) => name.startsWith('main-'))).toBe(true);
    // And three.js keeps the chunk it was given in 74b1729.
    expect([...chunks.keys()].some((name) => name.startsWith('three-'))).toBe(true);
  });

  it('carries no plan text but English, and no rules book at all', async () => {
    const { entry } = await built;

    expect(entry).not.toContain(RUSSIAN_PLAN);
    expect(entry, 'the rules book is 1.5 MB of every language').not.toContain(RULES_ONLY);
  });

  it('holds the entry under a bound only a collapsed split could cross', async () => {
    const { chunks, entry } = await built;
    const size = [...chunks.entries()].find(([, bytes]) => bytes === Buffer.byteLength(entry))?.[1];

    // 209,779 bytes on 2026-08-23, of which 208,374 is English. Half a million
    // is loose on purpose: this catches a collapse, and the deployment check's
    // ceilings — measured against the live site — catch the drift.
    expect(size ?? Number.POSITIVE_INFINITY).toBeLessThan(500_000);
  });
});
