/**
 * A plan's page carrying the next plan's text.
 *
 * Read the Arabic page for plan 12 on the built site, end to end. It opens on
 * envy — the first snake, the bite that takes a player back to the first chakra
 * — and then, halfway down, without a break, it becomes **antariksha**, which
 * is plan 13. A player standing on Envy reads the whole of Nullity.
 *
 * One donor is where all three come from.
 * `leela/src/locales/en/translation.json` has `plan_12.content` at 3,070
 * characters, of which the first 1,408 are envy and the remaining 1,662 are the
 * opening of `plan_13.content`. Arabic, Malay and Ukrainian are the three
 * languages translated from that edition, and each carries the join.
 *
 * **Two wrong instruments before this one, both caught by measuring.** The
 * first asked which plans are more than twice the length of their English —
 * these are 1.5× and it found nothing. The second asked whether a plan *ends
 * with* the opening of the next, which is true of the English donor and false
 * of every translation: the two copies were translated independently, so they
 * agree for a few hundred characters and then drift, and plan 12 holds a
 * shortened copy that stops in the middle of plan 13. The question that is
 * actually true of the data is whether a plan **contains** the opening of the
 * next one, and where.
 *
 * **Why this is repaired where the untranslated titles were recorded.** The bar
 * `corrections.mjs` states is that the donor text must be checkably wrong, so
 * that correcting it overrules no translator. Nothing here is a judgement about
 * what a sentence should say. The cut starts at a run of 548 to 725 characters
 * that is, word for word in that same language, the opening of plan 13; what
 * follows the run opens with plan 13's own name — `البطلان`, `Pembatalan`,
 * `Нікчема` — and has runs of 251 to 321 characters that are also inside plan
 * 13. Every part of what is cut is plan 13's, and it stays on plan 13.
 */

/**
 * Shortest run that cannot be a coincidence or a quotation.
 *
 * The three real ones are 548, 672 and 725 characters. No other pair of
 * neighbouring plans in any of the twenty-two languages shares even sixty.
 */
export const LONG_ENOUGH = 200;

/**
 * How far into a plan a spillover has to start.
 *
 * A plan is allowed to open by taking up where the one before it left off. The
 * three real ones begin at 46 to 47 per cent of the way through, so a quarter
 * is clear of them and still refuses to gut a page from its first sentence.
 */
const FAR_ENOUGH = 0.25;

/** Whitespace differences are where the donor's line breaks moved. */
const flat = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * Where the next plan's text starts inside this one, as an index into `body`.
 *
 * Null when there is no such run worth calling one. Measured on the flattened
 * text and converted back, because the two copies differ in whitespace.
 */
export function spilloverAt(body, next) {
  const flatBody = flat(body);
  const flatNext = flat(next);
  if (flatBody.length === 0 || flatNext.length === 0) return null;

  // The longest prefix of `next` that occurs in `body`. Binary search: if a
  // prefix of length n occurs, so does every shorter one.
  let low = 0;
  let high = Math.min(flatBody.length, flatNext.length);
  let best = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (middle > 0 && flatBody.includes(flatNext.slice(0, middle))) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (best < LONG_ENOUGH) return null;

  const found = flatBody.indexOf(flatNext.slice(0, best));
  if (found < flatBody.length * FAR_ENOUGH) return null;

  // Back into the original text. Counting flattened characters would be wrong
  // wherever the two differ in whitespace, which is the reason this exists: so
  // walk in from the end until the tail flattens to the run and what follows.
  const wanted = flatBody.slice(found);
  for (let taken = wanted.length; taken <= body.length; taken += 1) {
    if (flat(body.slice(body.length - taken)) === wanted) return body.length - taken;
  }

  return null;
}

/** `body` without the part of it that belongs to the next plan. */
export function withoutSpillover(body, next) {
  const at = spilloverAt(body, next);
  return at === null ? body : body.slice(0, at).trimEnd();
}

/**
 * Every plan of a language whose text runs into the next one's.
 *
 * @param plans The language's plans, in order.
 */
export function spilloversIn(plans, language) {
  const found = [];

  for (let index = 0; index < plans.length - 1; index += 1) {
    const here = plans[index];
    const next = plans[index + 1];
    const at = spilloverAt(String(here?.body ?? ''), String(next?.body ?? ''));
    if (at !== null) found.push({ language, plan: here.plan, into: next.plan, at });
  }

  return found;
}

/** One finding as the line the record is matched on. */
export const nameOf = (finding) =>
  `${finding.language} plan ${finding.plan} carries the opening of plan ${finding.into}`;

/**
 * The three in the donor now.
 *
 * Kept for the same reason an unapplied correction is reported: a repair that
 * silently stops matching is a repair that has been undone. If the donor is
 * fixed upstream these go quiet, and the build says so rather than carrying an
 * instruction that no longer describes anything.
 */
export const RECORDED = [
  'ar plan 12 carries the opening of plan 13',
  'ms plan 12 carries the opening of plan 13',
  'uk plan 12 carries the opening of plan 13',
];

/**
 * The two ways this can be wrong, as two lists.
 *
 * `rotted` is a record matching nothing: the donor was fixed upstream, or the
 * text moved and the entry now describes a join that is not there. A repair
 * that has silently stopped matching is a repair that has been undone.
 *
 * `fresh` is a finding nobody recorded — and it is the half that changes what a
 * player reads. `spilloversIn` runs over every language on every build, and
 * `withoutSpillover` truncates the body wherever it fires, recorded or not. So
 * a donor update that introduces a run-on in a fourth language has that plan's
 * tail deleted from the shipped dataset by a cut nobody authorised, printed
 * under a heading that reads as the tool working. Nothing downstream can catch
 * it either: the built data has zero findings precisely because the cut already
 * happened, so the fresh direction exists only here, at build time.
 *
 * This module shipped with `RECORDED` and no `against` for exactly that reason
 * — the doc-comment above states only the rotted half, so the missing half was
 * never written down as missing. Both siblings compute both halves and fail on
 * both: `untranslated.mjs` and `copies.mjs`.
 *
 * Falsified rather than assumed. Making this return `fresh: []` unconditionally
 * turned `packages/content/tests/spillover.test.ts` red — 3 failed, 14 passed
 * of 17, the rotted direction still green throughout, which is exactly the
 * half-built state this module shipped in:
 *   - "an unrecorded finding comes back fresh, and never rotted"
 *       ar plan 1 carries the opening of plan 2 was cut with nothing recording
 *       it: expected [] to deep equally contain { language: 'ar', plan: 1, … }
 *   - "both directions come back from the one pass"  expected [] to deeply
 *       equal [ Array(1) ]
 *   - "reports the same two lists as the sibling it was born half of"
 *       fresh carries findings: expected [] to have a length of 21 but got +0
 * Restoring the filter put all 17 back.
 *
 * @param findings Every spillover this build found, recorded or not.
 */
export function against(findings) {
  const seen = new Set(findings.map(nameOf));
  const recorded = new Set(RECORDED);

  return {
    fresh: findings.filter((finding) => !recorded.has(nameOf(finding))),
    rotted: RECORDED.filter((line) => !seen.has(line)),
  };
}
