#!/usr/bin/env node
/**
 * Report fields that are written and never read.
 *
 * Three of these were found by hand in three consecutive passes:
 * `Reply.broadcast` put private replies in front of a whole group,
 * `RuleSet.rerollOnRepeat` made two variants claim a fidelity they did not have,
 * and `players.needs_report` reproduced the exact defect this project had
 * criticised NeuroLeela for. All three were declared, set correctly everywhere,
 * documented — and consulted by nothing.
 *
 * Tests are deliberately not searched for THREE of the four questions.
 * `broadcast` was read in its tests and nowhere else, which is exactly the state
 * the fields half is looking for: a field the suite confirms and the program
 * ignores. `unreadFields`, `staleAmong` and `unusedInOwnPackage` therefore go on
 * reading the shipped sources alone.
 *
 * The fourth asks *does anything at all call this export*, and that question has
 * an honest answer that includes a test — a test compiles against the signature
 * and breaks when the signature does. It did not get one: `NOT_SOURCE` in
 * `lib/claims.mjs` holds `'tests'`, so a caller inside a tests directory was
 * outside this search by construction, and the audit reported
 * `floatingAssertions` in `scripts/lib/awaited.mjs` as uncalled while
 * `apps/mobile/tests/awaited.test.ts` called it thirteen times. Any library
 * function whose only caller is a test read the same way, and the remedy printed
 * below — *add it to PUBLIC_API with a reason* — would have made that permanent.
 * `testCallerFiles` in `lib/unread.mjs` is the second corpus, handed to the two
 * `uncalledExports` calls and to nothing else.
 *
 * Run:  node scripts/audit-unread.mjs
 *
 * Four findings fail the run, and each is declared `failing` where it is
 * collected, at the foot of this file: a field written and never read, a
 * `WRITE_ONLY` excuse that no longer suppresses anything, an export with no
 * caller anywhere, and an export its own application does not use. Each is a
 * statement about the code that can be checked, so each gates. The exit code is
 * returned once, by `lib/report.mjs`, from the same decision that prints the
 * closing sentence — the two used to be written separately and disagreed.
 *
 * Three things are reported and do not: the counts, the names declared in more
 * than one place — which this reader cannot tell apart without resolving
 * imports, so an ambiguity is a place to look rather than a verdict — and a
 * class member with no caller here.
 *
 * This header promised for several passes that the run always ends in a zero
 * exit code and is a prompt to look rather than a gate, while the file below it
 * set `process.exitCode = 1` in three separate places. The header is what a
 * person reads to decide whether a red job matters, so a wrong one is worse
 * than none: the retracted sentence is described here rather than quoted, so
 * that grepping for it finds the code and not the claim.
 */

import { staleAmong } from './lib/records.mjs';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish } from './lib/report.mjs';
import {
  ambiguousExports,
  declaredExports,
  declaredFields,
  declaredMembers,
  testCallerFiles,
  uncalledExports,
  unreadFields,
  unusedInOwnPackage,
} from './lib/unread.mjs';
import { workspaceSources } from './lib/claims.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The one reader both corpora below are built through. Lowercase deliberately:
// it is an injected reader and not a list of excused things, and
// `audit-records.mjs` reads every uppercase constant in this directory as a list
// that must be declared as one — which it said, loudly, the first time this was
// written `READ`.
const readTree = {
  exists: (path) => existsSync(join(ROOT, path)),
  entries: (path) => readdirSync(join(ROOT, path)),
  // A workspace's sources are not only its `src`: the post-deploy check and
  // the phone's entry point live beside it, and both are readers.
  isDirectory: (path) => statSync(join(ROOT, path)).isDirectory(),
};

/**
 * Where to look: every workspace that ships TypeScript, plus the scripts.
 *
 * This was a hand-written array, and `packages/journal/src` was not in it — so
 * the shared file format between the bot and the mini app was never checked,
 * while the audit reported that every export had a caller. Found now, so a
 * tenth package cannot be missed the same way.
 *
 * The audit scripts are readers too: `detectRules`'s fields are consumed by
 * `audit-copies.mjs`, and omitting them reported those fields as unread.
 */
const SEARCH = [...workspaceSources(readTree), 'scripts'];

