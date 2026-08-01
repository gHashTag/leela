import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank as code } from '../../../scripts/lib/source.mjs';
import { LANGUAGES, messageFor, plansFor, rulesFor } from '@leela/content';
import { TOTAL_PLANS } from '@leela/engine';
import { chapterPage, indexPage, legalPage, planPage } from '../src/render';

/**
 * The book says what it says in the reader's language.
 *
 * It generates 1,784 pages in twenty-two languages and said **no catalogue key
 * at all** — the only surface in this repository that spoke none. A Russian
 * reader met Russian plan text under *The rules*, *The 72 plans* and *Legal*,
 * with *Contents* under every page and *Play* in the corner, and a language
 * picker whose name for a screen reader was *Language*.
 *
 * Found by looking for what the mini app had just been caught by, one surface
 * over: eleven of fifteen controls named from the catalogue there, none of them
 * here. Six of the seven keys did not exist and were written; `app.rules` and
 * `app.plans` already did, said by two other surfaces and by neither of this
 * one's pages.
 *
 * Twenty of the twenty-two fall back to English, which is `@leela/content`'s
 * stated position and a visible gap rather than an invisible guess.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
/**
 * The file with what it says about itself blanked out, character for character.
 *
 * This file documents the strings it removed, and `build.ts` quotes
 * `LEGAL_TITLES[name] ?? name` as the thing that was wrong — which a plain
 * reader counts as the defect still being there. The lesson is two passes old
 * and was not applied here until the check accused its own explanation.
 */

/**
 * The generator, without the one page that is in no language.
 *
 * `rootPage` is the language picker: it belongs to nobody's language and says
 * *Play* and the subtitle in English on purpose, which is why a rule reading
 * "no English anywhere" would be a different and wrong rule.
 */
const RENDER = (() => {
  const whole = code(readFileSync(join(SRC, 'render.ts'), 'utf8'));
  const root = whole.indexOf('export function rootPage');
  return root === -1 ? whole : whole.slice(0, root);
})();

const BUILD = code(readFileSync(join(SRC, 'build.ts'), 'utf8'));
const RENDER_WHOLE = readFileSync(join(SRC, 'render.ts'), 'utf8');

/** A page of each kind, in one language. */
function pages(language: (typeof LANGUAGES)[number]) {
  return {
    contents: indexPage(language, plansFor(language), rulesFor(language)),
    plan: planPage(language, plansFor(language)[0]!, TOTAL_PLANS),
    chapter: chapterPage(language, rulesFor(language)[0] ?? {
      slug: 'x',
      title: 'x',
      body: 'x',
      source: 'test',
    }),
  };
}

describe('the chrome is in the reader\'s language', () => {
  it('says every heading the contents page carries', () => {
    const russian = pages('ru').contents;

    for (const key of ['app.rules', 'app.plans', 'app.legal', 'app.policy', 'app.terms'] as const) {
      expect(russian, key).toContain(messageFor('ru', key));
    }
  });

  it('says the subtitle, and agrees with the number in it', () => {
    /**
     * A count, and Russian agrees with one. Written flat it read *Игра
     * самопознания — 72 планов*, the genitive plural for a number ending in
     * five; seventy-two takes the few form. `Intl.PluralRules` decides, which
     * is what the catalogue's plural machinery is for.
     */
    expect(pages('ru').contents).toContain(
      messageFor('ru', 'app.book', { count: plansFor('ru').length }),
    );
    expect(messageFor('ru', 'app.book', { count: 72 })).toContain('72 плана');
    expect(messageFor('ru', 'app.book', { count: 1 })).toContain('1 план');
  });

  it('says the pager and the header on every kind of page', () => {
    const russian = pages('ru');

    for (const [kind, html] of Object.entries(russian)) {
      if (kind !== 'contents') {
        expect(html, `${kind}: the way back`).toContain(messageFor('ru', 'app.contents'));
      }
      expect(html, `${kind}: the game`).toContain(messageFor('ru', 'app.play'));
    }
  });

  it('names the language picker for a screen reader', () => {
    // The picker is a row of language names; its own name is the only thing
    // that says what the row is for.
    expect(pages('ru').contents).toContain(`aria-label="${messageFor('ru', 'app.language')}"`);
  });

  it('is English wherever there is no translation, and says so by falling back', () => {
    // The catalogue's stated position: only `en` and `ru` are complete, and the
    // other twenty fall back rather than blank. A visible gap, not a guess.
    expect(pages('de').contents).toContain(messageFor('en', 'app.rules'));
  });
});

