import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit script, which is plain JavaScript.
import {
  BLIND_TO,
  RECORDED,
  against,
  nameOf,
  untranslatedIn,
} from '../../../scripts/lib/untranslated.mjs';
import { LANGUAGES, couldBe, scriptOf, writtenIn } from '../src/index';
import type { Language } from '../src/language';

/**
 * Text the machine handed back in the language it was given.
 *
 * The script check has run over the rules book since the English edition was
 * found to have a Russian chapter in it, and never over the seventy-two plans —
 * the text the game puts on the screen on every throw. Ten titles were sitting
 * in it: a Japanese player on plan 12 stands on **Envy (irasya)** among Japanese
 * neighbours, and Chinese, Korean, Bengali and Tamil players on plan 40 read
 * `Vyana-loka`.
 *
 * They are recorded rather than repaired, under the bar `corrections.mjs`
 * states: a correction must be checkably wrong, and what a title should say in
 * Tamil is a judgement. So what the tests here hold is the *check* — that it
 * finds the shape wherever the shape is, that it says what it cannot see, and
 * that the record cannot quietly stop describing anything.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');

const plansOf = (language: Language) =>
  JSON.parse(readFileSync(join(DATA, `plans.${language}.json`), 'utf8')) as Array<{
    plan: number;
    title: string;
    body: string;
  }>;

/** Every language the check can see at all. */
const READABLE = LANGUAGES.filter((language) => scriptOf(language) !== BLIND_TO);

describe('presence, not weight', () => {
  it('calls a title with the Sanskrit in parentheses translated', () => {
    /**
     * The instrument this was first written with. `couldBe` asks which script a
     * text is *mostly* in — right for a chapter, wrong for a title of four Han
     * characters and eleven Latin letters. Weighing them reported 121
     * untranslated Chinese titles, of which 111 are translated and carry the
     * term the way every title in the dataset carries it.
     */
    expect(writtenIn('zh', '佛法计划 (Dharma-loka)')).toBe(true);
    expect(couldBe('zh', '佛法计划 (Dharma-loka)'), 'what weighing said').toBe(false);
  });

  it('calls one with none of the language in it untranslated', () => {
    expect(writtenIn('zh', 'Vyana-loka')).toBe(false);
    expect(writtenIn('ja', 'Envy (irasya)')).toBe(false);
  });

  it('lets Japanese be written in kanji alone, as couldBe does', () => {
    expect(writtenIn('ja', '真実の計画')).toBe(true);
  });

  it('answers for every language, since a script is declared for every one', () => {
    // The guard against a predicate that is only ever asked about four of them.
    for (const language of LANGUAGES) {
      expect(typeof writtenIn(language, 'text'), language).toBe('boolean');
    }
  });
});

describe('the check finds the shape wherever it is', () => {
  /**
   * Planted, in each language the check can see, rather than asserted about the
   * ten that are there. A check that happens to name today's findings would go
   * on passing if it stopped working — the failure mode this repository has met
   * more than once, most recently as a test that only asked whether a symbol
   * was *mentioned*.
   */
  it.each(READABLE.map((language) => [language] as const))(
    'catches an English title planted in %s',
    (language) => {
      const plans = plansOf(language).map((plan) =>
        plan.plan === 5 ? { ...plan, title: 'Purification (shuddhi)' } : plan,
      );

      const found = untranslatedIn(plans, language, writtenIn);
      expect(found.map(nameOf)).toContain(`${language} plan 5 title: Purification (shuddhi)`);
    },
  );

  it('catches an English paragraph inside a page that is otherwise the language', () => {
    // The unit is the paragraph because the body as a whole never fails: one
    // English paragraph among six Japanese ones is still Japanese by any
    // measure that looks at the body. There are none today, which is exactly
    // when a check is written — after that, an absence and a pass differ.
    const english =
      'Birth is the entrance to the karmic game, and the die decides what the player carries into it.';
    const plans = plansOf('ja').map((plan) =>
      plan.plan === 5 ? { ...plan, body: `${plan.body}\n\n${english}` } : plan,
    );

    const found = untranslatedIn(plans, 'ja', writtenIn);
    expect(found.some((finding) => finding.plan === 5 && finding.part.startsWith('paragraph'))).toBe(
      true,
    );
  });

  it('does not call a line of numbers or a citation untranslated', () => {
    // Short runs are headings, dates and sums — `8х9 = 72` is in no script at
    // all, and a check that reported it would be noise nobody reads.
    const plans = plansOf('ja').map((plan) =>
      plan.plan === 5 ? { ...plan, body: `8х9 = 72\n\n${plan.body}` } : plan,
    );

    expect(untranslatedIn(plans, 'ja', writtenIn).some((f) => f.plan === 5)).toBe(false);
  });
});

describe('the record cannot go quiet', () => {
  it('holds exactly what the shipped data has, in every readable language', () => {
    const found = READABLE.flatMap((language) =>
      untranslatedIn(plansOf(language), language, writtenIn),
    );
    const { fresh, rotted } = against(found);

    expect(fresh.map(nameOf), 'untranslated and unrecorded').toEqual([]);
    expect(rotted, 'recorded and no longer there').toEqual([]);
  });

  it('reports a new one rather than absorbing it', () => {
    const planted = [
      { language: 'ja', plan: 5, part: 'title', text: 'Purification (shuddhi)' },
      ...RECORDED.map((line: string) => {
        const [, language, plan, part, text] = /^(\w+) plan (\d+) (\w+): (.+)$/.exec(line) ?? [];
        return { language, plan: Number(plan), part, text };
      }),
    ];

    expect(against(planted).fresh.map(nameOf)).toEqual(['ja plan 5 title: Purification (shuddhi)']);
  });

  it('reports a record that has stopped matching anything', () => {
    // The half a quiet check would never mention. A donor fixed upstream, or a
    // title that moved, leaves an entry describing text that is not there —
    // and a record nobody re-reads is a claim that keeps passing.
    expect(against([]).rotted).toEqual(RECORDED);
  });

  it('records nothing it has not been shown', () => {
    // No exemption without a finding behind it: every recorded line must be a
    // line the check itself produces from the shipped data.
    const found = new Set(
      READABLE.flatMap((language) => untranslatedIn(plansOf(language), language, writtenIn)).map(
        nameOf,
      ),
    );

    for (const line of RECORDED) expect(found, line).toContain(line);
  });
});

describe('what it cannot see is said out loud', () => {
  it('is blind to the languages written in the script they were translated from', () => {
    /**
     * Not a defect of the check — a limit of the question. An English title left
     * in German has every letter a German title has, and no test of scripts can
     * tell them apart. It is asserted because *nothing found* and *nothing
     * looked for* print the same sentence, and this dataset has been read as
     * fully checked before on exactly that confusion.
     */
    const blind = LANGUAGES.filter((language) => scriptOf(language) === BLIND_TO);

    expect(blind.length, 'languages this cannot see').toBeGreaterThan(0);
    expect(blind).toContain('de');

    const german = plansOf('de').map((plan) =>
      plan.plan === 5 ? { ...plan, title: 'Purification (shuddhi)' } : plan,
    );
    expect(untranslatedIn(german, 'de', writtenIn), 'and it says so by finding nothing').toEqual([]);
  });

  it('reads every language it is not blind to, and they are the majority', () => {
    expect(READABLE.length + LANGUAGES.length - READABLE.length).toBe(LANGUAGES.length);
    expect(READABLE.length).toBeGreaterThan(LANGUAGES.length / 2);
  });
});
