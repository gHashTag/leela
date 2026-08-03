/**
 * The book cutting a text the way the format says, not its own way.
 *
 * `piecesOf` in `@leela/content` decides what a paragraph is for all three
 * surfaces: it splits a heading away from the prose written under it on the
 * next line, and drops a line that is only hashes. Both were defects when each
 * surface answered for itself — the Russian chakras chapter had **no headings
 * at all** on the page and four hash marks in their place, and the Turkish
 * glossary showed a bare `##`.
 *
 * The rule has a test of its own, and it passes whatever the surfaces do with
 * it: measured, taking `piecesOf` out of `renderMarkdown` restores both defects
 * and **every one of this package's tests still passes**. A rule that lives in
 * a shared package needs the surfaces' use of it asserted too, or reverting the
 * use proves nothing.
 *
 * So these are about what comes out, not about which function was called. The
 * book keeps its own heading detection for a block it is handed — that part is
 * not what `piecesOf` gives it, and the two cases below are.
 */

import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/render';

describe('a heading written on the line above its prose', () => {
  it('becomes a heading and a paragraph, not one paragraph of both', () => {
    // Seventeen blocks are written this way, all Russian: `ru/chakras` and
    // `ru/notes`. Without the format's cut they read as one paragraph
    // beginning with hashes.
    const drawn = renderMarkdown('#### Первая чакра (Муладхара)\nрасположена в основании позвоночника');

    expect(drawn).toContain('<h2>Первая чакра (Муладхара)</h2>');
    expect(drawn).toContain('<p>расположена в основании позвоночника</p>');
    expect(drawn).not.toContain('####');
  });

  it('keeps the prose that follows it, all of it', () => {
    // The cut must not cost a word. A repair that dropped the tail would pass
    // the assertion above and lose the chapter.
    const drawn = renderMarkdown('## Section\nfirst line\nsecond line');

    expect(drawn).toContain('first line');
    expect(drawn).toContain('second line');
  });
});

describe('a line that is only hashes', () => {
  it('is not drawn at all', () => {
    // A heading whose words did not survive a translation. The Turkish
    // glossary holds one; `##` on a page says less than nothing.
    const drawn = renderMarkdown('before\n\n##\n\nafter');

    expect(drawn).toBe('<p>before</p>\n<p>after</p>');
  });

  it('does not take the paragraphs around it with it', () => {
    expect(renderMarkdown('##')).toBe('');
    expect(renderMarkdown('only this')).toBe('<p>only this</p>');
  });
});