describe('nothing a reader sees is written into the generator', () => {
  /**
   * The shape rather than the seven that were found. A string in the source is
   * a string that cannot be translated, and this surface had eight of them.
   */
  const ENGLISH = [
    ['the rules', /'The rules'|>The rules</],
    ['the plans', /'The 72 plans'|>The 72 plans</],
    ['legal', /'Legal'|>Legal</],
    ['a legal document', /'Privacy policy'|'Terms of use'/],
    ['the way back', /'Contents'|>Contents</],
    ['the game', /'Play'|>Play</],
    ['the picker', /aria-label="Language"/],
    ['the subtitle', /The game of self-knowledge/],
  ] as const;

  it.each(ENGLISH)('does not spell out %s', (_what, pattern) => {
    expect(RENDER, 'render.ts').not.toMatch(pattern);
    expect(BUILD, 'build.ts').not.toMatch(pattern);
  });

  it('leaves the site\'s own name, which is not a word to translate', () => {
    // `Leela` is the game. The guard against reading the rule above as "no
    // literal anywhere", which would be a different and wrong rule.
    expect(RENDER).toContain("SITE_NAME = 'Leela'");
  });

  it('says the contents page\'s description in the reader\'s language too', () => {
    // The one that survived the first sweep: a `<meta name="description">`
    // written in English with the language's own name spliced into it — *The
    // game of self-knowledge in Русский* — so every search result and every
    // Telegram preview of a contents page was in English.
    const russian = pages('ru').contents;
    const described = /name="description" content="([^"]*)"/.exec(russian)?.[1];

    expect(described).toBe(messageFor('ru', 'app.book', { count: plansFor('ru').length }));
    expect(described, 'not English with a Russian word in it').not.toMatch(/self-knowledge/);
  });

  it('still lets the root page speak English, being in no language', () => {
    expect(RENDER_WHOLE, 'the picker page is the exception').toMatch(
      /export function rootPage[\s\S]*The game of self-knowledge/,
    );
  });
});

describe('a legal document nobody has named', () => {
  it('stops the build rather than publishing its filename', () => {
    /**
     * `LEGAL_TITLES[name] ?? name` would have published a `legal/cookies.en.md`
     * with **cookies** as its heading, its `<title>` and its `og:title`, in all
     * twenty-two languages. The map is typed over the documents that exist, so
     * a third will not compile; this is the run-time half, for a file that
     * appears in the directory without anyone touching the map.
     */
    expect(BUILD).toContain('no title declared for this document');
    expect(BUILD, 'no fallback to the file name').not.toMatch(/LEGAL_TITLES\[\w+\]\s*\?\?/);
  });
});

describe('an untranslated legal page is English throughout', () => {
  it('carries English chrome under an English document', () => {
    /**
     * The page declares `lang="en"` when the body is the English document —
     * decided when the pages stopped claiming to be Arabic — so Russian chrome
     * inside it would be the two halves of one page disagreeing.
     */
    const german = legalPage({
      language: 'de',
      name: 'policy',
      title: messageFor('en', 'app.policy'),
      body: 'We collect nothing.',
      writtenIn: 'en',
      translatedInto: ['en', 'ru'],
    });

    expect(german).toContain('<html lang="en"');
    expect(german).toContain(messageFor('en', 'app.contents'));
    expect(german).not.toContain(messageFor('de', 'app.contents') === messageFor('en', 'app.contents')
      ? ' never'
      : messageFor('de', 'app.contents'));
  });

  it('carries the reader\'s chrome where the document really is theirs', () => {
    const russian = legalPage({
      language: 'ru',
      name: 'policy',
      title: messageFor('ru', 'app.policy'),
      body: 'Мы ничего не собираем.',
      writtenIn: 'ru',
      translatedInto: ['en', 'ru'],
    });

    expect(russian).toContain('<html lang="ru"');
    expect(russian).toContain(messageFor('ru', 'app.contents'));
  });
});
