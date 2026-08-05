#!/usr/bin/env node
/**
 * Every assertion is one somebody waited for.
 *
 * `expect(p).resolves.toBe(x)` returns a promise. Dropped on the floor, nothing
 * in the test waits on it.
 *
 * It is worth being exact about what that costs, because the obvious sentence —
 * *the assertion checks nothing* — is false here, and was measured to be false
 * rather than assumed. Breaking one on purpose (`toBe(null)` changed to a value
 * no game can hold) does fail the test today: Vitest auto-awaits assertions
 * left hanging when a test ends. What it prints alongside is the finding:
 *
 *     Promise returned by `expect(actual).resolves.toBe(expected)` was not
 *     awaited. Vitest currently auto-awaits hanging assertions at the end of
 *     the test, but this will cause the test to fail in Vitest 3.
 *
 * So the defect is not a dead check. It is a live check standing on a rescue
 * its own runner has announced it is removing — correct today, failing on the
 * next major whether or not the code under it is right, and silent about the
 * difference in between.
 *
 * Found by reading `bun run verify`'s own output rather than its exit code.
 * `verify` exited 0 with 3,012 tests green, and printed that warning six times
 * from `apps/mobile`. All six came from one site, `tests/kept-game.test.ts`,
 * looping over six malformed payloads:
 *
 *     // eslint-disable-next-line no-await-in-loop
 *     expect(loadKeptGame(device).then((k) => k.game), rubbish).resolves.toBe(null);
 *
 * The comment is the fingerprint. Somebody wrote `await`, the lint rule refused
 * it inside a loop, and the `await` came off while the line excusing it stayed
 * — leaving a suppression above a statement it no longer suppresses, and six
 * malformed-input cases that could not fail.
 *
 * The rule this makes checkable: **an assertion whose result is discarded is
 * not an assertion.** Asserted as a shape, not as those six: any `.resolves` or
 * `.rejects` anywhere under a workspace's tests, in any file, is read for
 * whether something waits on it.
 *
 * Read with the TypeScript parser, not a regular expression. The three sites in
 * `apps/bot` that a line-oriented grep reports are all correct — their `await`
 * sits on an earlier line — and a check that names three innocents to catch one
 * defect is one somebody switches off.
 *
 * Waited for means: `await` it, `return` it, or put it where an `await`ed or
 * `return`ed expression collects it (`Promise.all([...])` is the common one).
 * Assigning it to a name also counts: the value was captured, and what happens
 * to it afterwards is a question this check does not pretend to answer.
 *
 * Run:  node scripts/audit-awaited.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { floatingAssertions } from './lib/awaited.mjs';
import { workspacePackages } from './lib/claims.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const read = {
  exists: (path) => existsSync(join(ROOT, path)),
  entries: (path) => readdirSync(join(ROOT, path)),
  isDirectory: (path) => statSync(join(ROOT, path)).isDirectory(),
};

/** Every `.ts`/`.tsx` file under a directory, however deep. */
function sourceFilesUnder(absolute) {
  if (!existsSync(absolute)) return [];
  const found = [];
  for (const entry of readdirSync(absolute).sort()) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFilesUnder(path));
    } else if (/\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

const workspaces = workspacePackages(read).filter((workspace) => workspace.tests);
const findings = [];
let filesRead = 0;

for (const workspace of workspaces) {
  for (const path of sourceFilesUnder(join(ROOT, workspace.tests))) {
    filesRead += 1;
    for (const finding of floatingAssertions(readFileSync(path, 'utf8'), path)) {
      findings.push({ file: relative(ROOT, path), ...finding });
    }
  }
}

console.log(
  `audit-awaited: ${filesRead} test file(s) across ${workspaces.length} workspace(s) with tests`,
);

if (findings.length === 0) {
  console.log('  every .resolves/.rejects assertion is awaited, returned or collected');
  process.exit(0);
}

console.error(`\n  ${findings.length} assertion(s) nothing waits on:\n`);
for (const finding of findings) {
  console.error(`    ${finding.file}:${finding.line}`);
  console.error(`      ${finding.text}`);
}
console.error(
  '\n  Each returns a promise nothing waits on. Vitest still auto-awaits these',
);
console.error(
  '  at the end of the test and warns that it will stop, so the assertion is',
);
console.error(
  '  correct today and fails on the next major whether or not the code under',
);
console.error(
  '  it is right. Await it, return it, or collect it into a Promise.all that',
);
console.error('  is itself awaited or returned.');
process.exit(1);
