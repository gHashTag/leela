import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
 * `public/` is copied verbatim by Vite, so the page ships with the app and
 * GitHub Pages serves it for anything missing under the site.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(HERE, '..', 'public', '404.html'), 'utf8');

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
     */
    for (const [, href] of PAGE.matchAll(/href="([^"]+)"/g)) {
      if (href.startsWith('http')) continue;
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
});
