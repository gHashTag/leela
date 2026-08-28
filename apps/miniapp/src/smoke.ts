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
  /**
   * Smallest response that could be the real thing, in bytes.
   *
   * Real bytes since {@link byteLength} — these floors were written against
   * character counts, which are never larger, so each of them got stricter and
   * none of them needed moving.
   */
  minBytes?: number;
  /**
   * Largest it may be before somebody has to look, in bytes.
   *
   * The floor catches a build that shipped nothing; this catches the opposite,
   * which is the failure this project actually has. The 3D board's entry is
   * 6.6 MB decoded and 93.7 per cent of the JavaScript a phone downloads,
   * almost all of it plan text in twenty-one languages the reader cannot read
   * (specs/006). Without a ceiling that number grew for months and was noticed
   * by measurement rather than by the build, and the next language added would
   * grow it again in silence.
   */
  maxBytes?: number;
  /**
   * The ceiling this page's own code files inherit. See {@link assetCheck}.
   *
   * On the page rather than on the generated check because the assets are
   * named by a content hash and cannot be listed by hand — the page is the
   * only place a ceiling can be attached to.
   */
  maxAssetBytes?: number;
  /**
   * The ceiling on what one reader downloads, in bytes. See {@link readerCost}.
   *
   * `maxAssetBytes` watches the files the *page* names, and after the
   * per-language split the page names one: the entry. Everything heavy — the
   * board's own code, three.js, the reader's language — is a chunk the entry
   * names instead, so the ceiling above would have guarded 209 kB and missed
   * the other million. This is the number that matters to a phone.
   */
  maxReaderBytes?: number;
  /**
   * The prefix of chunks a reader takes **at most one of**, e.g. `plans.`.
   *
   * Twenty-one language chunks are built and exactly one is fetched, so
   * summing them would report a cost nobody pays. Named per page rather than
   * hard-coded because it is a fact about how that page splits its data, and
   * the 2D board next door splits its own differently.
   */
  alternatives?: string;
  /**
   * The status this address should answer with. 200 unless it says otherwise.
   *
   * Every check here was a check that something is *served*, and the status
   * was `200` written into {@link runCheck} itself. One of them is now the
   * opposite question — what a WRONG address answers — and it has to be able
   * to require a 404, because a 404 page that answers 200 is worse than no
   * 404 page at all: every crawler then indexes an apology as a real page.
   */
  expectStatus?: number;
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
  /** The decoded response, in real bytes. {@link byteLength}. */
  bytes: number;
  /** What crossed the wire, when the response said. Undefined is unmeasured. */
  transferred?: number;
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
    /**
     * Four hundred thousand bytes: the entry after specs/006, and a little.
     *
     * It was 7,000,000 for two days — the entry's own size when the ceiling
     * was written — and the per-language cut took the entry from 6,624,622
     * bytes to 209,696, so this comes down with it. That is what a ceiling set
     * at today is for: it only ever moves down, and moving it is a deliberate
     * edit with a test beside it.
     *
     * **It watches less than it looks like, and that is not new.** The page
     * now names only the entry: the board's code, three.js and the reader's
     * one language are chunks nothing here sees — exactly as nothing here has
     * ever seen the 2D board's twenty-four dataset chunks. A guard on what a
     * whole reader pays is a separate piece of work, written up in specs/006,
     * and this ceiling is honest about being smaller than that one.
     */
    maxAssetBytes: 400_000,
    /**
     * The chunks a reader takes at most one of: the twenty-one languages.
     *
     * `plans.` is the prefix Rollup gives them, from the source filenames
     * `plans.<lang>.json`. Named here rather than assumed by {@link readerCost}
     * because it is a fact about how this page splits its data.
     */
    alternatives: 'plans.',
    /**
     * One and a half million bytes: what the worst reader pays today, and a
     * little.
     *
     * Measured against the live deployment on 2026-08-23 with this very
     * check: 1,353,972 decoded and 340,683 on the wire, which is the Tamil
     * reader — the one whose language has the most text. Before the
     * per-language cut the same reader paid 7,098,593 and 1,910,736.
     *
     * This is the number that would have caught a board putting all
     * twenty-two languages back behind a dynamic import, which
     * `maxAssetBytes` above cannot see: after the cut the page names only the
     * entry, and everything heavy hangs off it.
     *
     * Set at today rather than at a target, for the reason the other ceiling
     * says: one set at a number nobody has reached is a red build that gets
     * deleted, one set at today only ever moves down.
     */
    maxReaderBytes: 1_500_000,
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
  {
    /**
     * What a WRONG address answers — the only check here that asks about a
     * page nobody put on the site.
     *
     * `apps/webgl/public/404.html` had been written, tested and deployed since
     * 2026-08-02 and served for NOTHING for twenty-seven days: it was written
     * when the mini app was the artifact root, `f7490b1` moved the root to the
     * 3D board, and the page went down to `/leela/classic/404.html` — where a
     * host looking for one document at the root of what it publishes never
     * reads. Measured 2026-08-29: this address answered *Page not found ·
     * GitHub Pages*, 9,379 bytes about matching filename case and file
     * permissions, in English, to a reader who had mistyped a plan number.
     *
     * `not-here.test.ts` now holds the page's ADDRESS against `pages.yml`, and
     * that is as far as a file on disk can go. WHETHER THE HOST ACTUALLY
     * SERVES IT IS A FACT ABOUT A RUNNING SITE, and this is the only place in
     * the repository that can ask. It is the half that was missing: the page's
     * words had six tests and its delivery had none.
     *
     * The address is deliberately one nobody would ever add. A check on a path
     * that might one day become real would turn green by being built, which is
     * the quietest way for a guard to stop guarding.
     */
    path: 'this-address-is-not-in-the-site',
    what: 'a wrong address',
    expectStatus: 404,
    // Our words, and the way back. Both, because a host that serves *some*
    // custom page still fails this if it is somebody else's.
    mustContain: ['not here', 'href="/leela/"', 'href="/leela/docs/"'],
    // GitHub's own, quoted from the page it actually served. Not the words
    // "GitHub Pages" alone — the point is this exact document, and a check
    // written loosely enough to catch a mention would fail the day the page
    // credits its host.
    mustNotContain: ['the filename case matches the URL', 'For root URLs'],
    minBytes: 400,
  },
];

