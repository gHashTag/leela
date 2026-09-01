/**
 * Which functions read the seat holding the turn, and whether they meant to.
 *
 * The mini app keeps three module-level values for the seat whose turn it is:
 * `state`, `journal`, `intention`. They are right for the board, the die and
 * the line underneath — that surface *is* the turn holder's.
 *
 * They are wrong everywhere the app talks about somebody else, and it does so
 * more often than it looks. Three passes running, that produced a defect:
 *
 * - Share and Ask sent the turn holder's square with the writer's words and a
 *   third seat's question — three values, three seats, one function.
 * - A chip in Player 2's section opened Player 1's private accounts.
 * - "Save a copy" wrote a file of whoever held the turn, in a view showing
 *   every seat, for a player to carry away as their own.
 *
 * Each was harmless the day before by accident, and an accident is not a rule.
 * So the rule is written down: **a function that reads the turn holder's values
 * has said that it means to.** Anything else has a seat of its own and must ask
 * for it.
 */

import { blank } from './source.mjs';

/** The values that belong to whoever holds the turn. */
export const TURN_HOLDER = ['state', 'journal', 'intention'];

/**
 * The characters after which a `{` opens a *type* and not a body.
 *
 * `: { plan: number }` — the brace follows the colon. `A | { b: 1 }`, `Record<
 * string, { a: 1 }>`, `(x) => { y: 1 }` — the brace follows a union bar, a
 * comma, a bracket, or the `=` of an arrow. A brace following anything else,
 * at depth zero, is the one the function is written in.
 */
