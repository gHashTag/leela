/**
 * Words a type declares that nothing ever says.
 *
 * `TurnBlockedReason` listed `finished` and `canRoll` returned it from nowhere:
 * the only mention of that word in the file was the type itself. So every
 * surface wrote the check by hand — the bot inline, the mini app in its own
 * `canRoll`, the phone through `isSessionOver`, which asks a different question
 * — and one of the three got it wrong.
 *
 * A vocabulary with an unreachable word in it is worse than a shorter one. It
 * reads as though the question is answered here, and the answers get written
 * somewhere else, once per surface.
 *
 * The check is *produced*, not *handled*: a value that appears only in a
 * `switch` arm or a comparison is being received rather than made, and that is
 * a different thing — see `RECEIVED` in the audit for the cases of it here.
 *
 * ## That sentence used to be a claim rather than a rule
 *
 * It was written at the top of this file from the first pass, and `unsaidIn`
 * below it read `body.includes("'x'")` — any occurrence at all, so `x === 'x'`
 * counted as the word being said. MEASURED on `Arrival` in
 * `packages/ai/src/prompts.ts`: the union declares `standing | received`, the
 * word `received` occurs three times inside `packages/ai/src` — the declaration
 * itself, a doc-comment, and `arrival === 'received'` at line 346 — and not one
 * of them makes the value. The producer is `apps/bot/src/bot.ts`, in another
 * package, which this check does not read and should not. The audit passed, and
 * it passed for a reason that has nothing to do with the question it asks.
 *
 * Worse than one union half-real: the founding defect would have been invisible
 * had any engine file happened to write `reason === 'finished'`. A rule that
 * counts occurrences cannot see the difference between a vocabulary that is
 * produced and one that is only ever answered.
 *
 * So each occurrence is now classified rather than counted, and the reader is
 * the TypeScript parser rather than a search over text — the same choice
 * `lib/awaited.mjs` made, for the same reason. A production site is `return
 * 'x'`, `= 'x'`, an object-literal value, an argument, an array element, an arm
 * of a ternary, the right of `??`. `=== 'x'`, `case 'x':`, `.includes('x')`,
 * `.has('x')` and anything standing in a type are HANDLING, and prove nothing.
 * Not said is the default: a shape this reader does not recognise is a shape it
 * stays quiet about rather than counts as a word said.
 */

import ts from 'typescript';

/**
 * Comments removed, so that a word quoted in prose is not a use of it.
 *
 * Half of this repository is prose about what went wrong, and that prose quotes
 * the code it is about — the paragraph above this function says `arrival ===
 * 'received'` and `{ say: 'finished' }` in as many words. The parser below
 * ignores comments on its own; this runs first so that nothing downstream, and
 * no future reader of `code`, can be fooled by a sentence.
 *
 * **Blanked, not deleted, and strings are copied through untouched.** The first
 * version of this was two regular expressions — strip `/* ... *\/`, then strip
 * from `//` to end of line — and it cut into string literals. MEASURED over the
 * sixty-nine sources this audit reads: `'https://...'` lost its closing quote,
 * and four files that parse cleanly raw came back with 5, 8, 2 and 4 syntax
 * errors after stripping. One of the four is `apps/bot/src/bot.ts`, which is
 * where `{ say: 'finished' }` lives — the one production site the founding
 * defect turns on. A comment stripper that damages code is worse than none.
 *
 * Blanking keeps every offset the offset it had in the file and every newline a
 * newline, so a position in the result is a position in the source.
 */
