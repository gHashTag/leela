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

/** Values that look like a name and decide nothing. */
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN']);

/** `el.something.disabled = …` and `el.something.hidden = …`, with the reason. */
export function drawings(source) {
  const found = [];

  for (const [, control, property, decided] of source.matchAll(
    /el\.(\w+)\.(disabled|hidden)\s*=\s*([^;]+);/g,
  )) {
    found.push({
      control,
      property,
      decided: decided.replace(/\s+/g, ' ').trim(),
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
 */
export function namesItsDecision(drawing, mechanical) {
  if (mechanical.has(`${drawing.control}.${drawing.property}`)) return true;

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
export function inlineDrawings(source, mechanical = new Set()) {
  return drawings(source).filter((drawing) => !namesItsDecision(drawing, mechanical));
}
