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
  /** Smallest response that could be the real thing, in bytes. */
  minBytes?: number;
}

export interface CheckResult {
  check: Check;
  ok: boolean;
  status: number;
  bytes: number;
  missing: string[];
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
    const bytes = text.length;

    return {
      check,
      status,
      bytes,
      missing,
      ok: status === 200 && missing.length === 0 && bytes >= (check.minBytes ?? 0),
    };
  } catch (error) {
    return {
      check,
      status: 0,
      bytes: 0,
      missing: check.mustContain ?? [],
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Run every check. All of them, so one failure does not hide the rest. */
export async function runChecks(
  base: string,
  fetcher: Fetcher,
  checks: Check[] = DEPLOYMENT_CHECKS,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) results.push(await runCheck(base, check, fetcher));
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
