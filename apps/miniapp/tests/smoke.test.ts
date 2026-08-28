import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEPLOYMENT_CHECKS,
  allPassed,
  assetCheck,
  chunksIn,
  eagerChunksIn,
  describeResults,
  readerCost,
  runCheck,
  runChecks,
  type Check,
  type CheckResult,
  type Fetcher,
} from '../src/smoke';

/**
 * The 404 document this repository ships, read rather than invented.
 *
 * A fixture 404 written by hand here would prove that the check matches the
 * fixture. What has to be true is that it matches THE PAGE — so a rewrite of
 * the page that stopped saying "not here", or dropped a way back, fails in
 * this suite instead of in production, where the only symptom is a stranger
 * reading GitHub's advice about file permissions.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const NOT_HERE = readFileSync(join(HERE, '..', '..', 'webgl', 'public', '404.html'), 'utf8');

/**
 * A site that serves whatever it is given, by path.
 *
 * A MISSING PATH ANSWERS WITH THE 404 DOCUMENT, because that is what a static
 * host does and the old fixture said `text: ''`. That difference is not
 * cosmetic: the empty body is what a host with no 404 page configured would
 * send, so every fixture site here modelled the misconfiguration this
 * iteration exists to fix, and no check written against them could have seen
 * it.
 */
function siteServing(pages: Record<string, string>, notFound = NOT_HERE): Fetcher {
  return async (url: string) => {
    const path = url.replace('https://example.test/', '');
    const text = pages[path];
    return text === undefined ? { status: 404, text: notFound } : { status: 200, text };
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

  it('the host answering a wrong address with its own page instead of ours', async () => {
    /*
     * THE DEFECT THIS CHECK WAS WRITTEN FOR, exactly as it stood in production
     * for twenty-seven days: every real page 200s, the deploy is otherwise
     * perfect, and a mistyped address hands the reader nine kilobytes of
     * GitHub's advice about matching filename case and file permissions.
     *
     * Nothing else here can see it. Every other check asks about a page that
     * IS in the site, and this is the one address that is not.
     */
    const github =
      '<title>Page not found &middot; GitHub Pages</title>' +
      '<p>The site configured at this address does not contain the requested file.</p>' +
      '<p>If this is your site, make sure that the filename case matches the URL as well ' +
      'as any file permissions. For root URLs (like http://example.com/) you must provide ' +
      'an index.html file.</p>';

    const results = await runChecks('https://example.test', siteServing(pagesOf(healthy), github));

    expect(allPassed(results)).toBe(false);
    expect(describeResults(results)).toMatch(/a wrong address/);
  });

  it('the 404 page served with a 200, which is worse than not having one', async () => {
    /*
     * A soft 404. The reader is looked after and every crawler is told the
     * apology is a real page, so a site of 1,784 plans acquires an unbounded
     * number of indexable duplicates of one sentence. Caught by `expectStatus`
     * rather than by anything about the body — the body is correct here, which
     * is the whole trap.
     */
    const softly: Fetcher = async (url) => {
      const path = url.replace('https://example.test/', '');
      const text = pagesOf(healthy)[path];
      return text === undefined
        ? { status: 200, text: NOT_HERE }
        : { status: 200, text };
    };

    const results = await runChecks('https://example.test', softly);

    expect(allPassed(results)).toBe(false);
    // NAMED, not merely counted. Every other page in this fixture is served
    // correctly, so a bare `allPassed === false` would pass just as well if
    // the run had broken for some unrelated reason — and the body here is the
    // right body, so the only honest evidence is that this check, on this
    // address, is the one that failed.
    expect(describeResults(results)).toMatch(/FAIL\s+a wrong address/);
    expect(describeResults(results)).toMatch(/status 200/);
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
    // beside it. It has moved once: 7,000,000 the day it was written, 400,000
    // the day the per-language cut landed.
    const board = DEPLOYMENT_CHECKS.find((check) => check.what === 'the 3D board');

    expect(board?.maxAssetBytes).toBe(400_000);
    expect(assetCheck('assets/index-x.js', board as Check).maxBytes).toBe(400_000);
  });
});

/**
 * What a reader downloads, which is not what the page names.
 *
 * After the per-language split the 3D board's page names exactly one file —
 * the entry, 209,779 bytes — and the million bytes behind it are chunks the
 * entry names instead. A ceiling on the page's own assets would have passed a
 * board that put all twenty-two languages back, as long as it put them behind
 * a dynamic import.
 */