/**
 * The tests, which answer one question here and no other.
 *
 * `NOT_SOURCE` in `lib/claims.mjs` contains `'tests'`, so `SEARCH` above cannot
 * see a caller that lives in a tests directory — and this audit reported
 * `floatingAssertions` in `scripts/lib/awaited.mjs` as having no caller anywhere
 * while `apps/mobile/tests/awaited.test.ts` called it thirteen times. The
 * printed remedy would have put a permanent falsehood in `PUBLIC_API`.
 *
 * Handed to `uncalledExports` alone. `testCallerFiles`'s own comment says at
 * length why the other three questions must go on refusing to look at tests —
 * `broadcast` was read in its tests and nowhere else, and that is the defect
 * rather than the answer to it.
 */
const testFiles = testCallerFiles(readTree);
const testSources = testFiles.map((file) => readFileSync(join(ROOT, file), 'utf8'));

/**
 * Fields that are write-only on purpose.
 *
 * Each needs a reason, so the list cannot quietly become the place unread
 * fields go to be forgotten.
 */
const WRITE_ONLY = {
  // Read by three.js at renderer construction, not by any code of ours.
  antialias: 'a WebGLRenderer option, consumed inside three.js',
  fullName: 'display only',
  email: 'part of the legacy document shape, not used here',
  firstGame: 'part of the legacy document shape, not used here',
  // Read by string key in audit-copies.mjs, which no static search can see.
  entryOnSix: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  refusesOvershoot: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  winsOnExactLanding: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  reportGate: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  // Preserved so a migrated account can be reconciled with Firebase by hand.
  legacyId: 'provenance for a migrated account; migrateBatch matches on owner',
  // Handed to grammY, which calls it. A reader outside this repository is
  // still a reader.
  onStart: 'a callback grammY invokes',
  // Reported to a person and asserted in a test; no code branches on it.
  ratio: 'the measured contrast, for a test and a report rather than a rule',
};

/**
 * Every file that could call something, `.tsx` included.
 *
 * It was `.ts` and `.mjs`, which was true of this repository until a React
 * screen arrived in `apps/mobile`. On the day it did, the two functions that
 * screen is built out of were reported as having no caller anywhere — the whole
 * surface it exists to draw, invisible because of a file extension.
 *
 * A blind spot of exactly the kind this audit was widened for two passes ago,
 * and found the same way: by something new walking into it.
 */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) yield full;
  }
}

const files = [];
for (const source of SEARCH) {
  const full = join(ROOT, source);
  try {
    // A path, not always a directory: an entry point is one file beside the
    // folders — `apps/mobile/index.ts` is the whole of what the phone runs.
    // `walk` reads a directory, and handing it a file threw into the catch
    // below, where a source nobody looks at is indistinguishable from a package
    // with nothing in it yet.
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx|mjs)$/.test(full)) files.push(full);
  } catch {
    // A package without sources yet is not an error.
  }
}

const sources = files.map((file) => readFileSync(file, 'utf8'));

// Only TypeScript declares the interfaces and tables this is about. The `.mjs`
// scripts are searched as readers, not scanned for declarations: their object
// literals are configuration, not a contract anyone is expected to honour.
const declarations = files.flatMap((file, index) =>
  /\.tsx?$/.test(file) ? declaredFields(sources[index], relative(ROOT, file)) : [],
);

const unread = unreadFields(declarations, sources, Object.keys(WRITE_ONLY));

// The other half, which had never been asked. An excuse that suppresses nothing
// is a licence issued for something else: the field is read now, and the next
// one written and never read under the same name is waved through. Twenty-four
// of the thirty-four entries here were in exactly that state.
const wouldFlag = unreadFields(declarations, sources, []).map((field) => field.name ?? field);
const staleExcuses = staleAmong(Object.keys(WRITE_ONLY), wouldFlag);

console.log(`Checked ${declarations.length} field declarations across ${files.length} files.\n`);

// The fields half can fail now, and does. It reported for passes and gated
// nothing: this audit had no `process.exitCode` anywhere, so CI ran it, printed
// its findings and went green. Two fields were standing in that output — both
// on the contract's three-sixes rule, both now read by the comparer that owns
// them — and nobody had acted on them because nothing made them act.
//
// What both halves say, and the exit code they add up to, is assembled at the
// foot of this file: this audit has four gates and its closing sentence used to
// ask after one of them. See the note above that `finish` call.

console.log(`\n${Object.keys(WRITE_ONLY).length} field(s) are write-only on purpose.`);

// --- exports ----------------------------------------------------------------

/**
 * Exports with no caller inside this repository.
 *
 * The same question, asked of the public surface. It is a weaker signal than an
 * unread field — a package may export for consumers that do not exist yet — but
 * it is how `hasWon` was found, which had no caller and was wrong.
 */
