/**
 * What a language is, beyond its texts.
 *
 * `directionOf` and the endonyms lived in `apps/docs`, which is the only place
 * that had needed them. The mini app needed them too and did without: it set
 * `lang` and not `dir`, so an Arabic or Urdu player read Arabic prose in a
 * left-to-right layout. Knowledge about a language belongs next to `Language`,
 * or the second surface that needs it copies it — or, as here, goes without.
 */

import type { Language } from './language';

/** Languages here that read right to left. */
const RTL: ReadonlySet<string> = new Set(['ar', 'ur']);

export function directionOf(language: Language): 'rtl' | 'ltr' {
  return RTL.has(language) ? 'rtl' : 'ltr';
}

/** Endonyms — a language picker in English helps nobody choose their own. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  ar: 'العربية', bn: 'বাংলা', de: 'Deutsch', en: 'English', es: 'Español',
  fr: 'Français', hi: 'हिन्दी', ja: '日本語', jv: 'Basa Jawa', ko: '한국어',
  mr: 'मराठी', ms: 'Bahasa Melayu', pa: 'ਪੰਜਾਬੀ', pt: 'Português', ru: 'Русский',
  ta: 'தமிழ்', te: 'తెలుగు', tr: 'Türkçe', uk: 'Українська', ur: 'اردو',
  vi: 'Tiếng Việt', zh: '中文',
};

/** U+2066 LEFT-TO-RIGHT ISOLATE and U+2069 POP DIRECTIONAL ISOLATE. */
const LRI = '⁦';
const PDI = '⁩';

/**
 * Hold a run of text left to right, whatever surrounds it.
 *
 * The board is a diagram, not a sentence. Its squares are digits, and digits
 * are *weak* in the Unicode bidirectional algorithm: inside a right-to-left
 * paragraph a row reading `01 02 03` is reordered to `03 02 01` by the reader's
 * own renderer. Nothing in the string is wrong, and the board is mirrored
 * anyway — the snakes descend the wrong way and plan 1 sits where 9 belongs.
 *
 * An isolate says: whatever direction you are reading in, this part is not
 * part of it. Applied to the board, not to prose, because prose *should*
 * follow the reader.
 */
export function asLeftToRight(text: string): string {
  return `${LRI}${text}${PDI}`;
}

/**
 * The script a language is written in.
 *
 * Added because the English rules book shipped a chapter written in Russian.
 * `NeuroLeelaAgent/docs/rules/game-logic.md` sits among six numbered English
 * files, is titled «Логика игры НейроЛила», and the generator's hand-written
 * map published it as the seventh chapter of the English book — served to
 * English readers on the docs site for as long as the book has existed.
 *
 * A person reading their own language notices in a second. Nothing else did,
 * because nothing knew what a language is supposed to look like.
 */
export type Script =
  | 'latin'
  | 'cyrillic'
  | 'arabic'
  | 'devanagari'
  | 'bengali'
  | 'tamil'
  | 'telugu'
  | 'gurmukhi'
  | 'han'
  | 'kana'
  | 'hangul';

const SCRIPTS: Record<string, Script> = {
  ar: 'arabic',
  bn: 'bengali',
  de: 'latin',
  en: 'latin',
  es: 'latin',
  fr: 'latin',
  hi: 'devanagari',
  ja: 'kana',
  jv: 'latin',
  ko: 'hangul',
  mr: 'devanagari',
  ms: 'latin',
  pa: 'gurmukhi',
  pt: 'latin',
  ru: 'cyrillic',
  ta: 'tamil',
  te: 'telugu',
  tr: 'latin',
  uk: 'cyrillic',
  ur: 'arabic',
  vi: 'latin',
  zh: 'han',
};

export function scriptOf(language: Language): Script {
  return SCRIPTS[language] ?? 'latin';
}

const RANGES: Record<Script, RegExp> = {
  latin: /[A-Za-zÀ-ɏ]/,
  cyrillic: /[Ѐ-ӿ]/,
  arabic: /[؀-ۿݐ-ݿ]/,
  devanagari: /[ऀ-ॿ]/,
  bengali: /[ঀ-৿]/,
  tamil: /[஀-௿]/,
  telugu: /[ఀ-౿]/,
  gurmukhi: /[਀-੿]/,
  han: /[一-鿿㐀-䶿]/,
  // Kana only. It used to include the whole ideograph block as well, which made
  // every Japanese count also a Chinese count — and then Chinese text tied with
  // itself and was resolved by `han` being typed above `kana` in this literal.
  // Chinese never uses kana, so kana is the thing that tells them apart, and it
  // tells them apart on its own.
  kana: /[぀-ゟ゠-ヿｦ-ﾟ]/,
  hangul: /[가-힯ᄀ-ᇿ]/,
};

/**
 * Which of the scripts this repository knows a text is written in.
 *
 * By weight rather than by first hit: a Russian chapter with an English word
 * in it is Russian, and a title of one Latin loanword in Japanese prose is
 * Japanese. Returns null for text with no letters in any of them — a number, a
 * date, an empty string.
 *
 * **A tie is settled by name, not by position.** `count > best` means the
 * script written highest in the literal above wins when two are level, and that
 * was doing real work: `kana`'s range used to contain the ideograph block, so
 * Chinese text scored equally as `han` and as `kana` and came back Chinese
 * because `han` is typed one line earlier. Swap those two lines and every
 * Chinese chapter becomes Japanese — including to `audit-dataset`, which
 * refuses a chapter written in a script its language does not use.
 *
 * The ranges no longer overlap, so that particular tie cannot happen. The rule
 * is here anyway: an answer that depends on the order somebody typed keys in is
 * an answer nobody chose, and this repository has now met that twice.
 */
export function dominantScript(text: string): Script | null {
  let best: Script | null = null;
  let bestCount = 0;

  for (const [script, range] of Object.entries(RANGES) as Array<[Script, RegExp]>) {
    const pattern = new RegExp(range.source, 'gu');
    const count = (text.match(pattern) ?? []).length;
    if (count === 0) continue;

    if (count > bestCount || (count === bestCount && best !== null && script < best)) {
      best = script;
      bestCount = count;
    }
  }

  return best;
}

/**
 * Whether a text could be this language.
 *
 * Not "is": a script is shared — German and Turkish are both Latin, Russian and
 * Ukrainian both Cyrillic — so this catches a text in the wrong *family*, which
 * is the mistake that actually happens when files are filed by hand. Japanese
 * is allowed to be written in Han alone, since kanji-only text is Japanese too.
 */
export function couldBe(language: Language, text: string): boolean {
  const found = dominantScript(text);
  if (found === null) return true;

  const expected = scriptOf(language);
  if (found === expected) return true;
  return expected === 'kana' && found === 'han';
}
