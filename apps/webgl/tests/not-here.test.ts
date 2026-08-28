import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript. A document read by
// a check needs its comments blanked exactly as a module does.
import { blank } from '../../../scripts/lib/source.mjs';

/**
 * The page a wrong address lands on.
 *
 * A book of 1,784 pages published at a public URL collects old links, and a
 * static host answers a missing one with **its own** page: *Page not found ·
 * GitHub Pages*, in English, about GitHub, with nothing on it about this game.
 * Asked for `/leela/docs/en/plans/73.html` — a plan number one past the board —
 * the live site said exactly that. A reader who mistyped was simply somewhere
 * else, with no way back.
 *
 * No test could have seen it: every link check here resolves links *within* the
 * site, and this is the page for an address that is not in it.
 *
 * AND FOR TWENTY-SEVEN DAYS IT WAS STILL GITHUB'S PAGE THAT ANSWERED. The
 * sentence that used to close this comment — *"`public/` is copied verbatim by
 * Vite, so the page ships with the app and GitHub Pages serves it for anything
 * missing under the site"* — was two claims, and only the first was ever
 * checked. The page shipped; it was served for nothing. It was written on
 * 2026-08-02 into `apps/miniapp/public/`, when the mini app WAS the artifact
 * root. On 2026-08-04 `f7490b1` made the 3D board the root and moved the mini
 * app down into `classic/`, and the page went with it — to
 * `/leela/classic/404.html`, which a host looking for `/leela/404.html` never
 * reads. Measured 2026-08-29: `t27.ai/leela/anything-wrong` answered *Page not
 * found · GitHub Pages*, 9,379 bytes about file permissions.
 *
 * The same commit stranded `og:url` and the canonical, found one iteration
 * earlier. A commit that moves the root moves the meaning of every absolute
 * path in the tree, and three of them were left behind.
 *
 * THIS FILE NOW TESTS THE PAGE'S ADDRESS, NOT ONLY ITS WORDS, and it derives
 * that address from `pages.yml` rather than remembering it. The live half —
 * whether the host actually serves it — is a deployment check in
 * `apps/miniapp/src/smoke.ts`, because it is a fact about a running site and
 * no file on this disk can stand for it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = blank(readFileSync(join(HERE, '..', 'public', '404.html'), 'utf8'), 'html');

/**
 * Where this site is served from.
 *
 * Both hosts put it here — `t27.ai/leela/` and `ghashtag.github.io/leela/` —
 * and `pages.yml`'s own verification step asks the first of them.
 */
const ROOT = '/leela/';

describe('the page for an address that is not here', () => {
  it('says what happened, in a sentence rather than a code', () => {
    expect(PAGE).toMatch(/not here/i);
    expect(PAGE.length, 'and is a page, not a stub').toBeGreaterThan(400);
  });

  it('offers the way back to both things this site is', () => {
    // The game and the book. A page that only apologises leaves a reader on a
    // dead end politely.
    expect(PAGE).toContain(`href="${ROOT}"`);
    expect(PAGE).toContain(`href="${ROOT}docs/"`);
  });

  it('links from the site root, because it is served at any depth', () => {
    /**
     * The one property that cannot be relative. This page answers for
     * `/leela/nosuch`, for `/leela/docs/xx/`, and for
     * `/leela/docs/en/plans/73.html` — three different depths, one file. A
     * relative `../` would be right for exactly one of them.
     *
     * The app's own assets are the opposite case and are built with
     * `base: './'` for it: they are always beside the page that loads them.
     *
     * Collected first, and the collection asserted non-empty before anything is
     * asserted about its members. The set is `matchAll` over the page's own
     * markup, so it goes to zero the moment the page is rewritten without
     * `href="…"` — a nav rendered from a list, an anchor built in a script, a
     * redesign that links with `<a>` elements that carry the address somewhere
     * else. The loop would then run zero times and this test would report green
     * over an unchecked rule.
     *
     * It was already non-vacuous, but only by accident: the sibling above,
     * `offers the way back to both things this site is`, happens to assert that
     * two hrefs exist. A guard that is only non-vacuous because a neighbouring
     * test happens to assert something is a guard one deletion away from
     * silence — nobody deleting that test would know it was holding this one
     * up. So this one says out loud that it found something to check.
     */
    const local = [...PAGE.matchAll(/href="([^"]+)"/g)]
      .map(([, href]) => href!)
      .filter((href) => !href.startsWith('http'));

    expect(
      local.length,
      'no in-site href found -- the page stopped linking the way this test reads links, and the check was about to pass by checking nothing',
    ).toBeGreaterThan(0);

    for (const href of local) {
      expect(href.startsWith('/'), `${href} is relative`).toBe(true);
    }
  });

  it('needs nothing else to work', () => {
    /**
     * This is the page that has to render when something else did not: a
     * missing bundle, a half-finished deploy, a path nobody planned for. A
     * script or a stylesheet it had to fetch would be one more thing that can
     * be the reason it is blank.
     */
    expect(PAGE, 'no script').not.toMatch(/<script/i);
    expect(PAGE, 'nothing fetched').not.toMatch(/<link[^>]+rel="stylesheet"/i);
  });

  it('asks not to be indexed, being nobody’s page', () => {
    // A 404 that search engines keep is a wrong address with an audience.
    expect(PAGE).toMatch(/name="robots"[^>]*noindex/);
  });

  it('sits in the directory the deploy uploads, which is the whole job', () => {
    /*
     * THE ASSERTION THAT WAS MISSING FOR TWENTY-SEVEN DAYS. Everything above
     * describes a page that is correct in every respect except the one that
     * matters: a static host reads exactly one 404 document, the one at the
     * root of what it publishes, and this page was one directory below it.
     *
     * Read out of `pages.yml` rather than written down. The workflow's
     * `path:` is the single statement of what becomes the site, and a test
     * naming `apps/webgl` beside it would be a second copy of that fact —
     * free to agree today and drift the next time the root moves, which is
     * precisely the event that caused this defect.
     */
    const workflow = readFileSync(join(HERE, '..', '..', '..', '.github/workflows/pages.yml'), 'utf8');
    const uploaded = /upload-pages-artifact@v\d[\s\S]*?path:\s*(\S+)/.exec(workflow)?.[1];

    expect(uploaded, 'pages.yml still says what it uploads').toBeDefined();

    // `<app>/dist` is built from `<app>/public`: Vite copies that directory
    // verbatim into the build output, so a file in it lands at the root of the
    // artifact and nowhere else.
    const root = uploaded!.replace(/\/dist\/?$/, '/public');

    // ONE assertion, and deliberately not `expect(root).toBe('apps/webgl/…')`.
    // The first draft had that line, directly under a comment saying a test
    // naming the app beside `pages.yml` would be a second copy of the fact.
    // It would also have been the WRONG guard: it fails when the root moves,
    // which is a thing somebody is allowed to do, instead of when the page is
    // left behind by the move, which is the defect. What must hold is that the
    // 404 is wherever the deploy says the root is — however that is spelled.
    expect(
      existsSync(join(HERE, '..', '..', '..', root, '404.html')),
      `pages.yml publishes ${uploaded}, so the 404 must be in ${root}`,
    ).toBe(true);
  });
});
