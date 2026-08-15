#!/usr/bin/env node
/**
 * Which decisions the tests would not notice the loss of.
 *
 * Three passes running, a test of mine had to be corrected before it was worth
 * anything, and each time for the same reason: **the interesting case never
 * occurred.** A property test that plays four games and checks the keyboard at
 * a moment when nobody owes a report is a test that stays green with the whole
 * rule deleted. A table that asserts two answers *differ* passes when both are
 * wrong. A loop that stops at `isSessionOver` never reaches the account that
 * ends a game.
 *
 * None of those were caught by reading. They were caught by breaking the code
 * on purpose and watching what went red — which is a thing a script can do.
 *
 * So this breaks each decision in turn, runs the suite that owns it, and
 * reports the ones nothing noticed. A decision no test defends is a decision
 * that is not, in any useful sense, tested.
 *
 * The mutation is deliberately crude — the first `return` of the function is
 * replaced by a constant — because a crude break that survives is a stronger
 * finding than a subtle one that does not.
 *
 * A boolean is broken **both ways**, and that is not a nicety. `stripFrontmatter`
 * and `descriptionIsRedundant` each looked like they had a single defender, and
 * both turned out to be tested four ways: three of the four cases expect the
 * value the mutation happened to pick, so only one could notice. One direction
 * measures the tests' agreement with a guess rather than their coverage.
 *
 * A decision in `packages/` is usually asked by the apps rather than by its own
 * package, so `also` names the suites that have to run with it. Without that the
 * count is not wrong so much as incomplete, and an incomplete count of who is
 * defending something reads exactly like a weak defence.
 *
 * Needs: several minutes and a full test run per decision, so it is a tool to
 * be run by hand rather than a gate. CI runs the suites themselves.
 *
 * Run:  node scripts/audit-mutants.mjs [name…]
 *
 * To only put back what a stopped run left behind, and break nothing new:
 *
 *       node scripts/audit-mutants.mjs --restore
 *
 * `--help` prints the same usage the script prints when it refuses an argument
 * it does not know. It refuses rather than ignores, because an ignored flag left
 * no names behind, and no names means every decision — see `readArgv` in
 * `lib/undo.mjs`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { putItBack, putItBackOrRewrite, readArgv, remember, usage } from './lib/undo.mjs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/**
 * The decisions worth defending, and what to break them to.
 *
 * Every one of these answers a question some surface asks about a player or a
 * record. They are the functions whose being wrong has cost this project a
 * defect before.
 */
