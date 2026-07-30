import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS, allPlans } from '@leela/engine';
import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
  bookFor,
  couldBe,
  isLanguage,
  planFor,
  plansFor,
  resolveLanguage,
  ruleChapter,
  rulesFor,
} from '../src';

describe('coverage', () => {
  it.each(LANGUAGES)('%s has all 72 plans, numbered 1..72 in order', (lang) => {
    const plans = plansFor(lang);
    expect(plans).toHaveLength(TOTAL_PLANS);
    expect(plans.map((p) => p.plan)).toEqual(allPlans());
  });

  it.each(LANGUAGES)('%s has a title and body for every plan', (lang) => {
    for (const plan of plansFor(lang)) {
      expect(plan.title.length, `${lang} plan ${plan.plan} title`).toBeGreaterThan(0);
      expect(plan.body.length, `${lang} plan ${plan.plan} body`).toBeGreaterThan(0);
    }
  });

  it.each(LANGUAGES)('%s records provenance for every plan', (lang) => {
    for (const plan of plansFor(lang)) {
      expect(plan.source, `${lang} plan ${plan.plan}`).toMatch(/\S/);
    }
  });

  it.each(LANGUAGES)('%s has rules chapters', (lang) => {
    expect(rulesFor(lang).length, lang).toBeGreaterThan(0);
  });

  it('covers the languages both shipped apps supported', () => {
    // leela v6.5.1 shipped these ten; nothing may regress.
    for (const lang of ['ar', 'bn', 'en', 'fr', 'mr', 'ms', 'ru', 'te', 'tr', 'uk']) {
      expect(LANGUAGES).toContain(lang);
    }
  });

  // The first version of these checks only knew the words "plan" and "план",
  // so 744 titles across 15 languages kept their numbering — योजना 1. जन्म,
  // 计划 1. 出生, 플랜 1. 탄생 — and nothing failed. Assert on the shape of the
  // defect instead of on a list of words.

  it('leaves no plan number in any title', () => {
    for (const lang of LANGUAGES) {
      for (const plan of plansFor(lang)) {
        // The number followed by a separator is numbering in any script.
        expect(plan.title, `${lang} plan ${plan.plan}: "${plan.title}"`).not.toMatch(
          new RegExp(`\\b${plan.plan}\\s*[.:)]`),
        );
      }
    }
  });

  it('never falls back to the bare plan number as a title', () => {
    for (const lang of LANGUAGES) {
      for (const plan of plansFor(lang)) {
        // This is what a title looks like when the heading failed to parse.
        expect(plan.title.trim(), `${lang} plan ${plan.plan}`).not.toMatch(/^\d+$/);
      }
    }
  });

  it('leaves no markdown heading inside a body', () => {
    for (const lang of LANGUAGES) {
      for (const plan of plansFor(lang)) {
        // Includes the fullwidth number sign a CJK keyboard produces.
        expect(plan.body.trimStart()[0], `${lang} plan ${plan.plan}`).not.toMatch(/[#＃]/);
      }
    }
  });

  it('gives every plan a title long enough to be a word', () => {
    for (const lang of LANGUAGES) {
      for (const plan of plansFor(lang)) {
        // One character is a word in CJK, so the floor has to be low; the
        // checks above are what catch a title that is really a stray number.
        expect(plan.title.trim().length, `${lang} plan ${plan.plan}`).toBeGreaterThan(0);
      }
    }
  });

  // An audit of the 19 machine-translated languages found no term-level damage:
  // parenthesised transliterations survive everywhere, no two plans share a
  // body, and body lengths sit where a script's density predicts. These are
  // the guards that would catch a regression in a future rebuild.

  it('keeps the transliterated term in every title that had one', () => {
    // English carries a term in parentheses on 63 of the 72 plans.
    const withTerm = new Set(
      plansFor('en')
        .filter((p) => /[(（][^)）]+[)）]/.test(p.title))
        .map((p) => p.plan),
    );
    expect(withTerm.size).toBeGreaterThanOrEqual(63);

    for (const lang of LANGUAGES) {
      const missing = plansFor(lang)
        .filter((p) => withTerm.has(p.plan) && !/[(（][^)）]+[)）]/.test(p.title))
        .map((p) => p.plan);
      // A couple of languages drop one; a wholesale loss means the source
      // regressed or the parser started eating parentheses.
      expect(missing.length, `${lang} lost terms on plans ${missing.join(', ')}`).toBeLessThan(5);
    }
  });

  it('gives no two plans the same body', () => {
    for (const lang of LANGUAGES) {
      const bodies = plansFor(lang).map((p) => p.body.trim());
      expect(new Set(bodies).size, `${lang} has duplicated bodies`).toBe(bodies.length);
    }
  });

  it('keeps every body long enough to be the actual text', () => {
    for (const lang of LANGUAGES) {
      for (const plan of plansFor(lang)) {
        // The shortest real plan text runs to a few hundred characters even in
        // the densest scripts; anything near zero is a truncated translation.
        expect(plan.body.length, `${lang} plan ${plan.plan}`).toBeGreaterThan(150);
      }
    }
  });

  it('keeps each language within a plausible length of the English', () => {
    const english = plansFor('en').reduce((sum, p) => sum + p.body.length, 0);
    for (const lang of LANGUAGES) {
      const total = plansFor(lang).reduce((sum, p) => sum + p.body.length, 0);
      const ratio = total / english;
      // CJK packs the same meaning into roughly a third of the characters, so
      // the floor has to accommodate it; the ceiling catches duplicated text.
      expect(ratio, `${lang} is ${ratio.toFixed(2)}x English`).toBeGreaterThan(0.25);
      expect(ratio, `${lang} is ${ratio.toFixed(2)}x English`).toBeLessThan(1.5);
    }
  });

  it('keeps titles distinct within a language', () => {
    for (const lang of LANGUAGES) {
      const titles = plansFor(lang).map((p) => p.title.trim());
      const duplicated = titles.filter((t, i) => titles.indexOf(t) !== i);
      // A handful of plans genuinely share a name across the board; a large
      // overlap means the titles collapsed into something generic.
      expect(new Set(duplicated).size, `${lang}: ${[...new Set(duplicated)].join(', ')}`)
        .toBeLessThan(5);
    }
  });
});

