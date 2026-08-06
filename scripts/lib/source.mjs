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

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The extensions a TypeScript source can be written in.
 *
 * `.tsx` is here because of what `lib/claims.mjs` had already written down at
 * lines 303-306, in the one place this repository had learned it:
 *
 *   > `.tsx` counts. This asked for `.ts` alone, so a workspace whose `src`
 *   > holds only components — which `apps/mobile` is one refactor from being —
 *   > would have been skipped whole, by the same rule that exists to stop a
 *   > workspace being skipped.
 *
 * The lesson was written in `claims.mjs` and then not carried anywhere: three
 * audits went on filtering `.ts` alone underneath it. `apps/mobile/src/App.tsx`
 * is a thousand lines of shipped code that `audit-doubles` and `audit-promises`
 * had never read a character of, and reported *every bound is declared once*
 * over.
 *
 * `.mts` because `audit-promises` reads test files written as modules.
 *
 * A `.d.ts` ends in `.ts` and is therefore included, which is what the three
 * callers already did and is left alone deliberately: a declaration file states
 * the same constants and the same injected dependencies as the code beside it,
 * and excluding it here would be a rule about names rather than about content.
 */
const SOURCE = /\.(ts|mts|tsx)$/;

/**
 * Every TypeScript source under a directory, however deep.
 *
 * The walk two audits had written out separately and a third had written a
 * third time with a different extension filter — which is precisely how the two
 * of them came to disagree about whether a component is source. A rule the
 * checks share is a rule to write down once, which is the argument of this
 * whole module.
 *
 * A directory that cannot be read is empty rather than an error: the callers
 * pass a `src` or `tests` path that a workspace may not have, and a throw there
 * would stop the audit at the first workspace missing one.
 */
export function sourceFilesUnder(directory) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return found;
  }

  for (const entry of entries.sort()) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFilesUnder(path));
    else if (SOURCE.test(entry)) found.push(path);
  }

  return found;
}

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
  // The syntaxes with one comment form and no strings to protect, in a table
  // rather than a branch each: the third one was about to be a third copy of
  // the same two lines, in the file whose whole argument is that a rule the
  // checks share is written once.
  //
  // HTML, because `shared-link.test.ts` asserts that `index.html` carries a
  // description and the tags it looks for sit directly under a comment naming
  // every one of them — and because a dialog's only way out, moved into a
  // comment, satisfied the check that exists to keep a player from being
  // trapped in one.
  //
  // CSS, because two checks read the stylesheet raw. The winning square's own
  // rule was commented out whole and *"keeps the numbers on both boards"*
  // passed; and `.board`'s `aspect-ratio` was read out of a note above the live
  // declaration, so the test compared the value somebody had replaced. `//` is
  // deliberately not a comment here — in CSS it is not one, and the module
  // blanker below would blank half of a `content: "a // b"`.
  const ONE_FORM = { html: /<!--[\s\S]*?-->/g, css: /\/\*[\s\S]*?\*\//g };

  if (syntax in ONE_FORM) {
    return source.replace(ONE_FORM[syntax], (block) => block.replace(/[^\n]/g, ' '));
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
