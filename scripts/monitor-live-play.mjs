#!/usr/bin/env bun
/**
 * What the live game is doing to the people playing it.
 *
 *     bun run monitor:play
 *
 * The twenty-eight `audit-*.mjs` scripts ask whether the source is consistent
 * with itself, and on 2026-09-03 every one of them was green while production
 * said the game had been thrown seven times in its life and six of those
 * throws moved nothing. **No source audit could have found that**, because
 * nothing is wrong with the source. This is the other half.
 *
 * Split the same way `monitor-live-game.mjs` is split, and for the same reason.
 * The local half opens no database and holds no secret; it asks Railway to run
 * the inside half in the live container, and the inside half hashes every
 * player id before the verdict is even built, so what crosses stdout is
 * `player a3f1` rather than a Telegram account. The one check that needs the
 * service log rather than the database runs locally, on the log, because the
 * container cannot read its own log stream.
 *
 * Exit: 0 nothing to report, 1 something to fix, 2 could not measure — never a
 * pass. A monitor that answers 0 when it failed to look is worse than none.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import { findings, report } from '../apps/bot/src/live-play-monitor.ts';

const inside = process.argv.includes('--inside');

/** Short, stable, and not reversible to a Telegram id. */
const anon = (id) => `player ${createHash('sha256').update(String(id)).digest('hex').slice(0, 4)}`;

if (inside) {
  const { openDatabase } = await import('../apps/bot/src/sqlite.ts');
  const path = process.env.LEELA_DB ?? '';
  if (path === '') {
    console.log('UNKNOWN — LEELA_DB is not set in the container.');
    process.exit(2);
  }

  const db = openDatabase(path);
  const rows = (sql) => db.prepare(sql).all();

  const free = Number(process.env.LEELA_STARS_MONTH ?? '') > 0 ? 3 : null;

  const snapshot = {
    throws: rows(
      'SELECT user_id, roll, from_plan, to_plan, created_at FROM game_steps ORDER BY created_at',
    ).map((r) => ({
      userId: anon(r.user_id),
      roll: Number(r.roll),
      fromPlan: Number(r.from_plan),
      toPlan: Number(r.to_plan),
      at: Number(r.created_at),
    })),
    tables: rows('SELECT id, roll_count, updated_at FROM sessions').map((r) => ({
      id: anon(r.id),
      rollCount: Number(r.roll_count),
      updatedAt: Number(r.updated_at),
    })),
    entitlements: rows('SELECT user_id, until, refunded_at FROM entitlements').map((r) => ({
      userId: anon(r.user_id),
      until: Number(r.until),
      refundedAt: r.refunded_at === null ? null : Number(r.refunded_at),
    })),
    funnel: rows(
      'SELECT user_id, trial_at, paywall_at, invoice_at, purchase_at FROM payment_funnel',
    ).map((r) => ({
      userId: anon(r.user_id),
      trialAt: r.trial_at === null ? null : Number(r.trial_at),
      paywallAt: r.paywall_at === null ? null : Number(r.paywall_at),
      invoiceAt: r.invoice_at === null ? null : Number(r.invoice_at),
      purchaseAt: r.purchase_at === null ? null : Number(r.purchase_at),
    })),
    // The container cannot read its own log stream; the local half does that.
    log: [],
    freeMoves: free,
    now: Date.now(),
  };

  const found = findings(snapshot);
  console.log(`SCANNED — throws ${snapshot.throws.length}, tables ${snapshot.tables.length}, subscriptions ${snapshot.entitlements.length}, funnel rows ${snapshot.funnel.length}`);
  for (const line of report(found)) console.log(line);
  process.exit(found.length === 0 ? 0 : 1);
}

// ── The local half ───────────────────────────────────────────────────────────

const remote = spawnSync(
  'railway',
  ['ssh', 'bun', 'run', 'scripts/monitor-live-play.mjs', '--inside'],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 120_000 },
);

if (remote.error || remote.status === null) {
  console.log('UNKNOWN — Railway did not run the play monitor. Nothing was measured.');
  process.exit(2);
}

const fromDatabase = (remote.stdout ?? '')
  .split(/\r?\n/)
  .filter((l) => l.trim() !== '' && !/^warning:|^ *→ Migrate|^Existing files|^Using SSH/.test(l));

if (!fromDatabase.some((l) => l.startsWith('SCANNED — '))) {
  console.log('UNKNOWN — the inside half printed no scan line, so the database was never read.');
  process.exit(2);
}

// The one check that lives in the log rather than the database. Given a
// snapshot with nothing but log lines, every database check declines to speak,
// which is the property its own test pins.
const logs = spawnSync('railway', ['logs'], { encoding: 'utf8', timeout: 25_000 });
const lines = (logs.stdout ?? '').split(/\r?\n/).filter((l) => l.trim() !== '');
const fromLog = lines.length === 0
  ? []
  : report(
      findings({
        throws: [], tables: [], entitlements: [], funnel: [],
        log: lines, freeMoves: null, now: Date.now(),
      }),
    ).filter((l) => !l.startsWith('live play: nothing to report'));

for (const line of fromDatabase) console.log(line);
if (lines.length === 0) console.log('note: no log lines were captured, so the companion was not checked.');
for (const line of fromLog) console.log(line);

const problems = remote.status === 1 || fromLog.length > 0;
process.exit(problems ? 1 : 0);
