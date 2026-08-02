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
import { allPassed, assetsIn, runChecks, type Check, type Fetcher } from '../src/smoke';

const GAME = (assets: string[]) =>
  `<!doctype html><html lang="en"><head><title>Leela</title>` +
  `<script src="https://telegram.org/js/telegram-web-app.js"></script>` +
  assets
    .map((asset) =>
      asset.endsWith('.css')
        ? `<link rel="stylesheet" href="${asset}">`
        : `<script type="module" src="${asset}"></script>`,
    )
    .join('') +
  `</head><body><div id="board"></div>` +
  // Long enough to be a page rather than a stub: the game's own check asks for
  // at least 500 bytes, and a fixture under that never reaches the assets.
  `<!--${'p'.repeat(600)}--></body></html>`;

/** Just enough of a site for the five hand-written checks to pass. */
const SITE: Record<string, string> = {
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
    expect(assetsIn(GAME([]))).toEqual([]);
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
    expect(results).toHaveLength(7);
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
      { path: '', what: 'the game', mustContain: ['id="board"'] } as Check,
    ]);

    expect(results).toHaveLength(1);
    expect(asked).toEqual(['https://site/']);
  });
});
