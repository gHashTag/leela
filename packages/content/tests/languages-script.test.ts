import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  LANGUAGES,
  couldBe,
  dominantScript,
  plansFor,
  scriptOf,
  type Language,
} from '../src';

/**
 * What a language is supposed to look like.
 *
 * The English rules book shipped a seventh chapter written in Russian.
 * `NeuroLeelaAgent/docs/rules/game-logic.md` sits among six numbered English
 * files in a donor repository, is titled «Логика игры НейроЛила», and the
 * generator's hand-written map published it as chapter seven of the English
 * book — served to English readers on the docs site for as long as the book has
 * existed. A person reading their own language notices in a second. Nothing
 * else did, because nothing knew what a language looks like.
 *
 * These assert the rule against invented text. Asserting against
 * `packages/content/data` would be a test that passes until the data is wrong,
 * which is the day it needs to fail.
 */

const SAMPLES: Partial<Record<Language, string>> = {
  en: 'The player rolls a six to enter the game.',
  ru: 'Игрок бросает шестёрку, чтобы войти в игру.',
  uk: 'Гравець кидає шістку, щоб увійти в гру.',
  ar: 'يرمي اللاعب النرد ليدخل اللعبة.',
  ur: 'کھلاڑی کھیل میں داخل ہونے کے لیے چھکا پھینکتا ہے۔',
  hi: 'खिलाड़ी खेल में प्रवेश करने के लिए छक्का फेंकता है।',
  mr: 'खेळाडू खेळात प्रवेश करण्यासाठी सहा फेकतो.',
  bn: 'খেলোয়াড় খেলায় প্রবেশ করতে ছয় ফেলে।',
  ta: 'வீரர் விளையாட்டில் நுழைய ஆறு உருட்டுகிறார்.',
  te: 'ఆటగాడు ఆటలోకి ప్రవేశించడానికి ఆరు వేస్తాడు.',
  pa: 'ਖਿਡਾਰੀ ਖੇਡ ਵਿੱਚ ਦਾਖਲ ਹੋਣ ਲਈ ਛੱਕਾ ਸੁੱਟਦਾ ਹੈ।',
  zh: '玩家掷出六点才能进入游戏。',
  ja: 'プレイヤーは六を出してゲームに入ります。',
  ko: '플레이어는 육을 굴려 게임에 들어갑니다.',
  de: 'Der Spieler würfelt eine Sechs, um ins Spiel zu kommen.',
  tr: 'Oyuncu oyuna girmek için altı atar.',
  vi: 'Người chơi tung được sáu để vào trò chơi.',
};

describe('the script a language is written in', () => {
  it('is known for every language the package declares', () => {
    // A language added without a script would silently fall back to Latin, and
    // a Latin default would pass a Devanagari book as English.
    for (const language of LANGUAGES) {
      expect(scriptOf(language), language).toBeTruthy();
    }
  });

  it('reads real prose as the language it is', () => {
    for (const [language, text] of Object.entries(SAMPLES)) {
      expect(couldBe(language as Language, text), `${language}: ${text}`).toBe(true);
    }
  });

  it('refuses prose from a different family, which is the mistake that happens', () => {
    // The worked example: Russian filed under English. Files get put in the
    // wrong folder; they do not get subtly mistranslated into a neighbouring
    // alphabet.
    expect(couldBe('en', 'Логика игры НейроЛила')).toBe(false);
    expect(couldBe('ru', 'The meaning of the game')).toBe(false);
    expect(couldBe('hi', '玩家掷出六点才能进入游戏。')).toBe(false);
    expect(couldBe('zh', 'यह खेल का अर्थ है।')).toBe(false);
  });

  it('does not pretend to tell apart languages that share a script', () => {
    // German and Turkish are both Latin; Russian and Ukrainian both Cyrillic.
    // Claiming to catch those would be a check that fires on correct data.
    expect(couldBe('de', 'Oyuncu oyuna girmek için altı atar.')).toBe(true);
    expect(couldBe('ru', 'Гравець кидає шістку.')).toBe(true);
  });

  it('lets Japanese be written in kanji alone', () => {
    // Kanji-only text is Japanese too, and a rule that refused it would fire
    // on a correct chapter title.
    expect(couldBe('ja', '宇宙意識')).toBe(true);
  });

  it('weighs the text rather than stopping at the first letter it knows', () => {
    // A Russian chapter with an English word in it is Russian; a Japanese
    // sentence with one loanword is Japanese. First-hit matching would call
    // both of them English.
    expect(dominantScript('Логика игры НейроЛила (game logic)')).toBe('cyrillic');
    expect(couldBe('en', 'Логика игры НейроЛила (game logic)')).toBe(false);
    expect(couldBe('ru', 'Смысл игры и его meaning')).toBe(true);
  });

  it('has no opinion about text with no letters in it', () => {
    // A number, a date, a slug, an empty string: nothing to be wrong about,
    // and a check that guessed here would fire on a heading like "72".
    for (const text of ['', '   ', '72', '2026-07-30', '— · —']) {
      expect(dominantScript(text), JSON.stringify(text)).toBeNull();
      for (const language of LANGUAGES) expect(couldBe(language, text)).toBe(true);
    }
  });
});

