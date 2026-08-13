/**
 * The texts, as this screen needs them.
 *
 * A thin facade over `@leela/content` for two reasons. The first is that every
 * other module here would otherwise import the loader and bind the language
 * itself, and a language bound in six places is a screen that ends up half
 * translated. The second is `trimmedDescription`, which is presentation and has
 * no business in a shared dataset.
 */

export {
  LANGUAGE_NAMES,
  LANGUAGES,
  directionOf,
  messageFor,
  planFor,
  plansFor,
  resolveLanguage,
  type Language,
  type Plan,
} from '@leela/content';

import { planFor, type Language, type Plan } from '@leela/content';

/** Titles for the board, bound to one language. */
export const titlesFor =
  (language: Language) =>
  (plan: number): string =>
    planFor(language, plan).title;

/**
 * A plan's text, cut to fit.
 *
 * `description` where the source had one — it is already the summary — and the
 * body otherwise, because thirteen of the seventy-two have no description and a
 * blank card on those thirteen is how a dataset's holes become a screen's.
 *
 * The cut lands on a sentence end, and failing that on a space. Never mid-word:
 * a paragraph that stops in the middle of a word reads as a bug in the app
 * rather than as an abridgement, and this text is the part of the game the
 * player is meant to take seriously.
 */
export const trimmedDescription = (plan: Plan, limit: number): string => {
  const whole = (plan.description ?? '').trim() || (plan.body ?? '').trim();
  if (whole.length <= limit) return whole;

  const head = whole.slice(0, limit);
  // Sentence ends this dataset actually uses, across its scripts: the Latin
  // full stop, Devanagari's danda, and the ideographic stop.
  const sentence = Math.max(
    head.lastIndexOf('. '),
    head.lastIndexOf('। '),
    head.lastIndexOf('。'),
    head.lastIndexOf('! '),
    head.lastIndexOf('? '),
  );
  if (sentence > limit * 0.4) return head.slice(0, sentence + 1).trim();

  const space = head.lastIndexOf(' ');
  return `${(space > 0 ? head.slice(0, space) : head).trim()}…`;
};
