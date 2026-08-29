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

  const scanned = scanJs(source);
  return scanned === null ? blankByPattern(source) : scanned;
}

/**
 * Whether {@link blank} could read this source, or fell back.
 *
 * The fallback is silent by design — a caller wanting comments blanked gets
 * them blanked either way — and a silent fallback is exactly the shape this
 * repository keeps finding at the bottom of its own defects. So it can be
 * asked about.
 *
 * MEASURED over 478 files on 2026-08-29: **one** cannot be read, and it is
 * `apps/mobile/src/App.tsx`. JSX puts a `/` in `</View>` where nothing has
 * ended a value, so the reader takes it for a pattern; JSX is a different
 * grammar and this is a JavaScript reader. That file gets the older, cruder
 * answer, which is what it got before any of this — the fallback exists so the
 * worst case cannot be worse than what was there.
 *
 * The first sweep said thirty-two, and every `scripts/audit-*.mjs` was among
 * them: a shebang offers `/usr/bin` to a reader that has just been told nothing
 * ends a value. They were all falling back **and the repair still looked like
 * it worked**, which is the argument for this function existing at all.
 */
export function blankIsTrusted(source, syntax = 'js') {
  return syntax === 'js' ? scanJs(source) !== null : true;
}

/**
 * The two regular expressions this replaced, kept as the floor.
 *
 * `scanJs` returns null when it reaches the end of a file still inside a
 * string, a template or a regular expression — which means it lost its place
 * and everything after that point is blanked on a guess. **The worst case has
 * to be today's behaviour, not something new**, so that answer is thrown away
 * and this runs instead.
 *
 * The `[^:]` guard is a URL heuristic standing in for string awareness: it
 * saves `https://example.com` and nothing else, so `const a = "x // y"` is
 * blanked from the `//` onward. That defect is the reason `scanJs` exists.
 */
function blankByPattern(source) {
  const blanked = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));

  return blanked.replace(
    /(^|[^:])(\/\/.*)$/gm,
    (_whole, before, line) => before + line.replace(/./g, ' '),
  );
}

/**
 * The last character that can end an expression, or `''`.
 *
 * How a `/` is told from a division. After something that can END a value —
 * an identifier, a number, a closing bracket — a slash is division; anywhere
 * else it opens a regular expression. This is the ordinary heuristic and it is
 * enough here: the alternative is a JavaScript parser, and what this file needs
 * is to know where the comments are.
 */
const ENDS_A_VALUE = /[\w$)\]]/;

/**
 * The keywords after which a slash is a regular expression, not a division.
 *
 * `return /x/` and `typeof /x/` both end in a word character, so the rule
 * above would call them division and then scan the rest of the file as though
 * the regex body were code. That is exactly the failure this whole function
 * has to avoid, so the exceptions are listed.
 */
const BEFORE_A_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await', 'throw',
]);

/**
 * Comments blanked, by reading the file rather than matching it.
 *
 * A comment marker inside a string is not a comment, and a regular expression
 * cannot tell the difference — MEASURED on 2026-08-29, `const a = "x // y";`
 * came back blanked from the `//` onward, taking the rest of the line with it.
 * A test asserting `blank('… // vitest')` had its own closing brackets blanked
 * away and `callsTo` then refused the whole file. **That one was loud. The
 * silent shape is worse:** a check searching blanked source for a forbidden
 * sentence cannot see anything after a `//` in a string, on that line.
 *
 * **The first attempt at this was worse than the defect**, and that is why the
 * bail-out below exists. A scanner that tracks quotes and not regular
 * expressions meets `/['"]/`, takes the `'` for a string, and never finds its
 * close — so every comment in the rest of the file stays unblanked, silently.
 * Returning `null` rather than a wrong answer is what makes the failure a
 * fallback instead of a regression.
 *
 * @returns the blanked source, or `null` if the scan ended somewhere it should
 *   not have — in which case nothing here can be trusted and the caller uses
 *   the older, cruder reader.
 */
