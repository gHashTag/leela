#!/usr/bin/env node
/**
 * Every word a type declares, against the code that says it.
 *
 * `TurnBlockedReason` declared `finished` and `canRoll` returned it nowhere —
 * the only mention of the word in that file was the type. So the check got
 * written three times outside the engine: inline in the bot, in the mini app's
 * own `canRoll`, and in the phone's `isOver`, which asked `isSessionOver` — a
 * different question, true only once *every* player has finished, and at a
 * shared table it would have left the die open to somebody who had arrived.
 *
 * One declaration, three answers, one of them wrong. That is what an
 * unreachable word in a vocabulary costs, and it is cheap to look for.
 *
 * Run:  node scripts/audit-reachable.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeIn, unionsIn, unsaidIn } from './lib/reachable.mjs';
import { workspacePackages } from './lib/claims.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// Found rather than listed: the same ten workspaces `audit-doubles` had nine
// of. See `workspacePackages`.
const read = {
  exists: (path) => existsSync(join(ROOT, path)),
  entries: (path) => readdirSync(join(ROOT, path)),
  isDirectory: (path) => statSync(join(ROOT, path)).isDirectory(),
};

const SOURCES = workspacePackages(read).map((workspace) => workspace.src);

/**
 * Unions whose words arrive from outside, and are therefore never said here.
 *
 * `chatType` is Telegram's, not this repository's: the four values are what a
 * chat can be, and the bot receives one and compares it against `private`. A
 * word it never says is not a word it fails to produce — the producer is on the
 * other side of an API.
 *
 * `role` is the same shape from the other side. `packages/ai` builds the `user`
 * and `system` turns of a prompt; the `assistant` ones are the model's own
 * words, handed back by whoever kept the conversation — the bot's
 * `Conversations.add` is what makes them. A package that never says a word it
 * accepts is not a package failing to produce it.
 *
 * The distinction is the whole of this check. Everything not on this list is
 * something this repository claims to produce.
 */
const RECEIVED = new Set(['chatType', 'role']);

function filesUnder(directory) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return found;
  }

  for (const entry of entries) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else if (/\.tsx?$/.test(entry)) found.push(path);
  }

  return found;
}

const sources = SOURCES.flatMap((source) =>
  filesUnder(join(ROOT, source)).map((path) => ({
    file: relative(ROOT, path),
    code: codeIn(readFileSync(path, 'utf8')),
  })),
);

const unions = sources.flatMap(({ file, code }) => unionsIn(code, file));
const unsaid = unions
  .filter((union) => !RECEIVED.has(union.name))
  .map((union) => ({ union, members: unsaidIn(union, sources) }))
  .filter(({ members }) => members.length > 0);

console.log(
  `\nChecked ${unions.length} string unions across ${sources.length} files, ` +
    `${RECEIVED.size} of them received rather than produced.\n`,
);

if (unsaid.length === 0) {
  console.log('Every word a type declares is a word something says.');
} else {
  for (const { union, members } of unsaid) {
    console.log(`  ${union.name}  (${union.file})`);
    for (const member of members) console.log(`      '${member}' is declared and never said`);
  }
  console.log(
    '\nA vocabulary with an unreachable word reads as though the question is answered\n' +
      'here. It gets answered somewhere else instead, once per surface — and one of\n' +
      'those answers will be different.',
  );
  process.exitCode = 1;
}