const DECISIONS = [
  { package: 'packages/engine', file: 'src/game.ts', name: 'hasWon', to: ['true', 'false'] },
  { package: 'packages/engine', file: 'src/turn.ts', name: 'owesReport', to: ['true', 'false'] },
  { package: 'packages/engine', file: 'src/turn.ts', name: 'isWaitingToEnter', to: ['false', 'true'] },
  { package: 'packages/engine', file: 'src/turn.ts', name: 'needsSixToEnter', to: ['true', 'false'] },
  {
    package: 'packages/journal',
    file: 'src/index.ts',
    name: 'revisited',
    to: '[]',
    also: ['apps/miniapp', 'apps/bot'],
  },
  {
    package: 'packages/journal',
    file: 'src/index.ts',
    name: 'writingsOn',
    to: '[]',
    also: ['apps/miniapp'],
  },
  {
    package: 'packages/journal',
    file: 'src/index.ts',
    name: 'parseSquare',
    to: 'null',
    also: ['apps/miniapp', 'apps/bot'],
  },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'standing', to: "{ key: 'app.opening' }" },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'canRoll', to: ['true', 'false'] },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'mayThrow', to: "'yes'" },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'lineFor', to: "{ says: 'standing', announcement: null }" },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'mayStartOver', to: ['true', 'false'] },
  { package: 'apps/miniapp', file: 'src/reports.ts', name: 'seatOwesReport', to: ['true', 'false'] },
  { package: 'apps/miniapp', file: 'src/reports.ts', name: 'owingSeat', to: 'null' },
  { package: 'apps/miniapp', file: 'src/seats.ts', name: 'resize', to: '{ seats, created: [] }' },
  { package: 'apps/bot', file: 'src/commands.ts', name: 'afterReport', to: "{ say: 'may-roll' }" },
  { package: 'apps/bot', file: 'src/commands.ts', name: 'buttonsFor', to: 'playingButtons(room.language)' },
  { package: 'apps/bot', file: 'src/take-in.ts', name: 'decideSquare', to: "{ kind: 'unreadable' }" },
  { package: 'apps/bot', file: 'src/take-in.ts', name: 'decide', to: "{ kind: 'unreadable' }" },

  // The three quarters of the code the first sweep never looked at. A decision
  // is a decision whether or not it has cost a defect yet.
  { package: 'packages/db', file: 'src/legacy.ts', name: 'stateFromLegacy', to: 'initialState()' },
  { package: 'packages/db', file: 'src/mapping.ts', name: 'canPlayerRoll', to: '{ allowed: true, reason: null, nextAllowedAt: null, waitMs: 0 }' },
  { package: 'packages/db', file: 'src/mapping.ts', name: 'turnContextFromPlayer', to: '{ reportSubmitted: true, lastRollAt: null, lastReportAt: null, now }' },
  { package: 'packages/db', file: 'src/mapping.ts', name: 'rulesForPlayer', to: 'DEFAULT_RULESET' },
  { package: 'packages/db', file: 'src/mapping.ts', name: 'sessionFromRows', to: 'null' },
  { package: 'packages/contracts', file: 'src/verify.ts', name: 'compareBoards', to: '[]' },
  { package: 'packages/contracts', file: 'src/verify.ts', name: 'compareConstants', to: '[]' },
  { package: 'packages/contracts', file: 'src/verify.ts', name: 'parseContract', to: '{ jumps: new Map(), constants: new Map() }' },
  // Not a crude constant like the rest: this one is the record `parseSixes`
  // used to return for a source it could read nothing of — `resetsAt: null` and
  // four `false`s, with no `branchesRead` on it. That record is byte for byte
  // what a lawful contract-without-the-rule produces, so `compareSixes` said
  // nothing and `describeDivergences` printed agreement about a contract nobody
  // had managed to read. Breaking it to the *old* value rather than to `null`
  // is the point: `null` would throw and every test would go red for the wrong
  // reason, while this is the exact silence the readability state exists to end.
  {
    package: 'packages/contracts',
    file: 'src/verify.ts',
    name: 'parseSixes',
    to: '{ runAfterEntry: null, fallbackWrittenOnEverySix: false, resetsAt: null, resetReturnsToFallback: false, resetSkipsTheMove: false }',
  },
  { package: 'packages/ai', file: 'src/prompts.ts', name: 'summariseReturns', to: "''" },
  { package: 'packages/ai', file: 'src/prompts.ts', name: 'summariseJourney', to: "''" },
  { package: 'packages/ai', file: 'src/prompts.ts', name: 'trimToParagraph', to: 'text' },
  { package: 'packages/ai', file: 'src/guide.ts', name: 'fallbackText', to: "'…'" },
  { package: 'apps/docs', file: 'src/render.ts', name: 'descriptionIsRedundant', to: ['true', 'false'] },
  { package: 'apps/docs', file: 'src/build.ts', name: 'stripFrontmatter', to: 'text' },
  { package: 'apps/docs', file: 'src/render.ts', name: 'escape', to: 'text' },

  // The decisions the last ten passes added. Every one of them was written
  // because a surface had answered a question for itself and got it wrong, and
  // not one was in this list — so the closing sentence below, *every one of
  // them was defended by something*, was true of forty-two decisions and read
  // as a sentence about the code.
  {
    package: 'packages/journal',
    file: 'src/index.ts',
    name: 'merged',
    to: '{ entries: [...existing], added: 0, dropped: 0 }',
    also: ['apps/miniapp', 'apps/mobile'],
  },
  {
    package: 'packages/journal',
    file: 'src/index.ts',
    name: 'writerHint',
    to: 'null',
    also: ['apps/miniapp', 'apps/mobile'],
  },
  {
    package: 'packages/content',
    file: 'src/describe.ts',
    name: 'describeMove',
    to: "''",
    also: ['apps/miniapp', 'apps/mobile'],
  },
  {
    package: 'packages/content',
    file: 'src/wait.ts',
    name: 'formatWait',
    to: "''",
    also: ['apps/bot'],
  },
  { package: 'packages/engine', file: 'src/turn.ts', name: 'waitParts', to: 'null' },
  { package: 'apps/bot', file: 'src/commands.ts', name: 'mayEnd', to: ['true', 'false'] },
  { package: 'apps/miniapp', file: 'src/journal-file.ts', name: 'taking', to: '{ journal, added: 0, dropped: 0 }' },
  { package: 'apps/miniapp', file: 'src/state.ts', name: 'forgetIntention', to: ['true', 'false'] },

  // The two readings the audits themselves rest on. They live in `scripts/lib`
  // rather than in a package — reached from `packages/content`, which is where
  // the tests that own them are — and a check whose reading is wrong reports
  // whatever it likes about the dataset while staying green.
  {
    package: 'packages/content',
    file: '../../scripts/lib/spillover.mjs',
    name: 'spilloverAt',
    to: 'null',
  },
  {
    package: 'packages/content',
    file: '../../scripts/lib/untranslated.mjs',
    name: 'untranslatedIn',
    to: '[]',
  },

  // Rules three surfaces ask, and the readings a shared file rests on. The
  // list above grew by what had cost a defect; these are the ones that would
  // cost the same kind and had not yet.
  {
    package: 'packages/engine',
    file: 'src/turn.ts',
    name: 'countsAsReport',
    to: ['true', 'false'],
    also: ['apps/miniapp', 'apps/mobile', 'apps/bot'],
  },
  {
    package: 'packages/journal',
    file: 'src/index.ts',
    name: 'isIntention',
    to: ['true', 'false'],
    also: ['apps/miniapp', 'apps/mobile', 'apps/bot'],
  },
  {
    package: 'packages/journal',
    file: 'src/index.ts',
    name: 'parseDocument',
    to: 'null',
    also: ['apps/miniapp', 'apps/mobile', 'apps/bot'],
  },
  {
    package: 'packages/journal',
    file: 'src/index.ts',
    name: 'newEntries',
    to: '[]',
    also: ['apps/mobile', 'apps/bot'],
  },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'mayWrite', to: ['true', 'false'] },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'mayAsk', to: ['true', 'false'] },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'fitsHandOver', to: ['true', 'false'] },
  {
    package: 'apps/miniapp',
    file: 'src/view.ts',
    name: 'mayLeaveTheQuestion',
    to: ['true', 'false'],
  },

  // The phone, which had nothing in this list at all. A whole surface's
  // decisions, and the one that reads *which square may be written about* is
  // the one this repository has met the parking square through twice.
  { package: 'apps/mobile', file: 'src/game.ts', name: 'squareToRead', to: 'null' },
  { package: 'apps/mobile', file: 'src/game.ts', name: 'owesAnAccount', to: ['true', 'false'] },
  { package: 'apps/mobile', file: 'src/game.ts', name: 'isOver', to: ['true', 'false'] },
  { package: 'apps/mobile', file: 'src/game.ts', name: 'mayThrow', to: "'yes'" },
  { package: 'apps/mobile', file: 'src/journal.ts', name: 'mayChangeIntention', to: ['true', 'false'] },
  { package: 'apps/mobile', file: 'src/journal.ts', name: 'pathOf', to: '{ entries: [], returns: [] }' },
  { package: 'apps/mobile', file: 'src/journal.ts', name: 'draftFor', to: "''" },

  // A book half in one language and half in another, and where a reply goes.
  {
    package: 'packages/content',
    file: 'src/index.ts',
    name: 'bookFrom',
    to: '[...chapters]',
    also: ['apps/miniapp'],
  },
  { package: 'packages/content', file: 'src/languages.ts', name: 'writtenIn', to: ['true', 'false'] },
  { package: 'apps/bot', file: 'src/delivery.ts', name: 'destinationFor', to: "{ kind: 'chat' }" },
];

