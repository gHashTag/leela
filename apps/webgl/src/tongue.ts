import { type Language, resolveLanguage } from './canon';

/** English, when nothing else can be honoured. Not imported: `canon` does not
 * re-export it, and a fallback that is `undefined` fails silently. */
const FALLBACK: Language = 'en';

/**
 * Which language the screen speaks, and how the player changes it.
 *
 * The dataset covers twenty-two languages, but the interface strings under
 * `app.*` exist in two. Offering the other twenty would put a player into a
 * board whose text they can read and whose buttons they cannot — worse than
 * not offering them, because it looks like a bug rather than a gap. So the
 * switch offers what is actually translated, and that list is derived here
 * rather than written twice.
 *
 * A stored choice outranks the browser's. Someone who asked for Russian on a
 * machine set to English asked deliberately, and a browser setting is not a
 * reason to overrule them on the next visit.
 */

export const SPEAKS: readonly Language[] = ['en', 'ru'] as const;

const KEY = 'leela.language';

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** True when the interface, not merely the board text, exists in this language. */
export const isSpoken = (value: string): value is Language =>
  (SPEAKS as readonly string[]).includes(value);

/**
 * The language to open in.
 *
 * @param stored what the player last chose, or null.
 * @param fromBrowser `navigator.language`, which may be any locale at all.
 */
export const openingLanguage = (
  stored: string | null,
  fromBrowser: string,
): Language => {
  if (stored && isSpoken(stored)) return stored;

  // The browser may say `ru-RU`, `ru_RU` or `ru`; resolveLanguage handles the
  // shapes. It may also resolve onto a language the interface does not speak,
  // in which case English is the honest answer rather than a half-translated
  // screen.
  const resolved = resolveLanguage(fromBrowser);
  return isSpoken(resolved) ? resolved : FALLBACK;
};

/** The next language in the cycle; with two, this is simply the other one. */
export const nextLanguage = (current: Language): Language => {
  const at = SPEAKS.indexOf(current);
  // An unknown current language cycles to the first rather than off the end.
  return SPEAKS[(at + 1) % SPEAKS.length] ?? FALLBACK;
};

/** Reads the stored choice, tolerating a storage that refuses. */
export const readLanguage = (store: Store | null): string | null => {
  try {
    return store?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
};

/**
 * Remembers the choice. Returns whether it stuck: a browser in private mode
 * throws on write, and a switch that silently forgets is worse than one that
 * says it cannot remember.
 */
export const writeLanguage = (store: Store | null, language: Language): boolean => {
  try {
    store?.setItem(KEY, language);
    return true;
  } catch {
    return false;
  }
};

/** What to label the button with: the language it switches *to*. */
export const LABELS: Readonly<Record<Language, string>> = {
  en: 'EN',
  ru: 'RU',
} as Readonly<Record<Language, string>>;
