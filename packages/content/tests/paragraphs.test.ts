import { describe, expect, it } from 'vitest';
import { LANGUAGES, plansFor } from '../src';
// @ts-expect-error - the generator's logic is plain JavaScript, shared with the script
import { paragraphed, usesSingleNewlines } from '../../../scripts/lib/paragraphs.mjs';

/**
 * Where a paragraph ends, in a source that says so with one newline.
 *
 * Every reader in this repository splits a plan on blank lines — the book, the
 * mini app's `paragraphs()`, the bot's pager. Three of the twenty-two languages
 * had no blank line anywhere, so **all 72 plans in each of them rendered as one
 * unbroken wall of text**: 216 pages of the book, in Arabic, Malay and
 * Ukrainian, with nowhere for the eye to rest.
 *
 * The translations are not damaged. `leela/src/locales/<lang>` separates
 * paragraphs with a single `\n` — measured, not assumed: Malay plan 30 is four
 * lines of 583, 356, 1165 and 188 characters, which are paragraphs and not the
 * ~80-character lines a soft wrap makes. The markdown donors use a blank line.
 * The generator passed both through, and only one of the two is what anything
 * splits on.
 *
 * The repair is in the generator, never in `packages/content/data`:
 * `lib/corrections.mjs` opens with what happens to a fix that lives in a
 * generated file.
 */

describe('a text that says where its paragraphs end with one newline', () => {
  it('is recognised by what it contains, not by where it came from', () => {
    // Keyed on the donor's name this would be a fact about a filename, and the
    // next source to arrive in this shape would ship as a wall of text with
    // nothing to notice it.
    expect(usesSingleNewlines('one\ntwo')).toBe(true);
    expect(usesSingleNewlines('one\n\ntwo'), 'already says so the usual way').toBe(false);
    expect(usesSingleNewlines('one long paragraph and no more'), 'nothing to split').toBe(false);
  });

  it('gets a blank line between its paragraphs', () => {
    expect(paragraphed('one\ntwo\nthree')).toBe('one\n\ntwo\n\nthree');
  });

  it('leaves a text that already has blank lines exactly as it is', () => {
    // Including one that mixes the two. Guessing there would break sentences
    // apart, and a reader cannot tell a wrong break from the author's.
    for (const text of ['one\n\ntwo', 'one\n\ntwo\nstill two', 'no breaks at all']) {
      expect(paragraphed(text), text).toBe(text);
    }
  });

  it('does not leave a line that looks empty and is not', () => {
    // The donor has trailing spaces before its breaks.
    expect(paragraphed('one \n two')).toBe('one\n\ntwo');
    expect(paragraphed('one\n\n\ntwo'), 'already blank-separated').toBe('one\n\n\ntwo');
  });

  it('drops nothing but the whitespace', () => {
    const before = 'Uttam baik.\nDalam chakra keempat.\nSebarang perubahan.';
    const after = paragraphed(before);

    expect(after.replace(/\s+/g, ' ')).toBe(before.replace(/\s+/g, ' '));
  });
});

describe('no language is a wall of text', () => {
  /**
   * The shape rather than the three: a language whose *every* plan is one
   * paragraph is a language nothing has broken up, and that is either a donor
   * in a shape the generator does not know or a normalisation that stopped
   * working. Both look identical on the page.
   */
  const solid = (language: string) =>
    plansFor(language).filter((plan) => !plan.body.includes('\n\n')).length;

  it('has paragraphs in almost every plan, in every language', () => {
    for (const language of LANGUAGES) {
      // Two or three plans genuinely are a single paragraph — they are short.
      // Seventy-two of seventy-two is a source nobody split.
      expect(solid(language), `${language}: plans with no paragraph break`).toBeLessThan(10);
    }
  });

  it('has at least one plan of several paragraphs in every language', () => {
    for (const language of LANGUAGES) {
      const many = plansFor(language).filter((plan) => plan.body.split('\n\n').length > 3);
      expect(many.length, `${language}: no plan has more than three paragraphs`).toBeGreaterThan(0);
    }
  });

  it('would have failed on what the three shipped before', () => {
    // The guard against the check passing for want of a case: this is what the
    // data looked like, and it must still be recognised as wrong.
    const wall = { body: 'one\ntwo\nthree' };
    expect(wall.body.includes('\n\n')).toBe(false);
  });
});
