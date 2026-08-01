/**
 * Text the machine translation handed back in the language it was given.
 *
 * The check that exists because the English rules book shipped a chapter
 * written in Russian has always run over **the rules book**: six chapters a
 * language, a manual a player may never open. It never ran over the seventy-two
 * plans — the text the game puts on the screen every single throw — and the
 * sentence it printed on a green run said *every rules chapter is written in the
 * language it is filed under*, which is true, and reads like the dataset.
 *
 * Pointed at the plans it finds ten titles. A Japanese player standing on plan
 * 12 is told they are on **Envy (irasya)**, in a list where every neighbour is
 * Japanese; a Chinese, Korean, Bengali and Tamil player on plan 40 read
 * `Vyana-loka`. The donor did it: `translate-leela/locales/ja/12-envy-ja.md`
 * opens `# Plan 12. Envy (irasya)` above a Japanese page, and `leelaWeb3`'s copy
 * is byte-identical, so there is no better source in the family to take instead.
 *
 * **These are recorded, not repaired.** `corrections.mjs` states the bar and the
 * reason: a correction has to be checkably wrong — arithmetic, not judgement —
 * because nine times two hundred and eighty is two thousand five hundred and
 * twenty in every language at once, and what a title *should say* in Tamil is
 * not. This repository does not translate. So the record below is the finding,
 * and the audit's job is that the set does not grow quietly and that the record
 * does not rot: an entry describing text that is no longer there fails too,
 * exactly as an unapplied correction does.
 */

/**
 * What the check cannot see.
 *
 * For the nine languages written in the Latin script there is no test of this
 * kind: an English title left in German has every letter a German title has.
 * Whoever reads a green run reads that count with it, printed either way.
 */
export const BLIND_TO = 'latin';

/** A paragraph shorter than this is a heading, a citation or a number. */
const A_PARAGRAPH = 40;

/**
 * Every part of a language's plans with none of that language's script in it.
 *
 * Titles and paragraphs separately, because the whole body is never the unit
 * that goes wrong: one English paragraph inside a Japanese plan is invisible to
 * anything asking about the body as a whole. (There are none today. The absence
 * is worth having a name for — it is why the check reads paragraphs at all.)
 *
 * @param plans The language's `plans.<lang>.json`, parsed.
 * @param writtenIn `writtenIn` from `@leela/content`, handed in so this module
 *   stays plain JavaScript that vitest and bun can both read.
 */
export function untranslatedIn(plans, language, writtenIn) {
  const found = [];

  for (const plan of plans) {
    const title = String(plan.title ?? '');
    if (title.trim() && !writtenIn(language, title)) {
      found.push({ language, plan: plan.plan, part: 'title', text: title });
    }

    for (const [index, paragraph] of String(plan.body ?? '').split('\n\n').entries()) {
      if (paragraph.trim().length < A_PARAGRAPH) continue;
      if (writtenIn(language, paragraph)) continue;

      found.push({
        language,
        plan: plan.plan,
        part: `paragraph ${index + 1}`,
        text: paragraph.slice(0, 80),
      });
    }
  }

  return found;
}

/** One finding as the line the audit prints and the record is matched on. */
export const nameOf = (finding) =>
  `${finding.language} plan ${finding.plan} ${finding.part}: ${finding.text.trim()}`;

/**
 * The ten that are there now, each as its own sentence.
 *
 * Not a list of exemptions — a list of what the machine did, kept so that the
 * eleventh is loud. Every one of them was read in the donor it came from.
 */
export const RECORDED = [
  // Plainly English, in a language that is written in neither of its scripts.
  'ja plan 12 title: Envy (irasya)',
  'ja plan 59 title: Plan of Reality (Satya Loka)',
  'zh plan 12 title: Envy (irasya)',
  'ur plan 37 title: Jnana (jnana)',
  // A loka name kept in transliteration where every neighbouring title in the
  // same language translates it and keeps the Sanskrit in parentheses —
  // Japanese has plan 40 as ヴィアナ・ロカ, so the convention is the language's
  // own and these four fell out of it.
  'bn plan 40 title: Vyana-loka',
  'ko plan 40 title: Vyana-loka',
  'ta plan 40 title: Vyana-loka',
  'zh plan 40 title: Vyana-loka',
  'ko plan 70 title: Sattvaguna',
  'zh plan 70 title: Sattvaguna',
];

/**
 * The two ways this can be wrong, as two lists.
 *
 * `fresh` is a finding nobody has recorded — a translation that got worse, or a
 * language added without being read. `rotted` is a record matching nothing: the
 * donor was fixed, or the text moved and the entry now describes something that
 * is not there. The second is the one a quiet check would never mention, and it
 * is how a record turns into a lie it is still passing.
 */
export function against(findings) {
  const seen = new Set(findings.map(nameOf));
  const recorded = new Set(RECORDED);

  return {
    fresh: findings.filter((finding) => !recorded.has(nameOf(finding))),
    rotted: RECORDED.filter((line) => !seen.has(line)),
  };
}
