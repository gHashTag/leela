#!/usr/bin/env bun
/**
 * Compare one live signed Mini App game with the active Railway database.
 *
 *     bun scripts/monitor-live-game.mjs
 *
 * The local half opens no database and reads no secret; it asks Railway to run
 * the inside half in the active container. The inside half prints only the
 * pure verdict. Player ids, BOT_TOKEN, signed init data, and response bodies
 * never cross stdout or stderr.
 */

import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

import {
  liveGameExitCode,
  liveGamePlayerIsActive,
  liveGameRemoteExitCode,
  liveGameVerdict,
} from '../apps/bot/src/live-game-monitor.ts';
import { openDatabase } from '../apps/bot/src/sqlite.ts';
import { offering } from '../apps/bot/src/stars.ts';

const inside = process.argv.includes('--inside');

if (!inside) {
  const remote = spawnSync(
    'railway',
    ['ssh', 'bun', 'run', 'scripts/monitor-live-game.mjs', '--inside'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 60_000 },
  );
  if (remote.error || remote.status === null) {
    console.log('UNKNOWN — Railway did not run the signed game monitor.');
    process.exit(2);
  }

  const exitCode = liveGameRemoteExitCode(remote.status, remote.stdout);
  const label = exitCode === 0 ? 'PASS' : exitCode === 1 ? 'FAIL' : 'UNKNOWN';
  const line = remote.stdout.split(/\r?\n/).find((candidate) => candidate.startsWith(`${label} — `));
  if (remote.status === exitCode && line) {
    console.log(line);
  } else {
    console.log('UNKNOWN — Railway did not return a valid signed game verdict.');
  }
  // Railway CLI diagnostics are useful only when the adapter itself failed;
  // never forward the container's stderr or an arbitrary exit status.
  if (exitCode === 2 && remote.status !== 2 && remote.stderr.trim() !== '') {
    console.error('Railway monitor command failed before a clean verdict.');
  }
  process.exit(exitCode);
}

const token = process.env.BOT_TOKEN ?? '';
const databasePath = process.env.LEELA_DB ?? '';
const domain = process.env.RAILWAY_PUBLIC_DOMAIN ?? '';

if (token === '' || databasePath === '' || domain === '') {
  console.log('UNKNOWN — the active container lacks a token, database path, or public domain.');
  process.exit(2);
}

/** Telegram's documented Mini App signature, kept local to this process. */
function signedLaunch(userId) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'leela-production-monitor',
    user: JSON.stringify({ id: userId }),
  };
  const checked = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(checked).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function request(url, init) {
  const stopped = new AbortController();
  const timer = setTimeout(() => stopped.abort(), 15_000);
  try {
    const response = await fetch(url, { ...init, signal: stopped.signal });
    let body = null;
    if (response.status === 200) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    }
    return { status: response.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let db;
try {
  db = openDatabase(databasePath);
  const players = db
    .prepare(
      `SELECT p.user_id AS user_id, p.plan AS plan, p.previous_plan AS previous_plan,
              p.direction AS direction, p.consecutive_sixes AS consecutive_sixes,
              p.position_before_three_sixes AS position_before_three_sixes,
              p.is_finished AS is_finished, s.language AS language
         FROM session_players p
         JOIN sessions s ON s.id = p.session_id
        ORDER BY COALESCE(s.updated_at, 0) DESC, p.seat ASC`,
    )
    .all();

  // The public route resolves a player's newest table. Never fall through to
  // an older game for that same player after their newest one has completed.
  const seen = new Set();
  const player = players.find((candidate) => {
    if (!candidate || typeof candidate.user_id !== 'string' || seen.has(candidate.user_id)) {
      return false;
    }
    seen.add(candidate.user_id);
    return liveGamePlayerIsActive({
      loka: Number(candidate.plan),
      previous_loka: Number(candidate.previous_plan),
      direction: String(candidate.direction),
      consecutive_sixes: Number(candidate.consecutive_sixes),
      position_before_three_sixes: Number(candidate.position_before_three_sixes),
      is_finished: Boolean(candidate.is_finished),
    });
  });

  if (!player || typeof player.user_id !== 'string') {
    console.log('UNKNOWN — no active seated player exists to probe.');
    process.exit(2);
  }

  const movedRow = db
    .prepare(
      'SELECT COUNT(*) AS count FROM game_steps WHERE user_id = ? AND from_plan <> to_plan',
    )
    .get(player.user_id);
  const entitledRow = db
    .prepare(
      `SELECT MAX(until) AS until FROM entitlements
        WHERE user_id = ? AND refunded_at IS NULL AND until > ?`,
    )
    .get(player.user_id, Date.now());

  const expected = {
    plan: Number(player.plan),
    language: String(player.language),
    moved: Number(movedRow?.count ?? 0),
    entitled: typeof entitledRow?.until === 'number',
    canSubscribe: offering(process.env) !== null,
  };
  const initData = signedLaunch(player.user_id);
  const url = `https://${domain}/api/game`;

  const [signed, badSignature, foreignOrigin] = await Promise.all([
    request(url, { method: 'GET', headers: { authorization: `tma ${initData}` } }),
    request(url, { method: 'GET', headers: { authorization: 'tma invalid' } }),
    request(url, {
      method: 'GET',
      headers: { authorization: `tma ${initData}`, origin: 'https://foreign.invalid' },
    }),
  ]);

  const verdict = liveGameVerdict({
    expected,
    signed,
    badSignatureStatus: badSignature?.status ?? null,
    foreignOriginStatus: foreignOrigin?.status ?? null,
  });
  const label = verdict.state === 'passing' ? 'PASS' : verdict.state === 'failing' ? 'FAIL' : 'UNKNOWN';
  console.log(`${label} — ${verdict.why}.`);
  process.exit(liveGameExitCode(verdict.state));
} catch {
  console.log('UNKNOWN — the production state comparison could not complete.');
  process.exit(2);
} finally {
  db?.close();
}
