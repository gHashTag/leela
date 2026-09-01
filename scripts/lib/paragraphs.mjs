/**
 * Where a paragraph ends, in a source that says so with one newline.
 *
 * The book renders a plan by splitting on blank lines — `apps/docs`, the mini
 * app's `paragraphs()`, the bot's pager. Three of the twenty-two languages had
 * no blank lines at all, so all 72 plans in each of them rendered as **one
 * unbroken wall of text**: 216 pages of the book, in Arabic, Malay and
 * Ukrainian, with no place for the eye to rest.
 *
 * The damage is not in the translation. `leela/src/locales/<lang>` separates
 * paragraphs with a single `\n` — measured rather than assumed: Malay plan 30
 * is four lines of 583, 356, 1165 and 188 characters, which are paragraphs and
 * not the ~80-character lines a soft wrap makes. The markdown donors use a
 * blank line, the JSON donor uses one newline, and the generator passed both
 * through unchanged. Only one of the two shapes is what every reader splits on.
 *
 * **The rule is read from the text, not from which donor it came from.** A body
 * that never uses a blank line and does use a newline is a body whose newline
 * is its paragraph break. A body that already has blank lines is left exactly
 * as it is — including a body that mixes the two, where guessing would break
 * sentences apart.
 *
 * That self-limiting shape is the point. Keyed on the donor's name it would be
 * a fact about a filename, and the next source to arrive in this shape would
 * ship as a wall of text again with nothing to notice it.
 */

/** Whether this text says where its paragraphs end with a single newline. */
export function usesSingleNewlines(text) {
  return !text.includes('\n\n') && text.includes('\n');
}

/**
 * The same text with its paragraph breaks written the way every reader splits.
 *
 * A run of newlines and the spaces around them becomes one blank line, so a
 * trailing space before a break — which the donor has — does not leave a line
 * that looks empty and is not.
 */
export function paragraphed(text) {
  const body = text ?? '';
  if (!usesSingleNewlines(body)) return body;

  return body
    .split(/[ \t]*\n[ \t]*/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n\n');
}