const PUBLIC_API = {
  // Small helpers a consumer would reach for; kept because the alternative is
  // every caller writing `plan in SNAKES` and drifting from the tables.
  // Read out of the vendored Solidity, beside compareBoards and
  // compareConstants which are already here. A consumer holding a redeployed
  // contract to the engine needs all four.
  // The strict form of a rule whose live reader is deliberately lenient. Both
  // readers drop what they cannot read and keep the rest — measured, because
  // refusing a whole table over one damaged seat returned a table of one — and
  // the strict statement is what their tests hold the lenient reading to. It is
  // a caller: `one-bad-line.test.ts` asks it whether what `readJournal` returned
  // is well formed, which is the invariant the leniency must not break.
  isJournal: 'the strict form of the journal rule, the oracle its lenient reader is held to',
  isSavedSeats: 'the strict form of the table rule, the oracle its per-seat reader is held to',
  parseSixes: 'contract surface: reads the three-sixes rule out of the source',
  compareSixes: 'contract surface: names where that rule and the engine part company',
  snakeAt: 'board helper for consumers; the tables are the thing it guards',
  arrowAt: 'board helper for consumers',
  isOnBoard: 'board helper for consumers',
  boardPosition: 'board helper for a renderer that is not the mini app',
  allPlans: 'board helper for a renderer',
  rollMany: 'used by tests and by anyone seeding a replay',
  replay: 'replays a game from its rolls; used by tests and off-chain checks',
  // The half of the migration that cannot run yet. `playerFromLegacy` converts
  // one account and is called by tests; `migrateBatch` converts an export, and
  // the export is a Firebase dump nobody has produced. Kept rather than
  // deleted because deleting it would mean writing it again from the same
  // reading, and the reading is what took the time.
  migrateBatch: 'converts a Firebase export; waiting on the dump itself',
  // Entry points a host calls, not this code.
  createBot: 'the bot entry point, called by index.ts',
  supervise: 'wraps the bot run loop',
  build: 'the docs generator, run as a script',
  // The catalogue's own tooling: read by tests and by a translator working out
  // what is left to do, not by the game.
  englishCatalogue: 'the key list, for tests and for a translator',
  // Audit surface, consumed by the scripts in this directory.
  declaredFields: 'this script',
  declaredExports: 'this script',
  unreadFields: 'this script',
  uncalledExports: 'this script',
  readsOf: 'tested directly; used by unreadFields',
  usesOf: 'tested directly; used by uncalledExports',
  auditBoard: 'used by audit-copies.mjs',
  compareToReference: 'used by audit-copies.mjs',
  describeProblems: 'used by audit-copies.mjs',
  detectRules: 'used by audit-copies.mjs',
  extractBoards: 'used by audit-copies.mjs',
  declaresBoard: 'used by audit-copies.mjs',
  compareRules: 'offered beside detectRules for a consumer comparing variants',
  runCheck: 'tested directly; used by runChecks',
  // Offered beside the pieces that are used, for a consumer assembling their own.
  canPlayerRoll: 'the gate from a players row, for a client that is not the bot',
  turnContextFromPlayer: 'used by canPlayerRoll; exported for the same consumer',
  describeMigration: 'a line for an operator running the migration by hand',
  compareBoards: 'contracts verifier surface, used by its tests',
  compareConstants: 'contracts verifier surface, used by its tests',
  describeDivergences: 'contracts verifier surface, used by its tests',
  parseContract: 'contracts verifier surface, used by its tests',
  fixedModel: 'a model that says one thing, for tests and for running with no key',
  recordingModel: 'a model that records, for asserting on a prompt',
  currentLanguage: 'which dataset the mini app loaded; for a language picker',
  measurePalette: 'the contrast check, used by its tests',
  contrast: 'used by measurePalette and tested directly',
  luminance: 'used by contrast and tested directly',
  channels: 'used by luminance and tested directly',
  AA_TEXT: 'the WCAG threshold, asserted in tests',
  AA_LARGE: 'the WCAG threshold for large text',
  LIGHT: 'the light palette, measured in tests',
  DARK: 'the dark palette, measured in tests',
  BOARD_COLUMNS: 'board dimension, for a renderer',
  BOARD_ROWS_COUNT: 'board dimension, for a renderer',
  ONE_DAY_MS: "the online variant's cooldown, asserted in tests",
  discardSteps: 'a sink that drops moves, for running without storage',
  sqliteStepSink: 'wired in index.ts when LEELA_DB is set',
  summariseJourney: 'used by systemPrompt and tested directly',
  pathFor: 'used by the bot transport when there is no table',
  paginate: 'used by pathFor and tested directly',
  stripFrontmatter: 'used by the docs build and tested directly',
  loadLegal: 'used by the docs build and tested directly',
  legalPage: 'used by the docs build',
  rootPage: 'used by the docs build',
  chapterPage: 'used by the docs build',
  indexPage: 'used by the docs build',
  planPage: 'used by the docs build',
  languagePicker: 'used by the page templates',
  directionOf: 'used by the page templates and tested directly',
  renderMarkdown: 'used by the page templates',
  LANGUAGE_NAMES: 'used by languagePicker',
  PLAY_URL: 'used by the page templates',
  descriptionIsRedundant: 'used by planPage and tested directly',
  escape: 'used throughout the page templates',
  playerUpdateFromState: 'writes a players row; for a client that is not the bot',
  ruleChapter: 'one rules chapter by slug, for a reader that wants one',
  validatePosition: 'the old GameService name, delegating to isOnBoard',
  // The shared way to read a source file. Its consumers are the checks that do
  // — `reader.test.ts` and `asked.test.ts` — and this audit searches sources
  // rather than tests, so a check is a caller it cannot see.
  callsTo: 'used by the checks that read source, which are tests',
};

