import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS, allPlans } from '@leela/engine';
import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
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

  it('keeps the mechanics chapter that documents the board', () => {
    expect(ruleChapter('en', 'mechanics')).not.toBeNull();
  });
});
