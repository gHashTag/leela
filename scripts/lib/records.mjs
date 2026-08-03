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

/**
 * `const NAME = [` or `const NAME = {`, exported or not.
 *
 * The first version of this read `export const NAME = [` in `scripts/lib` only,
 * and it found eight lists where there are thirty-one. It missed the two largest
 * excuse lists in the repository — `WRITE_ONLY` and `PUBLIC_API` in
 * `audit-unread.mjs` — on both counts at once: they are objects rather than
 * arrays, because each entry carries its reason, and they are not exported,
 * because the audit that owns them is the only reader.
 *
 * It also missed `RECORDED` in `audit-book.mjs` and `audit-offers.mjs`, which
 * turned out to carry the very defect this rule exists for. A rule that looks in
 * the tidy place finds the tidy lists.
 */
const LIST = /^(?:export )?const ([A-Z][A-Z0-9_]*)\s*=\s*[[{]/gm;

/**
 * The list-shaped constants in one module.
 *
 * Only uppercase names, and only arrays and objects. A non-collection constant
 * (`LONG_ENOUGH = 200`, `BLIND_TO = 'latin'`) is a threshold rather than a set
 * of things excused. Written as a source scan rather than by importing, because
 * importing runs the module — several of these read the donor clones at load,
 * and two of them are not exported at all.
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
 *
 * A `permission` is the third kind, and the distinction was measured rather than
 * assumed. `WRITE_ONLY` asserts something true **now** — this field is written
 * and never read — so an entry suppressing nothing means the fact has changed,
 * and twenty-four of its thirty-four had. `PUBLIC_API` asserts an **intent** —
 * this export is a package surface whether or not anything here calls it — so an
 * entry suppressing nothing means only that somebody is calling it today, which
 * is not a reason to withdraw the permission. Sixty-nine of its seventy suppress
 * nothing and every one is still correct.
 *
 * A permission rots the other way: by naming something that no longer exists.
 */
export const DECLARED = [
  {
    module: 'audit-arithmetic.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-arithmetic.mjs',
    asks: 'staleFalse',
    because: 'false sums already known, kept for the next one that turns out wrong',
  },
  {
    module: 'audit-book.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-book.mjs',
    asks: 'healed',
    because: 'books missing a chapter both editions agree on',
  },
  {
    module: 'audit-configs.mjs',
    name: 'WORKSPACES',
    kind: 'vocabulary',
    because: 'the two directories a workspace can live in, not a set of excused things',
  },
  {
    module: 'audit-copies.mjs',
    name: 'EXTENSIONS',
    kind: 'vocabulary',
    because: 'the file extensions a copy of the board can be written in',
  },
  {
    module: 'audit-copies.mjs',
    name: 'RULE_LABELS',
    kind: 'vocabulary',
    because: 'the printed names of the rules, so a table reads the same every run',
  },
  {
    module: 'audit-deployment.mjs',
    name: 'CHAINS',
    kind: 'vocabulary',
    because: 'the chains the contract is deployed to, with their public endpoints',
  },
  {
    module: 'audit-mutants.mjs',
    name: 'DECISIONS',
    kind: 'vocabulary',
    because: 'the decisions this tool breaks on purpose, and the suites that own them',
  },
  {
    module: 'audit-offers.mjs',
    name: 'OFFERS',
    kind: 'vocabulary',
    because: 'the things the game offers, which is what the surfaces are compared on',
  },
  {
    module: 'audit-offers.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-offers.mjs',
    asks: 'mended',
    because: 'things one surface offers and another does not',
  },
  {
    module: 'audit-offers.mjs',
    name: 'SURFACES',
    kind: 'vocabulary',
    because: 'the three surfaces the game is played on',
  },
  {
    module: 'audit-scripts.mjs',
    name: 'DOCS',
    kind: 'vocabulary',
    because: 'the documents that name a command, held to the runtime each script declares',
  },
  {
    module: 'audit-unread.mjs',
    name: 'PUBLIC_API',
    kind: 'permission',
    because: 'exports meant to be a package surface whether or not this repository calls them',
  },
  {
    module: 'audit-unread.mjs',
    name: 'PUBLIC_MEMBERS',
    kind: 'permission',
    because: 'class members meant to be a surface whether or not this repository calls them',
  },
  {
    module: 'audit-unread.mjs',
    name: 'SEARCH',
    kind: 'vocabulary',
    because: 'where to look, derived from the workspaces rather than written by hand',
  },
  {
    module: 'audit-unread.mjs',
    name: 'WRITE_ONLY',
    kind: 'record',
    askedIn: 'scripts/audit-unread.mjs',
    asks: 'staleExcuses',
    because: 'fields written and never read, each excused on purpose with a reason',
  },
  {
    module: 'audit-variants.mjs',
    name: 'CLAIMS',
    kind: 'vocabulary',
    because: 'the claims each ruleset flag makes, with the evidence in the published app',
  },
  {
    module: 'audit-variants.mjs',
    name: 'ONLINE_ONLY',
    kind: 'vocabulary',
    because: 'the flags only the online ruleset sets, so a shared claim is not read twice',
  },
  {
    module: 'board-overlay.mjs',
    name: 'ART',
    kind: 'vocabulary',
    because: 'the drawing, which excuses nothing',
  },
  {
    module: 'board-overlay.mjs',
    name: 'GRID',
    kind: 'vocabulary',
    because: 'the geometry of the board as it is drawn',
  },
  {
    module: 'build-content.mjs',
    name: 'EDITIONS',
    kind: 'vocabulary',
    because: 'the donor editions the generator reads, named so a missing one is loud',
  },
  {
    module: 'lib/arithmetic.mjs',
    name: 'OPERATORLESS_RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-arithmetic.mjs',
    asks: 'staleRecords',
    because: 'sums a translation dropped the multiplication sign out of',
  },
  {
    module: 'lib/copies.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-copies.mjs',
    asks: 'rotted',
    because: 'copies of the board in the donors that disagree with the engine',
  },
  {
    module: 'lib/corrections.mjs',
    name: 'CORRECTIONS',
    kind: 'record',
    askedIn: 'scripts/build-content.mjs',
    asks: 'unappliedIn',
    because: 'hand repairs to donor text, which stop matching when a donor is fixed',
  },
  {
    module: 'lib/numbers.mjs',
    name: 'DIGIT_BASES',
    kind: 'vocabulary',
    because: 'the non-ASCII digit ranges a translation can write a number in',
  },
  {
    module: 'lib/numbers.mjs',
    name: 'LOSSES_RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-numbers.mjs',
    asks: 'staleRecords',
    because: 'board references a machine translation lost',
  },
  {
    module: 'lib/numbers.mjs',
    name: 'WRITTEN_OUT',
    kind: 'vocabulary',
    because: 'numbers spelled as words, so a reference in words is not read as lost',
  },
  {
    module: 'lib/records.mjs',
    name: 'KINDS',
    kind: 'vocabulary',
    because: 'the three kinds a list can be declared as, which excuse nothing themselves',
  },
  {
    module: 'lib/records.mjs',
    name: 'DECLARED',
    kind: 'record',
    askedIn: 'scripts/audit-records.mjs',
    asks: 'staleDeclarations',
    because: 'this list itself, which excuses every other from being reported as undeclared',
  },
  {
    module: 'lib/spillover.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/build-content.mjs',
    asks: 'missedSpillovers',
    because: 'plans in the donor carrying the opening of the next one',
  },
  {
    module: 'lib/untranslated.mjs',
    name: 'FUNCTION_WORDS',
    kind: 'vocabulary',
    because: 'the words a language cannot do without, which is how its script is read',
  },
  {
    module: 'lib/untranslated.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-dataset.mjs',
    asks: 'rotted',
    because: 'parts of a plan left in the language they were translated from',
  },
  {
    module: 'lib/whose.mjs',
    name: 'TURN_HOLDER',
    kind: 'vocabulary',
    because: 'the field names that make a function a reader of somebody state',
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

/** The three kinds, so a fourth spelled by hand is a failure rather than a pass. */
export const KINDS = ['record', 'permission', 'vocabulary'];

/** A kind nobody defined lets a list through by spelling. */
export function unknownKinds(declared) {
  return declared
    .filter((one) => !KINDS.includes(one.kind))
    .map((one) => `${keyOf(one.module, one.name)} — ${one.kind}`);
}

/**
 * Whichever of `recorded` is not in `found`.
 *
 * The primitive under `staleRecords` in two modules and `staleDeclarations`
 * here. Written once rather than a fourth time, because the third copy was
 * written the day before this and the lesson of the whole file is that a rule
 * restated is a rule that will disagree with itself.
 */
export function staleAmong(recorded, found) {
  const seen = new Set(found);
  return recorded.filter((line) => !seen.has(line));
}