/**
 * Where an export is a contract, which is not only TypeScript.
 *
 * Fields are read from `.tsx?` alone, and the reason is written above: an
 * object literal in a script is configuration. An **export** is not. The shared
 * modules under `scripts/lib` are libraries with real consumers — `whose.mjs`
 * by `audit-whose.mjs`, `paragraphs.mjs` by the content generator — and the
 * waiver list below already names a dozen of them.
 *
 * It named them by hand, because this line read `.tsx?` and the audit could
 * never have reported one. Two exports were added to `scripts/lib/source.mjs`
 * with no caller but their own test and nothing said a word — the same blind
 * spot this audit has now been widened for three times: a package left out of a
 * hand-written list, a `.tsx` extension nobody had thought of, and this.
 */
const declaresExports = (file) => /\.tsx?$/.test(file) || /scripts\/lib\/[^/]+\.mjs$/.test(file);

const exportDeclarations = files.flatMap((file, index) =>
  declaresExports(file) ? declaredExports(sources[index], relative(ROOT, file)) : [],
);

/**
 * Class members nobody outside the class calls, and why that is allowed.
 *
 * The same list as `PUBLIC_API` above and for the same reason, kept apart
 * because a member is a different kind of claim: an export with no caller may
 * be a library's surface, while a method with no caller is a class talking to
 * an audience that is not there.
 */
const PUBLIC_MEMBERS = {
  refusedCount:
    'how many players the bot has learned it cannot message directly; read by ' +
    'its own tests and there for an operator, not for the game',

  // Not a waiver. `game_steps` is written on every move by `sqliteStepSink`,
  // and this is the only thing that can read it back — and nothing calls it, so
  // a durable bot has been filling a table nobody has ever opened.
  //
  // That is the exact shape of the defect this audit was widened to find:
  // `reportsFor` was written, stored and unreadable until `/path` was added,
  // and reports are the record the game exists to produce. Moves are not, which
  // is why this is recorded rather than answered here: either the bot grows a
  // command that reads a game's throws back, or it stops writing them. Both are
  // decisions about what the bot is for.
  stepsFor: 'the reader half of a move history nothing reads yet — see MIGRATION.md',
};

const memberDeclarations = files.flatMap((file, index) =>
  /\.tsx?$/.test(file) ? declaredMembers(sources[index], relative(ROOT, file)) : [],
);

// The two questions of the form *does anything at all call this*, and the only
// two that get the tests. A test is a caller: it compiles against the signature
// and breaks when the signature does. See `testCallerFiles`.
const callers = [...sources, ...testSources];

const uncalled = uncalledExports(exportDeclarations, callers, Object.keys(PUBLIC_API));
const unusedMembers = uncalledExports(memberDeclarations, callers, Object.keys(PUBLIC_MEMBERS));

console.log(
  `\nChecked ${exportDeclarations.length} exports and ${memberDeclarations.length} class members ` +
    `for a caller in ${files.length} source file(s) and ${testFiles.length} test file(s).\n`,
);

console.log(
  `${Object.keys(PUBLIC_MEMBERS).length} class member(s) are uncalled on purpose.\n`,
);

const ambiguous = ambiguousExports(exportDeclarations, Object.keys(PUBLIC_API));

