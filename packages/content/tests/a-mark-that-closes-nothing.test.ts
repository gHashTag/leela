/**
 * A quotation mark with nothing on the other end of it.
 *
 * The eighth plan ended with one, in eighteen languages. The donor has it —
 * `translate-leela/docs/8-greed.md` holds exactly one `"` and it is the last
 * character of the file — and every machine translation carried it down:
 * seventeen at the very end, and the Spanish one character in, because Spanish
 * sets the full stop outside the quotation.
 *
 * That one is repaired in the generator, and the case for repairing it is
 * counted rather than argued. The mark closes nothing, which counting says in
 * every language at once. The two sources of this text that did not come
 * through that donor disagree with it: the Russian, written rather than
 * translated, has no quotation in plan 8 at all, and Arabic, Malay and
 * Ukrainian carry a properly paired one around a different phrase. And removing
 * it removes no words, which is the line `lib/corrections.mjs` draws.
 *
 * Three others are left alone, and the difference is the point. Each is in one
 * language only, and each is a mark that was **lost** rather than one that was
 * added: Arabic plan 17 keeps one of the English text's six, French plan 43
 * opens `«` and never closes it, Malay plan 10 has one of two. Putting those
 * right means deciding where a quotation ends, which is deciding what the
 * sentence says, and this repository does not translate.
 *
 * So these assert two things: that the repair is in the shipped data, and that
 * what is left is the three that were read and understood — no more, and no
 * fewer, because a mark that quietly disappears upstream should be looked at
 * too.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { LANGUAGES, plansFor, rulesFor, loadEveryLanguage } from '../src/index';

const QUOTES = /["“”„«»「」]/g;

/** Every text a reader can open, with the quotation marks it holds. */
function marksIn(): Array<{ where: string; language: string; marks: string[] }> {
  const all: Array<{ where: string; language: string; marks: string[] }> = [];

  for (const language of LANGUAGES) {
    for (const plan of plansFor(language)) {
      all.push({
        where: `plan ${plan.plan}`,
        language,
        marks: String(plan.body ?? '').match(QUOTES) ?? [],
      });
    }

    for (const chapter of rulesFor(language)) {
      all.push({
        where: chapter.slug,
        language,
        marks: String(chapter.body ?? '').match(QUOTES) ?? [],
      });
    }
  }

  return all;
}

/**
 * The three that were read, each with the reason it is not repaired.
 *
 * Not a list of exemptions. Every one was opened, compared against the English
 * it was made from, and left because putting it right needs a decision about
 * where a quotation begins or ends.
 */
const READ_AND_LEFT = [
  // Six marks in the English, one here: five were lost, and which of the
  // several quotations this one opens is not a thing counting can answer.
  'ar plan 17',
  // Opens `«` and never closes it. Where the closing guillemet goes is a
  // reading of the sentence.
  'fr plan 43',
  // Two in the English, one here, and it sits inside a phrase rather than
  // around one.
  'ms plan 10',
];

describe('a quotation mark alone in a text', () => {
  it('is gone from the eighth plan, in every language that carried it', () => {
    // The repair, asserted in the shipped data rather than in the generator: a
    // correction that lives only in the code that applies it is a correction
    // that a rebuild can undo without anybody noticing.
    const eighth = marksIn().filter((text) => text.where === 'plan 8' && text.marks.length === 1);

    expect(eighth.map((text) => text.language)).toEqual([]);
  });

  it('leaves the pairs the eighth plan really has alone', () => {
    // Arabic, Malay and Ukrainian quote a phrase in plan 8 and close it. The
    // repair must not reach a body that has a quotation in it, or it would take
    // one end off a real pair and make the thing it was written to remove.
    for (const language of ['ar', 'ms', 'uk'] as const) {
      const body = String(plansFor(language).find((plan) => plan.plan === 8)?.body ?? '');

      expect({ language, marks: (body.match(QUOTES) ?? []).length }).toEqual({ language, marks: 2 });
    }
  });

  it('is nowhere else but the three that were read', () => {
    // Both directions. A fourth is a donor defect nobody has looked at; a
    // missing one is a repair upstream, or a check that has stopped matching,
    // and those look identical from here.
    const lonely = marksIn()
      .filter((text) => text.marks.length === 1)
      .map((text) => `${text.language} ${text.where}`)
      .sort();

    expect(lonely).toEqual([...READ_AND_LEFT].sort());
  });

  it('is what it is because a mark cannot pair with itself', () => {
    // The instrument. A straight `"` opens and closes, so an odd count is the
    // only thing that can be said about it without reading the sentence — and
    // one is the odd count that needs no judgement at all: there is nothing it
    // could have paired with.
    expect('a "quoted" phrase'.match(QUOTES)).toHaveLength(2);
    expect('a phrase that ends"'.match(QUOTES)).toHaveLength(1);
  });
});

/**
 * Every language's text, in memory, before anything asks for it.
 *
 * Twenty-one of the twenty-two are loaded on demand now — the board's entry
 * carried 6.6 MB of plan text to a reader of one language, and only English is
 * static because it is the fallback. A suite that reads other languages has to
 * say so, and this is that saying: without it these tests would quietly
 * measure English twenty-two times and pass.
 */
beforeAll(loadEveryLanguage);

