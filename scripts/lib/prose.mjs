/**
 * The shipped text is prose, and not the markup it was carried in.
 *
 * `packages/content/data/plans.*.json` is built from four donors, two of them
 * markdown and two JSON, and the words pass through a machine translator on
 * the way. Anything of the format that survives that journey is printed to a
 * reader as itself: the Malay sixth plan carried a paragraph reading
 * `& Nbsp; & nbsp; & nbsp; & nbsp;` between *"Keempat-empat ini dipanggil"*
 * and the list it introduces, and had since the edition was generated.
 *
 * **THE PROBE THAT MISSED IT LOOKED FOR `&nbsp;`.** Sweeping 1,584 bodies for
 * the canonical spelling found nothing, because a translator that mangles an
 * entity does not leave it canonical — it had inserted a space after each
 * ampersand and capitalised the first. What found it was counting: `&` occurs
 * in exactly ONE plan of 1,584, and one is a number worth looking at.
 *
 * So the readers here are written to catch the DEFECT rather than its tidy
 * form: an ampersand with letters and a semicolon after it, spaces allowed
 * anywhere. A check for markup that only recognises well-formed markup is a
 * check for the case that was never the problem.
 */

/**
 * Markup that has no business in a sentence, as the shapes it really takes.
 *
 * Each is a class, not a spelling. `&\s*[A-Za-z]+\s*;` catches `&nbsp;`,
 * `& Nbsp;` and `&AMP ;` alike; the heading and emphasis readers ask for the
 * markdown that a donor could leak; the tag reader asks for an angle bracket
 * followed by a name, which is the only way an HTML tag can begin.
 */
export const MARKUP = [
  { what: 'an HTML entity', reader: /&\s*[A-Za-z]+\s*;|&\s*#\s*\d+\s*;/ },
  { what: 'an HTML tag', reader: /<\s*\/?\s*[A-Za-z][A-Za-z0-9]*(\s|\/?>)/ },
  { what: 'a markdown heading', reader: /(^|\n)\s{0,3}#{1,6}\s+\S/ },
  { what: 'markdown emphasis', reader: /\*\*\S|\S\*\*|(^|\s)_[^_\s][^_]*_(\s|$)/ },
  { what: 'a markdown link', reader: /\[[^\]\n]+\]\([^)\n]+\)/ },
  { what: 'a markdown image', reader: /!\[[^\]\n]*\]\([^)\n]+\)/ },
  { what: 'a fenced code block', reader: /(^|\n)\s*```/ },
];

/**
 * A plan's text ends where a sentence ends.
 *
 * The generator already cuts a plan that runs into the one after it —
 * `lib/spillover.mjs` did that for three languages — and this is the other
 * edge: a body that stops in the middle of a clause, because a donor was
 * truncated or a paragraph was dropped.
 *
 * Every script's own full stop, because six of the twenty-two do not use the
 * Latin one: `۔` for Urdu, `।` and `॥` for the Devanagari family, `。！？` for
 * the CJK editions, `؟` for Arabic. A closing bracket or quotation mark may
 * follow the stop and often does.
 *
 * A colon and a semicolon are deliberately NOT endings. A body finishing on
 * either is a body that was about to say something, which is the shape being
 * looked for — and MEASURED: no plan in any language ends on one today, so
 * refusing them costs nothing and catches the next truncation.
 */
export const ENDS_A_SENTENCE = /[.!?…。！？۔।॥؟»”"')\]]\s*$/u;

/** Every piece of markup left in a text, named. Empty when it is prose. */
export function markupIn(text) {
  const said = String(text ?? '');
  return MARKUP.filter(({ reader }) => reader.test(said)).map(({ what }) => what);
}

/** Whether a body reads as finished. Empty text is not a truncation. */
export function endsProperly(body) {
  const said = String(body ?? '').trim();
  return said === '' || ENDS_A_SENTENCE.test(said);
}

/**
 * Everything wrong with one plan's prose, as sentences a person can act on.
 *
 * Title, description and body are read separately, because markup in a title
 * is a different repair from markup in a body — and the title is what the
 * board prints in the header, where there is no room for it.
 */
export function proseProblems({ language, plan, title, description, body }) {
  const problems = [];

  for (const [field, text] of [['title', title], ['description', description], ['body', body]]) {
    if (text === null || text === undefined) continue;
    for (const what of markupIn(text)) {
      problems.push(`${language} plan ${plan} ${field}: ${what}`);
    }
  }

  if (!endsProperly(body)) {
    problems.push(`${language} plan ${plan} body: stops mid-sentence — ${JSON.stringify(String(body).trim().slice(-40))}`);
  }

  return problems;
}
