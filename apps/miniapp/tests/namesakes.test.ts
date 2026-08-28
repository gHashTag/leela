import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe as group, expect, it } from 'vitest';

import type { Named, Namesake, Record_ } from '../../../scripts/lib/namesakes.d.mts';
import { RECORDED, against, nameOf, namesakesIn, recordedLines } from '../../../scripts/lib/namesakes.mjs';

/**
 * Two squares of the board, told to a player by one name.
 *
 * `audit-namesakes.mjs` is the gate; this is the check on the gate. It feeds
 * the rule things that are wrong and requires it to say so, because an audit
 * shown only correct input has not been shown to work — and this repository
 * has caught three of its own guards failing to fail.
 *
 * MEASURED 2026-08-29: thirty findings in seventeen of the twenty-two
 * languages, five pairs. The fixtures below are those findings, not inventions.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const plansOf = (language: string): Named[] =>
  JSON.parse(readFileSync(resolve(ROOT, `packages/content/data/plans.${language}.json`), 'utf8'));

group('a plan’s name, without the term beside it', () => {
  it('drops the Sanskrit and keeps the word', () => {
    expect(nameOf('Greed (lobha)')).toBe('Greed');
    expect(nameOf('Greed')).toBe('Greed');
    expect(nameOf('Жадность (лобха)')).toBe('Жадность');
  });

  it('knows the full-width brackets the CJK editions set theirs in', () => {
    /*
     * `Jnana（ジナナ）` is how the Japanese edition writes it. A reader that
     * knew only the ASCII pair would call every one of those a name of its
     * own, and the collision check would go quiet for two languages.
     */
    expect(nameOf('Jnana（ジナナ）')).toBe('Jnana');
  });

  it('answers for nothing without throwing', () => {
    expect(nameOf(undefined)).toBe('');
    expect(nameOf('(only a term)')).toBe('');
  });
});

group('finding two plans with one name', () => {
  it('CATCHES the collision the whole thing was written for', () => {
    /*
     * The Urdu edition, read on the live book: plan 4 is لالچ (لوبھہ) and plan
     * 8 is لالچ. Russian names them «Жадность (лобха)» and «Алчность (матсара
     * или матсаръя)» — two words for two vices — and the English donor renders
     * the second as bare "Greed", which is what it calls plan 4.
     */
    const found = namesakesIn(plansOf('ur'));

    expect(found.map((one: Namesake) => one.plans)).toContainEqual([4, 8]);
  });

  it('COMPARES NAMES, NOT TITLES, which was the first version’s mistake', () => {
    /*
     * `"Greed (lobha)"` and `"Greed"` are different strings and the same name.
     * Asking about whole titles found ZERO collisions in twenty-two languages
     * and reported the data clean — a null result that indicted the query, not
     * the world.
     */
    const titles = plansOf('en').map((plan) => plan.title);
    const distinctTitles = new Set(titles).size;

    expect(distinctTitles, 'no two titles are identical strings').toBe(titles.length);
    expect(namesakesIn(plansOf('en')).map((one: Namesake) => one.plans)).toContainEqual([4, 8]);
  });

  it('says nothing about a board whose names are all its own', () => {
    // Russian, which is written rather than translated, and has none.
    expect(namesakesIn(plansOf('ru'))).toEqual([]);
  });

  it('names the pair in board order, so a record can be compared by string', () => {
    const found = namesakesIn([
      { plan: 8, title: 'Greed' },
      { plan: 4, title: 'Greed (lobha)' },
    ]);

    // Whichever order the data arrives in, the earlier-SEEN plan is first —
    // and the audit sorts by number, so the record reads the same either way.
    expect(found).toEqual([{ plans: [8, 4], name: 'Greed' }]);
  });

  it('ignores a plan with no name at all rather than pairing them', () => {
    // Two titles that are nothing but a term would otherwise collide on ''.
    expect(namesakesIn([
      { plan: 1, title: '(tapa)' },
      { plan: 2, title: '(moha)' },
    ])).toEqual([]);
  });
});

group('the record of what is left alone', () => {
  it('accounts for every collision in the shipped data, and no more', () => {
    const found: string[] = [];
    for (const language of (RECORDED as Record_[]).flatMap((entry) => entry.languages)) {
      for (const one of namesakesIn(plansOf(language))) {
        found.push(`${language} plans ${one.plans.join(' and ')}`);
      }
    }

    const { fresh, rotted } = against([...new Set(found)]);

    expect(fresh, 'a collision nobody wrote down').toEqual([]);
    expect(rotted, 'a record matching nothing in the data').toEqual([]);
  });

  it('catches a collision that is not recorded', () => {
    // The half that matters when a translation gets worse.
    expect(against(['xx plans 1 and 2']).fresh).toEqual(['xx plans 1 and 2']);
  });

  it('catches a record that has stopped describing anything', () => {
    /*
     * The quiet half. A title gets fixed, the collision goes, and the entry
     * stays behind as a claim about the data that the data denies — which is
     * how a record turns into a lie it is still passing.
     */
    expect(against([]).rotted.length).toBe(recordedLines().length);
    expect(against([]).rotted).toContain('en plans 4 and 8');
  });

  it('says why each is left alone, in a sentence', () => {
    // A record without a reason is a waiver, and this repository does not take
    // waivers — every entry states what is known and why nobody is overruled.
    for (const entry of RECORDED as Record_[]) {
      expect(entry.because.length, `plans ${entry.plans.join('/')}`).toBeGreaterThan(20);
      expect(entry.languages.length).toBeGreaterThan(0);
    }
  });
});