/**
 * Put a `return <constant>` at the top of a function's body.
 *
 * Finding the body is the whole of the difficulty, and both of this script's
 * first two "nobody noticed" results were this function being wrong rather than
 * a test being weak — which is exactly the failure it exists to catch, so it is
 * written down here rather than quietly fixed.
 *
 * A generic signature does not start with `(`: `owingSeat<T extends …>(` was
 * reported as missing from a file it is in. And a return type may itself
 * contain a brace — `): { plan: number } | null {` — so the first `{` after the
 * parameters is not the body. A body's brace is the one with nothing after it
 * on its line.
 *
 * The third was the worst, because it made this script *lie in the direction it
 * exists to prevent*. A parameter may be an inline object type written across
 * several lines:
 *
 *     export function needsSixToEnter(event: {
 *       isBlocked: boolean;
 *
 * that opening brace also has nothing after it on its line, so the `return` went
 * inside the type — where nothing checks types, so it was stripped and the
 * function ran unchanged. The report read **"NOBODY NOTICED"** for a decision
 * five tests defend. So the parameter list is skipped by counting brackets
 * before any brace is considered at all.
 */
function mutate(source, name, to) {
  const at = source.search(new RegExp(`export function ${name}\\b`));
  if (at < 0) return null;

  // Past the parameters first, whatever they contain.
  let index = source.indexOf('(', at);
  for (let depth = 0; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    if (source[index] === ')') depth -= 1;
    if (depth === 0) break;
  }

  for (; index < source.length; index += 1) {
    if (source[index] !== '{') continue;

    const restOfLine = source.slice(index + 1, source.indexOf('\n', index));
    if (restOfLine.trim().length > 0) continue;

    return `${source.slice(0, index + 1)}\n  return ${to};${source.slice(index + 1)}`;
  }

  return null;
}