export function codeIn(source) {
  const keep = (ch) => (ch === '\n' ? '\n' : ' ');
  let out = '';
  let at = 0;
  // The last character that was not whitespace, which is how a regular
  // expression is told from a division: `/` after a value divides, `/` after
  // `(`, `,`, `=` and their relatives opens a pattern.
  let last = '';
  // What is currently open, innermost last. A quote character means a string or
  // a template; `{` means an interpolation inside one, whose contents are code
  // again and may hold strings, braces and templates of their own.
  const open = [];
  const insideText = () => open.length > 0 && open[open.length - 1] !== '{';

  while (at < source.length) {
    const ch = source[at];
    const next = source[at + 1];

    if (insideText()) {
      const quote = open[open.length - 1];
      if (ch === '\\') {
        out += ch + (next ?? '');
        at += 2;
        continue;
      }
      if (ch === quote) {
        open.pop();
        out += ch;
        at += 1;
        last = ch;
        continue;
      }
      if (quote === '`' && ch === '$' && next === '{') {
        open.push('{');
        out += '${';
        at += 2;
        last = '{';
        continue;
      }
      out += ch;
      at += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      while (at < source.length && source[at] !== '\n') {
        out += keep(source[at]);
        at += 1;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', at + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (; at < stop; at += 1) out += keep(source[at]);
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      open.push(ch);
      out += ch;
      at += 1;
      last = ch;
      continue;
    }

    // Braces are counted only inside an interpolation, where one of them is the
    // end of it. `${ obj.map((x) => ({ k: 1 })) }` closes on the last.
    if (open.length > 0 && ch === '{') {
      open.push('{');
      out += ch;
      at += 1;
      last = ch;
      continue;
    }
    if (open.length > 0 && ch === '}' && open[open.length - 1] === '{') {
      open.pop();
      out += ch;
      at += 1;
      last = ch;
      continue;
    }

    if (ch === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(last)) {
      out += ch;
      at += 1;
      let inClass = false;
      while (at < source.length) {
        const c = source[at];
        if (c === '\\') {
          out += c + (source[at + 1] ?? '');
          at += 2;
          continue;
        }
        // An unterminated pattern is a misreading — a division taken for a
        // slash. Stop at the line rather than swallow the rest of the file.
        if (c === '\n') break;
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
        out += c;
        at += 1;
      }
      out += source[at] ?? '';
      at += 1;
      while (at < source.length && /[a-z]/.test(source[at])) {
        out += source[at];
        at += 1;
      }
      last = '/';
      continue;
    }

    out += ch;
    if (!/\s/.test(ch)) last = ch;
    at += 1;
  }

  return out;
}

/**
 * One parse per file, kept, because `unsaidIn` asks about every source once per
 * union and there are more unions than there are cheap parses.
 */
const trees = new Map();

function treeFor(source, file) {
  const key = `${file} :: ${source.length} :: ${source}`;
  const had = trees.get(key);
  if (had) return had;
  // The kind matters: a `.ts` file may write `<T>(x: T) => x`, which under TSX
  // is an unclosed tag. MEASURED on `apps/docs/src/render.ts` — 166 syntax
  // errors read as TSX, none read as TS.
  const kind = /\.tsx$/.test(file ?? '') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const made = ts.createSourceFile(file ?? 'source.ts', source, ts.ScriptTarget.Latest, true, kind);
  trees.set(key, made);
  return made;
}

/** Every alternative of a union that is a plain string literal. */
function literalsOf(typeNode) {
  let node = typeNode;
  while (node && ts.isParenthesizedTypeNode(node)) node = node.type;
  if (!node || !ts.isUnionTypeNode(node)) return [];
  return node.types
    .filter((one) => ts.isLiteralTypeNode(one) && ts.isStringLiteral(one.literal))
    .map((one) => one.literal.text);
}

function nameOf(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

/**
 * `type X = 'a' | 'b';` and `kind: 'a' | 'b';` — every string union declared.
 *
 * **Alternatives that are not literals are ignored, not fatal.** Both of the
 * regular expressions this replaced required the ENTIRE right-hand side to be
 * string literals, so a union that mixes words with a named type or with `null`
 * was not seen at all. MEASURED: 16 unions found that way; reading the
 * declarations instead finds 8 more, and three of those matter by name —
 * `apps/miniapp/src/view.ts` and `apps/mobile/src/game.ts` each declare a
 * `ThrowRefusal` that is `'yes' | ... | TurnBlockedReason`, which is to say the
 * two per-surface re-answers of the exact type this audit was written for, and
 * `apps/mobile/src/journal.ts` has `refusal: 'empty' | 'too-short' | null`.
 *
 * HONEST NEGATIVE, and it belongs here rather than in a commit message: every
 * member of those three unions IS produced today, so widening the scan closes
 * no live defect. It only means the guard is now watching the two files it was
 * written for, which it never was.
 *
 * A union written anywhere ELSE is still not read, and that is a choice with a
 * measurement behind it: 14 more union type nodes of two or more string
 * literals exist in these sixty-nine files, and ten of them are the inside of a
 * `Pick<Player, 'needsReport' | 'lastRollAt' | ...>`. Those words are property
 * names being selected, not a vocabulary anything produces, and holding them to
 * this rule would report a dozen innocents on the first run. The remaining four
 * are parameter and return annotations, which are a real vocabulary written in
 * a place nothing can name — there is no declaration to report against — so
 * they are a miss, written down rather than papered over.
 *
 * `at` is the span of the TYPE, not of the declaration around it. A class field
 * may be written `kind: 'a' | 'b' = 'a';`, and cutting the whole declaration
 * out of the search would take the one production site with it.
 */
export function unionsIn(source, file) {
  const tree = treeFor(source, file);
  const found = [];

  const collect = (name, typeNode) => {
    if (!name || !typeNode) return;
    const members = literalsOf(typeNode);
    if (members.length > 1) {
      found.push({ name, members, file, at: [typeNode.getStart(tree), typeNode.getEnd()] });
    }
  };

  const visit = (node) => {
    if (ts.isTypeAliasDeclaration(node)) collect(node.name.text, node.type);
    else if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node))
      collect(nameOf(node.name), node.type);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(tree, visit);

  return found;
}

/** The workspace a file belongs to: `apps/bot/src/x.ts` -> `apps/bot`. */
function packageOf(file) {
  return file.split('/').slice(0, 2).join('/');
}

/**
 * Operators that PUT the value on their right somewhere.
 *
 * Written as `switch` arms rather than as a `const ASSIGNMENTS = new Set([...])`
 * on purpose, and the same goes for the two below. `lib/records.mjs` holds every
 * module-level uppercase collection in `scripts/` to a declaration, because such
 * a constant is nearly always a list of things somebody excused and an excuse
 * with nothing asking after it rots where nothing looks. These three are not
 * excuses — they are how one syntax kind is told from another — and the honest
 * way to say so is to not write them in the shape reserved for a record.
 * `lib/awaited.mjs` classifies `ts.SyntaxKind` the same way.
 */
function assigns(operator) {
  switch (operator) {
    case ts.SyntaxKind.EqualsToken:
    case ts.SyntaxKind.QuestionQuestionEqualsToken:
    case ts.SyntaxKind.BarBarEqualsToken:
    case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
      return true;
    default:
      return false;
  }
}

/** Operators that CHOOSE one of their sides, so the side they take is made. */
function chooses(operator) {
  switch (operator) {
    case ts.SyntaxKind.QuestionQuestionToken:
    case ts.SyntaxKind.BarBarToken:
    case ts.SyntaxKind.AmpersandAmpersandToken:
      return true;
    default:
      return false;
  }
}

/**
 * Members that answer a question about a word rather than hand one over.
 *
 * Deliberately short. Every one of these takes the word as the thing being
 * asked about — `kinds.includes('x')` is a question about `kinds`, not a use of
 * `'x'` — and every one of them is somebody's way of writing the comparison
 * this check refuses to accept. Anything not listed is read as an ordinary
 * argument, which is the direction to err in: a false SAID hides a defect in
 * one union, a false UNSAID names an innocent, and the second is the one that
 * gets a check deleted rather than obeyed.
 */
function asksAbout(method) {
  switch (method) {
    case 'includes':
    case 'has':
    case 'startsWith':
    case 'endsWith':
    case 'indexOf':
    case 'lastIndexOf':
      return true;
    default:
      return false;
  }
}

/**
 * Is this literal at a site that MAKES the value, rather than one that receives
 * it?
 *
 * A whitelist, not a blacklist, and that is the point: an unrecognised shape
 * counts as not-said. The rule this file states — produced, not handled — can
 * only be enforced by naming the places a value is produced, because the places
 * a value is merely mentioned are open-ended, and every one that was forgotten
 * would read as a word being said.
 *
 * A literal in a type is handled by omission rather than by a rule: its parent
 * is a `LiteralTypeNode`, which appears nowhere below.
 */
function isProduced(node) {
  let child = node;
  let parent = node.parent;

  // `('x')`, `'x' as Kind`, `'x' satisfies Kind`, `'x'!` — wrappers that do not
  // change what was made.
  while (
    parent &&
    ((ts.isParenthesizedExpression(parent) && parent.expression === child) ||
      (ts.isAsExpression(parent) && parent.expression === child) ||
      (ts.isSatisfiesExpression(parent) && parent.expression === child) ||
      (ts.isNonNullExpression(parent) && parent.expression === child))
  ) {
    child = parent;
    parent = parent.parent;
  }

  if (!parent) return false;

  if (ts.isReturnStatement(parent)) return true;
  if (ts.isArrowFunction(parent) && parent.body === child) return true;
  if (ts.isVariableDeclaration(parent) && parent.initializer === child) return true;
  if (ts.isPropertyAssignment(parent) && parent.initializer === child) return true;
  if (ts.isPropertyDeclaration(parent) && parent.initializer === child) return true;
  if (ts.isParameter(parent) && parent.initializer === child) return true;
  if (ts.isEnumMember(parent) && parent.initializer === child) return true;
  if (ts.isArrayLiteralExpression(parent)) return true;
  if (ts.isSpreadElement(parent)) return true;
  if (ts.isYieldExpression(parent) && parent.expression === child) return true;
  if (ts.isAwaitExpression(parent) && parent.expression === child) return true;
  if (ts.isExportAssignment(parent) && parent.expression === child) return true;
  if (ts.isJsxExpression(parent)) return true;
  if (ts.isJsxAttribute(parent) && parent.initializer === child) return true;
  if (ts.isConditionalExpression(parent))
    return parent.whenTrue === child || parent.whenFalse === child;

  if (ts.isBinaryExpression(parent)) {
    const operator = parent.operatorToken.kind;
    if (assigns(operator)) return parent.right === child;
    if (chooses(operator)) return true;
    // `===`, `!==`, `in`, and the rest: the word is what a question is about.
    return false;
  }

  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    if (!parent.arguments || !parent.arguments.includes(child)) return false;
    const callee = parent.expression;
    if (ts.isPropertyAccessExpression(callee) && asksAbout(callee.name.text)) return false;
    return true;
  }

  return false;
}

