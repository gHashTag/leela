/**
 * Corrections to the donor text, stated once and applied by the generator.
 *
 * `packages/content/data/plans.*.json` are built from `leela-src`. A pass
 * corrected `9х280=7,380` to `2,520` in three of those files and nowhere else,
 * so the next `node scripts/build-content.mjs` put the false sum back —
 * `audit-arithmetic` started failing, and the only reason anybody saw it was
 * that a rebuild happened to run in the same pass as the audit.
 *
 * A repair that lives in a generated file is a repair with a countdown on it.
 * This is where one goes so that a rebuild reproduces it, and the reason it is
 * its own module rather than a constant in the generator is that two other
 * things need to read it: the generator, to apply it, and the dataset audit, to
 * check the shipped data still carries it. The generator cannot be imported —
 * it reads the donor and writes files the moment it loads.
 *
 * **The bar for adding an entry.** The donor text must be *checkably* wrong —
 * arithmetic, not judgement — so that correcting it overrules no translator.
 * Nine times two hundred and eighty is two thousand five hundred and twenty in
 * every language at once. Everything else the translation audits find is
 * recorded and left alone precisely because repairing it would mean deciding
 * what a sentence should say, and this repository does not translate.
 */

export const CORRECTIONS = [
  {
    where: 'the eighth plan ends with a quotation mark that opens nothing',
    // The donor has it: `translate-leela/docs/8-greed.md` holds exactly one `"`
    // and it is the last character of the file. Eighteen machine translations
    // carry it, seventeen at the very end and the Spanish one character in,
    // because Spanish sets the full stop outside the quotation.
    //
    // Checkable, and on three counts rather than one. The mark closes nothing —
    // counting says so, in every language at once. The two sources of this text
    // that did not come through that donor disagree with it: the Russian, which
    // is written rather than translated, has no quotation in plan 8 at all, and
    // Arabic, Malay and Ukrainian carry a properly paired one around a
    // different phrase entirely. And removing it removes no words, which is the
    // line this file draws — what a sentence should say is not the question,
    // and nobody is overruled.
    languages: ['bn', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'jv', 'ko', 'mr', 'pa', 'pt', 'ta', 'te', 'tr', 'ur', 'vi', 'zh'],
    plan: 8,
    // Only where it is alone. A body with a pair in it is a body with a
    // quotation in it, and this must not touch that.
    repair: (body) => {
      const marks = body.match(/["“”„«»「」]/g) ?? [];
      return marks.length === 1 ? body.replace(/["“”„«»「」]/, '') : body;
    },
    // What must be true of the shipped text, said without reference to the
    // repair. Asking instead whether running the repair again changes anything
    // is a check that cannot fail: a repair that has stopped firing changes
    // nothing either, and the audit called eighteen broken translations
    // correct. A structural entry states the property, and the property is
    // read out of the data.
    holds: (body) => (body.match(/["“”„«»「」]/g) ?? []).length !== 1,
  },
  {
    where: 'the ninth plan argues that nine keeps itself; 9 × 280 is 2520, not 7380',
    // The three translations that follow the English rather than the Russian
    // edition, which is how they inherited the English donor's false product.
    // The Russian says 2520 and has always been right.
    languages: ['uk', 'ms', 'ar'],
    plan: 9,
    from: '7,380',
    to: '2,520',
  },
  {
    where: 'the eighth plan states 8 × 9 with no sign in it; only multiplication makes 72',
    // Plan 8's run ends in a sentence rather than in the list, and the machine
    // translation ate the multiplication sign there. Both operands and the
    // product survive, and no other operation on 8 and 9 gives 72 — 8+9 is 17,
    // 8−9 is −1 — so the sign is what arithmetic says it is. The character is
    // the Cyrillic `х` this file already writes every other row with.
    //
    // The three siblings of this one are recorded in `audit-arithmetic` rather
    // than corrected: each needs a number restored or a digit removed, and
    // which one is a reading of what the machine did rather than a calculation.
    languages: ['ms'],
    plan: 8,
    from: '8 9 = 72',
    to: '8х9 = 72',
  },
];

/**
 * A body with every correction stated for this language and plan applied.
 *
 * Returns what was applied as well as the text, because a correction matching
 * nothing is the thing worth knowing: either the donor was fixed upstream, or
 * the sentence moved and the entry now describes text that is not there. The
 * two look identical to a build that stays quiet, so the build does not.
 */
export function corrected(body, language, plan) {
  let out = body;
  const applied = [];

  for (const fix of CORRECTIONS) {
    if (fix.plan !== plan || !fix.languages.includes(language)) continue;

    // Some of what a donor gets wrong is structural rather than textual. The
    // eighth plan ends with a quotation mark that opens nothing, and the words
    // in front of it are different in each of the eighteen languages that
    // carry it — there is no `from` to write. An entry may therefore state the
    // repair as a function of the body, and is recorded and checked for rot on
    // exactly the same terms: it counts as applied when it changes something,
    // and `unappliedIn` fails on it when it stops.
    if (fix.repair) {
      const next = fix.repair(out);
      if (next !== out) {
        out = next;
        applied.push(fix.where);
      }
      continue;
    }

    if (!out.includes(fix.from)) continue;

    out = out.split(fix.from).join(fix.to);
    applied.push(fix.where);
  }

  return { body: out, applied };
}

/** Corrections that no plan in any language matched, as their own sentences. */
export function unappliedIn(applied) {
  const seen = new Set(applied);
  return CORRECTIONS.map((fix) => fix.where).filter((where) => !seen.has(where));
}
