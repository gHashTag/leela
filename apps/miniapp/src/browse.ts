/**
 * The two lists the published app has and this one did not.
 *
 * `GameScreen` puts two buttons in its header: `:information_source:` opens
 * `RULES_SCREEN`, and `:books:` opens `PLANS_SCREEN`. Both are lists of titles
 * that open a text — the rules book in seven chapters, and all 72 plans, so a
 * player can read a square they have not landed on.
 *
 * The mini app shipped neither. It could read the plan you were standing on and
 * nothing else, and the rules book — which `@leela/content` has carried in 22
 * languages since the third pass — had no way in at all. A book nobody can open
 * is a book nobody has.
 *
 * The deciding is here and pure; the dialog is the DOM's.
 */

import { FALLBACK_LANGUAGE, type Language, plansFor, rulesFor } from '@leela/content';
import { TOTAL_PLANS } from '@leela/engine';

/** A line in one of the lists. */
export interface Entry {
  /** What opens when it is tapped: a plan number, or a chapter's slug. */
  readonly key: number | string;
  readonly title: string;
  /**
   * True for the square the player is standing on. The published app marks it
   * too — `onPressItem` passes `report: true` when it is the current plan and
   * the report is not yet written.
   */
  readonly here?: boolean;
}

/**
 * Every plan, in order, with the one the player is on marked.
 *
 * All 72 whatever the dataset holds: a language missing a title still has a
 * square, and a list with a hole in it is a list a player scrolls past without
 * noticing. The number is the title's fallback because the number is what the
 * board shows.
 */
export function planEntries(language: Language, standingOn?: number): Entry[] {
  const known = new Map(plansFor(language).map((plan) => [plan.plan, plan.title]));

  return Array.from({ length: TOTAL_PLANS }, (_, index) => {
    const plan = index + 1;
    const title = known.get(plan)?.trim();
    return {
      key: plan,
      title: title && title.length > 0 ? title : String(plan),
      here: plan === standingOn,
    };
  });
}

/**
 * The rules book's chapters, in the order the book is written.
 *
 * Falls back to English as a whole rather than chapter by chapter: a book half
 * in one language and half in another is worse than a book in the language a
 * reader can at least read. `rulesFor` returns nothing for a language with no
 * chapters, and English is what every other surface falls back to.
 */
export function ruleEntries(language: Language): Entry[] {
  const chapters = rulesFor(language);
  const source = chapters.length > 0 ? chapters : rulesFor(FALLBACK_LANGUAGE);

  return source.map((chapter) => ({
    key: chapter.slug,
    title: chapter.title?.trim() || chapter.slug,
  }));
}

/** What a chapter opens to, or null when the book has no such chapter. */
export function ruleText(
  language: Language,
  slug: string,
): { title: string; body: string } | null {
  const chapters = rulesFor(language);
  const source = chapters.length > 0 ? chapters : rulesFor(FALLBACK_LANGUAGE);
  const chapter = source.find((entry) => entry.slug === slug);
  if (!chapter) return null;

  return { title: chapter.title?.trim() || slug, body: chapter.body ?? '' };
}
