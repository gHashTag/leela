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
 * - **Not every language was translated from the same edition.** So a number is
 *   only expected of a translation when both the edition it came from and the
 *   Russian original carry it.
 *
 *   Which edition that is was written down wrong here for a long time —
 *   *Ukrainian, Malay and Arabic follow the English text, the rest follow the
 *   Russian*. The second half is false. `translate-leela/index.js` reads
 *   `./docs` and writes `./locales/<lang>`, and `docs` is **English**: the
 *   nineteen machine translations are translations of an English edition, and
 *   of a *different* English from the one this dataset ships. Both editions are
 *   kept under `data/editions/` now, and `editionOf` reads which one a language
 *   followed off the plans themselves.
 *
 *   Neither is LibreTranslate's, which is what `libre.js` in that repository
 *   looks like it says. That file is fifteen lines, calls
 *   `translate('Привет, мир!', 'ru', 'en')` as an example, and **nothing
 *   imports it**. The translator is Google Cloud Translate, in `index.js`.
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
 * An arithmetic chain: `9x5=45=9`, `8x6=48, 8+4=12, 1+2=3`.
 *
 * Removed before anything here counts a number, because the numbers inside one
 * are not board references and never were. Plans 8 and 9 argue from
 * multiplication tables, and this check was reading every term of them as a
 * cross-reference to a square — so a translation that writes a shorter table
 * was reported as having lost the board, in five of the records it kept.
 *
 * Those tables are `audit-arithmetic`'s territory, and it asks a different
 * question of them: every product it can *read* is checked, in every language.
 * Two checks, two questions. This one asks whether a sentence still points at
 * the square it points at.
 *
 * **What the hand-off does not cover**, written down because this sentence used
 * to overstate it. It said "a stricter rule than presence" — and presence was
 * exactly what neither check asked. This one excuses a table term; that one
 * only examines the sums that are there. `audit-arithmetic` has since closed
 * half of the gap by finding sums whose *operator* a translation dropped, which
 * is what the apparently missing rows in plan 8 turned out to be. A row
 * genuinely absent is still nobody's, and its own header says why counting
 * cannot settle it.
 */
const ARITHMETIC = /\d+\s*[x×хX*✕]\s*\d+\s*=[\d\s+=,.]*/g;

/** The same text with its equations taken out, and everything else kept. */
export function withoutArithmetic(text) {
  return toAsciiDigits(text).replace(ARITHMETIC, ' ');
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
  const grouped = toAsciiDigits(text)
    .replace(/(?<=\d)[ ,.  ](?=\d\d\d\b)/g, '');
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
  // One sentence, three translations, and only one of them had been read. The
  // Ukrainian was found by eye eleven passes ago; these two were found by the
  // audit pointing at them — see `alsoWrittenOutSomewhere`.
  'uk/68': ['шістдесят восьмий'],
  'ms/68': ['enam puluh lapan'], // ms/60: `sehingga persegi enam puluh lapan dicapai`
  'ar/68': ['الثامن والستين'], // ar/60: `حتى يتم الوصول إلى المربع الثامن والستين`
  // The eighth plane, plan 62 — the sentence Spanish, Hindi and Chinese were
  // already excused for. Three more translations write it the same way.
  'ms/8': ['pesawat kelapan'],
  'uk/8': ['восьмого плану'],
  'ar/8': ['الطائرة الثامنة'],
  // The four aspects of mind, plan 55 — German's `vier Hauptaspekte`, three
  // scripts further out. Quoted with the noun they count, so that the excuse is
  // this sentence rather than any four in the language.
  'ms/4': ['empat aspek'],
  'uk/4': ['чотири основні аспекти'],
  'ar/4': ['أربعة جوانب'],
};

/** Whether this language writes this board reference out in words. */
export function writtenOut(language, number, text) {
  const forms = WRITTEN_OUT[`${language}/${number}`] ?? [];
  return forms.some((form) => text.includes(form));
}

