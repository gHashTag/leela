/**
 * What a language is, beyond its texts.
 *
 * `directionOf` and the endonyms lived in `apps/docs`, which is the only place
 * that had needed them. The mini app needed them too and did without: it set
 * `lang` and not `dir`, so an Arabic or Urdu player read Arabic prose in a
 * left-to-right layout. Knowledge about a language belongs next to `Language`,
 * or the second surface that needs it copies it — or, as here, goes without.
 */

import type { Language } from './index';

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
