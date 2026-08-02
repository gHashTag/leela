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
 * Tests are deliberately not searched. `broadcast` was read in its tests and
 * nowhere else, which is exactly the state this is looking for: a field the
 * suite confirms and the program ignores.
 *
 * Run:  node scripts/audit-unread.mjs
 *
 * Exits 0 always: this is a prompt to look, not a gate. A field can be
 * legitimately write-only, and a check that blocks a build on a judgement call
 * gets switched off rather than heeded.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ambiguousExports,
  declaredExports,
  declaredFields,
  declaredMembers,
  uncalledExports,
  unreadFields,
  unusedInOwnPackage,
} from './lib/unread.mjs';
import { workspaceSources } from './lib/claims.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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
const SEARCH = [
  ...workspaceSources({
    exists: (path) => existsSync(join(ROOT, path)),
    entries: (path) => readdirSync(join(ROOT, path)),
    // A workspace's sources are not only its `src`: the post-deploy check and
    // the phone's entry point live beside it, and both are readers.
    isDirectory: (path) => statSync(join(ROOT, path)).isDirectory(),
  }),
  'scripts',
];

/**
 * Fields that are write-only on purpose.
 *
 * Each needs a reason, so the list cannot quietly become the place unread
 * fields go to be forgotten.
 */
const WRITE_ONLY = {
  // Timestamps the database maintains; nothing in the app reads them back.
  created_at: 'set by the database, read by operators not by code',
  updated_at: 'set by the database, used by pruneFinished in SQL rather than TS',
  // Carried across from the legacy shape for reconciliation by hand.
  isStart: 'migrated from the published app for provenance; the engine uses is_finished',
  host_id: 'recorded so a table has an owner on the record; no rule depends on it',
  // Display-only columns written for a client that has not been ported.
  message: 'written for a client to show; no rule reads it',
  avatar: 'display only',
  intention: 'display only',
  fullName: 'display only',
  email: 'part of the legacy document shape, not used here',
  firstGame: 'part of the legacy document shape, not used here',
  likes: 'display only',
  comments: 'display only',
  // The move log exists to be read by a person or a later replay, not by the
  // running game — which already has the state the log describes.
  from_plan: 'move log, for replay and audit rather than for a rule',
  to_plan: 'move log',
  jumped_from: 'move log',
  is_game_start: 'move log',
  is_game_finished: 'move log',
  is_three_sixes_reset: 'move log',
  // The chat history is written for a client to display and for later analysis.
  user_message: 'chat history, written for display',
  ai_response: 'chat history, written for display',
  message_type: 'chat history, written for display',
  report_id: 'chat history, links an exchange to a report for later reading',
  plan_number: 'reports and chat history, read by a client not by a rule',
  // The names OpenRouter's API expects, written from camelCase options.
  max_tokens: "OpenRouter's own field name, written from maxTokens",
  temperature: "OpenRouter's own field name, written from the option",
  // Read by string key in audit-copies.mjs, which no static search can see.
  entryOnSix: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  threeSixesReset: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  refusesOvershoot: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  winsOnExactLanding: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  reportGate: 'read dynamically by audit-copies.mjs via RULE_LABELS',
  rerollOnRepeat: 'read by rollerFor, and dynamically by audit-copies.mjs',
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

console.log(`Checked ${declarations.length} field declarations across ${files.length} files.\n`);

if (unread.length === 0) {
  console.log('Every field has at least one reader.');
} else {
  console.log(`${unread.length} field(s) are written and never read:\n`);
  for (const field of unread) {
    console.log(`  ${field.name}  (${field.kind}, declared in ${field.file})`);
  }
  console.log(
    '\nEither read it, remove it, or add it to WRITE_ONLY with a reason.\n' +
      'A field nobody reads is often a question nobody asked.',
  );
}

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

const uncalled = uncalledExports(exportDeclarations, sources, Object.keys(PUBLIC_API));
const unusedMembers = uncalledExports(memberDeclarations, sources, Object.keys(PUBLIC_MEMBERS));

console.log(
  `\nChecked ${exportDeclarations.length} exports and ${memberDeclarations.length} class members.\n`,
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

console.log(`${ambiguous.length} name(s) are declared in more than one place.\n`);

if (orphaned.length > 0) {
  console.log(`${orphaned.length} of them are not used by the package that declares them:\n`);
  for (const item of orphaned) {
    console.log(`  ${item.name}  (${item.file})`);
  }
  console.log(
    '\nUses are counted by name, so a live caller in one package covers a dead export in\n' +
      'another. That is how the phone app came to write a path no screen read back.\n',
  );
}

if (unusedMembers.length > 0) {
  console.log(`${unusedMembers.length} class member(s) have no caller here:\n`);
  for (const item of unusedMembers) {
    console.log(`  ${item.owner}.${item.name}  (${item.kind}, ${item.file})`);
  }
  console.log(
    '\nA class is exported and its members are not, so this is the half of the surface\n' +
      '`export` cannot see. It is where `reportsFor` hid: a durable sink that kept every\n' +
      'report and answered that it kept nothing.\n',
  );
}

if (uncalled.length === 0) {
  console.log('Every export has at least one caller.');
} else {
  console.log(`${uncalled.length} export(s) have no caller here:\n`);
  for (const item of uncalled) {
    console.log(`  ${item.name}  (${item.kind}, ${item.file})`);
  }
  console.log(
    '\nAn export with no caller is code no caller has disagreed with.\n' +
      'Call it, remove it, or add it to PUBLIC_API with a reason.',
  );
}
