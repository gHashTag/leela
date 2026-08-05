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

/** Top-level functions in a module, with their bodies. */
export function functionsIn(source) {
  const found = [];
  const pattern = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;

  for (const match of source.matchAll(pattern)) {
    const from = match.index ?? 0;
    const opens = source.indexOf('{', from);
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
 * Whether a body reads one of the turn holder's values as a bare name.
 *
 * Comments are stripped first: half of this repository's lines are prose about
 * what went wrong, and `journal` appears in a great many of them.
 */
export function readsTurnHolder(body) {
  // Through the shared blanker rather than a stripper written here: this file
  // had its own, and it *removed* comments where `blank` blanks them, so an
  // index into the result was not an index into the file.
  const code = blank(body);

  return TURN_HOLDER.filter((name) => {
    // `journal` but not `journal:` (a property), `theirs.journal`, or
    // `loadJournalFor` — a bare read of the module's own variable.
    const bare = new RegExp(`(?<![\\w$.])${name}(?![\\w$]|\\s*:)`);
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
 */
export function unguardedReaders(source) {
  const found = [];

  for (const fn of functionsIn(source)) {
    const parameters = /\(([^)]*)\)/.exec(source.slice(source.indexOf(`function ${fn.name}`)))?.[1] ?? '';
    if (!GIVEN_A_SEAT.test(parameters)) continue;

    const reads = readsTurnHolder(withoutTheGuard(blank(fn.body)));
    if (reads.length > 0) found.push({ name: fn.name, reads });
  }

  return found;
}