const TYPE_CONTINUES = /^(=>|[:|&,<([])$/;

/**
 * The last token before `at` that is not whitespace.
 *
 * `=>` is returned whole, and that is not a detail. The grid over signature
 * shapes in `whose-values.test.ts` was written against a version of this that
 * returned single characters, and it went red on
 * `function f(a): (x: number) => { plan: number } {` — the brace after the
 * arrow is a return type and the character before it is `>`, which reads
 * exactly like the `>` that closes a generic and ends one. The grid was written
 * to catch the shape nobody had thought of, and the first thing it caught was
 * the shape the person writing it had not thought of.
 */
function previousToken(source, at) {
  let index = at - 1;
  while (index >= 0 && /\s/.test(source[index])) index -= 1;
  if (index < 0) return '';

  if (source[index] === '>' && source[index - 1] === '=') return '=>';
  return source[index];
}

/**
 * Where a function's body opens, given where its parameter list opens.
 *
 * This was `source.indexOf('{', from)` — the first brace after `function NAME(`
 * — and for three shapes of signature that brace is not the body:
 *
 *   - `function whatIsBeingWritten(): { plan: number; intention: string } {`
 *     handed back the *return type* as the body. The audit then read six lines
 *     of type instead of the six lines underneath, found nothing, and said
 *     every reader was named. The function it could not see reads two of the
 *     turn holder's values and feeds both surfaces this audit was written
 *     about;
 *   - `function paint({ board, die }: Parts) {` would have handed back the
 *     destructured parameter;
 *   - `function exportPath(seatId = currentPlayer(session).id): void {` was
 *     read correctly only by luck — nothing in that parameter list is a brace.
 *
 * So the parameter `(` is matched to its `)` with balanced brackets, and a
 * return annotation after it is walked over the same way, `<>` and `=>` and
 * object types included. The alternative — reading to the first `{` and hoping
 * — is the mistake `source.mjs` was written to stop, one bracket over.
 */
function bodyOpensAt(source, parameterOpens) {
  let depth = 0;
  let at = parameterOpens;

  for (; at < source.length; at += 1) {
    if (source[at] === '(') depth += 1;
    else if (source[at] === ')') {
      depth -= 1;
      if (depth === 0) break;
    }
  }

  if (at >= source.length) return -1;
  at += 1;

  while (at < source.length && /\s/.test(source[at])) at += 1;
  if (source[at] !== ':') return source.indexOf('{', at);

  at += 1;
  depth = 0;

  for (; at < source.length; at += 1) {
    const character = source[at];

    if (character === '{' && depth === 0 && !TYPE_CONTINUES.test(previousToken(source, at))) {
      return at;
    }

    if (character === '{' || character === '(' || character === '[' || character === '<') {
      depth += 1;
    } else if (character === '}' || character === ')' || character === ']') {
      depth -= 1;
    } else if (character === '>' && source[at - 1] !== '=' && depth > 0) {
      // `=>` is not a closing angle bracket. Everything else that reaches here
      // closes the `<` of a generic.
      depth -= 1;
    }
  }

  return -1;
}

/** Top-level functions in a module, with their bodies. */
export function functionsIn(source) {
  const found = [];
  const pattern = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;

  for (const match of source.matchAll(pattern)) {
    const from = match.index ?? 0;
    const opens = bodyOpensAt(source, from + match[0].length - 1);
    if (opens < 0) continue;

    let depth = 0;
    let index = opens;
    for (; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    found.push({ name: match[1], body: source.slice(opens, index + 1) });
  }

  return found;
}

/**
 * The same code with object-literal keys blanked, character for character.
 *
 * `{ journal: theirs }` writes a field called `journal`; it does not read the
 * module's. That has to be told apart from a read, and the way it was told
 * apart was a lookahead on the name — `journal` but not `journal\s*:`.
 *
 * A ternary's else-colon answers that lookahead. `x ? journal : y` is a *read*
 * followed by a colon, and for as long as the lookahead stood it was invisible:
 * the file's own founding defect, `const theirs = something ? journal :
 * loadJournalFor(storage, seatId)`, came back from the reader as `[]`, while
 * the identical read written as `if (b) { const t = journal; }` came back as
 * `['journal']`. The consequence was not academic. Every guarded read in the
 * app is written as that ternary, so `unguardedReaders` — added precisely
 * because *a reason is prose and prose is not a claim anything checks* — had
 * never fired once and could not.
 *
 * A colon is therefore not evidence of anything. Key *position* is: an
 * identifier followed by `:` whose previous non-space character opens or
 * continues an object literal. Blanked rather than removed, for the reason
 * `blank` gives — an index into the result is an index into the body.
 */
function blankKeys(code) {
  return code.replace(/([{,])(\s*)([A-Za-z_$][\w$]*)(\s*:)/g, (whole, before, gap, name, after) =>
    before + gap + ' '.repeat(name.length) + after,
  );
}

/**
 * Whether a body reads one of the turn holder's values as a bare name.
 *
 * Comments are stripped first: half of this repository's lines are prose about
 * what went wrong, and `journal` appears in a great many of them.
 */
export function readsTurnHolder(body) {
  // Through the shared blanker rather than a stripper written here: this file
  // had its own, and it *removed* comments where `blank` blanks them, so an
  // index into the result was not an index into the file.
  const code = blankKeys(blank(body));

  return TURN_HOLDER.filter((name) => {
    // `journal` but not `theirs.journal` and not `loadJournalFor` — a bare read
    // of the module's own variable. Nothing here says anything about a colon:
    // the keys that a colon used to stand for are already blank above, and a
    // colon that is left is a ternary's, which is a read.
    const bare = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`);
    return bare.test(code);
  });
}

/** Functions that read them and are not on the list of those that may. */
export function unnamedReaders(source, allowed) {
  return functionsIn(source)
    .map((fn) => ({ ...fn, reads: readsTurnHolder(fn.body) }))
    .filter((fn) => fn.reads.length > 0 && !allowed.has(fn.name));
}

/**
 * The seat a function was handed, if it was handed one.
 *
 * `exportPath(seatId = …)`, `openPlan(plan, seatId = …)`, `cameBack(returns,
 * seatId)`. A function with one of these has a subject that is not the turn
 * holder, whatever it may also read.
 */
const GIVEN_A_SEAT = /\b(seatId|playerId|writer|owing)\b/;

/**
 * The guard that makes reading the turn holder's values correct.
 *
 * `seatId === currentPlayer(session).id ? journal : loadJournalFor(…, seatId)`
 * — the fast path for the seat already in hand. Everything inside it is right
 * by construction; everything outside it is the defect this file exists about.
 *
 * Scanned with balanced brackets rather than matched to the first `;`, for the
 * reason `callsTo` gives next door: a call closing a bracket inside its own
 * arguments ends a pattern early, and the check then reads a shorter statement
 * than the one written.
 */
function withoutTheGuard(code) {
  const opener = /[\w.]+\s*===\s*currentPlayer\(session\)\.id\s*\?/g;
  let out = '';
  let at = 0;

  for (const found of code.matchAll(opener)) {
    const from = found.index ?? 0;
    let index = from;
    let depth = 0;

    for (; index < code.length; index += 1) {
      const character = code[index];
      if (character === '(' || character === '[' || character === '{') depth += 1;
      else if (character === ')' || character === ']' || character === '}') depth -= 1;
      else if (character === ';' && depth === 0) break;
    }

    out += code.slice(at, from);
    at = index;
  }

  return out + code.slice(at);
}

/**
 * The parameter list a function was declared with, brackets balanced.
 *
 * Both halves of this were wrong, and both were invisible for the same reason:
 * the second question below had never fired, so nothing it read was ever
 * checked against the file.
 *
 *   - the declaration was found with `source.indexOf('function ' + name)`, and
 *     `indexOf('function openPlan')` lands on line 603, `function openPlans()`.
 *     `openPlan` is the one function in the app that is handed a seat *and*
 *     reads the turn holder's journal, and the second question read the empty
 *     parameter list of a different function and skipped it whole. A prefix is
 *     not a name;
 *   - the list was then read with `[^)]*`, which is the trap `source.mjs` was
 *     written about: `(seatId = currentPlayer(session).id)` stops at the `)` of
 *     `currentPlayer(session`. It happened to still contain `seatId`, so it
 *     happened to work. A pattern that is right by luck is one to replace
 *     before the luck runs out.
 */
function parametersOf(source, name) {
  const declared = new RegExp(`(?:^|[^\\w$])function\\s+${name}\\s*\\(`);
  const found = declared.exec(source);
  if (!found) return '';

  const opens = (found.index ?? 0) + found[0].length - 1;
  let depth = 0;
  let at = opens;

  for (; at < source.length; at += 1) {
    if (source[at] === '(') depth += 1;
    else if (source[at] === ')') {
      depth -= 1;
      if (depth === 0) break;
    }
  }

  return source.slice(opens + 1, at);
}

/**
 * Functions given a seat that read the turn holder's values anyway.
 *
 * The second question, and the one `unnamedReaders` cannot ask. That one asks
 * whether a function **said** it means to read them; a sentence is not a claim
 * anything checks. `exportPath` carried *"reads it only for the seat it was
 * asked about"* while copying the turn holder's whole path to the clipboard —
 * the audit read the waiver and passed, on the day the defect was there.
 *
 * So: a function handed a seat may read those values only inside the guard that
 * says the seat *is* the turn holder. Anywhere else it is talking about one
 * player and reading another's.
 *
 * It is empty over `main.ts` today, and this is the first pass in which that
 * sentence means anything. Every guarded read in the app is written as a
 * ternary, and until `readsTurnHolder` stopped taking a ternary's else-colon
 * for an object key this question could not see one — so it stripped the guard
 * out of text whose reads the reader was already blind to, and returned `[]`
 * whatever the file said. Neutering `withoutTheGuard` now names `exportPath`
 * and `openPlan`; before, it named nobody. The empty result is a measurement
 * for the first time rather than a reader with its eyes shut.
 */
export function unguardedReaders(source) {
  const found = [];

  for (const fn of functionsIn(source)) {
    const parameters = parametersOf(source, fn.name);
    if (!GIVEN_A_SEAT.test(parameters)) continue;

    const reads = readsTurnHolder(withoutTheGuard(blank(fn.body)));
    if (reads.length > 0) found.push({ name: fn.name, reads });
  }

  return found;
}
