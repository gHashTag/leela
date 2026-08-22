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
  /**
   * The path is an app's page, and its build names its assets with a content
   * hash. Expand it: one generated check per asset the page references, read
   * from the page's own directory — {@link assetsIn} says why they cannot be
   * listed by hand. There are two such pages now, the 3D board at the root and
   * the 2D board under `classic/`, which is why this is a fact on the check
   * rather than `path === ''` hard-coded in {@link runChecks}.
   */
  ownAssets?: boolean;
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
  /**
   * Why this failed, when the reason is not a status, a size or a fragment.
   *
   * A verdict reached by *reading* rather than by fetching — the page names no
   * asset of its own, the page asks the site root for one — has no status and
   * no byte count to print, and a report that says only `FAIL ... status 0`
   * sends whoever reads the CI log looking for a network problem that never
   * happened.
   */
  why?: string;
}

/**
 * What has to be true of a deployment.
 *
 * Chosen so that each one fails for a different reason: the 3D board's HTML,
 * the 2D board that must survive its move to `classic/`, a page deep in the
 * book, the stylesheet the book needs, and a legal document — the one thing
 * whose absence is a store rejection rather than a broken page.
 */
export const DEPLOYMENT_CHECKS: Check[] = [
  {
    path: '',
    what: 'the 3D board',
    // The title is the one fragment the 2D page does not carry, so the old
    // layout still deployed — the 2D app at the root — reads as a named
    // missing fragment rather than as a healthy 200 about the wrong app.
    mustContain: ['<title>Leela — the board in three dimensions</title>', 'id="board"'],
    minBytes: 500,
    ownAssets: true,
  },
  {
    path: 'classic/',
    what: 'the classic 2D board',
    // The fragments the root passed before the 3D board took its place: the
    // 2D app is not deleted, it moves, and these prove it survived the move.
    mustContain: ['<title>Leela</title>', 'id="board"', 'telegram-web-app.js'],
    minBytes: 500,
    ownAssets: true,
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

/** Every `src=` / `href=` the page carries, in the order it carries them. */
function referencesIn(html: string): string[] {
  return [
    ...new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1] as string)),
  ];
}

/** `assets/index-abc.js` or `./assets/index-abc.js` — read from the page's own directory. */
const OWN_ASSET = /^(?:\.\/)?assets\//;

/** `/assets/index-abc.js` — read from the origin, wherever the page itself lives. */
const ROOT_ASSET = /^\/assets\//;

/**
 * Everything the game's own page asks the browser to load.
 *
 * They cannot be listed by hand. Vite puts a content hash in every asset name,
 * so `assets/index-pd0t01pZ.js` is a different file on every build — which is
 * why the checks above name five pages and not one line of the game's code,
 * and why the failure this module opens by naming is the one it did not look
 * for. The page says what it needs; ask it.
 *
 * **What this returns is the page's *own* assets, and nothing else.** The
 * sentence this function used to carry — *an absolute reference is somebody
 * else's server* — is true of `https://telegram.org/js/telegram-web-app.js`
 * and flatly false of `/assets/index-abc.js`. The second one is this
 * deployment's file, asked for from the wrong place: a page served at
 * `https://site/leela/` that writes `/assets/index-abc.js` sends the browser
 * to `https://site/assets/index-abc.js`, which is a 404 and a blank screen.
 * The old reader matched it — `/^\.?\/?assets\//` accepts a leading slash —
 * and then erased the leading slash with `.replace(/^\.?\//, '')` before
 * handing the name back to a checker that re-roots every path under the base
 * it was given. So the checker fetched `https://site/leela/assets/index-abc.js`
 * and got a healthy 200 from the one URL the browser was never going to ask
 * for. Normalising the reference destroyed the only difference between a
 * correct path and a broken one, and the module whose first sentence is *a
 * build that emits a broken asset path deploys green* passed that build.
 *
 * The one line that keeps this from happening is `base: './'` in
 * `vite.config.ts`. It is a default away from being gone.
 *
 * Dropping absolute references instead of normalising them would be the same
 * blindness moved one layer down: nothing would fetch the wrong URL, and
 * nothing would say the page is broken either. They come back from
 * {@link assetProblems}, which is a verdict rather than a list of things to go
 * and fetch.
 */
