/**
 * Checking that what was deployed actually works.
 *
 * `actions/deploy-pages` reports success when the upload succeeded, which is
 * not the same as the game being playable. A build that emits a broken asset
 * path, or a book whose pages did not make it into the artifact, deploys
 * green.
 *
 * These are pure functions over a fetcher, so the whole check runs in a test
 * against a fake and in CI against the real site.
 */

export interface Check {
  /** Path relative to the site root, e.g. `docs/ru/plans/1.html`. */
  path: string;
  /** What it is, for the report. */
  what: string;
  /** Fragments the response must contain. */
  mustContain?: string[];
  /**
   * Fragments the response must **not** contain.
   *
   * A missing asset does not always answer 404. A static host that falls back
   * to `index.html` answers 200 with a page, and a check asking only for a
   * status and a size reads that as the bundle.
   */
  mustNotContain?: string[];
  /** Smallest response that could be the real thing, in bytes. */
  minBytes?: number;
}

export interface CheckResult {
  check: Check;
  ok: boolean;
  status: number;
  bytes: number;
  missing: string[];
  /** Fragments that were there and should not have been. */
  instead: string[];
  error?: string;
}

/**
 * What has to be true of a deployment.
 *
 * Chosen so that each one fails for a different reason: the app's HTML, the
 * asset it references, a page deep in the book, the stylesheet the book needs,
 * and a legal document — the one thing whose absence is a store rejection
 * rather than a broken page.
 */
export const DEPLOYMENT_CHECKS: Check[] = [
  {
    path: '',
    what: 'the game',
    mustContain: ['<title>Leela</title>', 'id="board"', 'telegram-web-app.js'],
    minBytes: 500,
  },
  {
    path: 'docs/',
    what: 'the book',
    mustContain: ['Leela', 'href="ru/'],
    minBytes: 500,
  },
  {
    path: 'docs/ru/plans/1.html',
    what: 'a plan, deep in the book',
    // The Russian title of plan 1: proves the content shipped, not just a shell.
    mustContain: ['Рождение', '<h1>'],
    minBytes: 1500,
  },
  {
    path: 'docs/style.css',
    what: "the book's stylesheet",
    mustContain: ['--measure'],
    minBytes: 500,
  },
  {
    path: 'docs/en/legal/policy.html',
    what: 'the privacy policy',
    mustContain: ['Privacy'],
    minBytes: 800,
  },
];

export type Fetcher = (url: string) => Promise<{ status: number; text: string }>;

/** Run one check. Never throws: a failure is a result, not an exception. */
export async function runCheck(
  base: string,
  check: Check,
  fetcher: Fetcher,
): Promise<CheckResult> {
  const url = `${base.replace(/\/$/, '')}/${check.path}`;

  try {
    const { status, text } = await fetcher(url);
    const missing = (check.mustContain ?? []).filter((fragment) => !text.includes(fragment));
    const present = (check.mustNotContain ?? []).filter((fragment) => text.includes(fragment));
    const bytes = text.length;

    return {
      check,
      status,
      bytes,
      missing,
      instead: present,
      ok:
        status === 200 &&
        missing.length === 0 &&
        present.length === 0 &&
        bytes >= (check.minBytes ?? 0),
    };
  } catch (error) {
    return {
      check,
      status: 0,
      bytes: 0,
      missing: check.mustContain ?? [],
      instead: [],
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Everything the game's own page asks the browser to load.
 *
 * Relative references only: an absolute one is somebody else's server, and
 * `telegram-web-app.js` being down is not this deployment being broken.
 *
 * They cannot be listed by hand. Vite puts a content hash in every asset name,
 * so `assets/index-pd0t01pZ.js` is a different file on every build — which is
 * why the checks below name five pages and not one line of the game's code,
 * and why the failure this module opens by naming is the one it did not look
 * for. The page says what it needs; ask it.
 */
export function assetsIn(html: string): string[] {
  const found = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1] as string);

  return [...new Set(found.filter((reference) => /^\.?\/?assets\//.test(reference)))].map(
    (reference) => reference.replace(/^\.?\//, ''),
  );
}

/**
 * A check for one of them.
 *
 * Weaker than the five written by hand, and deliberately: nobody can say what
 * a bundle contains from one build to the next. What can be said is that it
 * answers, that it is not a few bytes of nothing, and that it is not the
 * index page handed back by a host that could not find it.
 */
export function assetCheck(path: string): Check {
  const isStyle = path.endsWith('.css');

  return {
    path,
    what: isStyle ? "the game's stylesheet" : "the game's code",
    minBytes: isStyle ? 200 : 1000,
    mustNotContain: ['<!doctype html', '<!DOCTYPE html'],
  };
}

/**
 * Run every check. All of them, so one failure does not hide the rest.
 *
 * The game's own assets are added from its HTML once that has been fetched:
 * a build that emits a broken asset path is the first failure this module
 * names, and the page it emits still contains `id="board"` and passes every
 * hand-written check while the game is a blank screen.
 */
export async function runChecks(
  base: string,
  fetcher: Fetcher,
  checks: Check[] = DEPLOYMENT_CHECKS,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const check of checks) {
    const result = await runCheck(base, check, fetcher);
    results.push(result);

    // The game's page, and only if it came back: there is nothing to read the
    // asset names out of otherwise, and its own failure is already reported.
    if (check.path !== '' || !result.ok) continue;

    const { text } = await fetcher(`${base.replace(/\/$/, '')}/`);
    for (const asset of assetsIn(text)) {
      results.push(await runCheck(base, assetCheck(asset), fetcher));
    }
  }

  return results;
}

/** A report a person can read in a CI log. */
export function describeResults(results: CheckResult[]): string {
  return results
    .map((result) => {
      const mark = result.ok ? 'ok  ' : 'FAIL';
      const detail = result.ok
        ? `${result.bytes}b`
        : [
            result.error ? `error: ${result.error}` : `status ${result.status}`,
            result.bytes < (result.check.minBytes ?? 0)
              ? `only ${result.bytes}b, expected at least ${result.check.minBytes}`
              : '',
            result.missing.length > 0 ? `missing: ${result.missing.join(', ')}` : '',
            result.instead.length > 0 ? `served instead: ${result.instead.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('; ');

      return `${mark}  ${result.check.what} (/${result.check.path})  ${detail}`;
    })
    .join('\n');
}

/** True when every check passed. */
export function allPassed(results: CheckResult[]): boolean {
  return results.every((result) => result.ok);
}
