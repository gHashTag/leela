import { describe, expect, it } from 'vitest';
import {
  DEPLOYMENT_CHECKS,
  allPassed,
  describeResults,
  runCheck,
  runChecks,
  type Fetcher,
} from '../src/smoke';

/** A site that serves whatever it is given, by path. */
function siteServing(pages: Record<string, string>): Fetcher {
  return async (url: string) => {
    const path = url.replace('https://example.test/', '');
    const text = pages[path];
    return text === undefined ? { status: 404, text: '' } : { status: 200, text };
  };
}

/**
 * A whole site where every check passes.
 *
 * Both boards' pages name an asset of their own, and the root's did not
 * always. It was a title, a board and the Telegram script — a page that loads
 * no code of its own — and every check in this file passed on it, because the
 * run expands an app's page into one check per asset and a page with no
 * assets expands into nothing. So the fixture for *healthy* was a blank
 * screen, and the assertion that the healthy site passes was also, silently,
 * an assertion that a page naming none of its own files is acceptable. The
 * assets are here so that `allPassed` on this fixture means what its name
 * says — for the 3D board at the root and for the 2D board under `classic/`
 * alike.
 */
const PAGES: Record<string, string> = {
  '': (
    '<title>Leela — the board in three dimensions</title><canvas id="board"></canvas>' +
    '<script type="module" src="./assets/index-3d.js"></script>'
  ).padEnd(600, ' '),
  'assets/index-3d.js': 'console.log(1)'.padEnd(2000, ' '),
  'classic/': (
    '<title>Leela</title><div id="board"></div><script src="telegram-web-app.js"></script>' +
    '<script type="module" src="./assets/index-ok.js"></script>'
  ).padEnd(600, ' '),
  'classic/assets/index-ok.js': 'console.log(1)'.padEnd(2000, ' '),
  'docs/': 'Leela <a href="ru/">Русский</a>'.padEnd(600, ' '),
  'docs/ru/plans/1.html': '<h1>1. Рождение (джанма)</h1>'.padEnd(2000, ' '),
  'docs/style.css': ':root { --measure: 34rem; }'.padEnd(600, ' '),
  'docs/en/legal/policy.html': '<h1>Privacy policy</h1>'.padEnd(900, ' '),
};

const healthy = siteServing(PAGES);

describe('a healthy deployment passes', () => {
  it('passes every check', async () => {
    const results = await runChecks('https://example.test', healthy);
    expect(describeResults(results)).not.toMatch(/FAIL/);
    expect(allPassed(results)).toBe(true);
  });

  it('tolerates a trailing slash on the base URL', async () => {
    expect(allPassed(await runChecks('https://example.test/', healthy))).toBe(true);
  });
});

