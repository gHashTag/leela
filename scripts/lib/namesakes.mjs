/**
 * Two squares of the board, told to a player by one name.
 *
 * A game of Leela is seventy-two distinct plans. A player throws, lands on 8,
 * and is told they are on *Greed* — which is what they were told on 4. There
 * is no way back from that: the number is the only thing separating them, and
 * the number is what the board already showed.
 *
 * MEASURED 2026-08-29 across the shipped data: **thirty findings in seventeen
 * of the twenty-two languages**, clustering into five pairs. The Russian
 * edition — written rather than translated, and the source the rest descend
 * from — names all five pairs distinctly, so none of this is the board having
 * two squares for one idea.
 *
 * **The comparison is on the NAME, not the title.** Every language keeps the
 * Sanskrit term in parentheses beside the name, so *"Greed (lobha)"* and
 * *"Greed"* are different strings and the same name. Asking about whole titles
 * found zero collisions and was the wrong question — the first version of this
 * did exactly that and reported the data clean.
 *
 * **Recorded, not repaired**, on the bar `corrections.mjs` states and for the
 * reason `untranslated.mjs` gives: what plan 8 should be called in Tamil is a
 * judgement, and this repository does not translate. Two of these may not even
 * be errors — *maya* and *moha* are near enough that a language may honestly
 * have one word for them. What is checkable is that a player is told the same
 * thing on two squares, and that is what is written down.
 */

/**
 * A plan's name: the title without the Sanskrit term beside it.
 *
 * Both bracket shapes, because the Japanese and Chinese editions set theirs in
 * full-width parentheses — `Jnana（ジナナ）` — and a reader that knew only the
 * ASCII pair would call every one of those a name of its own.
 */
export const nameOf = (title) => String(title ?? '').replace(/[（(].*$/s, '').trim();

/**
 * Every pair of plans a language calls by one name.
 *
 * Ordered by plan number so a pair reads the same however the data is ordered,
 * and so the record below can be compared against it by string.
 */
export function namesakesIn(plans) {
  const firstSeen = new Map();
  const found = [];

  for (const plan of plans) {
    const name = nameOf(plan.title);
    if (name === '') continue;

    const earlier = firstSeen.get(name);
    if (earlier === undefined) {
      firstSeen.set(name, plan.plan);
      continue;
    }

    found.push({ plans: [earlier, plan.plan], name });
  }

  return found;
}

/** One finding as the line the record holds. */
export const lineOf = (language, finding) =>
  `${language} plans ${finding.plans.join(' and ')}: ${finding.name}`;

/**
 * What the shipped data says today, and why each one is left alone.
 *
 * Grouped by PAIR rather than by language, because the cause is shared: one
 * mistranslation of one distinction, inherited by every edition that was
 * machine-translated from the same English. Thirty lines by language would
 * hide that; five entries show it.
 */
export const RECORDED = [
  {
    plans: [4, 8],
    languages: ['bn', 'de', 'fr', 'hi', 'ko', 'mr', 'pa', 'pt', 'ta', 'te', 'tr', 'uk', 'ur', 'vi', 'zh'],
    // THE ROOT WAS IN THE ENGLISH, AND IT IS REPAIRED — 2026-08-29, on the
    // owner's «все три». Russian has plan 4 as «Жадность (лобха)» and plan 8 as
    // «Алчность (матсара или матсаръя)» — two words for two vices, with the
    // Sanskrit term on each. The English donor rendered the second as bare
    // *"Greed"*: the distinct word gone and the term with it.
    //
    // This entry used to say that repairing it meant choosing an English word —
    // *Avarice*? *Covetousness*? *Matsara*? — and that the decision was a
    // translator's, which this repository does not make. **It was his to make
    // and he made it.** `lib/corrections.mjs` now renders plan 8 as *Avarice
    // (matsara)*, restoring the distinction the Russian carries rather than
    // inventing one, and `en` has left the list above.
    //
    // FIFTEEN REMAIN, and they are a different question. Each was
    // machine-translated from the English that had already lost the word, so
    // each would need a word chosen in ITS language — fifteen translators
    // overruled instead of one author heeded. They stay recorded.
    because: 'the English lost the word AND the term; repaired 2026-08-29, 15 editions still carry what they inherited',
  },
  {
    plans: [12, 16],
    languages: ['hi', 'mr', 'pa', 'ta', 'te', 'tr', 'ur'],
    // English and Russian both distinguish these — *Envy (irasya)* and
    // *Jealousy (dvesha)*, «Зависть» and «Ревность» — and seven translations
    // collapsed them into one word. Whether a language has two is a question
    // about that language.
    because: 'envy and jealousy, distinct in en and ru, one word in seven translations',
  },
  {
    plans: [18, 66],
    languages: ['bn', 'hi', 'mr', 'ur'],
    // *Plan of joy (harsha-loka)* and *Plan of bliss (ananda loka)*. The
    // Sanskrit terms differ and are kept; only the name in front collapsed.
    because: 'joy and bliss, distinct in en and ru, one word in four translations',
  },
  {
    plans: [2, 6],
    languages: ['ar', 'te'],
    // *Maya* and *Delusion (moha)*. The likeliest of these to be honest rather
    // than wrong: the two ideas are close, and a language may have one word
    // that covers both. Recorded because a player is still told the same thing
    // twice, not because somebody has decided it is a mistake.
    because: 'maya and moha are near enough that one word may be honest',
  },
  {
    plans: [10, 35],
    languages: ['te'],
    // *Cleansing (tapa)* and *Purgatory (naraka-loka)* — a practice and a
    // place. One edition, and the terms beside them differ.
    because: 'cleansing and purgatory, one word in Telugu alone',
  },
];

/** Every recorded line, spelled the way a finding spells itself. */
export const recordedLines = () =>
  RECORDED.flatMap((entry) =>
    entry.languages.map((language) => `${language} plans ${entry.plans.join(' and ')}`),
  );

/**
 * The two ways this can be wrong, as two lists.
 *
 * `fresh` is a collision nobody wrote down — a translation that got worse, or
 * a language added without being read. `rotted` is a record matching nothing:
 * the title was fixed, or a plan renamed, and the entry now describes
 * something that is not there. The second is the one a quiet check would never
 * mention, and it is how a record turns into a lie it is still passing.
 */
export function against(findings) {
  const seen = new Set(findings);
  const recorded = new Set(recordedLines());

  return {
    fresh: findings.filter((line) => !recorded.has(line)),
    rotted: recordedLines().filter((line) => !seen.has(line)),
  };
}
