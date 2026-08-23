/**
 * Rooms that survive a restart.
 *
 * `RoomQueries` had no implementation, so the bot announced on every start that
 * games in progress would be lost. This is the smallest thing that fixes it:
 * SQLite, built into Node, no dependency and no server to run.
 *
 * The columns mirror `sessions` and `session_players` in `@leela/db`, so a
 * later move to Postgres is a change of driver rather than of shape.
 */

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { gameStepRow } from '@leela/db';
import { hasWon } from '@leela/engine';
import type { NewGameStepRow, SessionPlayerRow, SessionRow } from '@leela/db';
import type { RoomQueries, StoredSeat, StoredSession } from './persistence';
import { extendedTo } from './stars';
import {
  NEVER_NUDGED,
  type Entitlement,
  type EntitlementStore,
  type NudgeRecord,
  type NudgeStore,
  type Subscription,
} from './store';

/**
 * `node:sqlite` is newer than Vite's list of Node builtins, so a static import
 * makes the bundler try to resolve it as a file and fail. Loading it through
 * `createRequire` keeps it out of the transform entirely.
 */
interface Statement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}

export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

/**
 * Node ships `node:sqlite`; Bun ships `bun:sqlite` and has no `node:sqlite` at
 * all. The bot runs under Bun and the tests under Node, so both are tried.
 * Their prepared-statement APIs agree on `get`, `all`, `run` and `exec`, which
 * is everything used here.
 */
export function openDatabase(path: string): Database {
  const require = createRequire(import.meta.url);

  // The directory first. SQLite does not create one, and a bot pointed at
  // `/data/leela.db` with no volume mounted died on startup with
  // `SQLITE_CANTOPEN` — while its own README promised it would run and say it
  // was holding games in memory. A store creates the place it lives in.
  ensureDirectory(path);

  try {
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (path: string) => Database;
    };
    return new DatabaseSync(path);
  } catch {
    const { Database: BunDatabase } = require('bun:sqlite') as {
      Database: new (path: string) => Database;
    };
    return new BunDatabase(path);
  }
}

/**
 * Make the directory a database is asked to live in.
 *
 * Failure is left to the caller: this is a best effort at the common case — a
 * path under a mount point that is not there — and a path that genuinely
 * cannot be written is the caller's decision to make, loudly.
 */
function ensureDirectory(path: string): void {
  const directory = dirname(path);
  if (directory === '.' || directory === '') return;

  try {
    mkdirSync(directory, { recursive: true });
  } catch {
    // Opening will fail next and say so with the path in it, which is a
    // better message than anything that could be written here.
  }
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  host_id     TEXT NOT NULL,
  ruleset     TEXT NOT NULL DEFAULT 'classic',
  turn_index  INTEGER NOT NULL DEFAULT 0,
  roll_count  INTEGER NOT NULL DEFAULT 0,
  dice_seed   INTEGER,
  is_open     INTEGER NOT NULL DEFAULT 1,
  language    TEXT NOT NULL DEFAULT 'en',
  updated_at  INTEGER
);

CREATE TABLE IF NOT EXISTS session_players (
  session_id                  TEXT NOT NULL,
  user_id                     TEXT NOT NULL,
  seat                        INTEGER NOT NULL,
  name                        TEXT,
  plan                        INTEGER NOT NULL DEFAULT 68,
  previous_plan               INTEGER NOT NULL DEFAULT 0,
  direction                   TEXT NOT NULL DEFAULT '',
  consecutive_sixes           INTEGER NOT NULL DEFAULT 0,
  position_before_three_sixes INTEGER NOT NULL DEFAULT 0,
  is_finished                 INTEGER NOT NULL DEFAULT 1,
  last_roll_at                INTEGER,
  last_report_at              INTEGER,
  report_submitted            INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, seat),
  FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS session_players_user
  ON session_players (session_id, user_id);

