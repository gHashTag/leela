/**
 * Reading a source file in a check.
 *
 * A dozen tests in this repository assert things about source rather than about
 * behaviour — that every control carries a name, that a decision is asked and
 * not written out twice, that no sentence is spelled into a generator. They are
 * how most of the defects in the last twenty passes were found, and they are
 * also where the mistakes have been.
 *
 * Four in one night, all of one shape: **a pattern that reads the file as text
 * without knowing what text is.**
 *
 *   - `commands\.roll\(([^;]*?)\)` stopped at the `)` in `now()` and read a
 *     four-argument call as three, accusing correct code;
 *   - `[^)]*` over `keepIntention(intentionKeeper, asking.trim())` did the same;
 *   - a check found its writes in a comment-stripped copy and read their reasons
 *     out of the original, at indices that had drifted apart by every comment in
 *     between;
 *   - and a sweep that blanked `*` instead of the whole comment reported fifteen
 *     hard-coded English sentences, every one of them a quotation inside a
 *     comment explaining the string that had been removed.
 *
 * Twice the mistake accused code that was right, and twice it would have let a
 * defect through. So the two operations every one of those checks needs are
 * here, once, tested — the same reason `whose.mjs` and `drawings.mjs` are here:
 * a rule the checks share is a rule to write down once.
 */

/**
 * The same source with its comments blanked, character for character.
 *
 * Blanked and not removed, so an index into the result is an index into the
 * file. A check that finds something in the stripped text and then reads around
 * it in the original is reading a different place — off by every comment
 * between, which in this repository is a great many.
 *
 * Blanking at all is not optional. These files document the defects they fixed,
 * and a comment saying *this used to be `resolveLanguage(undefined)`* reads to a
 * regular expression exactly like the defect still being there.
 *
 * String contents are left alone: a check that forbids a sentence in the source
 * has to be able to see the sentence.
 */
export function blank(source, syntax = 'js') {
  // HTML has one comment form and no strings to protect, and a document read
  // by a check needs the same treatment as a module: `shared-link.test.ts`
  // asserts that `index.html` carries a description, and the tags it looks for
  // sit directly under a comment that names every one of them. Commented out,
  // they would have satisfied it.
  if (syntax === 'html') {
    return source.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '));
  }

  const blanked = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    block.replace(/[^\n]/g, ' '),
  );

  // `//` inside a URL is not a comment. The `[^:]` guard is what tells
  // `https://example.com` from a line comment.
  return blanked.replace(
    /(^|[^:])(\/\/.*)$/gm,
    (_whole, before, line) => before + line.replace(/./g, ' '),
  );
}

/**
 * Every call to `name`, with its arguments, parentheses balanced.
 *
 * The operation three checks got wrong by reaching for a regular expression.
 * `now()`, `asking.trim()` and `plansFor(language)[0]` all close a bracket
 * inside an argument list, and `[^)]*` or `[^;]*?` stops at the first one — so
 * the check reads a shorter call than the one that is written and reports a
 * defect in code that is right.
 *
 * Comments are blanked first, so a call quoted in prose is not counted.
 *
 * @returns One entry per call: the whole call, and the argument text inside it.
 */
export function callsTo(source, name) {
  const code = blank(source);
  const calls = [];
  const opener = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(`, 'g');

  for (const found of code.matchAll(opener)) {
    const open = (found.index ?? 0) + found[0].length;
    let depth = 1;
    let at = open;

    while (at < code.length && depth > 0) {
      if (code[at] === '(') depth += 1;
      else if (code[at] === ')') depth -= 1;
      at += 1;
    }

    // An unclosed call is a file that does not parse; say so rather than
    // returning half of one and letting the caller assert about it.
    if (depth !== 0) throw new Error(`${name}( is never closed`);

    calls.push({ whole: code.slice(found.index ?? 0, at), args: code.slice(open, at - 1) });
  }

  return calls;
}
