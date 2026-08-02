import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript. A document read by
// a check needs its comments blanked exactly as a module does.
import { blank } from '../../../scripts/lib/source.mjs';

/**
 * What a link to the game looks like when somebody shares it.
 *
 * Every one of the book's 1,784 pages carries a description and an Open Graph
 * set — `render.ts` writes them because the bot posts links into Telegram and
 * Telegram builds its preview from them. This page, the game itself, carried a
 * charset, a viewport and a title. It is the link players send each other and
 * the one every button in the bot points at, and a chat rendered it as a bare
 * URL.
 *
 * Found by asking the live site for its own head and putting it beside a book
 * page's. One repository, one reason, applied to one surface.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = blank(readFileSync(join(HERE, '..', 'index.html'), 'utf8'), 'html');

/** One `<meta>`'s content, however the attributes are wrapped. */
const contentOf = (attribute: string, value: string): string | null => {
  const found = new RegExp(
    `<meta[^>]*${attribute}="${value}"[^>]*content="([^"]*)"|<meta[^>]*content="([^"]*)"[^>]*${attribute}="${value}"`,
    's',
  ).exec(PAGE);

  return found?.[1] ?? found?.[2] ?? null;
};

describe('a link to the game, shared', () => {
  it('says what the game is, not only what it is called', () => {
    const description = contentOf('name', 'description');

    expect(description, 'a description at all').not.toBeNull();
    expect(description).toMatch(/72 plans/);
  });

  it('carries the set a preview is built from', () => {
    // The same five the book writes on every page: without `og:description` a
    // chat shows a title and a URL, and without `og:url` it shows whichever
    // address the reader happened to arrive by.
    for (const property of ['og:site_name', 'og:type', 'og:title', 'og:description', 'og:url']) {
      expect(contentOf('property', property), property).not.toBeNull();
    }
  });

  it('says the same thing twice, because a preview reads the second one', () => {
    // Two sentences for one page is how they come to disagree.
    expect(contentOf('property', 'og:description')).toBe(contentOf('name', 'description'));
  });

  it('names itself as a site rather than as an article', () => {
    // The book's plans are articles and this is the game. The book's own root
    // page says `website` for the same reason.
    expect(contentOf('property', 'og:type')).toBe('website');
  });

  it('points at one address, and the same one the book points back to', () => {
    /**
     * `PLAY_URL` in the book is `https://t27.ai/leela/`, and every page of it
     * carries a *Play* link there. A canonical anywhere else would tell a
     * search engine that the two are different games.
     */
    const play = 'https://t27.ai/leela/';

    expect(PAGE).toContain(`<link rel="canonical" href="${play}" />`);
    expect(contentOf('property', 'og:url')).toBe(play);
  });

  it('borrows the book\'s words rather than writing a second description', () => {
    // `render.ts` describes the site as *The game of self-knowledge — 72 plans,
    // in 22 languages*. One game, one sentence.
    const root = readFileSync(join(HERE, '..', '..', 'docs', 'src', 'render.ts'), 'utf8');

    expect(root, 'the book still says it this way').toContain('The game of self-knowledge — 72 plans');
    expect(contentOf('name', 'description')).toContain('The game of self-knowledge — 72 plans');
  });
});