CREATE TABLE IF NOT EXISTS game_steps (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              TEXT NOT NULL,
  roll                 INTEGER NOT NULL,
  from_plan            INTEGER NOT NULL,
  to_plan              INTEGER NOT NULL,
  direction            TEXT NOT NULL,
  jumped_from          INTEGER,
  is_game_start        INTEGER NOT NULL DEFAULT 0,
  is_game_finished     INTEGER NOT NULL DEFAULT 0,
  is_three_sixes_reset INTEGER NOT NULL DEFAULT 0,
  ruleset              TEXT NOT NULL,
  created_at           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS game_steps_user ON game_steps (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  plan       INTEGER NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_user ON reports (user_id, created_at DESC);

-- What each player is playing for.
--
-- One row per player rather than a column on anything: a table is a chat and a
-- chat has no profile, but the question belongs to the person and follows them
-- between tables — the same reason their reports are keyed by who wrote them
-- and not by where.
CREATE TABLE IF NOT EXISTS intentions (
  user_id    TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The companion's memory of its own initiative: the daily word.
--
-- Keyed by player for the intentions' reason — the knock follows the person,
-- not the table. A NULL sent_at means never written to, which is what makes
-- the first message the one that names /quiet; excerpt is the index last
-- read out, so the next is never the one just heard; quieted survives a
-- restart because an opt-out forgotten is a promise broken.
CREATE TABLE IF NOT EXISTS nudges (
  user_id    TEXT PRIMARY KEY,
  sent_at    INTEGER,
  excerpt    INTEGER,
  quieted    INTEGER NOT NULL DEFAULT 0,
  doorsteps  INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- What a player has paid for in Telegram Stars, and until when.
--
-- Keyed by Telegram's charge id rather than by player, which is the one place
-- this file departs from the nudges and intentions tables beside it: a refund
-- is granted against a charge, so a store holding only a player's current
-- expiry could not say which payment a refund undid. The player's expiry is
-- derived from these rows and never stored, so the two cannot drift apart.
--
-- refunded_at is NULL while the payment stands. Nothing is ever deleted: a
-- refunded payment is a fact about what happened, and an operator asked to
-- explain a refund a month later has only this to read.
CREATE TABLE IF NOT EXISTS entitlements (
  charge_id   TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  tier        TEXT NOT NULL,
  stars       INTEGER NOT NULL,
  paid_at     INTEGER NOT NULL,
  until       INTEGER NOT NULL,
  refunded_at INTEGER,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS entitlements_user ON entitlements (user_id, until DESC);
`;

/**
 * Add columns an older database is missing.
 *
 * `CREATE TABLE IF NOT EXISTS` does nothing to a table that already exists, so
 * the deployed bot — whose volume outlives every release — keeps whatever shape
 * it was first created with. The failure is silent: a write to a column that is
 * not there throws inside a transaction, and a chat is told there is no table.
 *
 * Derived from `SCHEMA` rather than kept as a list of past migrations, because
 * a list of past migrations is a hand-kept list, and this repository has now
 * been wrong about four of those. Whatever the schema declares, an old file
 * gets. Only additive: SQLite can add a column with a constant default and
 * nothing here drops, renames, or retypes one.
 */
export function addMissingColumns(db: Database, schema: string = SCHEMA): string[] {
  const added: string[] = [];

  for (const match of schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)) {
    const table = match[1] ?? '';
    const body = match[2] ?? '';
    const existing = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
        (column) => column.name,
      ),
    );
    // A table that is not there at all is `CREATE TABLE`'s business, not this.
    if (existing.size === 0) continue;

    for (const line of body.split(",\n")) {
      const declaration = line.trim();
      const name = declaration.split(/\s+/)[0] ?? "";
      // Constraint lines are not columns: PRIMARY KEY, FOREIGN KEY, UNIQUE.
      if (!/^\w+$/.test(name) || /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(name)) {
        continue;
      }
      if (existing.has(name)) continue;

      db.exec(`ALTER TABLE ${table} ADD COLUMN ${declaration}`);
      added.push(`${table}.${name}`);
    }
  }

  return added;
}

/** SQLite has no boolean; 1 and 0 have to be read back as one. */
function asBoolean(value: unknown): boolean {
  return value === 1 || value === true;
}

function asDate(value: unknown): Date | null {
  return typeof value === 'number' ? new Date(value) : null;
}

export interface SqliteOptions {
  /** A file path, or `:memory:` for a database that dies with the process. */
  path: string;
  /** Injected so a test can control time. */
  now?: () => number;
  /**
   * Where the migration says what it did. Silent when it did nothing.
   *
   * It exists because the deployed volume is the one database nobody can
   * read: a release that adds a column can only be believed if the process
   * that opened the file says so out loud, and a migration that quietly did
   * not run fails later, inside a tick, as a missing column.
   */
  log?: (message: string) => void;
}

export class SqliteRoomQueries implements RoomQueries {
  private readonly db: Database;
  private readonly clock: () => number;

  /**
   * The last moment stamped, so no two saves share one.
   *
   * "Which of your tables did you mean" is answered by the most recently played
   * one, and `Date.now()` has a millisecond to spend on several saves. Two
   * tables touched inside the same millisecond left the ordering to SQLite,
   * which chose — and chose differently from the in-memory store, whose answer
   * is the order things were saved in.
   *
   * The same tie this repository has met before, in `/path`: two reports
   * written in one millisecond came back in whatever order the database felt
   * like, and `id` was added to break it. There is no second column to break
   * this one, so the clock stops repeating itself instead.
   */
  private stamped = 0;

  constructor({ path, now = Date.now, log = console.log }: SqliteOptions) {
    this.db = openDatabase(path);
    this.clock = now;

    // Without this the FOREIGN KEY above is decorative and deleting a session
    // leaves its seats behind.
    this.db.exec('PRAGMA foreign_keys = ON');
    // A bot handles one update at a time but may be restarted mid-write.
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(SCHEMA);
    // A volume older than this release has the tables and not the columns.
    const added = addMissingColumns(this.db);
    if (added.length > 0) log(`Storage: added ${added.join(', ')} to an older database.`);
  }

  async loadSession(chatId: string): Promise<SessionRow | null> {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(chatId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      host_id: row.host_id as string,
      ruleset: row.ruleset as string,
      turn_index: row.turn_index as number,
      roll_count: row.roll_count as number,
      dice_seed: (row.dice_seed as number | null) ?? null,
      is_open: asBoolean(row.is_open),
      language: row.language as string,
      created_at: null,
      updated_at: asDate(row.updated_at),
    } as SessionRow;
  }

  async loadSeats(chatId: string): Promise<SessionPlayerRow[]> {
    const rows = this.db
      .prepare('SELECT * FROM session_players WHERE session_id = ? ORDER BY seat')
      .all(chatId) as Array<Record<string, unknown>>;

    return rows.map(
      (row, index) =>
        ({
          id: index + 1,
          session_id: row.session_id as string,
          user_id: row.user_id as string,
          seat: row.seat as number,
          name: (row.name as string | null) ?? null,
          plan: row.plan as number,
          previous_plan: row.previous_plan as number,
          direction: row.direction as string,
          consecutive_sixes: row.consecutive_sixes as number,
          position_before_three_sixes: row.position_before_three_sixes as number,
          is_finished: asBoolean(row.is_finished),
          last_roll_at: asDate(row.last_roll_at),
          last_report_at: asDate(row.last_report_at),
          report_submitted: asBoolean(row.report_submitted),
        }) as SessionPlayerRow,
    );
  }

  /**
   * Write the session and replace its seats, in one transaction.
   *
   * Both or neither: a room half-written after a roll is a game with the wrong
   * turn holder, which looks like a game and is not one.
   */
  async save(session: StoredSession, seats: StoredSeat[]): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          `INSERT INTO sessions (id, host_id, ruleset, turn_index, roll_count, dice_seed, is_open, language, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             host_id = excluded.host_id,
             ruleset = excluded.ruleset,
             turn_index = excluded.turn_index,
             roll_count = excluded.roll_count,
             dice_seed = excluded.dice_seed,
             is_open = excluded.is_open,
             language = excluded.language,
             updated_at = excluded.updated_at`,
        )
        .run(
          session.id,
          session.host_id,
          session.ruleset,
          session.turn_index,
          session.roll_count,
          session.dice_seed,
          session.is_open ? 1 : 0,
          session.language,
          this.touched(),
        );

      // Replaced rather than updated: a player can leave, and a stale seat
      // would keep taking turns.
      this.db.prepare('DELETE FROM session_players WHERE session_id = ?').run(session.id);

      const insert = this.db.prepare(
        `INSERT INTO session_players
           (session_id, user_id, seat, name, plan, previous_plan, direction,
            consecutive_sixes, position_before_three_sixes, is_finished,
            last_roll_at, last_report_at, report_submitted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const seat of seats) {
        insert.run(
          seat.session_id,
          seat.user_id,
          seat.seat,
          seat.name,
          seat.plan,
          seat.previous_plan,
          seat.direction,
          seat.consecutive_sixes,
          seat.position_before_three_sixes,
          seat.is_finished ? 1 : 0,
          seat.last_roll_at ? seat.last_roll_at.getTime() : null,
          seat.last_report_at ? seat.last_report_at.getTime() : null,
          seat.report_submitted ? 1 : 0,
        );
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Forget tables whose game ended a while ago.
   *
   * Nothing deleted a finished game, so every table ever opened stayed in the
   * database — thousands of dead rooms after a year of use. The reports are
   * deliberately untouched: a table is scaffolding, a report is the player's.
   *
   * Whether a game is over is the engine's question, and it used to be answered
   * in the WHERE clause: `is_finished = 1 AND previous_plan != 0`, with a
   * comment claiming it was "the same condition the engine uses". It was not.
   * The engine also asks whether the player is standing on the winning square,
   * and asked against every seat shape a row can hold, the two disagreed seven
   * times out of eight — each disagreement a `DELETE` of a table the engine
   * still considered live. The reachable one is a migration: `stateFromLegacy`
   * sets `previous_plan` equal to the plan when the export carried no history,
   * which the engine reads as "has not moved" and the clause read as "done".
   *
   * So SQL narrows by age, which is SQL's question, and the engine answers its
   * own. Pruning is periodic and the age filter bounds the set, so the cost of
   * loading them is nothing next to deleting somebody's game.
   *
   * @returns how many tables were forgotten.
   */
  pruneFinished(olderThanMs: number): number {
    const cutoff = this.now() - olderThanMs;

    const stale = this.db
      .prepare(
        `SELECT s.id FROM sessions s
          WHERE COALESCE(s.updated_at, 0) < ?
            AND EXISTS (SELECT 1 FROM session_players p WHERE p.session_id = s.id)`,
      )
      .all(cutoff) as Array<{ id: string }>;

    const remove = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    let forgotten = 0;

    for (const row of stale) {
      const seats = this.db
        .prepare('SELECT * FROM session_players WHERE session_id = ? ORDER BY seat')
        .all(row.id) as Array<Record<string, unknown>>;

      const over = seats.length > 0 && seats.every((seat) =>
        hasWon({
          loka: seat.plan as number,
          previous_loka: seat.previous_plan as number,
          direction: '',
          consecutive_sixes: seat.consecutive_sixes as number,
          position_before_three_sixes: seat.position_before_three_sixes as number,
          is_finished: asBoolean(seat.is_finished),
        }),
      );

      if (!over) continue;
      remove.run(row.id);
      forgotten += 1;
    }

    return forgotten;
  }

  /**
   * Which table this player sits at, most recently played first.
   *
   * A player can be seated at several — a group and a private game — and the
   * one they mean when they ask a question is the one they last played.
   */
  /** The clock, never twice the same, so "most recent" is always an order. */
  private touched(): number {
    this.stamped = Math.max(this.clock(), this.stamped + 1);
    return this.stamped;
  }

  private now(): number {
    return this.clock();
  }

  async sessionOfPlayer(playerId: string): Promise<string | null> {
    const row = this.db
      .prepare(
        `SELECT p.session_id AS id FROM session_players p
           JOIN sessions s ON s.id = p.session_id
          WHERE p.user_id = ?
          ORDER BY COALESCE(s.updated_at, 0) DESC
          LIMIT 1`,
      )
      .get(playerId) as { id?: string } | undefined;

    return row?.id ?? null;
  }

  /**
   * Every table's chat id, oldest-played first.
   *
   * Ascending where `sessionOfPlayer` is descending, and on purpose: the
   * memory store enumerates in its map's insertion order — last save last —
   * and a caller keeping the newest seat per player must read the same order
   * from both, or the two stores answer "which of your tables did you mean"
   * differently. `id` breaks the tie the way `reportsFor` breaks its own.
   */
  async allSessions(): Promise<string[]> {
    const rows = this.db
      .prepare('SELECT id FROM sessions ORDER BY COALESCE(updated_at, 0), id')
      .all() as Array<{ id: string }>;

    return rows.map((row) => row.id);
  }

  async remove(chatId: string): Promise<void> {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(chatId);
  }

  /**
   * Keep a move.
   *
   * `gameStepRow` and the `game_steps` table both existed and nothing ever
   * called or wrote to them: the schema promised a replayable history and no
   * row was ever inserted. A player's path is recoverable from `(seed,
   * rollsTaken)`, but only by someone who knows to look; a move log is the
   * version a person can read.
   */
  recordStep(step: NewGameStepRow): void {
    this.db
      .prepare(
        `INSERT INTO game_steps
           (user_id, roll, from_plan, to_plan, direction, jumped_from,
            is_game_start, is_game_finished, is_three_sixes_reset, ruleset, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        step.user_id,
        step.roll,
        step.from_plan,
        step.to_plan,
        step.direction,
        step.jumped_from ?? null,
        step.is_game_start ? 1 : 0,
        step.is_game_finished ? 1 : 0,
        step.is_three_sixes_reset ? 1 : 0,
        step.ruleset,
        this.now(),
      );
  }

  /** Every move a player has made, newest first. */
  stepsFor(userId: string): Array<{ roll: number; from: number; to: number; direction: string }> {
    const rows = this.db
      .prepare(
        'SELECT roll, from_plan, to_plan, direction FROM game_steps WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      )
      .all(userId) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      roll: row.roll as number,
      from: row.from_plan as number,
      to: row.to_plan as number,
      direction: row.direction as string,
    }));
  }

  /**
   * Keep a report. The same database, so one file holds a whole deployment.
   *
   * `at` is when it was written, which a path arriving as a file carries and
   * which is not now. Stamping the import instead falsified every imported
   * date and made the same file arrive as new on every send.
   */
  recordReport(report: { userId: string; plan: number; text: string; at?: Date }): void {
    this.db
      .prepare('INSERT INTO reports (user_id, plan, text, created_at) VALUES (?, ?, ?, ?)')
      .run(report.userId, report.plan, report.text, report.at?.getTime() ?? this.now());
  }

  /**
   * What a player is playing for, or nothing.
   *
   * The companion had never been told it — the word did not appear anywhere in
   * this app or in `packages/ai` — so it read a year of answers without knowing
   * the question they were answering.
   */
  intentionOf(userId: string): string | null {
    const row = this.db
      .prepare('SELECT text FROM intentions WHERE user_id = ?')
      .get(userId) as Record<string, unknown> | undefined;

    return row ? (row.text as string) : null;
  }

  /** Set it, or replace it: changing your question is part of playing. */
  setIntention(userId: string, text: string): void {
    this.db
      .prepare(
        `INSERT INTO intentions (user_id, text, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
      )
      .run(userId, text, this.now());
  }

  /** What the initiative remembers about this player, or nothing yet. */
  nudgeOf(
    userId: string,
  ): { sentAt: number | null; excerpt: number | null; quieted: boolean; doorsteps: number } | null {
    const row = this.db
      .prepare('SELECT sent_at, excerpt, quieted, doorsteps FROM nudges WHERE user_id = ?')
      .get(userId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      sentAt: (row.sent_at as number | null) ?? null,
      excerpt: (row.excerpt as number | null) ?? null,
      quieted: asBoolean(row.quieted),
      // A row written before the column existed reads NULL through the
      // migration's default, and a player who has heard no doorstep word has
      // heard none: both are zero.
      doorsteps: (row.doorsteps as number | null) ?? 0,
    };
  }

  /**
   * Remember a send. The upsert leaves `quieted` alone: a send never speaks
   * for `/quiet`, and the two halves of one row are written by different acts.
   */
  recordNudge(userId: string, at: number, excerpt: number, doorstep = false): void {
    this.db
      .prepare(
        `INSERT INTO nudges (user_id, sent_at, excerpt, quieted, doorsteps, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           sent_at = excluded.sent_at,
           excerpt = excluded.excerpt,
           doorsteps = nudges.doorsteps + excluded.doorsteps,
           updated_at = excluded.updated_at`,
      )
      .run(userId, at, excerpt, doorstep ? 1 : 0, this.now());
  }

  /** `/quiet`, either direction — and it must not invent a send that never was. */
  setQuieted(userId: string, quieted: boolean): void {
    this.db
      .prepare(
        `INSERT INTO nudges (user_id, sent_at, excerpt, quieted, updated_at) VALUES (?, NULL, NULL, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           quieted = excluded.quieted,
           updated_at = excluded.updated_at`,
      )
      .run(userId, quieted ? 1 : 0, this.now());
  }

  /**
   * When this player's entitlement runs out, or nothing.
   *
   * The largest `until` among the payments they have made that are neither
   * refunded nor already over. Asked of the database rather than assembled
   * here so that a player with a hundred payments costs one row.
   */
  entitlementUntil(userId: string, now: number): number | null {
    const row = this.db
      .prepare(
        `SELECT MAX(until) AS until FROM entitlements
          WHERE user_id = ? AND refunded_at IS NULL AND until > ?`,
      )
      .get(userId, now) as Record<string, unknown> | undefined;

    // `MAX` over no rows is one row holding NULL, not no rows at all.
    const until = (row?.until as number | null) ?? null;
    return typeof until === 'number' ? until : null;
  }

  /** Keep a payment. Written by a confirmed payment and by nothing else. */
  recordEntitlement(entitlement: {
    chargeId: string;
    userId: string;
    tier: string;
    stars: number;
    paidAt: number;
    until: number;
  }): void {
    this.db
      .prepare(
        // DO NOTHING rather than an update: a charge already here is a payment
        // already counted, and the caller returns it rather than reaching this
        // statement at all. Two guards agreeing, because the one that fails is
        // the one taking money twice.
        `INSERT INTO entitlements (charge_id, user_id, tier, stars, paid_at, until, refunded_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
         ON CONFLICT(charge_id) DO NOTHING`,
      )
      .run(
        entitlement.chargeId,
        entitlement.userId,
        entitlement.tier,
        entitlement.stars,
        entitlement.paidAt,
        entitlement.until,
        this.now(),
      );
  }

  /** One payment, whoever made it, or nothing. */
  entitlementOf(chargeId: string): {
    chargeId: string;
    userId: string;
    tier: string;
    stars: number;
    paidAt: number;
    until: number;
    refundedAt: number | null;
  } | null {
    const row = this.db
      .prepare('SELECT * FROM entitlements WHERE charge_id = ?')
      .get(chargeId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      chargeId: row.charge_id as string,
      userId: row.user_id as string,
      tier: row.tier as string,
      stars: row.stars as number,
      paidAt: row.paid_at as number,
      until: row.until as number,
      refundedAt: (row.refunded_at as number | null) ?? null,
    };
  }

  /**
   * Mark a payment given back.
   *
   * The row stays: a refunded payment is a fact about what happened, and the
   * derived expiry stops counting it because `entitlementUntil` asks for
   * `refunded_at IS NULL`.
   */
  refundEntitlement(chargeId: string, at: number): void {
    this.db
      .prepare('UPDATE entitlements SET refunded_at = ?, updated_at = ? WHERE charge_id = ?')
      .run(at, this.now(), chargeId);
  }

  /** Every report a player has written, newest first. */
  reportsFor(userId: string): Array<{ plan: number; text: string; createdAt: Date }> {
    const rows = this.db
      // `id` breaks the tie: two reports written in the same millisecond would
      // otherwise come back in whatever order SQLite felt like.
      .prepare(
        'SELECT plan, text, created_at FROM reports WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      )
      .all(userId) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      plan: row.plan as number,
      text: row.text as string,
      createdAt: new Date(row.created_at as number),
    }));
  }

  close(): void {
    this.db.close();
  }
}

/** A `StepSink` backed by the same database as the rooms. */
export function sqliteStepSink(queries: SqliteRoomQueries) {
  return {
    async record(step: {
      userId: string;
      event: import('@leela/engine').MoveEvent;
      ruleset: import('@leela/engine').RuleSet;
    }): Promise<void> {
      queries.recordStep(gameStepRow(step.userId, step.event, step.ruleset));
    },
  };
}

/**
 * A `ReportSink` backed by the same database as the rooms.
 *
 * `history` is the half that was missing, and its absence was not quiet: a
 * `ReportSink` without it means *this bot keeps nothing*, and the bot said so
 * to anybody who asked. So the durable configuration — the one the README tells
 * an operator to run, the one with a volume mounted so that nothing is lost —
 * wrote every report into SQLite and then answered `/path` with **"this bot is
 * not keeping reports"**, `/returns` with the same, `/save` with nowhere to put
 * a file, and refused every square handed over by the mini app because there
 * was nothing to merge it into.
 *
 * `reportsFor` was written, tested, and called by nobody. `audit-unread` cannot
 * see it: it is a method on a class, not an export, and the check only looks at
 * exports.
 *
 * Found by playing a whole game through the database rather than by reading it
 * — thirty-eight reports filed, and a path that said nothing had ever been
 * written.
 */
export function sqliteReportSink(queries: SqliteRoomQueries) {
  return {
    async record(report: {
      userId: string;
      plan: number;
      text: string;
      at?: Date;
    }): Promise<void> {
      queries.recordReport(report);
    },

    async history(userId: string): Promise<Array<{ plan: number; text: string; createdAt: Date }>> {
      return queries.reportsFor(userId);
    },

    async intention(userId: string): Promise<string | null> {
      return queries.intentionOf(userId);
    },

    async setIntention(userId: string, text: string): Promise<void> {
      queries.setIntention(userId, text);
    },
  };
}

/**
 * The initiative's memory, backed by the same database as everything else.
 *
 * One file holds a whole deployment, and this is the half of the initiative
 * that must survive a restart: `/quiet` forgotten is a promise broken, and a
 * `sent_at` forgotten is the same player knocked on twice in one morning by a
 * bot that redeployed between.
 */
/**
 * Entitlements, backed by the same database as everything else.
 *
 * The half that must survive a restart most of all: a player has paid, and a
 * bot that forgets on the next deploy has taken money for nothing. In memory
 * when the games are — a deployment that keeps nothing keeps no payments
 * either, and `openStorage` says which of the two it is doing on startup.
 */
export function sqliteEntitlements(queries: SqliteRoomQueries): EntitlementStore {
  return {
    async record(payment): Promise<Entitlement> {
      // A charge already kept is a payment already counted — the same rule the
      // memory store states, and it has to be here too because the failure is
      // in the *arithmetic*: a retried update would otherwise read the first
      // stretch as something to extend and buy sixty days for one payment.
      const already = queries.entitlementOf(payment.chargeId);
      if (already) return already;

      // The same arithmetic the memory store uses, from the same function:
      // two implementations of "does a second payment extend or replace" is
      // two answers, and the one that is wrong is the one taking money.
      const until = extendedTo(
        queries.entitlementUntil(payment.userId, payment.at),
        payment.at,
        payment.days,
      );

      queries.recordEntitlement({
        chargeId: payment.chargeId,
        userId: payment.userId,
        tier: payment.tier,
        stars: payment.stars,
        paidAt: payment.at,
        until,
      });

      return {
        chargeId: payment.chargeId,
        userId: payment.userId,
        tier: payment.tier,
        stars: payment.stars,
        paidAt: payment.at,
        until,
        refundedAt: null,
      };
    },

    async subscribed(userId: string, now: number): Promise<Subscription | null> {
      const until = queries.entitlementUntil(userId, now);
      return until === null ? null : { until };
    },

    async of(chargeId: string): Promise<Entitlement | null> {
      return queries.entitlementOf(chargeId);
    },

    async refund(chargeId: string, at: number): Promise<Entitlement | null> {
      const held = queries.entitlementOf(chargeId);
      if (!held) return null;

      queries.refundEntitlement(chargeId, at);
      return { ...held, refundedAt: at };
    },
  };
}

export function sqliteNudgeStore(queries: SqliteRoomQueries): NudgeStore {
  return {
    async of(userId: string): Promise<NudgeRecord> {
      return queries.nudgeOf(userId) ?? NEVER_NUDGED;
    },

    async record(
      userId: string,
      sent: { at: number; excerpt: number; doorstep?: boolean },
    ): Promise<void> {
      queries.recordNudge(userId, sent.at, sent.excerpt, sent.doorstep === true);
    },

    async setQuieted(userId: string, quieted: boolean): Promise<void> {
      queries.setQuieted(userId, quieted);
    },
  };
}
