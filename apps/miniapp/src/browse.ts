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
 *
 * **Pure means it is given its texts, not that it fetches them.** These three
 * functions used to call `plansFor` and `bookFor`, which read the whole of
 * `@leela/content` — every language at once. That is right for a server and
 * ruinous for a phone: `content.ts` next door exists to fetch one language as
 * its own chunk, and three imports in this file defeated it entirely, because a
 * module that is statically reachable cannot be split out however many dynamic
 * imports point at it. The shipped bundle was 8.1 MB where this app's README
 * promised 368 kB.
 *
 * So they take arrays. Which language those arrays hold is the caller's
 * business; what to make of them is this file's.
 */

import type { Plan, RuleChapter } from '@leela/content';
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
  /**
   * How many times the player has written about this square, when more than
   * once. The list is the only place a whole game is visible at once, so it is
   * where returning shows up: three marks against plan 41 is the game telling
   * a player something no single report can.
   */
  readonly returns?: number;
  /** True for a rules chapter shown in English because this book lacks it. */
  readonly borrowed?: boolean;
}

/**
 * Every plan, in order, with the one the player is on marked.
 *
 * All 72 whatever the dataset holds: a language missing a title still has a
 * square, and a list with a hole in it is a list a player scrolls past without
 * noticing. The number is the title's fallback because the number is what the
 * board shows.
 */
export function planEntries(
  plans: readonly Plan[],
  standingOn?: number,
  returns: ReadonlyMap<number, number> = new Map(),
): Entry[] {
  const known = new Map(plans.map((plan) => [plan.plan, plan.title]));

  return Array.from({ length: TOTAL_PLANS }, (_, index) => {
    const plan = index + 1;
    const title = known.get(plan)?.trim();
    const seen = returns.get(plan) ?? 0;
    return {
      key: plan,
      title: title && title.length > 0 ? title : String(plan),
      here: plan === standingOn,
      // Only a return is worth a mark. Every square a player has stood on has
      // a report against it, so marking all of them would mark most of the
      // board and say nothing.
      ...(seen > 1 ? { returns: seen } : {}),
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
export function ruleEntries(chapters: readonly RuleChapter[]): Entry[] {
  return chapters.map((chapter) => ({
    key: chapter.slug,
    title: chapter.title?.trim() || chapter.slug,
    // Marked, not hidden. Three languages' books arrived without the chapter on
    // the chakras, and a reader is owed the difference between "written for
    // you" and "the only copy there is".
    ...(chapter.borrowed ? { borrowed: true } : {}),
  }));
}

/** What a chapter opens to, or null when the book has no such chapter. */
export function ruleText(
  chapters: readonly RuleChapter[],
  slug: string,
): { title: string; body: string } | null {
  const chapter = chapters.find((entry) => entry.slug === slug);
  if (!chapter) return null;

  return { title: chapter.title?.trim() || slug, body: chapter.body ?? '' };
}

/** What the one reader dialog is showing. */
export type ReaderKind = 'plan' | 'chapter' | 'path';

/**
 * Whether the journal's own controls belong under what is being read.
 *
 * "Save a copy" and "Bring one back" export and import the player's journal.
 * They live in the same dialog as the plan texts, and only the export was ever
 * hidden — so reading a plan showed a "Bring one back" button under the
 * traditional text of the square you were standing on, and the rules book
 * inherited it the day the rules book existed.
 *
 * One owner for the pair, and the rule stated once: they belong to the journal
 * and to nothing else.
 */
export function showsPathTools(kind: ReaderKind): boolean {
  return kind === 'path';
}