describe('what a reader downloads', () => {
  it('reads every chunk an entry names, including the ones only its dep map holds', () => {
    // Both shapes Vite writes: the `import()` call for a chunk fetched on
    // demand, and the `__vite__mapDeps` array holding that chunk's own static
    // dependencies — which is how three.js is reachable from an entry that
    // never mentions it.
    const entry = [
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./main-DHaLAJb4.js","./three-DAiD5YwZ.js"])))=>i.map(i=>d[i]);',
      'ru:()=>a(()=>import("./plans.ru-BWyLN3Rz.js"),[],import.meta.url)',
      'ta:()=>a(()=>import("./plans.ta-CC6xpm4e.js"),[],import.meta.url)',
      "const style='./nothing.css'",
    ].join('\n');

    expect(chunksIn(entry)).toEqual([
      'main-DHaLAJb4.js',
      'three-DAiD5YwZ.js',
      'plans.ru-BWyLN3Rz.js',
      'plans.ta-CC6xpm4e.js',
    ]);
  });

  it('names each chunk once, however many times the entry does', () => {
    expect(chunksIn('import("./main-a.js");import("./main-a.js")')).toEqual(['main-a.js']);
  });

  it('counts the heaviest of the alternatives, not all of them and not the first', () => {
    const files = [
      { name: 'index-a.js', bytes: 209_779 },
      { name: 'main-b.js', bytes: 140_217 },
      { name: 'plans.jv-c.js', bytes: 181_710 },
      { name: 'plans.ta-d.js', bytes: 530_005 },
      { name: 'plans.en-e.js', bytes: 208_374 },
    ];

    const cost = readerCost(files, 'plans.');

    // Everything always fetched, plus Tamil — the reader with the most text.
    expect(cost.bytes).toBe(209_779 + 140_217 + 530_005);
    expect(cost.took).toBe('plans.ta-d.js');
  });

  it('counts everything when nothing is an alternative', () => {
    const cost = readerCost([
      { name: 'a.js', bytes: 10 },
      { name: 'b.js', bytes: 90 },
    ]);

    expect(cost.bytes).toBe(100);
    expect(cost.took).toBeNull();
  });

  it('refuses a wire total when any part of it went unmeasured', () => {
    // A sum missing three of its terms is not a smaller number, it is a wrong
    // one — and a wrong one that looks like an improvement.
    const partly = readerCost([
      { name: 'a.js', bytes: 10, transferred: 4 },
      { name: 'b.js', bytes: 90 },
    ]);
    expect(partly.transferred).toBeUndefined();

    const whole = readerCost([
      { name: 'a.js', bytes: 10, transferred: 4 },
      { name: 'b.js', bytes: 90, transferred: 30 },
    ]);
    expect(whole.transferred).toBe(34);
  });

  it('weighs a whole board and fails it over the ceiling', async () => {
    const chunks: Record<string, string> = {
      'assets/index-a.js': 'import("./plans.ru-c.js");import("./main-b.js")',
      'assets/main-b.js': 'x'.repeat(300),
      'assets/plans.ru-c.js': 'x'.repeat(400),
    };
    const page = '<html><body><script src="./assets/index-a.js"></script></body></html>';

    const fetcher: Fetcher = async (url) => {
      const path = url.replace('https://example.test/', '');
      if (path === '') return { status: 200, text: page };
      const text = chunks[path];
      return text === undefined ? { status: 404, text: '' } : { status: 200, text };
    };

    const check: Check = {
      path: '',
      what: 'the board',
      ownAssets: true,
      alternatives: 'plans.',
      maxReaderBytes: 600,
    };

    const results = await runChecks('https://example.test', fetcher, [check]);
    const weighed = results.find((one) => one.check.what.startsWith('what a reader downloads'));

    // 47 of entry + 300 of code + 400 of Russian is over six hundred.
    expect(weighed?.bytes).toBe(47 + 300 + 400);
    expect(weighed?.ok).toBe(false);
    expect(describeResults([weighed as CheckResult])).toContain('over the 600 ceiling');
  });

  it('refuses to call a total a total when a chunk did not answer', async () => {
    const page = '<html><body><script src="./assets/index-a.js"></script></body></html>';
    const fetcher: Fetcher = async (url) => {
      const path = url.replace('https://example.test/', '');
      if (path === '') return { status: 200, text: page };
      if (path === 'assets/index-a.js') return { status: 200, text: 'import("./gone-b.js")' };
      return { status: 404, text: '' };
    };

    const results = await runChecks('https://example.test', fetcher, [
      { path: '', what: 'the board', ownAssets: true, maxReaderBytes: 9_000_000 },
    ]);
    const weighed = results.find((one) => one.check.what.startsWith('what a reader downloads'));

    expect(weighed?.ok).toBe(false);
    expect(describeResults([weighed as CheckResult])).toContain('gone-b.js');
  });
});

