/**
 * Nobody should meet a hash.
 *
 * The rules chapters write their sections as `## The second chakra
 * (Svadhisthana)` — three hundred and five of them, across nineteen languages.
 * The book renders those as headings. The mini app split the chapter on blank
 * lines and put each part on the screen as text, and the phone put the whole
 * body into one `Text`, so a reader of either met the hashes: literally
 * `## দ্বিতীয় চক্রে (স্বাধিষ্ঠান)`, markup shown to somebody who never asked
 * to see any, on the surface that is published.
 *
 * Three surfaces reading one text, and each had decided for itself what a
 * paragraph is. That is the shape this repository keeps finding — the reason
 * `stateFromKept` sits in the engine and `parseDocument` in the format — so the
 * question moved to where the texts live and all three ask it.
 *
 * These assert the rule and then the texts: a paragraph that opens with hashes
 * is a heading and its text is what follows them, and no chapter this
 * repository ships holds a paragraph that would reach a reader with markup on
 * it.
 */

import { describe, expect, it } from 'vitest';
import { LANGUAGES, headingOf, piecesOf, plansFor, rulesFor } from '../src/index';

describe('what a heading is', () => {
  it('is a paragraph opening with hashes, at the level the author wrote', () => {
    // The shape. Six levels, because the source may use any of them and a check
    // that knew two would pass the day somebody wrote a third.
    for (let level = 1; level <= 6; level += 1) {
      const said = 'The second chakra (Svadhisthana)';

      expect(headingOf(`${'#'.repeat(level)} ${said}`)).toEqual({ level, text: said });
    }
  });

  it('is not prose that happens to hold a hash', () => {
    for (const paragraph of [
      'A plan is not a number, and #6 is not a heading.',
      'The third chakra refers to the celestial plane.',
      '#',
      '#   ',
      '',
      '       ',
    ]) {
      expect({ paragraph, heading: headingOf(paragraph) }).toEqual({ paragraph, heading: null });
    }
  });

  it('does not need the space CommonMark asks for', () => {
    // Seventeen headings in the shipped texts have lost theirs, every one a
    // section of the glossary that another language writes with it. Measured
    // before the rule was loosened: seventeen paragraphs change meaning and all
    // seventeen are section names, in twenty-two languages.
    expect(headingOf('##Vedanta')).toEqual({ level: 2, text: 'Vedanta' });
    expect(headingOf('##श्रुति')).toEqual({ level: 2, text: 'श्रुति' });
  });

  it('is not seven hashes, which is not a level', () => {
    // Seven is `######` and then a word beginning with a hash, which is prose
    // as far as anything here is concerned.
    expect(headingOf('####### seven is not a level')?.level).toBe(6);
  });

  it('reads one whatever whitespace surrounds it', () => {
    // A text file somebody edited, and the surfaces trim at different moments.
    expect(headingOf('  ##   The fourth chakra (Anahata)   ')).toEqual({
      level: 2,
      text: 'The fourth chakra (Anahata)',
    });
  });
});