describe('each way a deployment can be broken is caught', () => {
  // The point is that deploy-pages reports success on all of these.

  it('a page that is not there at all', async () => {
    const results = await runChecks('https://example.test', siteServing({}));
    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toContain('status 404');
  });

  it('a shell that served but carries none of the content', async () => {
    const empty = siteServing({
      ...pagesOf(healthy),
      'docs/ru/plans/1.html': '<h1>Placeholder</h1>'.padEnd(2000, ' '),
    });
    const results = await runChecks('https://example.test', empty);
    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toMatch(/missing: Рождение/);
  });

  it('a page truncated to almost nothing', async () => {
    const truncated = siteServing({ ...pagesOf(healthy), 'docs/ru/plans/1.html': '<h1>Рождение</h1>' });
    const results = await runChecks('https://example.test', truncated);
    expect(describeResults(results)).toMatch(/only \d+b, expected at least/);
  });

  it('a network failure, without throwing', async () => {
    const offline: Fetcher = async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    };
    const results = await runChecks('https://example.test', offline);
    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toContain('ENOTFOUND');
  });

  it('the app HTML without its board, which is a build that emitted a shell', async () => {
    const shell = siteServing({
      ...pagesOf(healthy),
      '': '<title>Leela — the board in three dimensions</title>'.padEnd(600, ' '),
    });
    const results = await runChecks('https://example.test', shell);
    expect(describeResults(results)).toMatch(/missing: id="board"/);
  });

  it('the 2D app still at the root, which is the old layout deployed over the new', async () => {
    // Everything the root check used to ask for is on this page — a title, the
    // board, the Telegram script — so only a fragment unique to the 3D entry
    // can tell a stale deployment from a live one.
    const stale = siteServing({ ...pagesOf(healthy), '': pagesOf(healthy)['classic/'] as string });
    const results = await runChecks('https://example.test', stale);
    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toMatch(
      /missing: <title>Leela — the board in three dimensions<\/title>/,
    );
  });

  it('the classic board gone, which is a copy step that did not run', async () => {
    const pages = pagesOf(healthy);
    delete pages['classic/'];
    delete pages['classic/assets/index-ok.js'];
    const results = await runChecks('https://example.test', siteServing(pages));
    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toMatch(/FAIL\s+the classic 2D board/);
  });

  it("the classic page whose bundle did not survive the copy", async () => {
    // `classic/` is a directory copied into the artifact, so its page can
    // arrive intact while `classic/assets/` does not — and the page alone
    // passes every fragment the hand-written check asks for.
    const pages = pagesOf(healthy);
    delete pages['classic/assets/index-ok.js'];
    const results = await runChecks('https://example.test', siteServing(pages));
    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toMatch(/\/classic\/assets\/index-ok\.js/);
  });
});

describe('the report', () => {
  it('runs every check rather than stopping at the first failure', async () => {
    const results = await runChecks('https://example.test', siteServing({}));
    expect(results).toHaveLength(DEPLOYMENT_CHECKS.length);
  });

  it('names what broke and where', async () => {
    const results = await runChecks('https://example.test', siteServing({}));
    const text = describeResults(results);
    for (const check of DEPLOYMENT_CHECKS) {
      expect(text, check.what).toContain(check.what);
      expect(text).toContain(`/${check.path}`);
    }
  });

  it('reports sizes when things pass, so a shrinking page is visible', async () => {
    expect(describeResults(await runChecks('https://example.test', healthy))).toMatch(/ok\s+.*\d+b/);
  });
});

describe('the checks themselves', () => {
  it('covers both boards, the book, a plan, the stylesheet and the legal page', () => {
    const paths = DEPLOYMENT_CHECKS.map((check) => check.path);
    expect(paths).toContain('');
    expect(paths).toContain('classic/');
    expect(paths).toContain('docs/');
    expect(paths.some((p) => p.includes('plans/'))).toBe(true);
    expect(paths.some((p) => p.endsWith('.css'))).toBe(true);
    expect(paths.some((p) => p.includes('legal/'))).toBe(true);
  });

  it('expands both boards into checks on their own assets, not just the root', () => {
    // The classic board is the page whose bundle a bad copy step loses; an
    // expansion wired to `path === ''` would never look.
    const expanded = DEPLOYMENT_CHECKS.filter((check) => check.ownAssets).map((check) => check.path);
    expect(expanded).toEqual(['', 'classic/']);
  });

  it('gives every check something to assert beyond a 200', () => {
    // A 200 proves a file exists, not that it is the file we meant to ship.
    for (const check of DEPLOYMENT_CHECKS) {
      const asserts = (check.mustContain?.length ?? 0) > 0 || (check.minBytes ?? 0) > 0;
      expect(asserts, check.what).toBe(true);
    }
  });
});

describe('runCheck', () => {
  it('returns a result rather than throwing on a bad URL', async () => {
    const result = await runCheck('https://example.test', DEPLOYMENT_CHECKS[0], async () => {
      throw new TypeError('fetch failed');
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('fetch failed');
  });
});

/**
 * The pages a fetcher serves, so a test can vary one of them.
 *
 * It used to be a second copy of the same object literal, which meant a page
 * added to the healthy site was a page missing from every broken-site test
 * built on top of it. One source now; the parameter is kept because it is how
 * the call sites read.
 */
function pagesOf(_fetcher: Fetcher): Record<string, string> {
  return { ...PAGES };
}