/**
 * The live board's own ceilings, asserted so that raising one is deliberate.
 *
 * Both have moved once already, and both moved *down*: the asset ceiling from
 * 7,000,000 to 400,000 when the per-language cut landed, and this reader
 * ceiling exists because that cut made the first one nearly blind.
 */
describe('the ceilings the 3D board ships with', () => {
  const board = DEPLOYMENT_CHECKS.find((check) => check.what === 'the 3D board') as Check;

  it('holds the entry to four hundred thousand bytes', () => {
    expect(board.maxAssetBytes).toBe(400_000);
  });

  it('holds a whole reader to what a reader really fetches', () => {
    /*
     * 850,000, down from 1,500,000 on 2026-08-29 — the third time a ceiling
     * here has moved and the third time it moved DOWN.
     *
     * The old figure was set from a measurement that counted a language chunk
     * the browser never asks for on load: this board's titles come from the
     * entry, and a plan's text is fetched when the reader opens it.
     * `eagerChunksIn` reads Vite's own dependency table now, and what it
     * reports agrees to the byte with what the browser fetched.
     */
    expect(board.maxReaderBytes).toBe(850_000);
    // Without this the guard would sum twenty-one languages nobody downloads
    // and fail a board that is exactly right.
    expect(board.alternatives).toBe('plans.');
  });
});

/**
 * The classic board's ceilings, which did not exist until 2026-08-29.
 *
 * The 3D board's own comment had said so for weeks — *"exactly as nothing here
 * has ever seen the 2D board's twenty-four dataset chunks"* — and a stated gap
 * nobody closes is a gap.
 */
describe('the ceilings the classic board ships with', () => {
  const board = DEPLOYMENT_CHECKS.find((check) => check.what === 'the classic 2D board') as Check;

  it('holds a whole reader to the entry and one language', () => {
    // 652,461 measured live, which is 120,130 + 532,331 exactly.
    expect(board.maxReaderBytes).toBe(700_000);
    expect(board.alternatives).toBe('plans.');
  });

  it('does not count the rules book, which nobody fetches until they open it', () => {
    /*
     * A FACT A PERSON HAS TO STATE. This bundle has no `__vite__mapDeps`, and
     * in it `plans.en` — fetched on load — and `rules-…` — not — are written
     * identically. Counting the book put this board's cost at 2,176,906 when a
     * browser measured 459,501.
     */
    expect(board.lazy).toBe('rules-');
  });
});