/** Every word this source MAKES, with where it makes it. */
function saidIn(source, file) {
  const tree = treeFor(source, file);
  const found = [];

  const visit = (node) => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isProduced(node)
    ) {
      found.push({ word: node.text, at: node.getStart(tree) });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(tree, visit);

  return found;
}

/**
 * Members of a union that nothing in its own package says out loud.
 *
 * The declaration itself is cut out first, or a union whose words were only
 * ever declared could prove itself. It is belt and braces now — a literal
 * inside a type is not a production site to begin with — and it is kept because
 * the cut costs nothing and the day somebody widens `isProduced` is the day it
 * matters again.
 *
 * **Its own package, and only that.** The first version of this looked
 * everywhere, and both attempts to make it fail passed: `'finished'` is said by
 * the bot's `{ say: 'finished' }`, and `'path'` by a command, a message key and
 * a filename. A word common enough to appear somewhere is a word this check can
 * never see missing — which is exactly the blind spot `audit-unread` had, where
 * one live caller of a name covered a dead export of the same name next door.
 *
 * A union's producer is in the package that declares it: the engine makes the
 * directions, the mini app makes its own reader kinds. A consumer elsewhere
 * proves nothing about whether anybody makes them.
 *
 * **DO NOT widen this to fix a report you do not like.** Classifying the hits
 * makes `Arrival` in `packages/ai` come back with `received` unsaid, which is
 * true: the word arrives from `apps/bot/src/bot.ts:966`, where the roll handler
 * builds it. Reaching across packages to find that producer would take the
 * founding defect with it — `apps/bot` says `{ say: 'finished' }`, a production
 * site for the very word `TurnBlockedReason` declared and the engine never
 * made, so a repository-wide search would have gone green on the defect this
 * whole audit exists for. A vocabulary that another package produces is
 * `RECEIVED`, named one entry at a time with a reason. That is the wider door,
 * and it is the one to use.
 */
export function unsaidIn(union, sources) {
  const own = packageOf(union.file);

  const spoken = new Set();
  for (const { file, code } of sources) {
    if (packageOf(file) !== own) continue;
    for (const { word, at } of saidIn(code, file)) {
      if (file === union.file && at >= union.at[0] && at < union.at[1]) continue;
      spoken.add(word);
    }
  }

  return union.members.filter((member) => !spoken.has(member));
}