/**
 * The arguments, which are decision names and two flags.
 *
 * `--restore` puts back what a stopped run left and stops there. It exists
 * because the recovery this repository prints everywhere used to be the bare
 * sweep: the restore happens first, prints *Put back what a stopped run had
 * broken*, and then several minutes of fresh mutations begin. Somebody who read
 * the message, ran it, saw the line they were told to expect and pressed Ctrl-C
 * was left with a NEW mutation in a DIFFERENT file — the same defect the
 * message was curing, moved. `lib/undo.mjs`'s `RECOVERY` now names this flag,
 * so the printed command does the one thing it says.
 *
 * `--mutation-note` moves where the note lives, the same seam
 * `build-content.mjs` and `audit-scripts.mjs` carry: a test may drive the
 * restore path, and a test that wrote `scripts/.mutants-undo.json` would block
 * every build on the machine, including the one that recovers from it.
 *
 * Names are filtered out of the flags by hand rather than by a parser, and the
 * value after `--mutation-note` is dropped explicitly — a path that survived
 * into the names would silently select no decisions, which reads like a clean
 * sweep of nothing.
 *
 * **That hand-filtering used to discard anything else it saw, and discarding is
 * the one thing it must not do.** The expression was
 * `args.filter((arg) => !arg.startsWith('--'))`, so an unknown flag left no
 * trace; no names left means *the operator named no decisions*; and that means
 * the whole table. `--help`, `--dry-run`, `--list`, a typo'd `--restor` were
 * therefore each indistinguishable from the bare command, which edits shipped
 * source in place for several minutes — in the script whose stopped runs have
 * cost this project an hour twice, and which is the one command the standing
 * operator note tells people to type by name. There was no `--help` handler in
 * the file at all, so the first thing anybody tries on an unfamiliar tool was
 * the destructive sweep with no output to say so.
 *
 * The reading now lives in `lib/undo.mjs` as `readArgv`, a pure function over
 * argv, and it is allowed to refuse: `packages/content/tests/undo.test.ts`
 * drives a generated grid of flag-shaped tokens through it and holds the one
 * invariant that matters — an argv it does not understand in full never reaches
 * the shape that mutates everything. The usage it prints is built from the same
 * `RECOVERY` constant every other message in this repository prints, so there
 * is still exactly one spelling of the way out.
 */
const argv = readArgv(
  process.argv.slice(2),
  DECISIONS.map((decision) => decision.name),
);

if (argv.kind === 'usage') {
  console.log(usage());
  // Not zero, and deliberately. This script's exit code answers *did a sweep
  // run and was every decision defended*; printing a usage text is not that,
  // and a caller that reads 0 as a clean sweep must not be told one happened.
  process.exit(2);
}

if (argv.kind === 'refused') {
  console.error(`\nThis does not know: ${argv.unknown.join(' ')}\n`);
  console.error(usage());
  process.exit(2);
}

const { restoreOnly, names } = argv;
const chosen = names.length > 0 ? DECISIONS.filter((d) => names.includes(d.name)) : DECISIONS;

const survived = [];
let checked = 0;

/**
 * The file this script has broken on purpose right now, and how to undo it.
 *
 * `finally` restores after each mutation, and a `finally` does not run when the
 * process is killed. This script was interrupted by a timeout mid-run and left
 * `return { kind: 'chat' };` at the top of `destinationFor` in a shipped file —
 * seven tests failed afterwards for a reason that had nothing to do with the
 * code, and a commit made without running them would have shipped it.
 *
 * A script that edits the repository on purpose has to survive being stopped.
 * The handlers are registered once and the state is one file, because only one
 * is ever broken at a time.
 */
