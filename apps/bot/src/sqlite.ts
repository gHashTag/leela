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
import type { NewGameStepRow, SessionPlayerRow, SessionRow } from '@leela/db';
import type { RoomQueries, StoredSeat, StoredSession } from './persistence';

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
}

export class SqliteRoomQueries implements RoomQueries {
  private readonly db: Database;
  private readonly now: () => number;

  constructor({ path, now = Date.now }: SqliteOptions) {
    this.db = openDatabase(path);
    this.now = now;

    // Without this the FOREIGN KEY above is decorative and deleting a session
    // leaves its seats behind.
    this.db.exec('PRAGMA foreign_keys = ON');
    // A bot handles one update at a time but may be restarted mid-write.
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(SCHEMA);
    // A volume older than this release has the tables and not the columns.
    addMissingColumns(this.db);
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
          this.now(),
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
   * A game counts as over when every seat has finished *after* being on the
   * board, which is the same condition the engine uses — a seat that never
   * entered has `previous_plan = 0` and is waiting, not done.
   *
   * @returns how many tables were forgotten.
   */
  pruneFinished(olderThanMs: number): number {
    const cutoff = this.now() - olderThanMs;

    const stale = this.db
      .prepare(
        `SELECT s.id FROM sessions s
          WHERE COALESCE(s.updated_at, 0) < ?
            AND NOT EXISTS (
              SELECT 1 FROM session_players p
               WHERE p.session_id = s.id
                 AND (p.is_finished = 0 OR p.previous_plan = 0)
            )
            AND EXISTS (SELECT 1 FROM session_players p WHERE p.session_id = s.id)`,
      )
      .all(cutoff) as Array<{ id: string }>;

    const remove = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    for (const row of stale) remove.run(row.id);

    return stale.length;
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

  /** Keep a report. The same database, so one file holds a whole deployment. */
  recordReport(report: { userId: string; plan: number; text: string }): void {
    this.db
      .prepare('INSERT INTO reports (user_id, plan, text, created_at) VALUES (?, ?, ?, ?)')
      .run(report.userId, report.plan, report.text, this.now());
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

/** A `ReportSink` backed by the same database as the rooms. */
export function sqliteReportSink(queries: SqliteRoomQueries) {
  return {
    async record(report: { userId: string; plan: number; text: string }): Promise<void> {
      queries.recordReport(report);
    },
  };
}