describe('planFor', () => {
  it('returns the requested plan', () => {
    expect(planFor('en', 1).plan).toBe(1);
    expect(planFor('ru', 68).plan).toBe(68);
    expect(planFor('en', TOTAL_PLANS).plan).toBe(TOTAL_PLANS);
  });

  it('rejects plans off the board', () => {
    for (const bad of [0, -1, 73, 1.5, NaN]) {
      expect(() => planFor('en', bad)).toThrow(RangeError);
    }
  });

  it('names plan 1 birth and plan 68 cosmic consciousness in English', () => {
    expect(planFor('en', 1).title.toLowerCase()).toContain('birth');
    expect(planFor('en', 68).title.toLowerCase()).toMatch(/cosmic|consciousness/);
  });
});

describe('language resolution', () => {
  it('accepts a bare tag', () => {
    expect(resolveLanguage('ru')).toBe('ru');
  });

  it('accepts a region or script subtag', () => {
    expect(resolveLanguage('ru-RU')).toBe('ru');
    expect(resolveLanguage('en_GB')).toBe('en');
    expect(resolveLanguage('zh-Hans')).toBe('zh');
    expect(resolveLanguage('PT-br')).toBe('pt');
  });

  it('falls back for anything it does not cover', () => {
    for (const unknown of ['kl', 'xx-YY', '', null, undefined]) {
      expect(resolveLanguage(unknown)).toBe(FALLBACK_LANGUAGE);
    }
  });

  it('recognises exactly the covered languages', () => {
    expect(isLanguage('ru')).toBe(true);
    expect(isLanguage('kl')).toBe(false);
  });

  it('serves an unknown locale rather than failing', () => {
    expect(plansFor('kl')).toHaveLength(TOTAL_PLANS);
    expect(planFor('kl', 42).plan).toBe(42);
  });
});

describe('rules chapters', () => {
  it('finds a chapter by slug', () => {
    const intro = ruleChapter('ru', 'introduction');
    expect(intro).not.toBeNull();
    expect(intro?.body.length).toBeGreaterThan(0);
  });

  it('returns null for a slug that does not exist', () => {
    expect(ruleChapter('en', 'no-such-chapter')).toBeNull();
  });

  it('serves every chapter in the language it is filed under', () => {
    // The English book had a seventh chapter written in Russian —
    // `game-logic.md`, developer notes on the NeuroLeela rewrite, filed among
    // six numbered English files in a donor repository and mapped straight
    // through to the docs site. A test used to assert its presence, on the
    // strength of its slug.
    //
    // The rule, not the chapter: whatever the book contains, a reader gets
    // their own language.
    for (const language of LANGUAGES) {
      for (const chapter of rulesFor(language)) {
        expect(couldBe(language, chapter.title ?? ''), `${language}/${chapter.slug} title`).toBe(true);
        expect(
          couldBe(language, chapter.body.slice(0, 2000)),
          `${language}/${chapter.slug} body`,
        ).toBe(true);
      }
    }
  });

  it('gives every language the same book, or the difference is deliberate', () => {
    // Four different chapter sets shipped across 22 languages, and one of the
    // differences was a Russian file. This does not demand uniformity — `ar`,
    // `ms` and `uk` genuinely carry chapters from the published app that the
    // others do not — it demands that English, the fallback every language
    // reads when its own is missing, is not the odd one out.
    const english = rulesFor('en').map((chapter) => chapter.slug);
    const common = rulesFor('de').map((chapter) => chapter.slug);

    expect(english).toEqual(common);
  });
});