describe('which chunks a first load really fetches', () => {
  /*
   * `chunksIn` finds every `"./x.js"` in a bundle, and a bundle names two
   * kinds: what it pulls immediately and what it will fetch if the reader ever
   * asks. Summing both reported a cost nobody pays — MEASURED against the live
   * site from the browser's own resource timings on 2026-08-29:
   *
   *     3D board   really fetches 4 files, 844,491 decoded
   *                `readerCost` said 1,357,549 — it added a language chunk the
   *                browser never asks for on load
   *     classic    really fetches 5 files, 459,501 decoded
   *                the 1.5 MB rules book is lazy and was counted whole
   */

  /** The 3D entry's own opening line, taken from the deployed bundle. */
  const WITH_TABLE =
    'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./main-zcLKYe1y.js","./three-DAiD5YwZ.js"])))=>i.map(i=>d[i]);' +
    'ta:()=>a(()=>import("./plans.ta-CC6xpm4e.js"),[],import.meta.url)';

  it('takes the eager set from the table the bundle writes', () => {
    // main and three are fetched on load; the language chunk is not.
    expect(eagerChunksIn(WITH_TABLE)).toEqual(['main-zcLKYe1y.js', 'three-DAiD5YwZ.js']);
    expect(eagerChunksIn(WITH_TABLE)).not.toContain('plans.ta-CC6xpm4e.js');
  });

  it('still names everything when there is no table, which is the old answer', () => {
    /*
     * THE PROPERTY THAT MADE THIS SAFE TO SHIP. The classic bundle has no
     * `__vite__mapDeps` at all, and in it `plans.en` — which the browser
     * fetches — and `rules-…` — which it does not — are written IDENTICALLY.
     * No reader of that text can tell them apart, so the honest answer there
     * is the one it gave before, and `Check.lazy` is where a person says the
     * part the bundle cannot.
     */
    const noTable = 'w(()=>import("./plans.en-A.js"),[],import.meta.url), w(()=>import("./rules-B.js"),[],import.meta.url)';

    expect(eagerChunksIn(noTable)).toEqual(chunksIn(noTable));
    expect(eagerChunksIn(noTable)).toEqual(['plans.en-A.js', 'rules-B.js']);
  });

  it('falls back when the table is there but empty, rather than claiming nothing loads', () => {
    // An empty table is a shape this reader does not understand, not a
    // statement that a page fetches no code at all.
    const empty = 'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=[])))=>i.map(i=>d[i]); import("./a-1.js")';

    expect(eagerChunksIn(empty)).toEqual(['a-1.js']);
  });

  it('DROPS THE LAZY CHUNK ON THE WHOLE PATH, not just in the sum', async () => {
    /*
     * Through `runChecks` and a fetcher, because the filter lives in
     * `weighTheReader` and the test below only exercised `readerCost` with a
     * list somebody had already filtered. FOUND BY FALSIFICATION: removing the
     * filter left this file green, which is a guard that does not guard.
     */
    const page =
      '<title>T</title><div id="board"></div><script type="module" src="./assets/index-x.js"></script>'.padEnd(600, ' ');
    const entry = 'import("./plans.en-a.js"); import("./rules-b.js");'.padEnd(2000, ' ');
    const files: Record<string, string> = {
      '': page,
      'assets/index-x.js': entry,
      'assets/plans.en-a.js': 'e'.repeat(1000),
      'assets/rules-b.js': 'r'.repeat(900_000),
    };
    const fetcher: Fetcher = async (url) => {
      const path = url.replace('https://site/', '');
      const text = files[path];
      return text === undefined ? { status: 404, text: '' } : { status: 200, text };
    };

    const check: Check = {
      path: '',
      what: 'a board with a book it does not open',
      mustContain: ['id="board"'],
      minBytes: 500,
      maxReaderBytes: 100_000,
      alternatives: 'plans.',
      lazy: 'rules-',
      ownAssets: true,
    };

    const withLazy = await runChecks('https://site/', fetcher, [check]);
    const cost = withLazy.find((one) => one.check.what.startsWith('what a reader downloads'));

    // The 900 kB book is not counted, so the ceiling of 100 kB holds.
    expect(cost?.ok, 'the book is not part of a first load').toBe(true);
    expect(cost?.bytes).toBeLessThan(100_000);

    // And with nothing declared lazy, the same site blows the same ceiling —
    // which is what makes the assertion above about the filter and not about
    // the fixture being small.
    const notDeclared = await runChecks('https://site/', fetcher, [{ ...check, lazy: undefined }]);
    const bigger = notDeclared.find((one) => one.check.what.startsWith('what a reader downloads'));

    expect(bigger?.ok).toBe(false);
    expect(bigger?.bytes).toBeGreaterThan(900_000);
  });

  it('drops the chunks a check declares lazy, and keeps the rest', () => {
    const files = [
      { name: 'index.js', bytes: 120_130 },
      { name: 'plans.ta.js', bytes: 532_331 },
      { name: 'plans.en.js', bytes: 206_633 },
      { name: 'rules-x.js', bytes: 1_516_069 },
    ];
    const paid = files.filter((f) => !f.name.startsWith('rules-'));

    // Entry plus ONE language, and no rules book: 652,461, which is what the
    // live classic board reports.
    expect(readerCost(paid, 'plans.').bytes).toBe(652_461);
    expect(readerCost(files, 'plans.').bytes).toBe(2_168_530);
  });
});
