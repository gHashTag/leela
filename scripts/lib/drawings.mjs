/**
 * Every control the mini app draws as available, and what decided it.
 *
 * Three defects came from the same shape, one pass after another:
 *
 * - a double tap on Save filed two accounts of one square, because `draw`
 *   disabled the button and `saveReport` asked nothing;
 * - one tap on the players button threw away a month of play, because the
 *   count was a live control and the act behind it built a fresh table;
 * - the die took a throw the drawing had already refused.
 *
 * A disabled button is a drawing, and a drawing refuses nothing. Any other path
 * — a double tap, a stale dialog, a keyboard, a line of code written next year
 * — walks straight past it.
 *
 * So the rule is not about those three. It is: **a control's availability is
 * decided by a named function, and the act behind it asks the same one.** The
 * name is what makes the second half possible: an inline condition cannot be
 * called from anywhere else, which is exactly why the acts did not.
 */

/**
 * Values that look like a name and decide nothing.
 *
 * Exported because a check is worth what it refuses, and the only way to ask
 * that of every control at once is to read the shapes out of the module that
 * declares them rather than to keep a second list in a test. A list kept twice
 * is a list that drifts, and the half that drifts is always the half nothing
 * runs against real source.
 */
export const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN']);

/** `el.something.disabled = …` and `el.something.hidden = …`, with the reason. */
const DRAWING = /el\.(\w+)\.(disabled|hidden)\s*=\s*([^;]+);/g;

/**
 * Every drawing in a source, and what decided it.
 *
 * Each carries `from` and `to`: the half-open span of the decided expression
 * inside `source`, `to` being the index of the `;`. They are here so that a
 * test can put a different decision in one exact statement and ask what the
 * check then says — over every statement and every un-naming shape, rather than
 * over the two or three anybody thought to write out by hand. Without the span
 * a test has to find the statement itself, which means a second copy of the
 * pattern above, which means the test and the audit can disagree about what a
 * drawing even is. That is the mistake `lib/source.mjs` was written to stop.
 */
export function drawings(source) {
  const found = [];

  for (const match of source.matchAll(DRAWING)) {
    const [whole, control, property, decided] = match;
    // `[^;]+` runs up to the `;`, so the whole match ends with the expression
    // and one semicolon: the span is arithmetic rather than a second search.
    const to = match.index + whole.length - 1;

    found.push({
      control,
      property,
      decided: decided.replace(/\s+/g, ' ').trim(),
      from: to - decided.length,
      to,
    });
  }

  return found;
}

/**
 * Whether a drawing names its decision.
 *
 * A call to something is a name; `!x.value.trim().length === 0` is not. The
 * check is deliberately about *shape* rather than about a list of approved
 * functions: a new decision should not have to be registered anywhere, it only
 * has to be a function somebody else can call.
 *
 * `mechanical` is a Map from `control.property` to the exact decided
 * expressions excused there — a permission over pairs, not over controls. It
 * used to be a Set of controls, and the first line of this function used to be
 * `if (mechanical.has(...)) return true;`, which excused every statement that
 * would ever be written on a waived control. See the note above `MECHANICAL` in
 * `audit-drawings.mjs` for what that cost.
 *
 * A Set passed here now throws rather than quietly excusing a control, which is
 * the loud failure this would rather have than the silent one it had.
 */
export function namesItsDecision(drawing, mechanical) {
  // The waiver names a decision, so it is asked about the decision. Anything
  // else assigned to a waived control falls through to the shape rules below,
  // exactly as it would on any other control.
  if (mechanical.get(`${drawing.control}.${drawing.property}`)?.has(drawing.decided)) return true;

  // A literal is not a decision. `= true` was passing the name check as a bare
  // word, which would have let the very thing this exists to catch through —
  // found by testing the checker rather than by trusting it.
  if (LITERALS.has(drawing.decided.replace(/^!/, ''))) return false;
  if (/^!?-?\d/.test(drawing.decided)) return false;

  // Reading the DOM is not deciding anything. `el.writerText.value.trim()
  // .length === 0` looks like a call and is the exact shape this exists to
  // catch — which the first version of the check let through, because it asked
  // only whether *something* was called.
  if (/^!?el\./.test(drawing.decided)) return false;

  // `mayShare(...)`, `!mayStartOver(...)`, `mayThrow(...) !== 'yes'` — a call on
  // a plain name, which is a thing somebody else can call too. Or a bare name:
  // a decision computed a few lines up and readable again.
  return (
    /^!?[A-Za-z_$][\w$]*\(/.test(drawing.decided) || /^!?\w+(\.\w+)*$/.test(drawing.decided)
  );
}

/** The drawings that decide something inline, which is what nothing else can call. */
export function inlineDrawings(source, mechanical = new Map()) {
  return drawings(source).filter((drawing) => !namesItsDecision(drawing, mechanical));
}
