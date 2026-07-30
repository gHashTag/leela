import { describe, expect, it } from 'vitest';
import { LANGUAGES, couldBe, dominantScript, scriptOf, type Language } from '../src';

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
