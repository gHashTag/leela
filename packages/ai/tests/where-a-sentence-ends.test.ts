/**
 * Where the plan text is cut before it is handed to the companion.
 *
 * Six hundred and seventeen of the 1,584 plans are longer than the budget, so
 * most of what the model is told about a square is a trimmed version of it.
 * `trimToParagraph` prefers a paragraph break, falls back to the end of a
 * sentence, and only then cuts where the budget runs out.
 *
 * **It knew where a sentence ends in two scripts.** `. ` and `。`, and nothing
 * else — so for the languages that end one with `।` or `۔` the fallback never
 * matched and the text arrived cut mid-word: Hindi plan 23 stopped inside
 * `सर्वोच`, Urdu plan 23 inside `رہا`. The same blindness cost this repository
 * a measurement once already, when a sweep for texts ending without a
 * terminator called two hundred and ninety-eight Bengali and Hindi plans broken
 * on exactly these two characters.
 *
 * **And three plans ended on a colon with nothing after it.** Plan 64 in Hindi,
 * Malay and Punjabi introduces a list in one paragraph and gives it in the
 * next, so the cut handed the companion *energy manifests itself in three
 * dimensions:* and no dimensions. The rule against that is already written one
 * function up, about a heading with nothing under it: saying less is better
 * than promising and not delivering.
 *
 * Found by building a real prompt and reading every line of it, which is also
 * how the arrival sentence was found to say *They undefined.* — that one was my
 * own probe passing a direction without the mark that belongs to it, and the
 * fifth assertion here is what it taught.
 */

import { describe, expect, it } from 'vitest';
import { LANGUAGES, plansFor } from '@leela/content';
import { MAX_PLAN_CHARS, trimToParagraph } from '../src/prompts';

/** The sentence marks these texts are actually written with. */
const ENDS = /[.。।۔!?»”"')\]]$/u;

describe('the plan text as the companion is given it', () => {
  it('never ends inside a word, in any language', () => {
    // The shape, over what is shipped rather than over an example. A cut is
    // allowed to lose the rest of a text; it is not allowed to lose the rest of
    // a word.
    const broken: string[] = [];

    for (const language of LANGUAGES) {
      for (const plan of plansFor(language)) {
        const body = String(plan.body ?? '');
        if (body.length <= MAX_PLAN_CHARS) continue;

        const cut = trimToParagraph(body).trim();
        if (!ENDS.test(cut)) broken.push(`${language}/${plan.plan}: …${cut.slice(-40)}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it('cuts something, so this is a rule about work being done', () => {
    // Zero trimmed plans would make every assertion here pass on a budget
    // nothing reaches.
    const trimmed = LANGUAGES.flatMap((language) =>
      plansFor(language).filter((plan) => String(plan.body ?? '').length > MAX_PLAN_CHARS),
    );

    expect(trimmed.length).toBeGreaterThan(100);
  });

  it('knows where a sentence ends in the scripts these texts use', () => {
    // Named as well as swept, because the sweep would also pass on a budget so
    // large nothing is ever cut by the fallback.
    const long = (mark: string) =>
      `${'क'.repeat(1400)}${mark} ${'ख'.repeat(1400)}`;

    for (const mark of ['.', '।', '۔', '。']) {
      const cut = trimToParagraph(long(mark), 2400);

      expect({ mark, ends: cut.endsWith(mark) }).toEqual({ mark, ends: true });
    }
  });

  it('does not end on a promise it has cut the answer off', () => {
    // A colon is a sentence that has not finished. The paragraph branch is
    // where this can happen: the list is in the next paragraph, and the cut
    // dropped it.
    const list = 'It manifests in three dimensions:';
    const cut = trimToParagraph(`${'a'.repeat(1600)}. Then this.\n\n${list}\n\n${'b'.repeat(900)}`, 2400);

    expect(cut.endsWith(':')).toBe(false);
    expect(cut.endsWith('.')).toBe(true);
  });

  it('has no guard where a guard could not act', () => {
    // Written on both ways out first. On the sentence branch the cut always
    // lands on a sentence mark, and on the raw branch there is by definition no
    // mark after the halfway point to step back to — so the check could never
    // fire there, and a line that reads like a guard and cannot act is worse
    // than no line. Asserted rather than deleted quietly: this is the case that
    // proved it, and it must keep coming out whole.
    const head = `Опыт начинается так. ${'слово '.repeat(400)}`.slice(0, 2399);
    const cut = trimToParagraph(`${head}:${'и дальше без единой точки '.repeat(20)}`, 2400);

    expect(cut).toHaveLength(2400);
    expect(cut.endsWith(':')).toBe(true);
  });

  it('keeps a colon that is all there is, rather than handing over nothing', () => {
    // The other half. A text whose first sentence ends in a colon would lose
    // everything, and a companion told nothing about the square is worse off
    // than one told a sentence that trails.
    const cut = trimToParagraph(`Three dimensions:${'c'.repeat(3000)}`, 2400);

    expect(cut.length).toBeGreaterThan(1200);
  });

  it('leaves a text inside the budget exactly as it is', () => {
    const short = 'One paragraph, complete.\n\nAnd a second one.';

    expect(trimToParagraph(short)).toBe(short);
  });
});
