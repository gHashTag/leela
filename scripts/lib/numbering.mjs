/**
 * Taking the plan number off the front of a title, in any script.
 *
 * Every donor heading is *"Plan 34. Anger (krodha)"* in its own language, and
 * the dataset wants the name alone. The version this replaces reasoned in
 * Latin: it searched for `String(plan)` — ASCII digits — and stripped a
 * separator from the class `[\s.:)\-–—、。]`. Its own comment says it was
 * written because matching the WORD for "plan" in twenty-two scripts *"does
 * not scale and silently left the number in place for 15 of the 22
 * languages"*, which is exactly right and is the same trap one level down: it
 * scaled past the word and stopped at the digits.
 *
 * MEASURED against the shipped data on 2026-08-29, three languages and
 * seventy-one titles still carried their label:
 *
 *     ur   49   "۔ پیدائش (جنما)"          the Urdu full stop U+06D4, left behind
 *     mr   20   "योजना ३. राग (क्रोधा)"      Devanagari digits, never matched at all
 *     bn    2   "পরিকল্পনা ২৮। প্রকৃত ধর্ম"     Bengali digits and the danda U+0964
 *
 * Two failures of one assumption. Urdu writes the numeral in ASCII and the
 * stop as `۔`, so the number was found and the separator survived; Marathi and
 * Bengali write the numeral in their own digits, so nothing matched and the
 * whole label survived. A reader of those editions opens plan 3 and is told it
 * is called *"Plan 3. Anger"*, and an Urdu reader gets a full stop for a first
 * character — twice over, since the book prints its own *"1."* in front.
 *
 * So this reads digits by their Unicode value rather than their spelling, and
 * takes any separator that is a punctuation mark rather than a listed one.
 */

/**
 * What a decimal digit is worth, whatever script wrote it.
 *
 * `Number('३')`, `parseInt('३', 10)` and both normalisation forms all return
 * NaN or the character back — measured, not assumed. `\p{Nd}` matches it, so a
 * digit can be FOUND with a regular expression and cannot be VALUED with one.
 *
 * Unicode lays every decimal digit script out as ten consecutive code points
 * beginning at its zero, and no two of those runs are adjacent, so the zero is
 * the first code point at or below this one whose predecessor is not a digit.
 * Walking back at most nine places finds it without a table of scripts that
 * somebody has to maintain and nobody would notice going stale.
 */
export function digitValue(character) {
  const code = character.codePointAt(0);
  if (!/\p{Nd}/u.test(character)) return null;

  for (let back = 0; back <= 9; back += 1) {
    const before = code - back - 1;
    if (before < 0 || !/\p{Nd}/u.test(String.fromCodePoint(before))) return back;
  }

  return null;
}

/** A run of digits as the number it spells, in any script. Null if it is not one. */
export function numberIn(digits) {
  let total = 0;

  for (const character of digits) {
    const value = digitValue(character);
    if (value === null) return null;
    total = total * 10 + value;
  }

  return digits.length > 0 ? total : null;
}

/**
 * How far into a title the numbering may begin.
 *
 * The label in front of the number is a word or two — *Plan*, *योजना*,
 * *পরিকল্পনা*, *منصوبہ*. Beyond that we are looking at a title that happens to
 * contain a number, and *"The 3 gunas"* must be left alone.
 */
const LABEL_AT_MOST = 12;

/**
 * The title without its numbering, or the title unchanged.
 *
 * Null in and null out, because the callers pass whatever the heading parser
 * found and one of them has no heading at all.
 */
export function stripNumbering(title, plan) {
  if (!title) return null;

  // The first run of decimal digits in any script, and where it sits.
  const found = /\p{Nd}+/u.exec(title);
  if (found === null || found.index > LABEL_AT_MOST) return title.trim();
  if (numberIn(found[0]) !== plan) return title.trim();

  /*
   * Any punctuation may separate the number from the name, which is the other
   * half of the repair. The list this replaces held `[\s.:)\-–—、。]` — the
   * Latin stop and two CJK marks — and had never been shown the Urdu `۔` or
   * the danda `।`, so Urdu kept a full stop for a first character on 49 of its
   * 72 plans. A class of "punctuation and space" needs no additions the next
   * time a script is added, which is the property the old list lacked.
   */
  const remainder = title.slice(found.index + found[0].length).replace(/^[\s\p{P}]+/u, '').trim();

  // If cutting would leave nothing, the number was the whole title — keep it.
  return remainder.length > 0 ? remainder : title.trim();
}
