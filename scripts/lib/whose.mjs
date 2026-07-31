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
  const code = body
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

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
