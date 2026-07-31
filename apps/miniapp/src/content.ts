/**
 * Loading only the language the player reads.
 *
 * `@leela/content` bundles all 22 languages, which is right for a server and
 * wrong for a phone: importing it whole produced a 6.5 MB bundle, 1.6 MB
 * gzipped, to show one language. Here each language is a separate chunk and
 * exactly one is fetched.
 *
 * The language list and the fallback still come from the package, so there is
 * one source of truth for which languages exist.
 */

import {
  bookFrom,
  FALLBACK_LANGUAGE,
  resolveLanguage,
  type Language,
  type Plan,
  type RuleChapter,
} from '@leela/content';

/**
 * Every dataset, as a lazy import. Vite turns this into one chunk per file and
 * fetches only what is called.
 */
const datasets = import.meta.glob<{ default: Plan[] }>(
  '../../../packages/content/data/plans.*.json',
);

function pathFor(language: Language): string {
  return `../../../packages/content/data/plans.${language}.json`;
}

let loaded: { language: Language; plans: Plan[] } | null = null;

/**
 * Fetch a language's plans, falling back to English if the chunk is missing.
 *
 * @throws Error when even the fallback cannot be loaded — there is no sensible
 *         way to show a game about 72 texts with no texts.
 */
export async function loadPlans(locale: string): Promise<{ language: Language; plans: Plan[] }> {
  const language = resolveLanguage(locale);
  if (loaded?.language === language) return loaded;

  const importer = datasets[pathFor(language)] ?? datasets[pathFor(FALLBACK_LANGUAGE)];
  if (!importer) {
    throw new Error(`no plan dataset found for ${language} or ${FALLBACK_LANGUAGE}`);
  }

  const module = await importer();
  loaded = { language, plans: module.default };
  return loaded;
}

/**
 * One plan from the loaded dataset.
 *
 * @throws Error when called before `loadPlans`, which would otherwise show an
 *         empty board and look like a rendering bug.
 */
export function plan(number: number): Plan {
  if (!loaded) throw new Error('loadPlans must finish before a plan can be read');

  const found = loaded.plans.find((p) => p.plan === number);
  if (!found) throw new RangeError(`plan ${number} is not in the ${loaded.language} dataset`);
  return found;
}

/**
 * The plans that are loaded, for the surfaces that want the whole list.
 *
 * @throws Error when called before `loadPlans`, for the reason `plan` does.
 */
export function plans(): Plan[] {
  if (!loaded) throw new Error('loadPlans must finish before the plans can be read');
  return loaded.plans;
}

/** The language currently loaded, or null before the first load. */
export function currentLanguage(): Language | null {
  return loaded?.language ?? null;
}

/**
 * The rules book, fetched only when a reader opens it.
 *
 * Its own chunk, and not part of the first load. `rules.json` is 1.5 MB of
 * every language's chapters and a player who never taps the book never needs a
 * byte of it — while the board, which everybody needs, waited behind all of it.
 *
 * One file rather than one per language, because that is what the generator
 * writes; splitting it further is a change to `build-content.mjs` and belongs
 * with the audit that would keep the two halves honest.
 *
 * The borrow rule stays in `@leela/content`. This fetches the two books and
 * `bookFrom` decides — the alternative is the mini app knowing what to do about
 * a language missing the chapter on the chakras, which would be the sixth copy
 * of a rule that took five to consolidate.
 */
const books = import.meta.glob<{ default: Record<string, RuleChapter[]> }>(
  '../../../packages/content/data/rules.json',
);

let book: { language: Language; chapters: RuleChapter[] } | null = null;

export async function loadBook(locale: string): Promise<RuleChapter[]> {
  const language = resolveLanguage(locale);
  if (book?.language === language) return book.chapters;

  const importer = books['../../../packages/content/data/rules.json'];
  if (!importer) throw new Error('no rules book found');

  const all = (await importer()).default;
  book = {
    language,
    chapters: bookFrom(all[language] ?? [], all[FALLBACK_LANGUAGE] ?? []),
  };
  return book.chapters;
}