function scanJs(source) {
  let out = '';
  let i = 0;

  /*
   * A shebang is not JavaScript, and Node strips it before parsing. This
   * reader has to as well: `#!/usr/bin/env node` offers a `/` in a position
   * where nothing has ended a value, so it reads as a regular expression —
   * `/usr/` with `bin` for flags — and the scan is wrong from the first line.
   *
   * MEASURED: with this missing, 32 of 478 files in this repository could not
   * be trusted, and every `scripts/audit-*.mjs` was among them. They all fell
   * back to the cruder reader silently, so the repair looked like it worked.
   */
  if (source.startsWith('#!')) {
    const end = source.indexOf('\n');
    if (end === -1) return source.replace(/./g, ' ');
    out = source.slice(0, end);
    i = end;
  }

  // What the scanner is inside of. `template` carries a stack because
  // `${}` holds code, which may hold another template.
  let quote = null;
  const templates = [];
  let lastValue = '';

  const blankTo = (stop) => {
    for (let j = i; j < stop; j += 1) out += source[j] === '\n' ? '\n' : ' ';
    i = stop;
  };

  while (i < source.length) {
    const ch = source[i];

    // --- inside a string or a template's text ---------------------------------
    if (quote !== null) {
      out += ch;
      if (ch === '\\' && i + 1 < source.length) {
        out += source[i + 1];
        i += 2;
        continue;
      }
      if (quote === '`' && ch === '$' && source[i + 1] === '{') {
        out += '{';
        templates.push('`');
        quote = null;
        i += 2;
        lastValue = '{';
        continue;
      }
      if (ch === quote) {
        quote = null;
        lastValue = ch === '`' ? '`' : 'x';
      }
      i += 1;
      continue;
    }

    // --- a string, a template, or the end of a `${}` --------------------------
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '}' && templates.length > 0) {
      templates.pop();
      quote = '`';
      out += ch;
      i += 1;
      continue;
    }

    // --- comments ------------------------------------------------------------
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      blankTo(end === -1 ? source.length : end + 2);
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      blankTo(end === -1 ? source.length : end);
      continue;
    }

    // --- a regular expression, or a division ---------------------------------
    if (ch === '/' && !isDivision(source, i, lastValue)) {
      const end = endOfRegex(source, i);
      if (end === null) return null;
      out += source.slice(i, end);
      i = end;
      lastValue = '/';
      continue;
    }

    out += ch;
    if (!/\s/.test(ch)) lastValue = ch;
    i += 1;
  }

  // Ending inside a string, a template or a `${}` means the scan lost its
  // place somewhere back there, and everything since was read as the wrong
  // kind of text. Say so rather than hand back a guess.
  return quote === null && templates.length === 0 ? out : null;
}

/** Whether the `/` at `at` divides rather than opens a pattern. */
function isDivision(source, at, lastValue) {
  if (!ENDS_A_VALUE.test(lastValue)) return false;

  // A word before the slash may be a keyword, and `return /x/` is a pattern.
  const before = source.slice(0, at).match(/([A-Za-z_$][\w$]*)\s*$/);
  return before === null ? true : !BEFORE_A_REGEX.has(before[1]);
}

/**
 * Where the regular expression starting at `at` ends, or null.
 *
 * Character classes are tracked because `/[/]/` is one pattern, not two — the
 * slash inside the brackets closes nothing. Null for one that runs to the end
 * of the line, which no valid pattern does and which means the `/` was
 * something this reader misjudged.
 */
function endOfRegex(source, at) {
  let inClass = false;

  for (let i = at + 1; i < source.length; i += 1) {
    const ch = source[i];

    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '\n') return null;
    if (inClass) {
      if (ch === ']') inClass = false;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === '/') {
      let end = i + 1;
      while (end < source.length && /[a-z]/.test(source[end])) end += 1;
      return end;
    }
  }
  return null;
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
