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
 * Pointed at the plans it finds fourteen titles. A Japanese player standing on plan
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
 * What the script check cannot see.
 *
 * For the languages written in the Latin script there is no test of *that*
 * kind: an English title left in German has every letter a German title has.
 * `FUNCTION_WORDS` below answers the same question a different way for the
 * seven of them this dataset holds, and `unseeableIn` says what is left.
 */
export const BLIND_TO = 'latin';

/**
 * The words a language cannot write a paragraph without.
 *
 * A closed class — articles, conjunctions, prepositions, the copula — chosen
 * because it is the one part of a language that says nothing about meaning.
 * Asking whether a German paragraph contains `der`, `und` or `ist` overrules no
 * translator: it is not a judgement about what the sentence should say, which
 * is the line `lib/corrections.mjs` draws.
 *
 * Measured before it was trusted, which is the whole of why it is here:
 *
 * - Over the shipped texts, **2,899 prose paragraphs in seven languages and not
 *   one** of them lacks its own function words.
 * - Fed the English plans as though they were each of the other seven, it fires
 *   on **340 of 341** paragraphs every time.
 * - Over the prose of the language itself, in all eight, it fires on **none**.
 *
 * So a paragraph of prose with none of these in it is a paragraph in some other
 * language, and the one it misses is the price of a rule that never accuses a
 * translator wrongly.
 *
 * **A word that English also writes cannot tell the two apart.** Measured
 * against the English plans: German's `die` appears twelve times in them,
 * Spanish's `no` seventy-one, and Portuguese's `a` five hundred and forty-four.
 * Left in, the Portuguese list called English prose Portuguese nearly always,
 * and the test that feeds English in under every language is what said so. They
 * are struck out, and every list still holds a dozen words its own prose cannot
 * avoid.
 */
export const FUNCTION_WORDS = {
  de: /\b(der|das|und|ist|nicht|sich|ein|eine|mit|dem|den|von|zu|auf|für|wird|werden|auch|aber|durch)\b/i,
  en: /\b(the|and|of|to|in|is|that|it|with|for|as|are|this|from|which|not|but|by)\b/i,
  es: /\b(el|la|los|las|de|que|es|un|una|con|por|para|del|se|como|más|pero|este|esta)\b/i,
  fr: /\b(le|la|les|de|des|est|ne|pas|un|une|avec|pour|dans|du|se|comme|plus|mais|ce|cette)\b/i,
  jv: /\b(kang|lan|ing|iku|ora|karo|saka|marang|dadi|wong|iki|kuwi|nanging|uga|bisa)\b/i,
  ms: /\b(yang|dan|di|ini|itu|tidak|dengan|dari|untuk|adalah|akan|pada|dalam|dia|boleh|tetapi)\b/i,
  pt: /\b(o|os|de|que|é|não|um|uma|com|por|para|da|se|seu|como|mais|mas|este|esta)\b/i,
  vi: /\b(và|của|là|có|không|được|trong|người|những|một|này|với|các|cho|khi|đã|sẽ)\b/i,
};

/**
 * Turkish is not here, and the reason is about Turkish rather than about this
 * dataset.
 *
 * It is agglutinative: the words a closed-class list is made of arrive as
 * suffixes. `bu` becomes `bundan`, `kendi` becomes `kendisi`, and `\bbu\b`
 * matches neither. Measured, one Turkish paragraph of the three hundred and
 * ninety-seven holds none of sixteen perfectly ordinary function words —
 * *Oyunun doğası gereği hareketsizlik…*, which is Turkish, twenty-seven words
 * long, and would have been accused.
 *
 * Adding a word until that paragraph passes would be fitting the rule to the
 * sample it was measured on. So Turkish stays unseen and the audit says so,
 * which is the same choice `BLIND_TO` was made for.
 */

/** A paragraph shorter than this is a heading, a citation or a number. */
const A_PARAGRAPH = 40;