/**
 * Numbers some language has been read to spell out, whatever language it was.
 *
 * A reference written in words is a fact about a *sentence*, and the sentence is
 * usually the same one in every translation of a plan. `uk/68` was read and
 * excused; the identical sentence in Malay and Arabic — `sehingga persegi enam
 * puluh lapan dicapai`, `حتى يتم الوصول إلى المربع الثامن والستين` — sat in the
 * recorded damage for eleven passes, because reading is done one file at a time
 * and nothing pointed from one to the next.
 *
 * So the audit points. It cannot read Malay, but it can say *this number is one
 * a translator somewhere wrote as a word, and you are looking at the same plan*
 * — which is the whole of how those two were found.
 */
export function alsoWrittenOutSomewhere(number) {
  return Object.keys(WRITTEN_OUT).some((key) => key.endsWith(`/${number}`));
}

/**
 * An enumerated list: `1. kama, 2. krodha, 3. lobha, 4. moha`.
 *
 * The fifth false alarm, and the same mistake as the times tables one pass ago:
 * a numeral that is not a board reference, counted as one. Plan 6 lists the four
 * possessions and both editions number them, so `1` and `4` were expected of
 * every translation — and Arabic, Malay and Ukrainian keep all four items and
 * drop the numbering, which is a typographic choice and not a lost square.
 *
 * `2` and `3` were never reported, which is the tell: those two digits happen to
 * occur elsewhere in each of those bodies, so a check that asks only whether a
 * number appears *anywhere* let them pass. Three records, six numbers, and the
 * two that escaped were the evidence that the question was wrong.
 *
 * A run from 1, at least three long, at the start of a line. Two numbered items
 * are not distinguishable from a sentence that opens with a figure, and a list
 * that starts at 5 is a continuation of something this plan does not contain.
 */
export function withoutEnumeration(text) {
  const ascii = toAsciiDigits(text);
  const ITEM = /(?:^|\n)[ \t]*(\d{1,2})[.)][ \t]+/g;

  const numbered = new Set([...ascii.matchAll(ITEM)].map((item) => Number(item[1])));
  let run = 0;
  while (numbered.has(run + 1)) run += 1;
  if (run < 3) return ascii;

  return ascii.replace(ITEM, (whole, digits) =>
    Number(digits) <= run ? whole.replace(digits, ' ') : whole,
  );
}

/**
 * What a translation of one plan has lost.
 *
 * Only numbers **both** editions carry: those are the ones no phrasing choice
 * explains away, so their absence is a loss rather than a difference. Returns
 * them sorted, so two runs over the same data read the same.
 */
export function lostFrom(translated, russian, english, language = '') {
  // Equations dropped, on both sides. `numbersIn` still reports their terms —
  // somebody asking what numbers a text states wants them — but a *loss* is a
  // different question, and the terms of a multiplication table are not board
  // references. Plans 8 and 9 argue from tables, and reading their rows as
  // cross-references made a translation with a shorter table look like one that
  // had lost the board: five of the thirty-six records were that and nothing
  // else. The tables belong to `audit-arithmetic`, which checks every product
  // it can read — and not that a row is there at all. See above.
  //
  // The enumeration goes the same way and for the same reason: a numbered list
  // is a typographic choice, and a translation that drops the numbering has not
  // lost a square. Taken out of all three, as the tables are — an enumerator is
  // no more a reference in the source than it is in the translation.
  const said = (text) => new Set(numbersIn(withoutEnumeration(withoutArithmetic(text))));

  const inRussian = said(russian);
  const inEnglish = said(english);
  const present = said(translated);

  return [...inRussian]
    .filter(
      (number) =>
        inEnglish.has(number) &&
        !present.has(number) &&
        !writtenOut(language, number, translated),
    )
    .sort((a, b) => Number(a) - Number(b));
}

