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
 * A decision in `packages/` is usually asked by the apps rather than by its own
 * package, so `also` names the suites that have to run with it. Without that the
 * count is not wrong so much as incomplete, and an incomplete count of who is
 * defending something reads exactly like a weak defence.
 *
 * Needs: several minutes and a full test run per decision, so it is a tool to
 * be run by hand rather than a gate. CI runs the suites themselves.
 *
 * Run:  node scripts/audit-mutants.mjs [name…]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
  { package: 'packages/engine', file: 'src/game.ts', name: 'hasWon', to: 'true' },
  { package: 'packages/engine', file: 'src/turn.ts', name: 'owesReport', to: 'true' },
  { package: 'packages/engine', file: 'src/turn.ts', name: 'isWaitingToEnter', to: 'false' },
  { package: 'packages/engine', file: 'src/turn.ts', name: 'needsSixToEnter', to: 'true' },
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
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'canRoll', to: 'true' },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'mayThrow', to: "'yes'" },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'lineFor', to: "{ says: 'standing', announcement: null }" },
  { package: 'apps/miniapp', file: 'src/view.ts', name: 'mayStartOver', to: 'true' },
  { package: 'apps/miniapp', file: 'src/reports.ts', name: 'seatOwesReport', to: 'true' },
  { package: 'apps/miniapp', file: 'src/reports.ts', name: 'owingSeat', to: 'null' },
  { package: 'apps/miniapp', file: 'src/seats.ts', name: 'resize', to: '{ seats, created: [] }' },
  { package: 'apps/bot', file: 'src/commands.ts', name: 'afterReport', to: "{ say: 'may-roll' }" },
  { package: 'apps/bot', file: 'src/commands.ts', name: 'buttonsFor', to: 'playingButtons(room.language)' },
  { package: 'apps/bot', file: 'src/take-in.ts', name: 'decideSquare', to: "{ kind: 'unreadable' }" },
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
 */
function mutate(source, name, to) {
  const at = source.search(new RegExp(`export function ${name}\\b`));
  if (at < 0) return null;

  for (let index = source.indexOf('(', at); index < source.length; index += 1) {
    if (source[index] !== '{') continue;

    const restOfLine = source.slice(index + 1, source.indexOf('\n', index));
    if (restOfLine.trim().length > 0) continue;

    return `${source.slice(0, index + 1)}\n  return ${to};${source.slice(index + 1)}`;
  }

  return null;
}

const wanted = process.argv.slice(2);
const chosen = wanted.length > 0 ? DECISIONS.filter((d) => wanted.includes(d.name)) : DECISIONS;

const survived = [];
let checked = 0;

for (const decision of chosen) {
  const path = join(ROOT, decision.package, decision.file);
  const original = readFileSync(path, 'utf8');
  const broken = mutate(original, decision.name, decision.to);

  if (broken === null) {
    survived.push(`${decision.name} — not found in ${decision.file}`);
    continue;
  }

  checked += 1;
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
    writeFileSync(path, original);
  }

  const mark = failed === 0 ? 'NOBODY NOTICED' : `${failed} failed`;
  console.log(`  ${decision.package}/${decision.name} → ${decision.to}: ${mark}`);
  if (failed === 0) survived.push(`${decision.package}/${decision.name}`);
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
