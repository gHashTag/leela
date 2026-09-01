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
 *
 * **The one exception, and it is not a loophole: the owner may rule.** The bar
 * exists so that THIS repository does not overrule a translator — not so that
 * the author of the corpus cannot correct his own book. An entry resting on his
 * decision says so in its `where`, carries the date, and is held to exactly the
 * same rot-detection as the arithmetic ones: it must still fire, and the
 * property it claims must still be readable out of the shipped data. There is
 * one such entry, added 2026-08-29 on «все три».
 *
 * **Titles as well as bodies, since 2026-08-29.** An entry may name a `field`.
 * It defaults to `body`, which is what every earlier entry repairs, and the
 * generator now runs the same pass over the title — because the defect that
 * needed the owner's ruling was in a title, and a mechanism that reaches only
 * half the text would have sent that repair back into a generated file with a
 * countdown on it, which is the thing this module exists to stop.
 */

export const CORRECTIONS = [
  {
    where: "the eighth plan has no English name of its own — the owner's ruling, 2026-08-29",
    // NOT arithmetic, and the only entry here that is not. It rests on the
    // owner's answer of 2026-08-29 to the three variants — «все три» — which is
    // the word `audit-namesakes` had been recording and waiting for since #57.
    //
    // The defect, measured rather than argued. `audit-namesakes` finds thirty
    // pairs of plans sharing a name across seventeen editions, and EIGHTEEN of
    // them are plans 4 and 8: `Greed` in English, `Gier`, `贪婪`, `लोभ`, and so
    // on down the list. The root is one asymmetry in the English edition —
    // plan 4 reads `Greed (lobha)` and plan 8 reads bare `Greed`, so the two
    // collapse to one name and every edition translated from the English
    // inherited the collision.
    //
    // **This restores a distinction the source makes; it does not invent one.**
    // The Russian edition is written rather than translated — the entry below
    // about the quotation mark already leans on that — and it uses two
    // different words: «Жадность (лобха)» for plan 4 and «Алчность (матсара
    // или матсаръя)» for plan 8. The English rendering collapsed both to
    // `Greed`, and every edition translated from the English inherited one
    // name for two plans. `Avarice` is the standard English for «Алчность»,
    // and French already keeps the pair apart the same way, rendering plan 4
    // as `Cupidité`.
    //
    // The transliteration comes from the Russian too, in the `Name (word)`
    // form 63 of the other 71 English titles already use. MEASURED FIRST: an
    // earlier version of this entry added only the transliteration, and
    // `audit-namesakes` still reported the pair — `nameOf` strips a
    // parenthetical, so `Greed (matsara)` and `Greed (lobha)` are one name to
    // it. A repair has to move the thing the check reads.
    field: 'title',
    languages: ['en'],
    plan: 8,
    from: 'Greed',
    to: 'Avarice (matsara)',
    // Stated over the shipped title rather than by re-running the repair: a
    // repair that has stopped firing changes nothing either, which is how
    // eighteen broken translations once passed.
    holds: (title) => title.trim() === 'Avarice (matsara)',
  },
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
  {
    where: 'the sixth plan in Malay carries a paragraph of mangled non-breaking spaces',
    // The whole paragraph is `& Nbsp; & nbsp; & nbsp; & nbsp;` — four HTML
    // entities for a non-breaking space, each broken by a space after the
    // ampersand and the first capitalised, standing alone between *"Keempat-
    // empat ini dipanggil"* and the list it introduces. A reader of the Malay
    // edition sees exactly that, on the page.
    //
    // BOTH donors carrying the Malay text have it — `leela-game/translations/
    // ms/plans.json` and `leela/src/locales/ms/translation.json` — so the
    // machine translation broke the markup, not this repository.
    //
    // Checkable, on the terms this file draws its line. An HTML entity is
    // MARKUP, not words, in every language at once, so nothing here is a
    // judgement about Malay. And REMOVING IT REMOVES NO WORDS: the paragraph
    // holds no letters of any language, only four broken entities, so no
    // translator is overruled and nothing anybody wrote is lost.
    //
    // FOUND BY THE COUNT, NOT BY THE PATTERN. A sweep for `&nbsp;` over all
    // 1,584 bodies found nothing, because the corpus does not hold the
    // canonical spelling. What found it was that `&` occurs in exactly ONE
    // plan of 1,584 — the probe had looked for how the defect is spelled when
    // it is written correctly, and a mangled thing is mangled.
    languages: ['ms'],
    plan: 6,
    // A paragraph that is nothing but entities, however spelled and spaced.
    // Anchored on the blank lines either side so it cannot eat the text around
    // it, and it must not touch a paragraph that has words in it as well.
    repair: (body) => body.replace(/\n\n(?:\s*&\s*[A-Za-z]+\s*;\s*)+\n\n/g, '\n\n'),
    // The property, read out of the data without reference to the repair.
    // Asking whether running the repair again changes anything is a check that
    // cannot fail — a repair that has stopped firing changes nothing either.
    holds: (body) => !/&\s*[A-Za-z]+\s*;/.test(body),
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
export function corrected(body, language, plan, field = 'body') {
  let out = body;
  const applied = [];

  for (const fix of CORRECTIONS) {
    if (fix.plan !== plan || !fix.languages.includes(language)) continue;
    // `body` when unstated, so every entry written before titles were reachable
    // keeps its meaning exactly.
    if ((fix.field ?? 'body') !== field) continue;

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
