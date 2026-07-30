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

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { declaredFields, unreadFields } from './lib/unread.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SEARCH = [
  'packages/engine/src',
  'packages/content/src',
  'packages/db/src',
  'packages/ai/src',
  'packages/contracts/src',
  'apps/bot/src',
  'apps/miniapp/src',
  'apps/docs/src',
  // The audit scripts are readers too: `detectRules`'s fields are consumed by
  // `audit-copies.mjs`, and omitting it reported them all as unread.
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

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (entry.endsWith('.ts') || entry.endsWith('.mjs')) yield full;
  }
}

const files = [];
for (const dir of SEARCH) {
  const full = join(ROOT, dir);
  try {
    files.push(...walk(full));
  } catch {
    // A package without sources yet is not an error.
  }
}

const sources = files.map((file) => readFileSync(file, 'utf8'));

// Only TypeScript declares the interfaces and tables this is about. The `.mjs`
// scripts are searched as readers, not scanned for declarations: their object
// literals are configuration, not a contract anyone is expected to honour.
const declarations = files.flatMap((file, index) =>
  file.endsWith('.ts') ? declaredFields(sources[index], relative(ROOT, file)) : [],
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
