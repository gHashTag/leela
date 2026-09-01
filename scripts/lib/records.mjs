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

import { codeIn } from './reachable.mjs';

/**
 * `const NAME = [`, `= {`, `= new Set([` or `= new Map([`, exported or not.
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
 *
 * Widened a third time, and the third widening is the one that should have been
 * predictable from the first two. Having learned that a list can be an object
 * and that a list can be unexported, the rule still read only the two literal
 * forms — so every list written the way a membership test is naturally written,
 * `new Set([...])`, was invisible. Twelve constants in `scripts/`, and seven of
 * them excuse things: the whole of `audit-drawings`, `audit-reachable` and
 * `audit-whose`'s waivers, both of `audit-promises`', and both of
 * `audit-doubles`'. `audit-records` had been printing *every list is declared*
 * over five audits whose excuse lists it had never once read.
 *
 * One of the seven was already dead when the rule first saw it: `PER_MODULE`
 * excused two names that each turned out to be declared exactly once, so it
 * suppressed nothing — an excuse outliving its reason, sitting for however long
 * in the one place nothing looked. That is this module's own first paragraph,
 * and it was true of this module's own blind spot.
 *
 * Anchored to the start of a line and to an opening bracket, so `new Set(
 * ALLOWED.keys())` — a set built from another list rather than written out — is
 * not counted twice as a list of its own.
 *
 * Widened a fourth time, and the axis is not the shape of the list this time but
 * the PLACE it is written. The first three widenings each asked *what else can a
 * list look like*; none of them asked *where else can a list be*. `scripts/` and
 * `scripts/lib/` were the whole world, because for as long as this rule has
 * existed they were the whole of the tooling — and the rule was therefore true by
 * accident rather than by construction.
 *
 * It was crossed by the first two configuration files ever written at the
 * repository root. `knip.config.mjs` and `eslint.config.mjs` arrived on
 * 2026-08-06, both of them carrying exactly what this rule polices:
 * `ignoreDependencies` naming three packages knip must not report, and a list of
 * the globs ESLint is pointed at. Records in the exact sense, outside the reach of
 * the check on the day they were written — and the *fourth* time an excuse list
 * has sat in the one place nothing looked.
 *
 * MEASURED, and it is why the widening is two halves rather than one. Reading the
 * root directory alone catches neither of them: this regex is anchored to `const
 * NAME =` at the start of a line, and both lists were written inline inside a
 * default-exported object literal, where they have no name for a record to cite.
 * Loosening the regex to match an object property would name every `files:`,
 * `rules:` and `plugins:` in every config in the tree, which is the check that
 * cries wolf on correct code and gets deleted rather than obeyed. So the lists are
 * hoisted to top-level named constants instead — `IGNORED_DEPENDENCIES` and
 * `LINTED_SOURCES` — and the rule stays exactly as tight as it was.
 */
