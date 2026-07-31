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
    where: 'the ninth plan argues that nine keeps itself; 9 × 280 is 2520, not 7380',
    // The three translations that follow the English rather than the Russian
    // edition, which is how they inherited the English donor's false product.
    // The Russian says 2520 and has always been right.
    languages: ['uk', 'ms', 'ar'],
    plan: 9,
    from: '7,380',
    to: '2,520',
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