export type Fetcher = (
  url: string,
) => Promise<{
  status: number;
  text: string;
  /**
   * What crossed the wire, when the response said so — the compressed length
   * from `content-length`, which a static host sets to the gzipped size.
   *
   * Optional because it is a fact about a transport a fake does not have, and
   * because a host is free not to send the header. Absent means unmeasured
   * here, never zero.
   */
  transferred?: number;
}>;

/**
 * The size of a response, in bytes.
 *
 * This file called `text.length` "bytes" and printed it as `b` for as long as
 * it has existed, and `text.length` counts UTF-16 code units — characters. On
 * the one asset the number is quoted about, the 3D board's entry, it
 * understated the file by 41 per cent: 3,907,316 characters against 6,624,207
 * bytes, measured against the live deployment on 2026-08-23. The board carries
 * plan texts in Devanagari, Cyrillic, Arabic, Tamil and Chinese, and each of
 * those characters is two or three bytes.
 *
 * The direction of the old error is worth stating, because it decides whether
 * anything shipped broken: characters are never more than bytes, so every
 * `minBytes` floor was compared against a number that could only be too small.
 * No check ever passed that should have failed. What was wrong was every size
 * this loop has *reported* — including the one the bundle-weight work is
 * aimed at.
 */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Run one check. Never throws: a failure is a result, not an exception. */