describe('the texts this repository ships', () => {
  /** Every paragraph of every text a reader can open, in every language. */
  function* paragraphs(): Generator<{ where: string; paragraph: string }> {
    for (const language of LANGUAGES) {
      for (const plan of plansFor(language)) {
        for (const paragraph of String(plan.body ?? '').split(/\n{2,}/)) {
          yield { where: `${language} plan ${plan.plan}`, paragraph };
        }
      }

      for (const chapter of rulesFor(language)) {
        for (const paragraph of String(chapter.body ?? '').split(/\n{2,}/)) {
          yield { where: `${language} ${chapter.slug}`, paragraph };
        }
      }
    }
  }

  it('hold headings, so this is a rule about something that is there', () => {
    // Otherwise every assertion below passes on a repository whose texts have
    // no headings in them at all.
    const headings = [...paragraphs()].filter((one) => headingOf(one.paragraph) !== null);

    expect(headings.length).toBeGreaterThan(100);
  });

  it('leave no markup in what a heading says', () => {
    // The text a surface draws is what follows the hashes, and it must not
    // start with more of them: `## # something` would put one on the screen.
    const leaking = [...paragraphs()]
      .map((one) => ({ ...one, heading: headingOf(one.paragraph) }))
      .filter((one) => one.heading !== null && /^#/.test(one.heading.text));

    expect(leaking.map((one) => `${one.where}: ${one.heading?.text.slice(0, 40)}`)).toEqual([]);
  });

  it('leave no piece that reaches a reader with markup on it', () => {
    // The assertion the three surfaces now share, stated over what they draw
    // rather than over what they were handed: whatever a text is cut into, no
    // part of it may still carry the marks.
    //
    // Written first over the paragraph rather than the pieces, and it failed on
    // the seventeen blocks that hold a heading and its prose together — which
    // is a block that rightly yields both a heading and a paragraph. The rule
    // is about what is drawn.
    const shown = [...paragraphs()]
      .flatMap((one) => piecesOf(one.paragraph).map((piece) => ({ ...one, piece })))
      .filter((one) => /^#/.test(one.piece.text));

    expect(shown.map((one) => `${one.where}: ${one.piece.text.slice(0, 40)}`)).toEqual([]);
  });

  it('cut a heading away from the prose written under it', () => {
    // The blank line is not always there. Seventeen blocks, all Russian —
    // `ru/chakras` and `ru/notes` — write the heading and the paragraph it
    // heads on consecutive lines, and every surface read that as one paragraph
    // starting with hashes. The published Russian chapter had no headings on it
    // at all, and four hash marks in their place.
    const pieces = piecesOf('#### Первая чакра (Муладхара)\nрасположена в основании позвоночника');

    expect(pieces).toEqual([
      { heading: { level: 4, text: 'Первая чакра (Муладхара)' }, text: 'Первая чакра (Муладхара)' },
      { heading: null, text: 'расположена в основании позвоночника' },
    ]);
  });

  it('still holds texts written that way, so the rule guards something', () => {
    // Measured: seventeen blocks, in `ru/chakras` and `ru/notes`. Russian is
    // one of the two languages nobody machine-translated, which is why this is
    // where somebody wrote by hand and put the heading on the line above.
    //
    // Asserted as *more than ten* rather than *seventeen*: an editor may add
    // one, and the rule is about the shape, not the tally. Zero would mean the
    // rule guards nothing and this file could be deleted.
    const glued = LANGUAGES.flatMap((language) =>
      rulesFor(language).flatMap((chapter) =>
        String(chapter.body ?? '')
          .split(/\n{2,}/)
          .filter((block) => {
            const lines = block.trim().split('\n');
            return lines.length > 1 && headingOf(lines[0] ?? '') !== null;
          }),
      ),
    );

    expect(glued.length).toBeGreaterThan(10);
  });

  it('draw no line that holds no words', () => {
    // The general shape, and the reason it is stated here rather than as a list
    // of the marks somebody thought of. Measured over all twenty-two languages:
    // exactly two kinds of wordless line exist — the Turkish `##` and the two
    // fences in `ru/chakras` — and both are dropped.
    //
    // The rule in `piecesOf` is deliberately narrower than this assertion. A
    // wordless line that is neither is a decision somebody should make on
    // purpose: a divider an author meant is not markup, and this failing is how
    // that question gets asked rather than answered by a regexp.
    const drawn = [...paragraphs()]
      .flatMap((one) => piecesOf(one.paragraph).map((piece) => ({ ...one, piece })))
      .flatMap((one) => one.piece.text.split('\n').map((line) => ({ ...one, line: line.trim() })))
      .filter((one) => one.line.length > 0)
      .filter((one) => !/[\p{L}\p{N}]/u.test(one.line));

    expect(drawn.map((one) => `${one.where}: ${JSON.stringify(one.line)}`)).toEqual([]);
  });

  it('drop the fence around words that are not code', () => {
    // `ru/chakras` puts two paragraphs of Sri Ramana Maharshi between ```
    // marks. Nothing knew what a fence was, so the book's rule for inline
    // `code` matched from the third backtick to the fourth: his words were
    // drawn in a monospace font with two stray marks on either side, on the
    // published page, and the two apps showed the marks as text.
    const pieces = piecesOf('```\nHis words, which are prose.\n```');

    expect(pieces).toEqual([{ heading: null, text: 'His words, which are prose.' }]);
  });

  it('drop a heading whose words did not survive the translation', () => {
    // The Turkish glossary holds a paragraph that is two hashes and nothing
    // else. It says nothing, and drawing `##` says less than nothing.
    expect(piecesOf('one\n\n##\n\ntwo').map((piece) => piece.text)).toEqual(['one', 'two']);
  });
});
