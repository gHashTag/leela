/**
 * Whether the rules book is the same book in every language.
 *
 * `audit-dataset` checks that each chapter is written in the script it is filed
 * under — which caught an English book with a Russian seventh chapter. It never
 * asked whether the *table of contents* is the same, and it is not.
 *
 * Ukrainian, Malay and Arabic carry two chapters nobody else has — `online`, a
 * chat-moderation policy ("racism, nazism and drugs are forbidden topics"), and
 * `foreword` — and are missing the chapter on the **chakras**. Two of the three
 * have no chapter on the **meaning of the game** either. Those are the same
 * three languages that were translated from the English edition rather than the
 * Russian one, found in the pass before this: a different donor, a different
 * contents page, and nothing in this repository looking at it.
 *
 * So the rule is stated over what the two editions agree on. English and
 * Russian are the sources every other language came through one of; a chapter
 * both of them teach is a chapter every reader is owed. A chapter only one of
 * them has is an edition's own choice, and a language that lacks it has lost
 * nothing.
 *
 * Extra chapters are not a fault. `online` and `foreword` are real text that
 * somebody wrote, and a book with more in it than the English one is a book
 * with more in it.
 */

/** The chapters both editions teach — the floor under every other language. */
export function sharedChapters(english, russian) {
  const inRussian = new Set(russian.map((chapter) => chapter.slug));
  return english.map((chapter) => chapter.slug).filter((slug) => inRussian.has(slug));
}

/** What one language's book is missing of that floor, and what it has instead. */
export function bookGap(chapters, shared) {
  const have = new Set(chapters.map((chapter) => chapter.slug));
  const owed = new Set(shared);

  return {
    missing: shared.filter((slug) => !have.has(slug)),
    extra: chapters.map((chapter) => chapter.slug).filter((slug) => !owed.has(slug)),
  };
}

/** Every language's gap, in a fixed order so two runs read the same. */
export function gaps(books, shared) {
  return Object.keys(books)
    .sort()
    .map((language) => ({ language, ...bookGap(books[language] ?? [], shared) }))
    .filter((gap) => gap.missing.length > 0);
}

/** A gap as one line, which is also how the recorded damage is written. */
export function keyOf(gap) {
  return `${gap.language}: ${gap.missing.join(',')}`;
}

/**
 * What is new against what is already known.
 *
 * The books below are missing chapters and cannot be completed here: completing
 * them means translating, which needs a service this repository deliberately
 * does not call. `bookFor` borrows the English chapter so no reader is left
 * without the teaching, and marks it borrowed so nobody is told it was written
 * for them. The audit names the gaps every run and fails on a new one.
 */
export function unrecorded(found, recorded) {
  const known = new Set(recorded);
  return found.filter((line) => !known.has(line));
}
