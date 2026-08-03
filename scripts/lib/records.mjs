/**
 * Every recorded exception is asked whether it still describes anything.
 *
 * The fourth shape closed this way, after the 68 ambiguity, the drawings and
 * `whose`. It exists because the lesson was learned three times and carried
 * once: `lib/arithmetic.mjs` was taught to fail on a record matching nothing,
 * and `lib/numbers.mjs` — its sibling, reading the same translations for the
 * same kind of damage — printed *take these out of RECORDED* and exited zero for
 * a hundred and ninety-nine passes.
 *
 * A list of known-bad things is an excuse, and an excuse outliving its reason is
 * a licence issued for something else: the next defect that reads the same way
 * passes on it. So a list is either declared as an excuse, and then something
 * must ask whether each entry still matches, or declared as vocabulary with a
 * reason — the same arrangement `audit-scripts` uses for a runtime and
 * `audit-whose` for a reader of somebody's state.
 *
 * This module's own `DECLARED` is a list of the same kind, so it is held to both
 * halves of its own rule: an undeclared list fails, and a declaration naming a
 * list that no longer exists fails too.
 */

/** `export const NAME = [` — the shape every recorded exception is written in. */
const LIST = /^export const ([A-Z][A-Z0-9_]*)\s*=\s*\[/gm;

/**
 * The exported array literals in one module.
 *
 * Only uppercase names, and only arrays. A lowercase export is a function or a
 * value, and a non-array constant (`LONG_ENOUGH = 200`, `BLIND_TO = 'latin'`) is
 * a threshold rather than a set of things excused. Written as a source scan
 * rather than by importing, because importing runs the module — several of these
 * read the donor clones at load.
 */
export function exportedLists(source) {
  const found = [];
  for (const match of source.matchAll(LIST)) found.push(match[1]);
  return found.sort();
}

/**
 * What each list is, and what asks whether its entries still describe anything.
 *
 * `asks` is the symbol or phrase that must be present in `askedIn` — a name
 * rather than a line number, since a line number goes stale on the next edit and
 * says nothing when it does.
 *
 * A `vocabulary` entry is not an excuse: nothing is being let through, so there
 * is nothing to go stale. It still has to be declared, or the rule would be
 * closed by calling every list vocabulary.
 */
export const DECLARED = [
  {
    module: 'arithmetic.mjs',
    name: 'OPERATORLESS_RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-arithmetic.mjs',
    asks: 'staleRecords',
    because: 'sums a translation dropped the multiplication sign out of',
  },
  {
    module: 'copies.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-copies.mjs',
    asks: 'rotted',
    because: 'copies of the board in the donors that disagree with the engine',
  },
  {
    module: 'corrections.mjs',
    name: 'CORRECTIONS',
    kind: 'record',
    askedIn: 'scripts/build-content.mjs',
    asks: 'unappliedIn',
    because: 'hand repairs to donor text, which stop matching when a donor is fixed',
  },
  {
    module: 'numbers.mjs',
    name: 'LOSSES_RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-numbers.mjs',
    asks: 'staleRecords',
    because: 'board references a machine translation lost',
  },
  {
    module: 'spillover.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/build-content.mjs',
    asks: 'missedSpillovers',
    because: 'plans in the donor carrying the opening of the next one',
  },
  {
    module: 'untranslated.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-dataset.mjs',
    asks: 'rotted',
    because: 'parts of a plan left in the language they were translated from',
  },
  {
    module: 'whose.mjs',
    name: 'TURN_HOLDER',
    kind: 'vocabulary',
    because: 'the field names that make a function a reader of somebody state, not a set of excused things',
  },
  {
    module: 'records.mjs',
    name: 'DECLARED',
    kind: 'record',
    askedIn: 'scripts/audit-records.mjs',
    asks: 'staleDeclarations',
    because: 'this list itself, which excuses every other from being reported as undeclared',
  },
];

/** A list as one line, which is how a declaration is matched to it. */
export const keyOf = (module, name) => `${module}:${name}`;

/**
 * Lists nobody has declared.
 *
 * This is the half that fails on a list written tomorrow. Without it the rule
 * is a paragraph in a file, and a paragraph does not stop the next person
 * writing an excuse nothing asks about.
 */
export function undeclared(found, declared) {
  const known = new Set(declared.map((one) => keyOf(one.module, one.name)));
  return found.filter((line) => !known.has(line));
}

/**
 * Declarations describing a list that is no longer there.
 *
 * The rule turned on itself. A declaration is a record too — it excuses a list
 * from being reported as undeclared — so it goes stale exactly the way the
 * lists it governs do, and for exactly the same reason it must be caught.
 *
 * Deliberately separate from `undeclared`, and not `found equals declared`: an
 * undeclared list is work for whoever wrote it and a stale declaration is work
 * for whoever keeps this file, and one comparison answering both sends somebody
 * to the wrong one.
 */
export function staleDeclarations(declared, found) {
  const seen = new Set(found);
  return declared
    .map((one) => keyOf(one.module, one.name))
    .filter((line) => !seen.has(line));
}

/**
 * Import statements, which mention a name without using it.
 *
 * The first version of `unasked` searched the whole file, and the experiment
 * that was supposed to prove it caught nothing: replacing the call to
 * `staleRecords` with the filter written out by hand left the name in the
 * import list, and the check read that as asking. An asker that imports a
 * question and never puts it is exactly the rot this is for.
 */
const withoutImports = (source) => source.replace(/^import[\s\S]*?from\s+'[^']*';$/gm, '');

/**
 * Records whose stated asker no longer asks.
 *
 * The third way this can rot, and the quietest: the list is there, the
 * declaration is there, and the question was deleted from the audit. Nothing
 * else would notice — the audit still runs, still passes, and no longer looks.
 *
 * Matched outside the imports for the reason above, and by name rather than as
 * a call, because two of the seven askers are variables holding the answer
 * (`rotted`, `missedSpillovers`) rather than functions.
 */
export function unasked(declared, sourceOf) {
  return declared
    .filter((one) => one.kind === 'record')
    .filter((one) => !withoutImports(sourceOf(one.askedIn) ?? '').includes(one.asks))
    .map((one) => `${keyOf(one.module, one.name)} — ${one.askedIn} no longer asks ${one.asks}`);
}

/** A declaration that says nothing about why is not a declaration. */
export function unexplained(declared) {
  return declared
    .filter((one) => !one.because || one.because.trim().length < 20)
    .map((one) => keyOf(one.module, one.name));
}
