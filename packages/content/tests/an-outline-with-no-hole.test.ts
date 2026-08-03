/**
 * The outline a reader walks through a chapter.
 *
 * Somebody who cannot see a page moves through it by heading level: *next
 * heading*, *next heading at this level*, *up one*. A level that is skipped
 * tells them a section is missing — the page says there is an `h2` between the
 * title and this `h3`, and there is not.
 *
 * Both surfaces that draw a chapter shifted every heading by a fixed amount,
 * and both assumed the text starts at `#`. It does not: the rules chapters
 * write their sections as `##` and the chakras chapter as `####`. So the book
 * drew **thirty-eight pages** as `h1 → h3`, and the mini app drew the chakras
 * under an `h2` dialog title as `h6` — three levels missing at once.
 *
 * Where a text starts counting is not something its author decided. The
 * distances between its headings are, and those are what a reader is owed. So
 * each surface shifts by the distance from its own container: the book's pages
 * carry an `h1`, so the shallowest heading becomes `h2`; the mini app's reader
 * has an `h2` title, so it becomes `h3`.
 *
 * **No shipped text uses two heading levels**, measured across all
 * twenty-two languages — so the part of the rule that keeps the distances is
 * asserted on a text written here rather than on one that ships. A rule proved
 * only by the data it was written for is a rule that stops the day the data
 * changes.
 */

import { describe, expect, it } from 'vitest';
import { LANGUAGES, piecesOf, rulesFor } from '../src/index';

/** The levels a surface would draw, shifting from its own container. */
function outline(text: string, container: number): number[] {
  const pieces = piecesOf(text);
  const shallowest = Math.min(...pieces.map((piece) => piece.heading?.level ?? 9), 9);
  const shift = shallowest === 9 ? 0 : container + 1 - shallowest;

  return pieces
    .filter((piece) => piece.heading)
    .map((piece) => Math.min(Math.max((piece.heading?.level ?? 0) + shift, container + 1), 6));
}

describe('a chapter drawn under a title', () => {
  it('starts one level below whatever holds it', () => {
    // The book's page carries an `h1`; the mini app's reader an `h2`. Neither
    // may put its first section deeper than the next level down.
    for (const container of [1, 2]) {
      for (const source of ['# One\n\ntext', '## One\n\ntext', '#### One\n\ntext']) {
        expect({ container, source, first: outline(source, container)[0] }).toEqual({
          container,
          source,
          first: container + 1,
        });
      }
    }
  });

  it('keeps the distance between two levels the author wrote', () => {
    // The half no shipped text can prove: none of them uses two levels. A
    // shift that collapsed them would pass every check made against the data
    // and lose the shape of the next chapter somebody writes.
    const two = '## Section\n\ntext\n\n### Under it\n\nmore\n\n## Next section\n\nmore';

    expect(outline(two, 1)).toEqual([2, 3, 2]);
    expect(outline(two, 2)).toEqual([3, 4, 3]);
  });

  it('leaves no level out, in any chapter this repository ships', () => {
    // The live assertion, over the texts as they are, for both containers.
    const holes: string[] = [];

    for (const language of LANGUAGES) {
      for (const chapter of rulesFor(language)) {
        for (const container of [1, 2]) {
          const levels = [container, ...outline(String(chapter.body ?? ''), container)];

          for (let at = 1; at < levels.length; at += 1) {
            if ((levels[at] ?? 0) - (levels[at - 1] ?? 0) > 1) {
              holes.push(`${language}/${chapter.slug} under h${container}: h${levels[at - 1]} → h${levels[at]}`);
              break;
            }
          }
        }
      }
    }

    expect(holes).toEqual([]);
  });

  it('has chapters with headings in it, so the rule is about something', () => {
    const withHeadings = LANGUAGES.flatMap((language) =>
      rulesFor(language).filter((chapter) =>
        piecesOf(String(chapter.body ?? '')).some((piece) => piece.heading),
      ),
    );

    expect(withHeadings.length).toBeGreaterThan(20);
  });

  it('goes no deeper than a heading can go', () => {
    // Six is the last one. A text nested past it has to stop somewhere, and
    // stopping is better than emitting an `h7` nothing understands.
    const deep = '###### Six\n\ntext';

    expect(outline(deep, 2)).toEqual([3]);
    expect(Math.max(...outline('# a\n\n## b\n\n### c\n\n#### d\n\n##### e\n\n###### f', 2))).toBeLessThanOrEqual(6);
  });
});
