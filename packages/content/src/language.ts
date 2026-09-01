/**
 * What a language is, before any text exists.
 *
 * The four things every other file here needs — the list, the type, the
 * fallback, and how to get from `zh-Hans` to `zh` — and not one byte of the
 * dataset. A leaf: it imports nothing from this package.
 *
 * It is a leaf because it was not one. `messages.ts` imported
 * `FALLBACK_LANGUAGE` and `resolveLanguage` from `index.ts` while `index.ts`
 * re-exported `messages.ts`, so the two required each other and Metro said so
 * on every launch of the phone app:
 *
 *   WARN  Require cycle: packages/content/src/index.ts -> messages.ts ->
 *   index.ts. Require cycles are allowed, but can result in uninitialized
 *   values.
 *
 * *Can result in uninitialized values* is the part that matters. Which of the
 * two modules finishes evaluating first depends on which one the bundler
 * reaches first, and the loser sees `undefined` where a constant should be —
 * so `resolveLanguage` inside `messageFor` is one import-order change away from
 * silently answering English to everybody. It had not happened yet. That is not
 * the same as it not being able to.
 *
 * `index.ts` re-exports all of this, so nothing outside the package changes.
 */

/** Languages the dataset covers, as BCP-47 primary subtags. */
export const LANGUAGES = [
  'ar', 'bn', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'jv', 'ko', 'mr',
  'ms', 'pa', 'pt', 'ru', 'ta', 'te', 'tr', 'uk', 'ur', 'vi', 'zh',
] as const;

export type Language = (typeof LANGUAGES)[number];

/** The language to fall back to when a request cannot be served. */
export const FALLBACK_LANGUAGE: Language = 'en';

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Resolve a locale like `ru-RU`, `zh-Hans` or `en_GB` onto a covered language,
 * falling back to English.
 */
export function resolveLanguage(locale: string | undefined | null): Language {
  if (!locale) return FALLBACK_LANGUAGE;
  const [primary = ''] = locale.toLowerCase().split(/[-_]/);
  return isLanguage(primary) ? primary : FALLBACK_LANGUAGE;
}
