import { readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build, type Rollup } from 'vite';
import { blank } from '../../../scripts/lib/source.mjs';

/**
 * The per-language split, asserted against the artifact rather than the intent.
 *
 * `content.ts` fetches one language as its own chunk, and said so in a docblock
 * for a hundred and twelve commits while the shipped bundle was **8.1 MB** —
 * every one of the twenty-two dynamic imports defeated by three value imports
 * of `@leela/content` in `browse.ts`, because a module that is statically
 * reachable cannot be split out however many dynamic imports point at it.
 * `apps/miniapp/README.md` published a table promising a 368 kB first load. The
 * artifact was larger than the number that table calls the *before*.
 *
 * Nothing noticed, and nothing could have: the docblock, the README and the
 * build's own chunk-size warning are three ways of stating an intention, and
 * `smoke.ts` asserts only that the file is at least 500 bytes. **Nobody
 * rechecks a number that is already written down**, which is exactly why the
 * check has to build the thing and look.
 *
 * What is asserted is the *shape* — the split is engaged — and not a byte
 * ceiling somebody would raise the day it failed. A ceiling is here too, but
 * loose enough that only a collapse of the split can cross it.
 */

/** Where rollup tells you a dynamic import was defeated. */
const DEFEATED = 'dynamic import will not move module into another chunk';

async function buildOnce(): Promise<{
  warnings: string[];
  chunks: Map<string, number>;
  /**
   * The emitted `index.html` — what a browser is actually served, with its
   * comments blanked out.
   */
  html: string;
}> {
  const outDir = join(tmpdir(), `leela-bundle-${process.pid}`);
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
   * Read as a document, not as text: an asset reference written inside an HTML
   * comment is not an asset the page loads, and the check below — which stands
   * in for the deploy verifier that reads the emitted page — must not count
   * one. Blanked rather than stripped, so the offsets in the failure message
   * are the offsets in the file.
   */
  const html = blank(readFileSync(join(outDir, 'index.html'), 'utf8'), 'html');

  return { warnings, chunks, html };
}

/**
 * A reference to somewhere that is not this deployment.
 *
 * `https://telegram.org/js/telegram-web-app.js`, `mailto:`, a `data:` URI, and
 * the protocol-relative `//cdn/...`. Whether they work is not this build's
 * business. Everything else is a path this build emitted, and this build is
 * responsible for where it points.
 */
function isSomebodyElses(reference: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith('//');
}

/**
 * One build, awaited by every test below it — including the one in the second
 * `describe`, which is why it is out here rather than inside the first.
 */
const built = buildOnce();

/**
 * The bound is generous because a real bundle is built inside it.
 *
 * `buildOnce` is shared, so whichever test awaits it first pays for the build —
 * and under `bun run verify`, with nine other packages running beside it, that
 * first one timed out at the default five seconds while passing on its own.
 * The same shape has bitten the play-through tests twice; the cost is a build,
 * not a hang, and a bound that fits an idle machine is a bound that fails on a
 * busy one.
 */
describe('the mini app ships one language, not twenty-two', { timeout: 120_000 }, () => {
  it('splits every language into its own chunk', async () => {
    const { chunks } = await built;
    const languages = [...chunks.keys()].filter((name) => name.startsWith('plans.'));

    // One chunk per language. Fewer means some were folded back into the entry,
    // which is precisely how this broke: it went from 22 to 0 in one commit.
    expect(languages.length).toBeGreaterThan(1);
  });

  it('leaves no dynamic import defeated by a static one', async () => {
    const { warnings } = await built;
    const defeated = warnings.filter((message) => message.includes(DEFEATED));

    // The build says this itself, once per language, and said it twenty-two
    // times a night for months into a log nobody read.
    expect(defeated, defeated.slice(0, 3).join('\n')).toEqual([]);
  });

  it('keeps the first load to the app rather than to the library', async () => {
    const { chunks } = await built;
    const entry = [...chunks].find(([name]) => name.startsWith('index-'));

    expect(entry, 'no entry chunk was emitted').toBeDefined();

    // Half a megabyte, against an entry that is ~94 kB today and was 8,147 kB
    // before the split was repaired. Deliberately loose: a ceiling close to the
    // real size is one that fails on an honest feature and gets raised, and a
    // ceiling that gets raised is not a ceiling. Only the split collapsing —
    // one language's worth of text landing in the entry — can cross this.
    expect(entry?.[1] ?? Infinity).toBeLessThan(500_000);
  });

  it('does not carry a plan text in the entry chunk', async () => {
    // The byte count says how much; this says what. `readdirSync` cannot tell a
    // large entry from a large app, but a Russian plan title in the entry can
    // only have come from the dataset.
    const { chunks } = await built;
    const outDir = join(tmpdir(), `leela-bundle-${process.pid}`, 'assets');
    const entry = [...chunks.keys()].find((name) => name.startsWith('index-'));
    const text = readdirSync(outDir).includes(entry ?? '')
      ? (await import('node:fs')).readFileSync(join(outDir, entry as string), 'utf8')
      : '';

    expect(text).not.toContain('Рождение');
    // `Johari` — Harish Johari, whose edition the rules chapters come from —
    // and not `Vaikuntha`, which this line used to name. `Vaikuntha` is in
    // plan 68's English text and in no rules chapter at all, so the assertion
    // passed on a bundle carrying English plans and would have passed on one
    // carrying the whole rules book. A guard whose message names something it
    // does not test is a guard that reads as coverage.
    expect(text, 'the rules book is 1.5 MB of every language').not.toContain('Johari');
  });
});

/**
 * Where the emitted page tells the browser to look for the emitted files.
 *
 * One line in `vite.config.ts` decides it — `base: './'` — and nothing held
 * it. Grep for `vite.config` across this directory and there was no hit; the
 * tests above build the app and read chunk *names*, never the `index.html`
 * that names them. Delete the line and Vite falls back to its default `/`,
 * every reference in the page becomes `/assets/index-abc.js`, and the app
 * still builds, still splits, still passes every assertion in this file.
 *
 * The site is served from a subdirectory — GitHub Pages from `/<repo>/`, the
 * custom host from `/leela/` — so a browser on `https://t27.ai/leela/` reads
 * `/assets/index-abc.js` as `https://t27.ai/assets/index-abc.js`, gets a 404,
 * and shows a blank board. The deploy verifier did not see it either: it
 * stripped the leading slash and fetched the file back under the base it was
 * handed, which answers 200. So the failure `smoke.ts` opens by naming — *a
 * build that emits a broken asset path deploys green* — was invisible to the
 * build, to the tests and to the check written for exactly that failure.
 *
 * What is asserted is the shape, not a filename and not a hash: whatever the
 * build emits, every reference that is this deployment's own is written
 * relative to the page. `base: '/'` fails this on the first reference it
 * reaches.
 */
describe('the emitted page asks for the files beside it', { timeout: 120_000 }, () => {
  it('writes every reference of its own relative to the page', async () => {
    const { html } = await built;
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1] as string);
    const own = references.filter((reference) => !isSomebodyElses(reference));

    // Otherwise a page that references nothing satisfies this by vacancy —
    // the same hole this pass closed in the deploy verifier.
    expect(own.length, `no local references in the emitted page:\n${html}`).toBeGreaterThan(0);

    for (const reference of own) {
      expect(
        reference.startsWith('./'),
        `${reference} is resolved against the site root, not against the page; ` +
          `served from a subdirectory the browser asks the origin for it`,
      ).toBe(true);
    }
  });
});
