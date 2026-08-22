/**
 * The deployment check did not look at the game's code.
 *
 * `smoke.ts` opens by naming the failure it exists for: *`actions/deploy-pages`
 * reports success when the upload succeeded, which is not the same as the game
 * being playable. **A build that emits a broken asset path**, or a book whose
 * pages did not make it into the artifact, deploys green.*
 *
 * Five checks were written by hand — the game's HTML, the book's index, a plan
 * deep in it, the book's stylesheet, a legal document. Fetched from the live
 * site, the game's page references exactly two files:
 *
 *     ./assets/index-pd0t01pZ.js
 *     ./assets/index-BTH6tunC.css
 *
 * Neither was checked, and neither could be: Vite puts a content hash in the
 * name, so both are different files on every build and a hand-written list
 * cannot hold them. So the one failure the module names first was the one it
 * did not look for — and it would have passed. `index.html` still contains
 * `id="board"` and `telegram-web-app.js` when the bundle beside it is a 404,
 * and the player is looking at a blank screen.
 *
 * The page says what it needs. These assert that it is asked: whatever the
 * build names its assets, every one of them is fetched and judged.
 */

import { describe, expect, it } from 'vitest';
import {
  allPassed,
  assetProblems,
  assetsIn,
  describeResults,
  runChecks,
  type Check,
  type Fetcher,
} from '../src/smoke';

// The root page is the 3D board now; what varies below is what it names.
const GAME = (assets: string[]) =>
  `<!doctype html><html lang="en"><head><title>Leela — the board in three dimensions</title>` +
  `<script src="https://telegram.org/js/telegram-web-app.js"></script>` +
  assets
    .map((asset) =>
      asset.endsWith('.css')
        ? `<link rel="stylesheet" href="${asset}">`
        : `<script type="module" src="${asset}"></script>`,
    )
    .join('') +
  `</head><body><canvas id="board"></canvas>` +
  // Long enough to be a page rather than a stub: the board's own check asks
  // for at least 500 bytes, and a fixture under that never reaches the assets.
  `<!--${'p'.repeat(600)}--></body></html>`;

/**
 * Just enough of a site for the other hand-written checks to pass.
 *
 * The classic board is healthy and constant — its page names one asset and
 * that asset answers — so every verdict below is about the root page, whose
 * references are what each test varies.
 */
const SITE: Record<string, string> = {
  'classic/': (
    `<title>Leela</title><script src="https://telegram.org/js/telegram-web-app.js"></script>` +
    `<script type="module" src="./assets/classic-ok.js"></script>` +
    `<div id="board"></div>${'x'.repeat(600)}`
  ),
  'classic/assets/classic-ok.js': `console.log(1)${'y'.repeat(2000)}`,
  'docs/': `<html>Leela <a href="ru/">ru</a>${'x'.repeat(600)}</html>`,
  'docs/ru/plans/1.html': `<h1>Рождение</h1>${'x'.repeat(1600)}`,
  'docs/style.css': `--measure: 60ch;${'x'.repeat(600)}`,
  'docs/en/legal/policy.html': `Privacy${'x'.repeat(900)}`,
};

/** A site whose game page names `assets`, each served by `serve`. */
function siteWith(assets: string[], serve: (path: string) => { status: number; text: string }) {
  const asked: string[] = [];

  const fetcher: Fetcher = async (url) => {
    const path = url.replace('https://site/', '');
    asked.push(path);

    if (path === '') return { status: 200, text: GAME(assets) };
    if (path in SITE) return { status: 200, text: SITE[path] as string };
    return serve(path);
  };

  return { fetcher, asked };
}

const good = (path: string) => ({
  status: 200,
  text: path.endsWith('.css') ? `.board{}${'y'.repeat(400)}` : `console.log(1)${'y'.repeat(2000)}`,
});