const UNDO = argv.notePath ?? join(HERE, '.mutants-undo.json');

// Whatever the last run left behind, before this one reads a single file: the
// mutation is *in* the source it is about to copy.
const leftBroken = putItBack(UNDO);

if (leftBroken === null) {
  // Only worth saying when somebody asked for a restore and there was nothing
  // to restore. In a sweep this is the ordinary case and silence is right.
  if (restoreOnly) console.log('Nothing to put back: no stopped run left a note.');
} else if (leftBroken.restored !== null) {
  console.log(`Put back what a stopped run had broken: ${relative(ROOT, leftBroken.restored)}\n`);
} else {
  // The note is there and will not parse, so which file is broken is not
  // knowable from it — and the note is deliberately left on disk, because it
  // holds the only copy of the original text. See `lib/undo.mjs`.
  console.error('\nA stopped run left a note that will not parse, so this cannot name the file.');
  console.error(`  Note:             ${leftBroken.note}`);
  console.error(`  Put it back with: ${leftBroken.recovery}\n`);
  process.exit(1);
}

// Restore and nothing else. Deliberately before a single decision is read: the
// whole point of the flag is that the command a message prints does not go on
// to break something new.
if (restoreOnly) process.exit(0);

for (const decision of chosen) {
  const path = join(ROOT, decision.package, decision.file);
  const original = readFileSync(path, 'utf8');

  for (const to of Array.isArray(decision.to) ? decision.to : [decision.to]) {
  const broken = mutate(original, decision.name, to);

  if (broken === null) {
    survived.push(`${decision.name} — not found in ${decision.file}`);
    continue;
  }

  checked += 1;
  remember(UNDO, path, original);
  writeFileSync(path, broken);

  let failed = 0;
  try {
    for (const suite of [decision.package, ...(decision.also ?? [])]) {
      try {
        execFileSync('npx', ['vitest', 'run'], {
          cwd: join(ROOT, suite),
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (error) {
        const output = String(error.stdout ?? '');
        failed += Number(/Tests\s+(\d+) failed/.exec(output)?.[1] ?? 1);
      }
    }
  } finally {
    // Loud rather than silent, and that is a change of manner rather than of
    // policy. `putItBack` used to throw on a note it could not read, which at
    // least stopped the sweep where it stood; it now returns instead, so a
    // restore that did not happen has to stop the sweep explicitly. Carrying
    // on would break a second file on top of a first that is still broken,
    // and the note only ever describes one.
    //
    // The two failure arms used to be handled backwards. The unreadable note —
    // the recoverable one, since the note still holds the original — printed a
    // command, and the note being GONE printed `The note is gone.`, no command
    // and no write, while the only surviving copy of the original sat in
    // `original` one line above. Under the sentence *stopping before anything
    // else is broken*, which reads as an all-clear at the moment shipped source
    // is wrong on disk with nothing pointing at it. `putItBackOrRewrite` now
    // uses that copy, and neither remaining message says the tree is fine.
    const outcome = putItBackOrRewrite(UNDO, { path, original });

    if (outcome.kind === 'rewritten') {
      console.error(`\n${relative(ROOT, path)} was broken on purpose by this run and the note that said so is gone.`);
      console.error('  The original text was still in memory here, so it has been written back.');
      console.error(`  Check that for yourself: ${outcome.check}`);
      console.error('  Nothing further was mutated. The sweep stops here rather than trusting itself.');
      process.exit(1);
    }

    if (outcome.kind === 'unrestored') {
      console.error(`\n${relative(ROOT, path)} IS STILL BROKEN ON DISK. This run mutated it and could not put it back.`);
      if (outcome.why !== null) console.error(`  The write failed: ${outcome.why}`);
      console.error(`  Put it back with: ${outcome.recovery}`);
      process.exit(1);
    }
  }

  const mark = failed === 0 ? 'NOBODY NOTICED' : `${failed} failed`;
  console.log(`  ${decision.package}/${decision.name} → ${to}: ${mark}`);
  if (failed === 0) survived.push(`${decision.package}/${decision.name} → ${to}`);
  }
}

console.log(`\nBroke ${checked} decisions on purpose.\n`);

if (survived.length === 0) {
  console.log('Every one of them was defended by something.');
} else {
  console.log('Nothing noticed the loss of:');
  for (const name of survived) console.log(`  ${name}`);
  console.log('\nA decision no test defends is a decision that is not tested.');
  process.exitCode = 1;
}