export async function runCheck(
  base: string,
  check: Check,
  fetcher: Fetcher,
): Promise<CheckResult> {
  const url = `${base.replace(/\/$/, '')}/${check.path}`;

  try {
    const { status, text, transferred } = await fetcher(url);
    const missing = (check.mustContain ?? []).filter((fragment) => !text.includes(fragment));
    const present = (check.mustNotContain ?? []).filter((fragment) => text.includes(fragment));
    const bytes = byteLength(text);

    return {
      check,
      status,
      bytes,
      transferred,
      missing,
      instead: present,
      ok:
        status === (check.expectStatus ?? 200) &&
        missing.length === 0 &&
        present.length === 0 &&
        bytes >= (check.minBytes ?? 0) &&
        bytes <= (check.maxBytes ?? Number.POSITIVE_INFINITY),
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
    // Code only: a stylesheet has never been this project's weight problem,
    // and a ceiling nobody has a reason for is a ceiling somebody raises
    // without reading it.
    ...(isStyle || of.maxAssetBytes === undefined ? {} : { maxBytes: of.maxAssetBytes }),
    mustNotContain: ['<!doctype html', '<!DOCTYPE html'],
  };
}

/**
 * Every chunk an entry names, as the build wrote them.
 *
 * Vite writes them as plain relative string literals — `import("./plans.ru-….js")`
 * for the ones fetched on demand, and a `__vite__mapDeps` array holding the
 * static dependencies of each of those, which is how `three.js` appears here
 * without the entry importing it directly. So one scan of the entry is the
 * whole graph a reader can reach through it, and no second hop is needed.
 *
 * What it does **not** see: a worker created at runtime from a chunk further
 * down, which on this board is 4,990 bytes. {@link readerCost} says so rather
 * than pretending to a completeness it has not got.
 */
export function chunksIn(code: string): string[] {
  return [...new Set([...code.matchAll(/["'`]\.\/([A-Za-z0-9._-]+\.js)["'`]/g)].map((found) => found[1] as string))];
}

export interface Weighed {
  name: string;
  bytes: number;
  transferred?: number;
}

export interface ReaderCost {
  bytes: number;
  /** Undefined when any part of it went unmeasured — never a partial sum. */
  transferred?: number;
  /** Which of the alternatives was counted, for the report. */
  took: string | null;
}

/**
 * What one reader downloads: everything, plus the largest of the alternatives.
 *
 * The largest rather than the average or the typical, because a ceiling is a
 * promise about the worst reader, and the worst reader here is the one whose
 * language has the most text — Tamil, at 530,005 bytes against Javanese's
 * 181,710. A guard written around English would pass while a Tamil player
 * downloaded twice what it allowed.
 *
 * The wire total is undefined unless every part reported one: a sum missing
 * three of its terms is not a smaller number, it is a wrong one.
 */
export function readerCost(files: Weighed[], alternatives?: string): ReaderCost {
  const optional = alternatives === undefined ? [] : files.filter((file) => file.name.startsWith(alternatives));
  const always = alternatives === undefined ? files : files.filter((file) => !file.name.startsWith(alternatives));

  const heaviest = optional.reduce<Weighed | null>(
    (worst, file) => (worst === null || file.bytes > worst.bytes ? file : worst),
    null,
  );

  const counted = heaviest === null ? always : [...always, heaviest];
  const measured = counted.every((file) => file.transferred !== undefined);

  return {
    bytes: counted.reduce((all, file) => all + file.bytes, 0),
    transferred: measured ? counted.reduce((all, file) => all + (file.transferred ?? 0), 0) : undefined,
    took: heaviest?.name ?? null,
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

    if (check.maxReaderBytes !== undefined) {
      results.push(await weighTheReader(base, check, assets, fetcher));
    }
  }

  return results;
}

/**
 * What one reader of this page downloads, weighed.
 *
 * The entry is fetched, every chunk it names is fetched once, and
 * {@link readerCost} takes all of them plus the largest of the alternatives.
 * A chunk that does not answer is counted at zero and named in the report,
 * because a total that silently drops a missing file reads as an improvement.
 */
async function weighTheReader(
  base: string,
  check: Check,
  assets: string[],
  fetcher: Fetcher,
): Promise<CheckResult> {
  const root = base.replace(/\/$/, '');
  const entry = assets.find((asset) => asset.endsWith('.js'));
  const what = `what a reader downloads for ${check.what}`;

  if (entry === undefined) {
    return verdict({ path: check.path, what }, 'the page names no code of its own to weigh');
  }

  const weigh = async (name: string): Promise<Weighed> => {
    // Chunks sit beside the entry, so they resolve against its directory.
    const beside = `${check.path}${entry.slice(0, entry.lastIndexOf('/') + 1)}${name}`;
    const { status, text, transferred } = await fetcher(`${root}/${beside}`);
    return status === 200
      ? { name, bytes: byteLength(text), transferred }
      : { name, bytes: 0, transferred: undefined };
  };

  const first = await weigh(entry.slice(entry.lastIndexOf('/') + 1));
  const named = chunksIn(
    (await fetcher(`${root}/${check.path}${entry}`)).text,
  );
  const rest = [];
  for (const name of named) rest.push(await weigh(name));

  const missing = [first, ...rest].filter((file) => file.bytes === 0).map((file) => file.name);
  const cost = readerCost([first, ...rest], check.alternatives);
  const ceiling = check.maxReaderBytes ?? Number.POSITIVE_INFINITY;

  return {
    check: { path: check.path, what, maxBytes: check.maxReaderBytes },
    status: 200,
    bytes: cost.bytes,
    transferred: cost.transferred,
    missing,
    instead: [],
    ok: cost.bytes <= ceiling && missing.length === 0,
    why:
      missing.length > 0
        ? `these chunks did not answer, so the total is not a total: ${missing.join(', ')}`
        : undefined,
  };
}

/** A report a person can read in a CI log. */
export function describeResults(results: CheckResult[]): string {
  return results
    .map((result) => {
      const mark = result.ok ? 'ok  ' : 'FAIL';
      const detail = result.ok
        ? // Both numbers when the wire cost is known and differs: a reader
          // deciding whether an asset is too heavy is deciding about what a
          // phone downloads, and the decoded size alone answers a different
          // question than the one being asked.
          result.transferred !== undefined && result.transferred !== result.bytes
          ? `${result.bytes}b (${result.transferred}b on the wire)`
          : `${result.bytes}b`
        : [
            // A verdict read off the page has no status to report, and
            // `status 0` reads as a network failure that never happened.
            result.why ? result.why : result.error ? `error: ${result.error}` : `status ${result.status}`,
            result.bytes < (result.check.minBytes ?? 0)
              ? `only ${result.bytes}b, expected at least ${result.check.minBytes}`
              : '',
            result.bytes > (result.check.maxBytes ?? Number.POSITIVE_INFINITY)
              ? `${result.bytes}b, which is over the ${result.check.maxBytes} ceiling — ` +
                'something got heavier; see specs/006'
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