/**
 * A title is two parts, and only one of them is translated.
 *
 * Every title in this dataset is `<the name> (<the Sanskrit>)`, and the term in
 * parentheses is kept in every language — Japanese plan 6 is `妄想(モハ)`,
 * Chinese plan 41 is `人类平面 (jana-loka)`. So a title can hold the language's
 * script and still be untranslated where a player reads it: Japanese plan 62 is
 * **`Happiness (スカ)`**, and asking whether the whole string has any kana in it
 * answers yes, about a square whose name is an English word.
 *
 * Found by playing a Japanese game and reading every line the bot sent. The
 * check written the pass before had recorded ten titles and passed this one and
 * three more like it — the instrument was right about presence and wrong about
 * where to look for it.
 *
 * Both parenthesis characters, because Japanese and Chinese use the full-width
 * pair and the same file mixes them: plan 37 in Japanese is `Jnana（ジナナ）`.
 */
const TERM = /[(（][^)）]*[)）]/g;

export function headOf(title) {
  const head = title.replace(TERM, ' ').trim();

  // A title that is nothing but the Sanskrit term has no head to judge; the
  // whole of it is then the thing to ask about.
  return head || title.trim();
}

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
    // The name, not the Sanskrit term beside it: the part a player reads as
    // the name of the square they are standing on.
    if (title.trim() && !writtenIn(language, headOf(title))) {
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

/**
 * A paragraph made of words rather than of numbers.
 *
 * The board's own grid — `72 71 70 69 …` — and the multiplication runs are
 * paragraphs by length and hold no function words in any language, because they
 * hold almost no words. Both were the only two the rule tripped over before
 * this was written, and neither is a translation failure.
 */
function isProse(text) {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const digits = (text.match(/\p{N}/gu) ?? []).length;

  // Twenty-five words, which is the bound the rule was measured at and
  // therefore the only one it may be used at. Written first with the letter
  // count alone, it accused two Javanese paragraphs of fourteen words each of
  // being in some other language — they are Javanese, and short enough to hold
  // none of the fifteen words listed for it.
  return letters > 60 && letters > digits * 3 && text.split(/\s+/).length >= 25;
}

/**
 * Every paragraph of a Latin-script language with none of its own words in it.
 *
 * The same finding shape as `untranslatedIn`, so the record, the printer and
 * the rot check treat both alike. There is nothing to find in the dataset
 * today — this is what a donor update would have to get past.
 */
export function wrongLanguageIn(plans, language) {
  const own = FUNCTION_WORDS[language];
  if (!own) return [];

  const found = [];

  for (const plan of plans) {
    for (const [index, paragraph] of String(plan.body ?? '').split('\n\n').entries()) {
      const text = paragraph.trim();
      if (text.length < A_PARAGRAPH || !isProse(text)) continue;
      if (own.test(text)) continue;

      found.push({
        language,
        plan: plan.plan,
        part: `paragraph ${index + 1}`,
        text: text.slice(0, 80),
      });
    }
  }

  return found;
}

/** Languages neither check can read: Latin script and no words listed. */
export const unseeableIn = (languages) =>
  languages.filter((language) => !FUNCTION_WORDS[language]);

/** One finding as the line the audit prints and the record is matched on. */
export const nameOf = (finding) =>
  `${finding.language} plan ${finding.plan} ${finding.part}: ${finding.text.trim()}`;

/**
 * The fourteen that are there now, each as its own sentence.
 *
 * Not a list of exemptions — a list of what the machine did, kept so that the
 * fifteenth is loud. Every one of them was read in the donor it came from.
 */
export const RECORDED = [
  // Plainly English where the name of the square goes. The last four hold the
  // Sanskrit in the language's own script and were read as translated by the
  // first version of this check, which asked about the whole string.
  'ja plan 12 title: Envy (irasya)',
  'ja plan 17 title: Compassion (だや)',
  'ja plan 58 title: Plan of Radiance (テジャ・ロカ)',
  'ja plan 59 title: Plan of Reality (Satya Loka)',
  'ja plan 62 title: Happiness (スカ)',
  'zh plan 12 title: Envy (irasya)',
  // The Sanskrit name left in transliteration where the name goes, with the
  // same term rendered into the language beside it.
  'ja plan 37 title: Jnana（ジナナ）',
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