describe('the assets the deployed page asks for', () => {
  it('are read out of the page, whatever the build called them', () => {
    // The shape. A hand-written list cannot name a content hash, which is why
    // there was no list.
    expect(assetsIn(GAME(['./assets/index-abc123.js', './assets/index-def456.css']))).toEqual([
      'assets/index-abc123.js',
      'assets/index-def456.css',
    ]);
  });

  it('do not include somebody else\'s server', () => {
    // `telegram-web-app.js` being down is not this deployment being broken, and
    // failing a deploy over it would teach an operator to ignore the check.
    //
    // The fixture carries one local asset on purpose. This line used to read
    // `assetsIn(GAME([]))` — a page with no local assets at all — so it proved
    // the Telegram script was dropped and, in the same breath and invisibly,
    // froze *a page naming none of its own files is a normal page*. Every
    // reference has to survive or be dropped for its own reason, which needs
    // one of each in the page.
    expect(assetsIn(GAME(['./assets/index-ok.js']))).toEqual(['assets/index-ok.js']);
  });

  it("name the page's own files even when it never says './'", () => {
    // Vite writes `./assets/...`; a hand-edited page or another bundler may
    // write `assets/...`. Both are read from the page's own directory.
    expect(assetsIn(GAME(['assets/index-bare.js']))).toEqual(['assets/index-bare.js']);
  });

  it('do not turn a reference to the site root into a reference to this page', () => {
    // The failure that made this file's opening sentence false a second time.
    // `/assets/index-abc.js` is *this* deployment's file asked for from the
    // origin: a page at `https://site/leela/` sends the browser to
    // `https://site/assets/index-abc.js`. The old reader accepted the leading
    // slash and then stripped it, so the checker fetched it back under
    // `https://site/leela/` — the one URL the browser was never going to ask
    // for — and reported 200. It is not one of the page's own assets.
    expect(assetsIn(GAME(['/assets/index-abc.js']))).toEqual([]);
    expect(assetProblems(GAME(['/assets/index-abc.js']))).toEqual(['/assets/index-abc.js']);

    // And it is not confused with the two references that are fine.
    expect(assetProblems(GAME(['./assets/index-ok.js']))).toEqual([]);
  });

  it('are every one of them fetched', async () => {
    const assets = ['./assets/a-1.js', './assets/b-2.css', './assets/c-3.js'];
    const { fetcher, asked } = siteWith(assets, good);

    await runChecks('https://site/', fetcher);

    for (const asset of assets) {
      expect(asked, `${asset} was never asked for`).toContain(asset.replace('./', ''));
    }
  });

  it('fail the deployment when one of them is not there', async () => {
    const { fetcher } = siteWith(['./assets/index-gone.js'], () => ({ status: 404, text: 'Not Found' }));

    const results = await runChecks('https://site/', fetcher);

    expect(allPassed(results)).toBe(false);
    expect(results.find((one) => one.check.path === 'assets/index-gone.js')?.ok).toBe(false);
  });

  it('fail when the host hands back the page instead of the file', async () => {
    // The failure a status and a size cannot see. A static host that falls back
    // to `index.html` answers 200 with something long, and the browser then
    // refuses to run HTML as a module — a blank screen behind a green deploy.
    const { fetcher } = siteWith(['./assets/index-missing.js'], () => ({
      status: 200,
      text: GAME(['./assets/index-missing.js']),
    }));

    const results = await runChecks('https://site/', fetcher);
    const asset = results.find((one) => one.check.path === 'assets/index-missing.js');

    expect(allPassed(results)).toBe(false);
    expect(asset?.instead).toContain('<!doctype html');
  });

  it('fail when a bundle comes back as a few bytes of nothing', async () => {
    const { fetcher } = siteWith(['./assets/index-empty.js'], () => ({ status: 200, text: '' }));

    expect(allPassed(await runChecks('https://site/', fetcher))).toBe(false);
  });

  it('pass a deployment where the page and everything it names are there', async () => {
    // Otherwise every assertion above is satisfied by failing always.
    const { fetcher } = siteWith(['./assets/index-ok.js', './assets/index-ok.css'], good);

    const results = await runChecks('https://site/', fetcher);

    expect(allPassed(results)).toBe(true);
    // Six hand-written, two generated from the root page, one generated from
    // the classic board's.
    expect(results).toHaveLength(9);
  });

  it('fail a page that names none of its own files', async () => {
    // Five hand-written checks read a title, an element id and a byte count,
    // and a shell has all three. The asset checks are generated from the page,
    // so a page naming no assets generates none of them, and the run passes on
    // five green lines about a page that loads nothing at all.
    const { fetcher } = siteWith([], good);

    const results = await runChecks('https://site/', fetcher);

    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toMatch(/names no asset of its own/);
  });

  it("do not fetch a root-absolute reference back under the page's own base", async () => {
    // The whole of the defect in one assertion. `/assets/root-abc.js` from a
    // page at `https://site/leela/` is a request to `https://site/`; a checker
    // that strips the slash asks `https://site/leela/assets/root-abc.js`,
    // which exists, and calls the deployment healthy.
    const { fetcher, asked } = siteWith(['/assets/root-abc.js'], good);

    const results = await runChecks('https://site/', fetcher);

    expect(asked.some((path) => path.includes('root-abc.js'))).toBe(false);
    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toMatch(/site root/);
  });

  it('do not go looking for assets when the page itself did not come back', async () => {
    // Nothing to read the names out of, and the page's own failure is already
    // reported. A second failure about a file nobody named is noise.
    const asked: string[] = [];
    const fetcher: Fetcher = async (url) => {
      asked.push(url);
      return { status: 500, text: 'nope' };
    };

    const results = await runChecks('https://site/', fetcher, [
      { path: '', what: 'the game', mustContain: ['id="board"'], ownAssets: true } as Check,
    ]);

    expect(results).toHaveLength(1);
    expect(asked).toEqual(['https://site/']);
  });
});