/**
 * The edition a translation was made from, read off the plans themselves.
 *
 * Every plan carries the file it came from, so the question does not need a
 * list: a language whose plans say `leela/src/locales/…` was translated
 * alongside `leela/src/locales/en`, and one that says `translate-leela/…` was
 * not. The audit's third false alarm was exactly this — *not every language was
 * translated from the same edition* — and it was closed by comparing against
 * the shipped English, which is a **third** edition that neither family
 * followed for these three languages.
 *
 * Returns the name of an edition under `data/editions/`, or null when the
 * shipped English is the right comparison.
 */
export function editionOf(plans) {
  const sources = new Set(plans.map((plan) => (plan.source ?? '').split('/')[0]));
  if (sources.size !== 1) return null;

  const [family] = sources;
  return { leela: 'leela-en', 'translate-leela': 'translate-leela-en' }[family] ?? null;
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

/**
 * The words that name one square and no other, in an edition's own titles.
 *
 * Every locale keeps the parenthesised transliteration — that is what the term
 * audit established in all 22 of them — so `(prana-loka)` on plan 38 is that
 * edition saying, in its own script, which square `prana` is. The mapping from a
 * term to a number is therefore *inside* each translation, and does not have to
 * be trusted from outside it.
 *
 * Unique on purpose. `loka` is in a dozen titles and identifies nothing;
 * `prana` is in one. A token shared between two titles cannot tell them apart,
 * so it is not evidence about either, and dropping it needs no vocabulary and no
 * list — only counting.
 */
export function identifyingTerms(plans) {
  const inTitle = new Map();
  const across = new Map();

  for (const plan of plans) {
    const tokens = new Set();
    for (const parenthesised of (plan.title ?? '').matchAll(/\(([^)]*)\)/g)) {
      for (const token of parenthesised[1].toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
        if (token.length > 2) tokens.add(token);
      }
    }
    inTitle.set(plan.plan, tokens);
    for (const token of tokens) across.set(token, (across.get(token) ?? 0) + 1);
  }

  return new Map(
    [...inTitle].map(([number, tokens]) => [
      number,
      new Set([...tokens].filter((token) => across.get(token) === 1)),
    ]),
  );
}

/**
 * Which of a square's own names a plan still says, if any.
 *
 * Whole words: `prana` inside `pranayama` is a different word, and a check that
 * counted it would report a sentence about breathing exercises as a surviving
 * cross-reference to square 38.
 */
export function namesOf(body, number, terms) {
  const own = terms.get(number);
  if (!own || own.size === 0) return [];

  const text = (body ?? '').toLowerCase();
  return [...own].filter((term) => new RegExp(`(?<!\\p{L})${term}(?!\\p{L})`, 'u').test(text));
}

/**
 * What kind of loss a record is: a numeral to put back, or a sentence to write.
 *
 * The difference is the whole of the repair, and it used to be five lines
 * somebody had read. Read is better than guessed, but five of thirty-one is not
 * a record — it is a sample, and the thirty-first pass to look at this will read
 * a sixth sentence and write a sixth line.
 *
 * Derived instead, from evidence already in the file: does the plan still name
 * the square it has stopped numbering? A classifier was tried once and rejected
 * for answering a third of the time, and rightly — but it was asking whether the
 * *term* looked Sanskrit. This asks the edition which square a term is, and the
 * edition answers or it does not.
 *
 * Three outcomes, and the third is not a failure. A square whose title carries
 * no name of its own — `Ignorance`, `Earth` — leaves nothing to look for, and
 * saying nothing about it is the honest answer rather than a guess dressed as
 * one.
 */
export function kindOf(body, number, terms) {
  const own = terms.get(number);
  if (!own || own.size === 0) return null;

  const said = namesOf(body, number, terms);
  return said.length > 0
    ? { kind: 'numeral only', names: said }
    : { kind: 'reference gone', names: [] };
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
