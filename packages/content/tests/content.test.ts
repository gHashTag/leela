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

  it('keeps no leading plan numbering in titles', () => {
    for (const lang of LANGUAGES) {
      for (const plan of plansFor(lang)) {
        expect(plan.title, `${lang} ${plan.plan}`).not.toMatch(/^(plan|план)\s*\d+[.:]/i);
      }
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
