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

/** A site where every check passes. */
const healthy = siteServing({
  '': '<title>Leela</title><div id="board"></div><script src="telegram-web-app.js"></script>'.padEnd(600, ' '),
  'docs/': 'Leela <a href="ru/">Русский</a>'.padEnd(600, ' '),
  'docs/ru/plans/1.html': '<h1>1. Рождение (джанма)</h1>'.padEnd(2000, ' '),
  'docs/style.css': ':root { --measure: 34rem; }'.padEnd(600, ' '),
  'docs/en/legal/policy.html': '<h1>Privacy policy</h1>'.padEnd(900, ' '),
});

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
    const shell = siteServing({ ...pagesOf(healthy), '': '<title>Leela</title>'.padEnd(600, ' ') });
    const results = await runChecks('https://example.test', shell);
    expect(describeResults(results)).toMatch(/missing: id="board"/);
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
  it('covers the game, the book, a plan, the stylesheet and the legal page', () => {
    const paths = DEPLOYMENT_CHECKS.map((check) => check.path);
    expect(paths).toContain('');
    expect(paths).toContain('docs/');
    expect(paths.some((p) => p.includes('plans/'))).toBe(true);
    expect(paths.some((p) => p.endsWith('.css'))).toBe(true);
    expect(paths.some((p) => p.includes('legal/'))).toBe(true);
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

/** The pages a fetcher serves, recovered so a test can vary one of them. */
function pagesOf(_fetcher: Fetcher): Record<string, string> {
  return {
    '': '<title>Leela</title><div id="board"></div><script src="telegram-web-app.js"></script>'.padEnd(600, ' '),
    'docs/': 'Leela <a href="ru/">Русский</a>'.padEnd(600, ' '),
    'docs/ru/plans/1.html': '<h1>1. Рождение (джанма)</h1>'.padEnd(2000, ' '),
    'docs/style.css': ':root { --measure: 34rem; }'.padEnd(600, ' '),
    'docs/en/legal/policy.html': '<h1>Privacy policy</h1>'.padEnd(900, ' '),
  };
}