const LIST = /^(?:export )?const ([A-Z][A-Z0-9_]*)\s*=\s*(?:new (?:Set|Map)\()?[[{]/gm;

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
 *
 * That sentence sat here for the length of this file's existence and nothing
 * implemented it. `unasked` opens with `.filter((one) => one.kind === 'record')`,
 * so a permission is excluded on the first line; `staleDeclarations` asks whether
 * the LIST is still there and never whether its ENTRIES are; `undeclared`,
 * `unexplained` and `unknownKinds` are all about the declaration rather than its
 * contents. Seven standing permissions, and `audit-records` closed over them with
 * *every asker still asks* — literally true and materially misleading, which is
 * the exact defect this module was written to close, inside this module.
 *
 * So a permission carries `namesIn`: where its entries must still be found.
 * `stalePermissions` reads the list out of the module that writes it and asks of
 * each entry whether that place still names it. A missing `namesIn` field is
 * itself a failure, so the next permission added cannot skip the question — and
 * `namesIn: null` is allowed only with a sentence saying why no single place can
 * be named, because an undeclarable absence is declared rather than silent.
 *
 * `namesIn` takes a list of places and not one place, and that was measured
 * rather than chosen. Two of the four permissions that can name a place name two:
 * `RECEIVED`'s words are unions in `apps/bot/src/delivery.ts` and
 * `packages/ai/src/prompts.ts`, and `PUBLIC_MEMBERS` is one member of the bot's
 * delivery and one of its store. Written for a single path, this rule would have
 * reported half of both as rotted on the day it was added.
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
    module: 'audit-copies.mjs',
    name: 'SKIP',
    kind: 'vocabulary',
    because: 'the directories a walk of the donor clones does not enter, none of them source',
  },
  {
    module: 'audit-deployment.mjs',
    name: 'CHAINS',
    kind: 'vocabulary',
    because: 'the chains the contract is deployed to, with their public endpoints',
  },
  {
    module: 'audit-doubles.mjs',
    name: 'PER_MODULE',
    kind: 'record',
    askedIn: 'scripts/audit-doubles.mjs',
    asks: 'staleAmong',
    because: 'names that are one idea per module rather than one idea shared between them',
  },
  {
    module: 'audit-doubles.mjs',
    name: 'TIED',
    kind: 'record',
    askedIn: 'scripts/audit-doubles.mjs',
    asks: 'staleAmong',
    because: 'copies that cannot be removed, each naming the test that holds the two in step',
  },
  {
    module: 'audit-drawings.mjs',
    name: 'MECHANICAL',
    kind: 'permission',
    namesIn: 'apps/miniapp/src/main.ts',
    because: 'controls a single act holds for the length of itself, which decide nothing',
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
    module: 'audit-promises.mjs',
    name: 'DATA',
    kind: 'permission',
    namesIn: null,
    namelessBecause:
      'bare property names — id, model, title — matched against every injection point in ' +
      'every workspace at once. There is no file they belong to, and a search for one of ' +
      'them succeeds in almost any file, so a named place would prove nothing about them',
    because: 'members that carry a value rather than behaviour, which nothing can usefully break',
  },
  {
    module: 'audit-promises.mjs',
    name: 'NOT_OURS',
    kind: 'permission',
    namesIn: null,
    namelessBecause:
      'the entry is owner and property joined at the moment of comparison, so the string ' +
      'CellOptions.onActivate is written in no file at all — apps/miniapp/src/cell.ts holds ' +
      'the two halves a line apart, and looking for the whole would report a live waiver',
    because: 'points where a broken implementation is reported by somebody else, named here',
  },
  {
    module: 'audit-reachable.mjs',
    name: 'RECEIVED',
    kind: 'permission',
    namesIn: ['apps/bot/src/delivery.ts', 'packages/ai/src/prompts.ts'],
    because: 'vocabularies this repository accepts from an API rather than produces itself',
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
    namesIn: null,
    namelessBecause:
      'seventy exports spread over ten workspaces, one file apiece and a different file for ' +
      'each. The place that names an entry is whichever module declares it, which is what ' +
      'the audit already finds by walking every source; a path here would be a copy of that',
    because: 'exports meant to be a package surface whether or not this repository calls them',
  },
  {
    module: 'audit-unread.mjs',
    name: 'PUBLIC_MEMBERS',
    kind: 'permission',
    namesIn: ['apps/bot/src/delivery.ts', 'apps/bot/src/sqlite.ts'],
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
    module: 'audit-variants.mjs',
    name: 'TELEGRAM_CLAIMS',
    kind: 'vocabulary',
    because:
      'the telegram variant citations against leela-src/leela-chakra-bot, re-read on every run',
  },
  {
    module: 'audit-whose.mjs',
    name: 'ALLOWED',
    kind: 'permission',
    namesIn: 'apps/miniapp/src/main.ts',
    because: 'functions whose subject really is the seat holding the turn, each saying which way',
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
    module: 'build-content.mjs',
    name: 'RULE_SLUGS',
    kind: 'vocabulary',
    because: 'the chapters that are rules rather than plans, the same slugs in every source',
  },
  // The two configuration files at the repository root, which is the fourth
  // place this rule was widened to reach. Both are named without a `lib/` or
  // `audit-` prefix because `module` is the path from the root of the scan, and
  // for these two that root is the repository rather than `scripts/`.
  {
    module: 'eslint.config.mjs',
    name: 'LINTED_SOURCES',
    kind: 'vocabulary',
    // Declared as vocabulary because it excuses nothing by its contents: every
    // glob in it points ESLint AT something. What it can lose is a workspace,
    // by omission — a package added tomorrow whose sources match no line here
    // is unlinted and silent about it — and nothing in this repository asks
    // that question today. Stated rather than hidden behind a `record` naming
    // an asker that does not exist: closing it means a check that compares
    // these globs with `workspacePackages`, which is a new audit and therefore
    // a new CI step.
    because: 'the globs ESLint is pointed at, which name where to look and excuse nothing',
  },
  {
    module: 'knip.config.mjs',
    name: 'IGNORED_DEPENDENCIES',
    kind: 'permission',
    namesIn: 'apps/mobile/package.json',
    because: 'packages Detox resolves from the working directory, which no source of ours names',
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
    module: 'lib/awaited.mjs',
    name: 'ASYNC_MATCHERS',
    kind: 'vocabulary',
    because: 'the two members that turn an expectation into something that waits',
  },
  {
    module: 'lib/claims.mjs',
    name: 'NOT_SOURCE',
    kind: 'vocabulary',
    because: 'directories that are not a workspace own source, whatever they happen to hold',
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
    module: 'lib/coverage.mjs',
    name: 'TRACKED',
    kind: 'vocabulary',
    because: 'the dimensions of a language coverage a rebuild can lose, read rather than listed',
  },
  {
    module: 'lib/drawings.mjs',
    name: 'LITERALS',
    kind: 'vocabulary',
    because: 'values that look like the name of a decision and decide nothing at all',
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
    module: 'lib/prose.mjs',
    name: 'MARKUP',
    kind: 'vocabulary',
    because:
      'the shapes markup takes when it survives into prose — an entity, a tag, a heading, ' +
      'emphasis, a link, an image, a fence. It excuses nothing: each is a class rather than ' +
      'a spelling, because the defect that motivated it was `& Nbsp;` and a sweep for the ' +
      'canonical `&nbsp;` over 1,584 bodies found nothing at all',
  },
  {
    module: 'lib/quotes.mjs',
    name: 'UNSPOKEN_PLANS',
    kind: 'record',
    askedIn: 'scripts/audit-quotes.mjs',
    asks: 'unspokenIn',
    because:
      'the six plans of seventy-two that no daily quote speaks for, and which the push therefore ' +
      'never sends. It excuses a real gap — sixty-six quotes for seventy-two plans — recorded ' +
      'rather than repaired because writing one is a judgement and it is the owner\'s, the same ' +
      'bar the untranslated titles of #56 and #57 are held at. `audit-quotes.mjs` re-derives the ' +
      'list with `unspokenIn` on every run and compares it entry by entry, so a gap that was ' +
      'filled and a seventh that appeared cannot look the same in a count',
  },
  {
    module: 'lib/timing.mjs',
    name: 'DECLARED',
    kind: 'record',
    askedIn: 'scripts/audit-timing.mjs',
    asks: 'gone',
    because:
      'the tests still allowed to put a CEILING on elapsed wall-clock time, each with the margin ' +
      'it was measured against. It excuses something real — a ceiling is falsified by a busy ' +
      'machine and says nothing about the code, which is how three flakes in this repository were ' +
      'each repaired by raising a number. `audit-timing.mjs` re-derives every entry: `gone` fails ' +
      'an entry naming a file that no longer has one, and `miscounted` fails one whose count has ' +
      'moved, so an excuse cannot outlive the thing it excuses',
  },
  {
    module: 'lib/source.mjs',
    name: 'BEFORE_A_REGEX',
    kind: 'vocabulary',
    because:
      'the keywords after which a slash opens a pattern rather than dividing — `return /x/` and ' +
      '`typeof /x/` both end in a word character, which the ordinary heuristic reads as the end of ' +
      'a value. It excuses nothing: every one is asked on every slash the reader meets. It is a ' +
      'list because getting it wrong is not a wrong answer but a lost place — the reader takes the ' +
      'pattern body for code, meets a quote inside a character class, and stops blanking comments ' +
      'for the rest of the file. That is the failure `blankIsTrusted` exists to make askable',
  },
  {
    module: 'lib/serving.mjs',
    name: 'HALVES',
    kind: 'vocabulary',
    because:
      'the two questions asked of the live bot — the texts it serves and the code it runs. It ' +
      'excuses nothing: every half is compared on every run and a pass needs all of them. It is ' +
      'a list rather than two constants because the first version of that guard asked ONE of ' +
      'these while its sentence claimed both, so a bot running eleven-hour-old code read as a ' +
      'pass; naming the set in one place is what makes adding a third question a change to a ' +
      'list rather than to four call sites, one of which gets missed',
  },
  {
    module: 'lib/namesakes.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/audit-namesakes.mjs',
    asks: 'rotted',
    because:
      'the thirty places a language calls two plans by one name, grouped by the pair ' +
      'because the cause is shared — repairing means choosing what a plan is called in ' +
      'that language, which is a translator’s decision',
  },
  {
    module: 'audit-preview.mjs',
    name: 'PAGES',
    kind: 'vocabulary',
    because:
      'the two pages of the game and where each is served from. It excuses nothing — it is ' +
      'the set the audit holds to a standard, and a page removed from it would be a page ' +
      'nothing checks, which is the defect that audit was written for',
  },
  {
    module: 'make-card.mjs',
    name: 'ART',
    kind: 'vocabulary',
    because:
      "the painting's width and height, which the card's layout is measured against. " +
      'preview.test.ts reads the file and fails if it is ever repainted at another size',
  },
  {
    module: 'make-card.mjs',
    name: 'REPEATABLE',
    kind: 'vocabulary',
    because:
      'the two flags that stop ImageMagick stamping a timestamp into a PNG. Nothing is ' +
      'excused: without them two runs of one command differ and `--check` is a liar',
  },
  {
    module: 'make-card.mjs',
    name: 'SAYS',
    kind: 'vocabulary',
    because: "the book's sentence about the game, split across the two lines the card sets it in",
  },
  {
    module: 'audit-spoken.mjs',
    name: 'SURFACES',
    kind: 'vocabulary',
    because:
      'the two apps that hand sentences to a DOM. It excuses nothing: apps/bot has no ' +
      'DOM and apps/docs renders HTML from strings, and both are named in that file as a ' +
      'stated gap rather than being quietly absent from a list',
  },
  {
    module: 'lib/spoken.mjs',
    name: 'SPOKEN',
    kind: 'vocabulary',
    because: 'the two ways this codebase hands a sentence to the page, textContent and aria-label',
  },
  {
    module: 'lib/rivals.mjs',
    name: 'ABSENCE',
    kind: 'vocabulary',
    because: 'the two things a missing needle is allowed to mean, refuted or unknown',
  },
  {
    module: 'lib/rivals.mjs',
    name: 'RIVALS',
    kind: 'vocabulary',
    because:
      'the competitors this repository makes claims about, each with the address its ' +
      'claims can be re-checked at. It excuses nothing: it is the subject list, and the ' +
      'addresses are the half NOTES.md never had, which is why five of its rows sat unchecked',
  },
  {
    module: 'lib/rivals.mjs',
    name: 'WITHOUT_AN_ADDRESS',
    kind: 'vocabulary',
    because:
      'the rivals nothing locates, and it excuses none of them: `describeRivals` prints ' +
      'every entry under "not checkable from here" on every run, so an unreachable rival ' +
      'stays in the report instead of being quietly dropped from it. Each carries what ' +
      'was probed, and the entry goes when an address is found',
  },
  {
    module: 'lib/runnable.mjs',
    name: 'FALSEY',
    kind: 'vocabulary',
    because: 'the scalars GitHub reads as false without evaluating them',
  },
  {
    module: 'lib/spillover.mjs',
    name: 'RECORDED',
    kind: 'record',
    askedIn: 'scripts/build-content.mjs',
    // Both directions, because `against` returns both and the build puts both.
    // This said `missedSpillovers` — one scalar, naming a variable that no
    // longer exists anywhere in the asker — while the build had already grown
    // the second half of the question. See `directionsOf` below.
    asks: ['rotted', 'fresh'],
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
 * A module written at the repository root rather than under `scripts/`.
 *
 * The fourth widening needed a second answer to *where is this file*, and the
 * cheap way to give it would have been a second path field on every declaration
 * — forty-nine entries carrying a thing that is the same for forty-seven of
 * them. `module` stays the key it has always been and this is the one place that
 * turns it into a path, so the audit, its test and `stalePermissions` cannot
 * disagree about where `knip.config.mjs` lives.
 *
 * A config at the root and a script under `scripts/` are told apart by the name,
 * not by a list: `*.config.mjs` is the convention both root files were written
 * with and the one a third would be written with. Nothing under `scripts/` is
 * named that way today, and if something ever is, it collides loudly here rather
 * than quietly — `entriesOf` would be handed a file that does not exist and
 * `stalePermissions` reports *its entries could not be read*.
 */
const ROOT_CONFIG = /^[\w.-]+\.config\.mjs$/;

/** Where a declared module is, as a path from the repository root. */
export const sourcePathOf = (module) =>
  ROOT_CONFIG.test(module) ? module : `scripts/${module}`;

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
 * Whether a place still names something, as a word in code rather than a substring.
 *
 * `roll.disabled` is written `el.roll.disabled`, so the boundary has to admit a
 * dot on the left; `draw` must not be answered by `drawing`, so it has to refuse
 * a letter on either side.
 *
 * Comments are cut out first, and that was measured rather than foreseen. The
 * experiment meant to prove the permission rule renamed `draw` to `redraw` in
 * `ALLOWED`'s entries and the check said nothing: `redraw` is written four times
 * in `apps/miniapp/src/main.ts`, every one of them in prose about redrawing. A
 * permission is granted to a thing that exists in code, so a word the file only
 * talks about is not the thing. `codeIn` is borrowed from `lib/reachable.mjs`
 * rather than written again here, since it was put there for this exact reason
 * and a rule restated is a rule that will disagree with itself.
 *
 * Both questions this file asks of a source now come through here, and that was
 * the second half of the same lesson rather than a tidying. It sat below
 * `unasked` for as long as `unasked` had a matcher of its own, and the two
 * disagreed exactly the way the paragraph above says a restated rule does.
 * `unasked`'s comment records what the separate copy cost.
 */
const namedIn = (source, entry) => {
  const literal = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w$])${literal}(?![\\w$])`).test(codeIn(source));
};

/**
 * Records whose stated asker no longer asks.
 *
 * The third way this can rot, and the quietest: the list is there, the
 * declaration is there, and the question was deleted from the audit. Nothing
 * else would notice — the audit still runs, still passes, and no longer looks.
 *
 * Matched by name rather than as a call, because several of the askers are
 * variables holding the answer (`rotted`, `fresh`) rather than functions, and
 * outside the imports for the reason above.
 *
 * Asked of code and not of prose, and the hole that closes was measured rather
 * than argued. This used to run `.includes` over the source with only the
 * imports cut out, so any sentence naming the asker satisfied it. Take the
 * `mended` staleness check out of `audit-offers.mjs` — the filter that builds it
 * and the line that reports it, the whole question — and the old `unasked` still
 * said nothing, because one line survives the deletion:
 * `// all-clear asked only about `fresh` and knew nothing of `mended`.`, written
 * by the round that closed the all-clear defect. A comment about a check was
 * accepted as the check. Of the thirteen records declared here that is the only
 * one standing on prose today, which is a fact about today: the words the rest
 * are keyed on include `healed` and `rotted` twice, plain enough to turn up in a
 * sentence the first time somebody explains one of them.
 *
 * The sibling above got this right first, and was believed to be about
 * permissions only — `namedIn` cuts the comments out because a rename to
 * `redraw` hid inside four sentences about redrawing. A record rots the same way
 * a permission does, so it is asked the same way, through that matcher and not
 * through a second copy of it, since a second copy is precisely what disagreed
 * with the first here.
 *
 * The boundary matters as much as the comments. `.includes` is a substring test,
 * so an asker named `mended` was answered by the word `amended` and one named
 * `rotted` by `unrotted`; `namedIn` refuses a letter on either side.
 *
 * ## One record can name more than one question
 *
 * `asks` was a scalar in all thirteen entries, and a question is not always one
 * word. `lib/spillover.mjs:against` returns TWO directions — `fresh`, findings
 * nobody recorded, and `rotted`, records matching nothing — and
 * `scripts/build-content.mjs` puts both of them, in two separate blocks with two
 * separate exit codes. One scalar can only ever hold one of the two, so half the
 * question was outside this check by construction: delete the `fresh` block from
 * the build and, with `asks: 'rotted'`, nothing here would have said a word.
 *
 * MEASURED, and it is how the widening was found rather than an argument for it.
 * The scalar on that entry read `missedSpillovers` — the name of a variable the
 * build had held before the second direction arrived, and which
 * `grep -c missedSpillovers scripts/build-content.mjs` now answers `0` for. So
 * the entry was reported stale for the LOUD reason (an identifier that is simply
 * gone) while the quiet reason sat underneath it: retyping one word would have
 * turned the audit green with one of the two directions still unasked.
 *
 * `asks` therefore takes a string OR an array of strings, read through
 * `directionsOf`, and EVERY named direction must be found in the asker by the
 * same `namedIn` above. One line is still reported per record, naming only the
 * directions that are missing — a record half-asked is one place to look, not
 * two, and the reader needs to know which half.
 */

/**
 * The questions one record's asker must still put, as a list either way.
 *
 * A scalar stays legal because twelve of the thirteen entries genuinely have one
 * question, and rewriting them as one-element arrays would be ceremony that
 * hides which records really do have two.
 */
export const directionsOf = (one) => (Array.isArray(one.asks) ? one.asks : [one.asks]);

export function unasked(declared, sourceOf) {
  return declared
    .filter((one) => one.kind === 'record')
    .flatMap((one) => {
      const code = withoutImports(sourceOf(one.askedIn) ?? '');
      const missing = directionsOf(one).filter((asks) => !namedIn(code, asks));

      if (missing.length === 0) return [];
      return [
        `${keyOf(one.module, one.name)} — ${one.askedIn} no longer asks ${missing.join(' or ')}`,
      ];
    });
}

/**
 * The text of one bracketed value, from the first bracket to the one that closes it.
 *
 * Bracket counting rather than a regex, because the values inside these lists are
 * prose: `'the board, the die and the line underneath are that seat's'` carries a
 * bracket in a sentence sooner or later, and `PUBLIC_MEMBERS` carries a ten-line
 * comment between two of its entries. Quotes, template literals and both comment
 * forms are stepped over for that reason.
 *
 * Returns null rather than a guess when the value is not bracketed at all — a
 * threshold, `= 200` — or when the brackets never close. Null is reported by the
 * caller as *could not be read*, which is the loud answer; the quiet one would be
 * to treat an unreadable list as an empty one and pass.
 */
const bracketed = (source, from) => {
  const closes = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  let quote = null;

  for (let at = from; at < source.length; at += 1) {
    const char = source[at];

    if (quote !== null) {
      if (char === '\\') at += 1;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '/' && source[at + 1] === '/') {
      const line = source.indexOf('\n', at);
      if (line < 0) return null;
      at = line;
      continue;
    }

    if (char === '/' && source[at + 1] === '*') {
      const end = source.indexOf('*/', at + 2);
      if (end < 0) return null;
      at = end + 1;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (closes[char] !== undefined) {
      stack.push(closes[char]);
      continue;
    }

    if (stack.length > 0) {
      if (char === stack[stack.length - 1]) {
        stack.pop();
        if (stack.length === 0) return source.slice(from, at + 1);
      }
      continue;
    }

    // Before the first bracket only `new Set` and `new Map` are expected. Anything
    // else means this constant is not a list, and reading on would swallow the
    // brackets of whatever is declared after it.
    if (!/[A-Za-z\s]/.test(char)) return null;
  }

  return null;
};

/**
 * The entries of one list, read out of the module that writes it.
 *
 * Read rather than imported, for the reason `exportedLists` is: importing runs
 * the module, and every audit that owns a permission list reads the working tree
 * at load and sets an exit code. `audit-whose` would run its whole check.
 *
 * The literal is evaluated once it has been cut out, rather than picked apart by
 * hand, because the four forms a list is written in — `new Set([...])`,
 * `new Map([...])`, an object of reasons, an array — differ in where the entry
 * sits and agree on nothing except being JavaScript. A hand-written reader of
 * four forms is the fourth restatement of a rule, which is the mistake this file
 * exists to stop making.
 *
 * A non-string entry makes the whole list unreadable rather than skipped. An
 * entry that is not a name is not something a place can be searched for, and
 * dropping it quietly is a licence issued in the one place nothing looks.
 */
export function entriesOf(source, name) {
  const at = new RegExp(`^(?:export )?const ${name}\\s*=\\s*`, 'm').exec(source);
  if (at === null) return null;

  const literal = bracketed(source, at.index + at[0].length);
  if (literal === null) return null;

  let value;
  try {
    value = new Function(`return (${literal});`)();
  } catch {
    return null;
  }

  let entries;
  if (value instanceof Map) entries = [...value.keys()];
  else if (value instanceof Set) entries = [...value];
  else if (Array.isArray(value)) entries = value;
  else if (value !== null && typeof value === 'object') entries = Object.keys(value);
  else return null;

  return entries.every((entry) => typeof entry === 'string') ? entries : null;
}

/**
 * Permissions naming something that is no longer there.
 *
 * The way a permission rots, stated at the top of this file and checked by
 * nothing until now. A record asserts a fact about today — this field is written
 * and never read — so it rots when the fact changes, and `unasked` is what asks.
 * A permission asserts an intent — this export is a surface whether or not we
 * call it — which does not stop being true because somebody called it. What
 * withdraws a permission is the thing it was granted to disappearing: a function
 * renamed, a member deleted, a union moved. Then the entry excuses nothing, and
 * the next thing to be given that name inherits an excuse nobody granted it.
 *
 * Injected the way `unasked` is, so the whole of it can be driven from a fixture:
 * `findIn(path)` answers with the text at a repository-relative path, or null.
 * Two kinds of path are asked for — `sourcePathOf(module)` for the list itself,
 * which is `scripts/<module>` for everything under the scripts directory and the
 * bare name for a config at the repository root, and each of `namesIn` for the
 * places its entries must still be named in.
 *
 * Only the entries that are there are asked about, so a list that SHRANK cannot
 * fail this: removing an excuse is the outcome the whole file is arguing for.
 * And a permission whose `namesIn` is null is never read at all — not the list,
 * not any place — because there is nothing it could be compared against.
 */
export function stalePermissions(declared, findIn) {
  const rotted = [];

  for (const one of declared) {
    if (one.kind !== 'permission') continue;
    const which = keyOf(one.module, one.name);

    if (!Object.prototype.hasOwnProperty.call(one, 'namesIn')) {
      rotted.push(`${which} — does not say where its entries must still be named`);
      continue;
    }

    if (one.namesIn === null) {
      if (!one.namelessBecause || one.namelessBecause.trim().length < 20) {
        rotted.push(`${which} — names no place for its entries and does not say why`);
      }
      continue;
    }

    const places = Array.isArray(one.namesIn) ? one.namesIn : [one.namesIn];
    const read = places.map((place) => ({ place, source: findIn(place) }));

    const gone = read.filter(({ source }) => source === null || source === undefined);
    if (gone.length > 0) {
      for (const { place } of gone) {
        rotted.push(`${which} — ${place}, where its entries must be named, is not there`);
      }
      continue;
    }

    const from = sourcePathOf(one.module);
    const entries = entriesOf(findIn(from) ?? '', one.name);
    if (entries === null) {
      rotted.push(`${which} — its entries could not be read out of ${from}`);
      continue;
    }

    for (const entry of entries) {
      if (read.some(({ source }) => namedIn(source, entry))) continue;
      rotted.push(`${which} — '${entry}' is named nowhere in ${places.join(', ')}`);
    }
  }

  return rotted;
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
