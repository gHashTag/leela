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

/**
 * The script each language is written in.
 *
 * **`Record<Language, Script>`, so a twenty-third language will not compile.**
 * It was `Record<string, Script>` behind a `?? 'latin'`, which is a restated
 * list of the twenty-two with the worst possible ending: a language added to
 * `LANGUAGES` would have been declared latin, and `audit-dataset` — the check
 * written *because* the English book once shipped a Russian chapter — would
 * have exempted it in CI while still printing that every chapter is written in
 * the language it is filed under.
 *
 * `RANGES` below has been `Record<Script, RegExp>` since it was written. One
 * map in this file was total and the other was not.
 */
const SCRIPTS: Record<Language, Script> = {
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

/**
 * @throws when handed a tag that is not one of the twenty-two.
 *
 * Loud rather than latin. The type makes that unreachable from TypeScript, and
 * the one caller that is not TypeScript is `scripts/audit-dataset.mjs`, reading
 * a generated manifest — where a language nobody has declared a script for is
 * a thing to be told about, not to be quietly waved through the check.
 */
export function scriptOf(language: Language): Script {
  const script = SCRIPTS[language];
  if (!script) throw new Error(`no script declared for "${language}"`);

  return script;
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
 * Whether a text is written in this language's script *at all*.
 *
 * `couldBe` asks which script a text is **mostly** in, which is the right
 * question for a chapter and the wrong one for a title. Every title in this
 * dataset carries the Sanskrit term in parentheses — `佛法计划 (Dharma-loka)` —
 * and eleven Latin letters outweigh four Han characters, so weighing them said
 * *this Chinese title is written in Latin* about a title that is translated.
 * A hundred and twenty-one of them, against ten that are actually untranslated.
 *
 * Presence is the question a title asks: a translated one has some of the
 * language in it, and one the machine handed back unchanged has none. Japanese
 * may be written in kanji alone, as in `couldBe`.
 *
 * It says nothing about the nine languages written in the Latin script — an
 * English title left in German has every letter German titles have. That blind
 * spot is stated wherever this is used, because a check that cannot see nine of
 * the twenty-two must not be read as having passed them.
 */
export function writtenIn(language: Language, text: string): boolean {
  const script = scriptOf(language);
  const has = (of: Script) => new RegExp(RANGES[of].source, 'u').test(text);

  return has(script) || (script === 'kana' && has('han'));
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