describe('the book a reader gets', () => {
  /**
   * "The language's chapters, or English when it has none" was written out five
   * times: twice in the bot, twice in the mini app, and its absence once in the
   * docs. Four of those were written in one afternoon by one author, which is
   * how quickly a rule spreads once it lives nowhere.
   *
   * The distinction that made it worth one home rather than five: a reader
   * *shown* English has been helped, and a published `/de/rules/notes.html`
   * holding English has been misled. `audit-dataset.mjs` forbids the second,
   * which is why `apps/docs` deliberately does not call this.
   */

  it('is never empty, for any language the package declares', () => {
    for (const language of LANGUAGES) {
      expect(bookFor(language).length, language).toBeGreaterThan(0);
    }
  });

  it("keeps the language's own chapters, first and untouched", () => {
    // This used to say the book *is* the language's own chapters, and that was
    // right while the only failure was a language with nothing. It is not the
    // only failure: Ukrainian, Malay and Arabic carry `online` and `foreword`
    // — a chat-moderation policy and a preface — and no chapter on the
    // chakras, because those three came through a different donor with a
    // different table of contents.
    //
    // So what a reader has is never displaced, and what they are missing is
    // added after it rather than left out.
    for (const language of LANGUAGES) {
      const own = rulesFor(language);
      if (own.length === 0) continue;

      expect(bookFor(language).slice(0, own.length), language).toEqual(own);
    }
  });

  it('borrows a chapter the reader’s book does not have, and says so', () => {
    // The choice was never "one language or two". It was "the chapter in
    // English or no chapter at all", and a reader cannot read what is not
    // there. `borrowed` is how the difference between "written for you" and
    // "the only copy there is" survives to the surface showing it.
    for (const language of LANGUAGES) {
      const own = new Set(rulesFor(language).map((chapter) => chapter.slug));
      if (own.size === 0) continue;

      for (const chapter of bookFor(language)) {
        expect(chapter.borrowed ?? false, `${language}/${chapter.slug}`).toBe(
          !own.has(chapter.slug),
        );
      }
    }
  });

  it('leaves no language without a chapter the two editions agree on', () => {
    // The rule, rather than the three languages that broke it: whatever both
    // English and Russian teach, every reader can reach.
    const shared = rulesFor('en')
      .map((chapter) => chapter.slug)
      .filter((slug) => rulesFor('ru').some((chapter) => chapter.slug === slug));

    expect(shared.length).toBeGreaterThan(0);

    for (const language of LANGUAGES) {
      const covered = new Set(bookFor(language).map((chapter) => chapter.slug));
      for (const slug of shared) expect(covered.has(slug), `${language}/${slug}`).toBe(true);
    }
  });

  it('is the English book, whole, for anything it cannot serve', () => {
    // Not chapter by chapter: half in one language and half in another is
    // worse than one a reader can at least read.
    //
    // An unknown locale never reaches the guard — `resolveLanguage` turns it
    // into English first. What the guard is for is a *declared* language whose
    // book is empty, which no rebuild has produced yet and which five
    // hand-written copies of this line were each trying to cover.
    expect(bookFor('zz')).toEqual(rulesFor(FALLBACK_LANGUAGE));
    expect(bookFor('')).toEqual(rulesFor(FALLBACK_LANGUAGE));
  });

  it('serves something for every locale a person could type', () => {
    // The property that matters at a call site: no caller has to think about
    // an empty list, which is what all five copies were avoiding.
    for (const locale of ['ru', 'RU', 'ru-RU', 'zz', '', 'en-GB', '  ']) {
      expect(bookFor(locale).length, JSON.stringify(locale)).toBeGreaterThan(0);
    }
  });

  it('is a book whose chapters all open', () => {
    // A list where something is a dead end is worse than a shorter list.
    for (const language of LANGUAGES) {
      for (const chapter of bookFor(language)) {
        expect(chapter.body.trim().length, `${language}/${chapter.slug}`).toBeGreaterThan(0);
      }
    }
  });
});