/**
 * The verdict over the whole grid, rather than over the cases we thought of.
 *
 * Six pages, built from every combination of *how many of its own files the
 * page names* and *whether it also names one from the site root*. Nothing here
 * lists a bad string: what is asserted is that the verdict is a function of
 * those two facts, and of nothing else. A page passes exactly when it names at
 * least one file it can reach and none it cannot — so the two kinds of nothing
 * are told apart from each other and from a healthy page, whatever the build
 * happens to have called the files.
 *
 * A page naming one root-absolute asset and one relative one is a real build:
 * `base: '/'` rewrites both, but a stylesheet written by hand into `index.html`
 * does not move. It fails here for the reference it cannot reach, not for the
 * one it can.
 */
describe('what the page names decides the verdict', () => {
  const OWN = ['./assets/one.js', './assets/two.css'];
  const FROM_ROOT = '/assets/root-abc.js';

  for (const own of [0, 1, 2]) {
    for (const fromRoot of [0, 1]) {
      const named = [...OWN.slice(0, own), ...(fromRoot === 1 ? [FROM_ROOT] : [])];
      const reachable = own > 0;
      const wellFormed = fromRoot === 0;

      it(`names ${own} of its own and ${fromRoot} from the site root`, async () => {
        const { fetcher, asked } = siteWith(named, good);

        const results = await runChecks('https://site/', fetcher);
        const report = describeResults(results);

        expect(allPassed(results), report).toBe(reachable && wellFormed);

        // Each bad kind is named, and only when it is the kind that is wrong.
        expect(/names no asset of its own/.test(report), report).toBe(!reachable);
        expect(/site root/.test(report), report).toBe(!wellFormed);

        // Every file the page can reach is still fetched, and the one it
        // cannot is never re-rooted into a URL that answers.
        for (const asset of OWN.slice(0, own)) {
          expect(asked, `${asset} was never asked for`).toContain(asset.replace('./', ''));
        }
        expect(asked.some((path) => path.includes('root-abc.js'))).toBe(false);
      });
    }
  }
});
