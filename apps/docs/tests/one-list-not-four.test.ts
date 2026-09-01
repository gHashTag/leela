/**
 * A list separated by blank lines is one list.
 *
 * The plan texts write their enumerations that way — one numbered line, a blank
 * line, the next. Plan 6's four kleshas, plan 58's states of consciousness,
 * plan 64's material contents, and a rules chapter with eleven items in it.
 *
 * `renderMarkdown` splits on blank lines and decides what each block is, so
 * each of those became a list of **one** item with no `start`, and a browser
 * numbers a run of those `1. 1. 1. 1.` Measured over the built book:
 * eighty-four of the hundred and seven pages that have a list said that.
 *
 * Nothing was missing — every word was on the page. Only the numbering, which
 * is the whole of what an enumeration says. A reader met four things all called
 * the first, in a text about four states that follow one another.
 *
 * CommonMark calls blank-line separated items one loose list, and the game
 * shows them as the text writes them, so the standard and the other surface
 * were already agreed. This was the only reader that was not.
 *
 * These assert the shape rather than plan 6: for any run of numbered lines,
 * however the blank lines fall between them, the reader gets one list — and
 * two lists that are genuinely separate stay separate.
 */

import { describe, expect, it } from 'vitest';
import { LANGUAGES, plansFor, rulesFor } from '@leela/content';
import { renderMarkdown } from '../src/render';

/** Every `<ol>`/`<ul>` in some HTML, with the items in it. */
function listsIn(html: string): Array<{ tag: string; items: string[]; start: string }> {
  return [...html.matchAll(/<(ol|ul)([^>]*)>([\s\S]*?)<\/\1>/g)].map((match) => ({
    tag: match[1] as string,
    start: match[2] as string,
    items: [...(match[3] as string).matchAll(/<li>([\s\S]*?)<\/li>/g)].map((one) => one[1] as string),
  }));
}

describe('an enumeration in a plan text', () => {
  it('is one list, however the blank lines fall in it', () => {
    // The shape. Written four ways, because the source is somebody's typing and
    // this repository has met a check that only knew the one shape it was
    // written for.
    const items = ['kama', 'krodha', 'lobha', 'moha'];
    const sources = [
      items.map((item, at) => `${at + 1}. ${item}`).join('\n'),
      items.map((item, at) => `${at + 1}. ${item}`).join('\n\n'),
      items.map((item, at) => `${at + 1}. ${item}`).join('\n\n\n'),
      `1. ${items[0]}\n2. ${items[1]}\n\n3. ${items[2]}\n\n4. ${items[3]}`,
    ];

    for (const source of sources) {
      const lists = listsIn(renderMarkdown(source));

      expect({ source, lists: lists.length }).toEqual({ source, lists: 1 });
      expect(lists[0]?.items).toEqual(items);
    }
  });

  it('keeps a bulleted run together too, and apart from a numbered one', () => {
    // Same rule, and the two kinds are not one list between them: a reader who
    // met four bullets inside a numbered list would be told the wrong thing
    // about which of them are steps.
    const mixed = '- one\n\n- two\n\n1. first\n\n2. second';
    const lists = listsIn(renderMarkdown(mixed));

    expect(lists.map((list) => list.tag)).toEqual(['ul', 'ol']);
    expect(lists[0]?.items).toEqual(['one', 'two']);
    expect(lists[1]?.items).toEqual(['first', 'second']);
  });

  it('leaves two lists apart when a paragraph stands between them', () => {
    // Otherwise the rule would swallow a text that says "and separately:".
    const source = '1. one\n\n2. two\n\nAnd separately:\n\n1. again\n\n2. and again';
    const lists = listsIn(renderMarkdown(source));

    expect(lists).toHaveLength(2);
    expect(lists[0]?.items).toEqual(['one', 'two']);
    expect(lists[1]?.items).toEqual(['again', 'and again']);
  });

  it('numbers nothing itself, so the reader counts what the author wrote', () => {
    // No `start` and no numbers in the items: the browser numbers an `<ol>`
    // from one, and the source's own numbers are the order it is written in.
    const lists = listsIn(renderMarkdown('1. one\n\n2. two\n\n3. three'));

    expect(lists[0]?.start.trim()).toBe('');
    expect(lists[0]?.items).toEqual(['one', 'two', 'three']);
  });

  it('carries every item of every list the book actually holds', () => {
    // The live assertion, over the texts that are shipped rather than over an
    // example: no page may hold two lists of one item with nothing between.
    const wrong: string[] = [];

    for (const language of LANGUAGES) {
      const texts = [
        ...plansFor(language).map((plan) => ({ where: `${language}/${plan.plan}`, body: plan.body })),
        ...rulesFor(language).map((chapter) => ({
          where: `${language}/${chapter.slug}`,
          body: chapter.body,
        })),
      ];

      for (const { where, body } of texts) {
        const lists = listsIn(renderMarkdown(String(body ?? '')));
        const singles = lists.filter((list) => list.items.length === 1);

        // One list of one item is a real thing to write. Two in a row is what
        // the fold exists to prevent, and the only way to have them now is for
        // something to stand between them — which makes them two lists.
        const html = renderMarkdown(String(body ?? ''));
        if (/<\/ol>\s*<ol>|<\/ul>\s*<ul>/.test(html)) {
          wrong.push(`${where}: ${singles.length} list(s) of one, run together`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});
