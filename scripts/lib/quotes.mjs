/**
 * The daily quote is text a person receives on their phone, unasked.
 *
 * `ai.t27.leela.dailyquote` fires at 06:00 +07 every day and pushes one of 66
 * quotes to two topics, `daily-quote-ru` and `daily-quote-en`. It has run every
 * day this loop has been watching — the log shows plan-44 through plan-47 on
 * consecutive mornings — and **nothing in this repository had ever read what it
 * sends.** The data lives in the donor clone, `../leela-src/leela/scripts/
 * daily-quotes.json`, which none of the twenty audits reach.
 *
 * The first sweep found seven defects in 132 texts, and two of them had gone
 * out inside 48 hours: `46 Различение` on 2026-08-28 and `47.План
 * нейтральности` on 2026-08-29. A push notification is the one surface where a
 * reader cannot look away and cannot check the source — so a stray space in a
 * title is seen by everybody and reported by nobody.
 *
 * **The canonical shape was measured, not assumed.** Of 132 titles, 128 follow
 * the number with exactly `". "`. The four that did not were the four defects:
 * `" Дж"`, `" Ра"`, `".Пл"` and `".  "`. That is what a rule looks like when it
 * is derived from the corpus rather than imposed on it — the lesson #56 paid
 * for, where a parser read Latin and called two donors wrong.
 */

/** `NN. ` — the way 128 of 132 titles open, and now all of them. */
const NUMBERED = /^(\d+)\.\s\S/;

/** A sentence a reader would see as unfinished. Every script's own full stop. */
const ENDS_A_SENTENCE = /[.!?…。！？۔।॥؟»”"')\]]$/u;

/**
 * Everything wrong with one quote, as sentences a person can act on.
 *
 * Both languages, because the two are pushed separately and a defect in one is
 * a defect for everybody subscribed to that topic.
 */
export function quoteProblems(quote) {
  const problems = [];
  const id = String(quote?.id ?? '(a quote with no id)');
  const number = Number(String(id).replace('plan-', ''));

  /*
   * **The field this checker did not know about, and the sender does.**
   *
   * On 2026-08-31 six quotes were added and this function passed all 72. The
   * sender then refused the whole file — *not fit to send from: entry 38
   * (plan-39): missing source* — because `daily-quote-select.mjs` reads
   * `quote.source.plan` and every one of the original 66 carries a `source`
   * recording which files the words came from. **A push that would have failed
   * for everybody, cleared by a guard that had checked what its author thought
   * mattered.**
   *
   * The lesson is not "add a field". It is that a checker written beside a
   * consumer must be held to the CONSUMER's contract, not to a reading of the
   * data — and the way to find that contract is to run the consumer, which is
   * what `--dry` is for and what should have happened before the guard was
   * called green.
   */
  const source = quote?.source;
  if (source === undefined || source === null) {
    problems.push(`${id}: no source — the sender refuses a file with one missing`);
  } else if (typeof source.plan !== 'string' || source.plan.trim() === '') {
    problems.push(`${id}: a source with no plan — the sender reads source.plan and would print undefined`);
  } else if (!Array.isArray(source.files) || source.files.length === 0) {
    problems.push(`${id}: a source naming no files — provenance that says nothing`);
  }

  for (const lang of ['ru', 'en']) {
    const said = quote?.[lang];
    if (said === undefined || said === null) {
      problems.push(`${id} ${lang}: missing entirely`);
      continue;
    }

    const title = String(said.title ?? '');
    const body = String(said.body ?? '');

    if (title.trim() === '') problems.push(`${id} ${lang}: no title`);
    if (body.trim() === '') problems.push(`${id} ${lang}: no body`);

    // The shape 128 of 132 already had. A title is the line a phone shows in
    // bold, and the number is how a reader finds the plan it belongs to.
    if (title !== '' && !NUMBERED.test(title)) {
      problems.push(`${id} ${lang} title: does not open "${number}. " — ${JSON.stringify(title.slice(0, 44))}`);
    }
    if (title !== '' && NUMBERED.test(title) && Number(NUMBERED.exec(title)[1]) !== number) {
      problems.push(`${id} ${lang} title: opens with a different number than its id`);
    }

    for (const [what, text] of [['title', title], ['body', body]]) {
      if (/\s\s/.test(text)) problems.push(`${id} ${lang} ${what}: a double space`);
      if (text !== text.trim()) problems.push(`${id} ${lang} ${what}: padded with whitespace`);
      if (/&\s*[A-Za-z#]/.test(text)) problems.push(`${id} ${lang} ${what}: an HTML entity`);
      if (/<\s*\/?\s*[A-Za-z]/.test(text)) problems.push(`${id} ${lang} ${what}: an HTML tag`);
    }

    if (body.trim() !== '' && !ENDS_A_SENTENCE.test(body.trim())) {
      problems.push(`${id} ${lang} body: stops mid-sentence — ${JSON.stringify(body.trim().slice(-30))}`);
    }
  }

  return problems;
}

/**
 * The plans no daily quote speaks for, and the count is the finding.
 *
 * **EMPTY SINCE 2026-08-29, and the empty list is the point.** It held six —
 * 39, 40, 42, 57, 58, 69 — for as long as there were sixty-six quotes for
 * seventy-two plans, and the sender never noticed because it walks its own list
 * and never asks the board what it is missing. The owner's answer to the three
 * variants was «все три», so the six were written and the gap closed.
 *
 * They were not composed. Every one is the plan's own title and a sentence
 * lifted VERBATIM from the plan's own body, in Russian and in English, checked
 * against `packages/content/data` before being written — so no word in them is
 * new, and this repository still does not translate. That is a firmer footing
 * than the sixty-six already there: **their English sides appear nowhere in the
 * English book at all** (0 of 66, measured), having been translated for the
 * quote file rather than taken from the edition a reader can open.
 *
 * The list stays as a list rather than becoming a count, and `audit-quotes.mjs`
 * re-derives it every run: a gap that was filled and a seventh that appeared
 * read the same way in a number.
 */
export const UNSPOKEN_PLANS = [];

/** Which of 1..72 no quote carries, from the quotes as they are. */
export function unspokenIn(quotes, total = 72) {
  const have = new Set(
    (Array.isArray(quotes) ? quotes : []).map((one) => Number(String(one?.id ?? '').replace('plan-', ''))),
  );

  const missing = [];
  for (let plan = 1; plan <= total; plan += 1) if (!have.has(plan)) missing.push(plan);
  return missing;
}
