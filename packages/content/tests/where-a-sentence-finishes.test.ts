/**
 * The marks a sentence ends with, counted off the texts rather than remembered.
 *
 * This list has been written short twice, in two different files, and both
 * times the same two characters were missing.
 *
 * `trimToParagraph` in `@leela/ai` knew `.` and `。`, so the plan text reached
 * the companion cut mid-word for every language that ends a sentence with `।`
 * or `۔` — Hindi plan 23 stopped inside `सर्वोच`, Urdu plan 23 inside `رہا`.
 * `whole`, one file over, trims the companion's own reply back to the last
 * sentence that finished and knew six marks without those two: a Hindi or Urdu
 * player whose reply ran out of tokens read the half sentence every other
 * language is spared, which is the defect that function's own comment describes.
 * And a sweep for texts ending without a terminator called two hundred and
 * ninety-eight Bengali and Hindi plans broken, on the same two characters again.
 *
 * Three places, one omission. So the list is here, where the languages are, and
 * these assert what makes it right: that it accounts for how the shipped texts
 * actually end, and that nothing carries a second copy of it.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES, SENTENCE_ENDS, lastSentenceEnd, plansFor, rulesFor } from '../src/index';

/** The last character of every paragraph long enough to be one. */
function paragraphEndings(): string[] {
  const ends: string[] = [];

  for (const language of LANGUAGES) {
    const texts = [
      ...plansFor(language).map((plan) => String(plan.body ?? '')),
      ...rulesFor(language).map((chapter) => String(chapter.body ?? '')),
    ];

    for (const body of texts) {
      for (const paragraph of body.split(/\n{2,}/)) {
        const trimmed = paragraph.trim();
        if (trimmed.length < 40) continue;

        const last = trimmed.slice(-1);
        if (/[\p{P}\p{S}]/u.test(last)) ends.push(last);
      }
    }
  }

  return ends;
}

describe('where a sentence finishes', () => {
  it('accounts for all but a handful of how the shipped texts end', () => {
    // The measurement the list is made of. Not every paragraph ends on a
    // sentence mark — some end on a colon, a bracket or a quotation — but the
    // marks that carry the weight must all be in it.
    const endings = paragraphEndings();
    const covered = endings.filter((mark) => (SENTENCE_ENDS as readonly string[]).includes(mark));

    expect(endings.length).toBeGreaterThan(5000);
    expect(covered.length / endings.length).toBeGreaterThan(0.97);
  });

  it('holds every mark that ends more than a hundred paragraphs', () => {
    // The shape rather than the four: whatever the texts lean on, the list has
    // it. A twenty-third language arriving with its own mark fails here on the
    // day it lands, rather than in a reply somebody reads half of.
    const counted = new Map<string, number>();
    for (const mark of paragraphEndings()) counted.set(mark, (counted.get(mark) ?? 0) + 1);

    const carried = [...counted]
      .filter(([, times]) => times > 100)
      .map(([mark]) => mark)
      .filter((mark) => !(SENTENCE_ENDS as readonly string[]).includes(mark))
      // A colon ends a paragraph that introduces the next one; it is not the
      // end of a sentence, and `trimToParagraph` steps back from one on purpose.
      .filter((mark) => mark !== ':');

    expect(carried).toEqual([]);
  });

  it('finds the last one, in each of the scripts that differ', () => {
    for (const [mark, tail] of [
      ['.', 'sit with it. And then the thing'],
      ['।', 'बैठें। और फिर आपने जो'],
      ['۔', 'بیٹھیں۔ اور پھر جو'],
      ['。', '求めます。そしてあなたが'],
    ] as Array<[string, string]>) {
      const at = lastSentenceEnd(tail);

      expect({ mark, at: tail[at] }).toEqual({ mark, at: mark });
    }
  });

  it('says so rather than guessing when a text has finished nothing', () => {
    expect(lastSentenceEnd('half a thought with nowhere to stop')).toBe(-1);
  });

  it('is not written out a second time anywhere', () => {
    // The reason this file exists. Two copies drifted apart once each; a third
    // would drift too, and a list of marks in a source file is exactly what
    // that looks like.
    const suspects = [
      'packages/ai/src/model.ts',
      'packages/ai/src/prompts.ts',
      'apps/bot/src/commands.ts',
      'apps/miniapp/src/main.ts',
      'apps/mobile/src/journal.ts',
      'apps/docs/src/render.ts',
    ];

    const written: string[] = [];
    for (const file of suspects) {
      const text = readFileSync(join(import.meta.dirname, '..', '..', '..', file), 'utf8');

      for (const [index, line] of text.split('\n').entries()) {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*')) continue;
        // Two or more of the marks quoted on one line is a list of them.
        const quoted = (SENTENCE_ENDS as readonly string[]).filter((mark) =>
          code.includes(`'${mark}'`),
        );
        if (quoted.length > 1) written.push(`${file}:${index + 1}`);
      }
    }

    expect(written).toEqual([]);
  });
});
