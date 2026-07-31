/**
 * The board references inside the traditional text, and whether a translation
 * still carries them.
 *
 * The translation audit two dozen passes ago checked the data at *term* level:
 * parenthesised transliterations survive, no two plans share a body, body
 * lengths sit where each script's density predicts. It found nothing, and it
 * was looking at the wrong layer.
 *
 * The plans talk about the board. "The player can get here only by passing
 * through the field of correct knowledge (45)." "A snake leading from the
 * tamoguna square (field 72)." "See also comments on boxes 38, prana, 39,
 * apana, and 40, vyana." "Until he reaches field 68." A cross-reference whose
 * number is gone points nowhere, and plan 9 — whose whole argument is
 * `9x5=45=9; 9x6=54=9; …` — becomes an argument with its premises deleted.
 *
 * This matters more than it did last month: the companion now puts that text in
 * its prompt and is told *it is the source; you are not*.
 *
 * Three false alarms had to be closed before any of this could be believed, and
 * they are why the checks below look the way they do:
 *
 * - **Numerals are not ASCII everywhere.** Arabic, Urdu, Hindi and Marathi
 *   write their own digits. A `\d` scan reports every number in those languages
 *   as missing, which is a check that fails loudest where it understands least.
 * - **Thousands are grouped differently.** `72,000` and `72 000` and `72000`
 *   are one number written three ways, and comparing them naively made every
 *   language — including English — look damaged in plan 9.
 * - **Not every language was translated from the same edition.** Ukrainian,
 *   Malay and Arabic follow the *English* text, the rest follow the Russian,
 *   and the two editions phrase things differently. So a number is only
 *   expected of a translation when **both** editions carry it.
 */

/** Every numeral system the 22 languages might write a board reference in. */
const DIGIT_BASES = [
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic (Urdu, Persian)
  0x0966, // Devanagari (Hindi, Marathi)
  0x09e6, // Bengali
  0x0a66, // Gurmukhi (Punjabi)
  0x0b66, // Oriya
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
  0x0e50, // Thai
  0xff10, // Fullwidth (CJK)
];

/** The same number, whatever digits it is written in. */
export function toAsciiDigits(text) {
  let out = '';

  for (const character of String(text)) {
    const code = character.codePointAt(0);
    const base = DIGIT_BASES.find((start) => code >= start && code <= start + 9);
    out += base === undefined ? character : String(code - base);
  }

  return out;
}

/**
 * The numbers a text states, with grouping removed.
 *
 * A separator only counts as grouping when exactly three digits follow it, so
 * "38, 39" stays two numbers and "72,000" becomes one. Anything longer than
 * eleven digits is not a board reference or a piece of arithmetic — it is a
 * phone number or an artefact, and it is not this audit's business.
 */
export function numbersIn(text) {
  const grouped = toAsciiDigits(text).replace(/(?<=\d)[ ,.  ](?=\d\d\d\b)/g, '');
  return [...grouped.matchAll(/\d+/g)].map((match) => match[0]).filter((n) => n.length <= 11);
}

/**
 * Board references written as words rather than digits.
 *
 * The fourth false alarm, and the one that had been believed. This audit counts
 * *digits*, so a translation that spells a number out reads as damage — and
 * every one of these was reported as a lost reference for as long as the check
 * has existed:
 *
 * - German plan 55: `vier Hauptaspekte`, the four aspects of mind.
 * - Spanish plan 62: `el octavo plano`, the eighth plane.
 * - Hindi plan 62: `आठवें तल`, the same sentence.
 * - Chinese plan 62: `第八位面`, the same sentence again.
 * - Marathi plan 5: `पाचव्या क्रमांकावर`, the number five and its planet.
 * - Ukrainian plan 60: `шістдесят восьмий квадрат` — the *winning square*,
 *   spelled out in full, counted as missing because it has no digits in it.
 *
 * Every entry here was read in the file it comes from before it was written
 * down. None is a translation and none is vocabulary anybody has to trust: each
 * is a quotation, and the sentence it comes from is named beside it.
 *
 * The remaining records are an upper bound rather than a count. Checking the
 * rest means reading twenty-two more sentences in Arabic, Malay and Ukrainian,
 * and what is above is what has been read.
 */
const WRITTEN_OUT = {
  'de/4': ['vier'],
  'es/8': ['octavo'],
  'hi/8': ['आठवें'],
  'zh/8': ['第八'],
  'mr/5': ['पाच'],
  'uk/68': ['шістдесят восьмий'],
};

/** Whether this language writes this board reference out in words. */
export function writtenOut(language, number, text) {
  const forms = WRITTEN_OUT[`${language}/${number}`] ?? [];
  return forms.some((form) => text.includes(form));
}

/**
 * What a translation of one plan has lost.
 *
 * Only numbers **both** editions carry: those are the ones no phrasing choice
 * explains away, so their absence is a loss rather than a difference. Returns
 * them sorted, so two runs over the same data read the same.
 */
export function lostFrom(translated, russian, english, language = '') {
  const inRussian = new Set(numbersIn(russian));
  const inEnglish = new Set(numbersIn(english));
  const present = new Set(numbersIn(translated));

  return [...inRussian]
    .filter(
      (number) =>
        inEnglish.has(number) &&
        !present.has(number) &&
        !writtenOut(language, number, translated),
    )
    .sort((a, b) => Number(a) - Number(b));
}

/** One plan in one language, and the board references it dropped. */
export function lossesIn(plans, russian, english, language = '') {
  const byPlan = (list) => new Map(list.map((plan) => [plan.plan, plan]));
  const ru = byPlan(russian);
  const en = byPlan(english);
  const losses = [];

  for (const plan of plans) {
    const source = ru.get(plan.plan);
    const other = en.get(plan.plan);
    if (!source || !other) continue;

    const lost = lostFrom(plan.body ?? '', source.body ?? '', other.body ?? '', language);
    if (lost.length > 0) losses.push({ plan: plan.plan, lost });
  }

  return losses.sort((a, b) => a.plan - b.plan);
}

/** A loss as one line, which is also how the recorded damage is written. */
export function keyOf(language, loss) {
  return `${language}/${loss.plan}: ${loss.lost.join(',')}`;
}

/**
 * What is new against what is already known.
 *
 * The damage below is real and cannot be repaired here — repairing it means
 * translating, which needs a service this repository deliberately does not
 * call. So it is recorded rather than hidden: the audit names it every run, and
 * fails only on a loss nobody has seen before.
 */
export function unrecorded(found, recorded) {
  const known = new Set(recorded);
  return found.filter((line) => !known.has(line));
}
