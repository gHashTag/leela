import { describe, expect, it } from 'vitest';
import {
  DEPLOYMENT_CHECKS,
  allPassed,
  assetCheck,
  describeResults,
  runCheck,
  runChecks,
  type Check,
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

/**
 * The size the report prints, and the unit it is printed in.
 *
 * `text.length` counts UTF-16 code units, this file called the number `bytes`
 * and printed it as `b`, and nothing ever noticed — because the fixtures were
 * ASCII, where the two agree exactly. The live board is not ASCII: its 22
 * languages include Devanagari, Cyrillic, Arabic, Tamil and Chinese, and the
 * one number the bundle-weight work is aimed at was understated by 41 per
 * cent. A test with an ASCII fixture cannot catch this, which is why the
 * fixtures below are deliberately not ASCII.
 */
describe('the size a check reports', () => {
  const check = { path: 'sized', what: 'a sized thing' };

  async function sizeOf(text: string, transferred?: number) {
    const fetcher: Fetcher = async () => ({ status: 200, text, transferred });
    return runCheck('https://example.test', check, fetcher);
  }

  it('counts bytes, not characters, in every script the board speaks', async () => {
    const cases: Array<[string, string, number]> = [
      ['ascii', 'roll', 4],
      ['cyrillic', 'бросьте', 14],
      ['devanagari', 'योजना', 15],
      ['arabic', 'خطة', 6],
      // Outside the basic plane: one character, two UTF-16 units, four bytes.
      ['beyond the plane', '𑀔', 4],
    ];

    const said = [];
    for (const [what, text, bytes] of cases) {
      const result = await sizeOf(text);
      said.push([what, result.bytes, bytes]);
    }

    expect(said.map(([what, got]) => `${what}: ${got}`)).toEqual(
      said.map(([what, , want]) => `${what}: ${want}`),
    );
  });

  it('holds the floor against real bytes, so a threshold can only get stricter', async () => {
    // Seven characters of Cyrillic are fourteen bytes: a floor of ten passes
    // now and failed when the count was characters.
    const result = await runCheck(
      'https://example.test',
      { ...check, minBytes: 10 },
      async () => ({ status: 200, text: 'бросьте' }),
    );

    expect(result.bytes).toBe(14);
    expect(result.ok).toBe(true);
  });

  it('says what crossed the wire beside what arrived, when the two differ', async () => {
    const compressed = await sizeOf('бросьте', 9);
    expect(describeResults([compressed])).toContain('14b (9b on the wire)');

    // And says it once when there is nothing to compare: a host that does not
    // compress, or does not say, must not print the same number twice.
    expect(describeResults([await sizeOf('бросьте', 14)])).toContain('14b');
    expect(describeResults([await sizeOf('бросьте', 14)])).not.toContain('on the wire');
    expect(describeResults([await sizeOf('бросьте')])).not.toContain('on the wire');
  });
});

/**
 * The ceiling, which is the guard this project actually needed.
 *
 * A floor catches a build that shipped nothing. Nothing caught the opposite,
 * and the opposite is what happened: the 3D board's entry grew to 6.6 MB of
 * which almost all is plan text in languages the reader cannot read, and it
 * was found by measuring rather than by the build going red.
 */
describe('the size a check refuses', () => {
  const under = { path: 'a', what: 'a thing', maxBytes: 10 };

  it('fails a response over the ceiling and says by how much', async () => {
    const fat = await runCheck('https://example.test', under, async () => ({
      status: 200,
      text: 'ерунда лишняя',
    }));

    expect(fat.ok).toBe(false);
    expect(describeResults([fat])).toContain('over the 10 ceiling');
  });

  it('passes a response at the ceiling exactly', async () => {
    const exact = await runCheck('https://example.test', under, async () => ({
      status: 200,
      text: 'абвгд',
    }));

    expect(exact.bytes).toBe(10);
    expect(exact.ok).toBe(true);
  });

  it('gives the page’s code files its ceiling, and its stylesheets none', async () => {
    const page = { path: '', what: 'the board', maxAssetBytes: 42 };

    expect(assetCheck('assets/index-abc.js', page).maxBytes).toBe(42);
    expect(assetCheck('assets/index-abc.css', page).maxBytes).toBeUndefined();
    // A page that names no ceiling hands none down, so nothing gains a limit
    // by accident.
    expect(assetCheck('assets/index-abc.js', { path: '', what: 'x' }).maxBytes).toBeUndefined();
  });

  it('holds the live board to the ceiling it ships with', () => {
    // Asserted so that moving the ceiling is a deliberate edit with a test
    // beside it. The measured target for after specs/006 is 400,000.
    const board = DEPLOYMENT_CHECKS.find((check) => check.what === 'the 3D board');

    expect(board?.maxAssetBytes).toBe(7_000_000);
    expect(assetCheck('assets/index-x.js', board as Check).maxBytes).toBe(7_000_000);
  });
});