describe('no answer rests on the order the ranges were typed in', () => {
  /**
   * `kana`'s range used to contain the whole ideograph block. Every Japanese
   * count was therefore also a Chinese count — and Chinese text, having no kana
   * at all, scored exactly the same as `han` and as `kana`. It came back
   * Chinese because `han` is typed one line above `kana`, and for no other
   * reason. Swap those two lines and every Chinese chapter becomes Japanese,
   * including to `audit-dataset`, which refuses a chapter written in a script
   * its language does not use.
   *
   * The pass before this one found the same shape in the rules chapters: a book
   * whose order came out of an object literal rather than out of anything about
   * the book. Twice is a habit, so the rule is asserted rather than the case.
   *
   * Kana is what tells the two apart, because Chinese never uses it — so the
   * assertions below are about that, and not about which of two equal counts
   * happens to be found first.
   */
  it('reads ideographs with no kana as han', () => {
    // A Chinese sentence, and a Japanese one written entirely in kanji, are the
    // same string of characters. There is no answer that is right for both, and
    // han is the one that is right for the language this repository ships.
    expect(dominantScript('純粋意識的完全展開')).toBe('han');
  });

  it('counts no character twice, which is what made the tie possible', () => {
    // The property, over every character the repository actually ships rather
    // than over a string chosen to demonstrate it. A character that belongs to
    // two ranges is counted for both scripts, and two scripts counting the same
    // characters is how an exact tie arises in the first place — after which
    // something has to break it, and what broke it was a line number.
    // The ranges are private and should stay private, so they are read out of
    // the source — the same way `apps/bot` reads its own registered commands
    // rather than keeping a list beside them.
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'languages.ts'),
      'utf8',
    );
    const block = source.slice(source.indexOf('const RANGES'), source.indexOf('\n};', source.indexOf('const RANGES')));
    const ranges = [...block.matchAll(/^\s*(\w+): \/(\[.+?\])\/,$/gm)].map(
      ([, script, pattern]) => [script, new RegExp(pattern, 'u')] as const,
    );

    expect(ranges.length, 'the ranges were found at all').toBeGreaterThan(5);

    const overlaps = new Set<string>();
    const seen = new Set<string>();

    for (const language of LANGUAGES) {
      for (const plan of plansFor(language)) {
        for (const character of `${plan.title ?? ''} ${plan.body}`) {
          if (seen.has(character)) continue;
          seen.add(character);

          const matched = ranges.filter(([, range]) => range.test(character)).map(([name]) => name);
          if (matched.length > 1) overlaps.add(`${character}: ${matched.join(' and ')}`);
        }
      }
    }

    expect([...overlaps]).toEqual([]);
  });

  it('reads a kana title as kana even beside its kanji', () => {
    expect(dominantScript('誕生(じゃんま)')).toBe('kana');
  });

  it('settles a tie by name rather than by position', () => {
    // Two letters of each. Whatever the answer is, it must not be "whichever
    // was typed first", because that is a decision nobody made.
    const tied = dominantScript('abПр');
    expect(tied).toBe('cyrillic');
    expect(dominantScript('Прab'), 'and not by which came first in the text').toBe('cyrillic');
  });

  it('still reads every shipped language as the script it is filed under', () => {
    // The whole point of the function, held over the real data rather than over
    // strings chosen to make it pass.
    for (const language of LANGUAGES) {
      const body = plansFor(language)[8]?.body ?? '';
      if (body.length === 0) continue;
      expect(dominantScript(body), language).toBe(scriptOf(language));
    }
  });
});