export function assetsIn(html: string): string[] {
  return referencesIn(html)
    .filter((reference) => OWN_ASSET.test(reference))
    .map((reference) => reference.replace(/^\.\//, ''));
}

/**
 * References to this deployment's assets that the page cannot reach.
 *
 * Root-absolute, i.e. `/assets/...`. Correct only when the site is served from
 * `/`, which this one is not: GitHub Pages puts it under `/<repo>/` and the
 * custom host under `/leela/`. There is nothing to fetch and no ambiguity to
 * resolve — the page as shipped is broken, and the only honest thing to do
 * with the reference is report it.
 */
export function assetProblems(html: string): string[] {
  return referencesIn(html).filter((reference) => ROOT_ASSET.test(reference));
}

/**
 * A check for one of them.
 *
 * Weaker than the ones written by hand, and deliberately: nobody can say what
 * a bundle contains from one build to the next. What can be said is that it
 * answers, that it is not a few bytes of nothing, and that it is not the
 * index page handed back by a host that could not find it.
 *
 * Named after the page that asked for it, because with two boards in one
 * artifact "the game's code" no longer says which game the report is about.
 */
export function assetCheck(path: string, of: Check): Check {
  const isStyle = path.endsWith('.css');

  return {
    path,
    what: `${of.what}'s ${isStyle ? 'stylesheet' : 'code'}`,
    minBytes: isStyle ? 200 : 1000,
    mustNotContain: ['<!doctype html', '<!DOCTYPE html'],
  };
}

/** A failure reached by reading the page, with nothing fetched. */
function verdict(check: Check, why: string): CheckResult {
  return { check, ok: false, status: 0, bytes: 0, missing: [], instead: [], why };
}

/**
 * The verdict on a page that asks the site root for one of its own files.
 *
 * Not fetched. Fetching it would mean choosing a base to resolve it against,
 * and every choice available is a lie: resolve it under the deployment's base
 * and you have re-created the bug this exists to catch; resolve it under the
 * origin and you have confirmed a URL no browser loading this page will ever
 * request.
 */
export function rootAssetVerdict(reference: string): CheckResult {
  return verdict(
    { path: reference, what: "an asset the page asks the site root for, not its own directory" },
    `the page references ${reference}; served from a subdirectory the browser asks the origin ` +
      `for it and gets a 404. Vite emits this when \`base\` is not './'`,
  );
}

/**
 * The verdict on a page that names none of its own files.
 *
 * The hand-written checks read a title, an element id and a byte count, and an
 * empty shell has all three. Everything below them is generated per asset, so
 * a page with no assets generates no checks and the run passes on green lines
 * about a page that loads nothing. Named after the page it indicts, because
 * either board can be the shell while the other is whole.
 */
export function noAssetsVerdict(of: Check): CheckResult {
  return verdict(
    { path: of.path, what: `${of.what}'s own code, which its page never names` },
    'the page names no asset of its own: no ./assets/... script or stylesheet. A shell with a ' +
      'title and an empty board passes every other check and loads nothing',
  );
}

/**
 * Run every check. All of them, so one failure does not hide the rest.
 *
 * Each board's own assets are added from its page's HTML once that has been
 * fetched: a build that emits a broken asset path is the first failure this
 * module names, and the page it emits still contains `id="board"` and passes
 * every hand-written check while the board is a blank screen. The 2D board is
 * a directory *copied* into the artifact besides, so a copy that missed its
 * `assets/` serves an intact page whose bundle is gone.
 *
 * Expanding a page into per-asset checks has no floor of its own, so the two
 * ways of naming nothing — naming no asset, and naming one the browser cannot
 * reach — are verdicts rather than fetches. Without them, the fewer files a
 * page asks for the greener the run, and a page asking for none is perfect.
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

    // An app's page, and only if it came back: there is nothing to read the
    // asset names out of otherwise, and its own failure is already reported.
    if (!check.ownAssets || !result.ok) continue;

    const { text } = await fetcher(`${base.replace(/\/$/, '')}/${check.path}`);
    const assets = assetsIn(text);

    for (const asset of assets) {
      // Resolved against the page that named it: `assets/…` in the classic
      // page is `classic/assets/…` at the site, and re-rooting it under the
      // base would fetch a URL the browser never asks for — the exact mistake
      // {@link assetsIn} recounts.
      results.push(await runCheck(base, assetCheck(`${check.path}${asset}`, check), fetcher));
    }

    for (const reference of assetProblems(text)) {
      results.push(rootAssetVerdict(reference));
    }

    if (assets.length === 0) results.push(noAssetsVerdict(check));
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
            // A verdict read off the page has no status to report, and
            // `status 0` reads as a network failure that never happened.
            result.why ? result.why : result.error ? `error: ${result.error}` : `status ${result.status}`,
            result.bytes < (result.check.minBytes ?? 0)
              ? `only ${result.bytes}b, expected at least ${result.check.minBytes}`
              : '',
            result.missing.length > 0 ? `missing: ${result.missing.join(', ')}` : '',
            result.instead.length > 0 ? `served instead: ${result.instead.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('; ');

      // A root-absolute path already carries its slash; `//assets/...` would
      // be a third thing that is neither what the page said nor what it meant.
      const where = result.check.path.startsWith('/') ? result.check.path : `/${result.check.path}`;

      return `${mark}  ${result.check.what} (${where})  ${detail}`;
    })
    .join('\n');
}

/** True when every check passed. */
export function allPassed(results: CheckResult[]): boolean {
  return results.every((result) => result.ok);
}