const orphaned = unusedInOwnPackage(
  exportDeclarations,
  files.map((file) => relative(ROOT, file)),
  sources,
  Object.keys(PUBLIC_API),
);

// The ambiguity report is printed with the rest of the run below, as a section
// of `finish`, rather than here as a bare count. `ambiguousExports` computes
// `{name, files}` and this line printed only the length, throwing away every
// `files` array it had just built — while the library's own justification for
// the check reads "an ambiguity reported is a place to look". Twenty-three is
// not a place to look. It is the number of places somebody else now has to
// find.

// Everything this audit found, and the exit code that agrees with it.
//
// The exports half is gated at last. It had reported into a green job for as
// long as it has existed: this file had no `process.exitCode` anywhere, so CI
// ran it, printed eight uncalled exports and went on. Two of the eight had live
// callers the reader could not see, `unseeableIn` was wired into the audit that
// asked its question in a counter of its own, and two lossy `merge` wrappers
// went in favour of the functions that also say what the merge cost. What is
// left is declared in `PUBLIC_API` with a reason apiece.
//
// And then there were four gates and one closing sentence that asked after one
// of them. `unread`, `staleExcuses`, `orphaned` and `uncalled` each set the exit
// code, and the last line of the run was decided by `uncalled.length === 0`
// alone — so a run that failed on a field written and never read, or on a
// withdrawn excuse, or on an export its own package does not use, ended on
// *every export has at least one caller*. That sentence was true; it was also
// the verdict a person reads, twenty lines below the alarm. `lib/report.mjs`
// now owns the arrangement: notes first, whatever failed last, the all-clear
// only when nothing failing has anything to say, and the code returned from the
// same decision that printed the words.
//
// `Every field has at least one reader.` stays a note rather than an all-clear.
// It is a true statement about the fields half whenever that half is clean, and
// there is no reason to hide it because the exports half failed — it simply
// must not be the last thing on screen when something did.
process.exitCode = finish({
  allClear: 'Every export has at least one caller.',
  sections: [
    {
      failing: false,
      lines: unread.length === 0 ? ['Every field has at least one reader.'] : [],
    },
    {
      failing: false,
      heading: `${unusedMembers.length} class member(s) have no caller here:\n`,
      lines: unusedMembers.map(
        (item) => `  ${item.owner}.${item.name}  (${item.kind}, ${item.file})`,
      ),
      epilogue:
        '\nA class is exported and its members are not, so this is the half of the surface\n' +
        '`export` cannot see. It is where `reportsFor` hid: a durable sink that kept every\n' +
        'report and answered that it kept nothing.\n',
    },
    {
      failing: false,
      heading: `${ambiguous.length} name(s) are declared in more than one place:\n`,
      lines: ambiguous.map((a) => `  ${a.name}  (${a.files.join(', ')})`),
      epilogue:
        '\nUses are counted by name across every source, so one live caller anywhere covers\n' +
        'every declaration of that name. Telling them apart means resolving imports, which\n' +
        'is a different tool; naming the files is not, and an ambiguity reported is only a\n' +
        'place to look if the report says where.\n',
    },
    {
      failing: true,
      heading: `${unread.length} field(s) are written and never read:\n`,
      lines: unread.map((field) => `  ${field.name}  (${field.kind}, declared in ${field.file})`),
      epilogue:
        '\nEither read it, remove it, or add it to WRITE_ONLY with a reason.\n' +
        'A field nobody reads is often a question nobody asked.',
    },
    {
      failing: true,
      heading: '\nThese write-only excuses no longer describe anything:\n',
      lines: staleExcuses.map((name) => `  ${name}`),
      epilogue:
        '\nEach names a field that is read now, or that this check no longer sees.\n' +
        'Take them out: an excuse kept past its reason waves through the next field\n' +
        'written and never read under the same name.',
    },
    {
      failing: true,
      heading: `${orphaned.length} of them are not used by the package that declares them:\n`,
      lines: orphaned.map((item) => `  ${item.name}  (${item.file})`),
      epilogue:
        '\nUses are counted by name, so a live caller in one package covers a dead export in\n' +
        'another. That is how the phone app came to write a path no screen read back.\n',
    },
    {
      failing: true,
      heading: `${uncalled.length} export(s) have no caller here:\n`,
      lines: uncalled.map((item) => `  ${item.name}  (${item.kind}, ${item.file})`),
      epilogue:
        '\nAn export with no caller is code no caller has disagreed with.\n' +
        'Call it, remove it, or add it to PUBLIC_API with a reason.',
    },
  ],
});
