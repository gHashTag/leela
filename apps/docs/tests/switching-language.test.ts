/**
 * A reader who switches language keeps the page they were reading.
 *
 * `languagePicker` was written for this, and its own docstring says the two
 * things it has to keep apart: *sending a person to the contents is help,
 * telling a crawler that the contents is a translation of a chapter is false.*
 * The two answers were one callback, so a page could only be linked to if it
 * was a **translation** — and for the legal pages that is not the question.
 *
 * Every language is served `legal/policy.html` and `legal/eula.html`, in
 * English wherever nobody translated them, because a missing privacy policy is
 * a store rejection and a blocker for a Telegram mini app. The build says so in
 * its own comment: *the page is still filed under `language` and still linked
 * from that contents — it is served, as it must be.* Only English and Russian
 * were written, so the picker refused the other twenty and dropped the reader
 * at the front of the book in the language they chose. Counted over the built
 * book: **840 links**, on a page that was there in every one of them.
 *
 * These assert the rule rather than the two files it was found on: for any page
 * of the book, the picker offers a language exactly when that language has the
 * page, and `hreflang` names a language exactly when the text is that
 * language's own.
 */

import { describe, expect, it } from 'vitest';
import { LANGUAGES, type Language } from '@leela/content';
import { legalPage, page } from '../src/render';

/** Every `<a lang=… href=…>` the picker offers, as a map. */
function picker(html: string): Map<string, string> {
  const nav = /<nav class="languages"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
  return new Map([...nav.matchAll(/<a lang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1]!, m[2]!]));
}

/** Every language `hreflang` claims a translation for. */
function alternates(html: string): string[] {
  return [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((language) => language !== 'x-default');
}

const policy = (language: Language) =>
  legalPage({
    language,
    name: 'policy',
    title: 'Privacy policy',
    body: 'Privacy Policy\n\nWe collect nothing at all.',
    writtenIn: language === 'ru' ? 'ru' : 'en',
    translatedInto: ['en', 'ru'],
    servedTo: LANGUAGES,
  });

describe('the language picker on a page every language is served', () => {
  it('offers the page itself, in every language, from every language', () => {
    // The shape: served everywhere, offered everywhere. Not "twenty of them
    // are English underneath" — that is what `hreflang` and `lang` are for.
    const dropped: string[] = [];

    for (const from of LANGUAGES) {
      const links = picker(policy(from));

      for (const to of LANGUAGES) {
        if (to === from) continue;
        const href = links.get(to);
        if (href !== `../../${to}/legal/policy.html`) {
          dropped.push(`${from} → ${to}: ${href ?? '(not offered)'}`);
        }
      }
    }

    expect(dropped).toEqual([]);
  });

  it('claims a translation only where the text is that language', () => {
    // The other half, and the reason the two answers had to be told apart. An
    // alternate that is not a translation tells a crawler something false.
    for (const from of LANGUAGES) {
      expect({ from, alternates: alternates(policy(from)) }).toEqual({
        from,
        alternates: ['en', 'ru'],
      });
    }
  });

  it('shows the language being read as itself, not as a link away from it', () => {
    const html = policy('ja');

    expect(picker(html).has('ja')).toBe(false);
    expect(html).toContain('<span class="current" lang="ja">');
  });
});

describe('the language picker on a page some languages do not have', () => {
  const chapter = (has: ReadonlyArray<Language>, language: Language) =>
    page({
      title: 'The chakras',
      language,
      root: '../../',
      path: 'rules/chakras.html',
      description: 'a chapter',
      body: '<p>a chapter</p>',
      pathFor: (other) => (has.includes(other) ? 'rules/chakras.html' : null),
    });

  it('sends a reader to the contents where the page is not there', () => {
    // Unchanged, and the reason `null` exists: a language whose book has no
    // such chapter has nothing to link to, and a 404 is worse than a contents.
    const links = picker(chapter(['en', 'ru'], 'en'));

    expect(links.get('ru')).toBe('../../ru/rules/chakras.html');
    expect(links.get('ar')).toBe('../../ar/');
  });

  it('does not claim an alternate for a page that is not there', () => {
    expect(alternates(chapter(['en', 'ru'], 'en'))).toEqual(['en', 'ru']);
  });

  it('answers both questions the same way when they are the same question', () => {
    // Which is every page but the legal ones: a chapter a language carries is
    // both served and translated, and one callback answers for both.
    const html = chapter(LANGUAGES, 'en');

    expect(alternates(html)).toEqual([...LANGUAGES]);
    for (const other of LANGUAGES) {
      if (other === 'en') continue;
      expect(picker(html).get(other)).toBe(`../../${other}/rules/chakras.html`);
    }
  });
});