/**
 * A map of the twenty-two, and what happens when it is short.
 *
 * `SCRIPTS` was `Record<string, Script>` behind a `?? 'latin'` — a restated
 * list of the languages, with the worst ending this repository has a name for.
 * A twenty-third language would have been declared latin, and `audit-dataset`
 * — the check written *because* the English book once shipped a Russian
 * chapter — would have exempted it in CI while still printing that every
 * chapter is written in the language it is filed under.
 *
 * The same map was found the same day in `packages/ai`, deciding what language
 * the companion answers in. Two restated lists of the twenty-two, both behind a
 * fallback that reads as correct.
 */
describe('the script of a language is declared, never guessed', () => {
  it('is declared for every language the game is published in', () => {
    for (const language of LANGUAGES) {
      expect(() => scriptOf(language), language).not.toThrow();
      expect(typeof scriptOf(language), language).toBe('string');
    }
  });

  it('says so rather than guessing latin, for a tag nobody declared', () => {
    /**
     * Loud rather than latin. The type makes this unreachable from TypeScript;
     * the caller that is not TypeScript is `scripts/audit-dataset.mjs`, reading
     * a generated manifest, and a language nobody has declared a script for is
     * a thing to be told about rather than waved through the check.
     */
    expect(() => scriptOf('kl' as never)).toThrow(/no script declared/);
  });

  it('does not put every language in one script, or the check means nothing', () => {
    // A map filled in by copying one line would satisfy everything above.
    const scripts = new Set(LANGUAGES.map((language) => scriptOf(language)));

    expect(scripts.size).toBeGreaterThan(5);
    expect(scripts).toContain('latin');
    expect(scripts).toContain('cyrillic');
    expect(scripts).toContain('arabic');
  });

  it('agrees with what the text of each language actually looks like', () => {
    /**
     * The half a map cannot get wrong quietly: whatever script is declared, the
     * text in that language has to be written in it. `audit-dataset` runs this
     * over the rules chapters; asserted here over the plans, so a wrong entry
     * fails in the package that declares it.
     *
     * Over the **body**, as the audit does, and not the title. `dominantScript`
     * counts characters, and a title like the Chinese `出生 (janma)` is two Han
     * characters against five Latin ones — so a transliteration in brackets
     * outweighs the name it transliterates. That is a fact about short strings
     * rather than about the map, and the audit reads two thousand characters
     * for the same reason.
     */
    for (const language of LANGUAGES) {
      const plan = plansFor(language)[0];
      expect(couldBe(language, plan?.body ?? ''), `${language}: ${plan?.title}`).toBe(true);
    }
  });

  it('is not to be asked about a handful of characters', () => {
    // Stated because it was found by asking: the guard against somebody using
    // `couldBe` on a title and reading the answer as a verdict on the file.
    expect(couldBe('zh', '出生 (janma)'), 'a title with its transliteration').toBe(false);
    expect(couldBe('zh', plansFor('zh')[0]?.body ?? ''), 'the same plan, whole').toBe(true);
  });
});
import { EVERY_LANGUAGE_MS,
  loadEveryLanguage } from '../src/index';

/**
 * Every language's text, in memory, before anything asks for it.
 *
 * Twenty-one of the twenty-two are loaded on demand now — the board's entry
 * carried 6.6 MB of plan text to a reader of one language, and only English is
 * static because it is the fallback. A suite that reads other languages has to
 * say so, and this is that saying: without it these tests would quietly
 * measure English twenty-two times and pass.
 */
beforeAll(loadEveryLanguage, EVERY_LANGUAGE_MS);

