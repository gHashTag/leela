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

import { createRequire } from 'node:module';
import type { SessionPlayerRow, SessionRow } from '@leela/db';
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

interface Database {
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
function openDatabase(path: string): Database {
  const require = createRequire(import.meta.url);

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
  report_submitted            INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, seat),
  FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS session_players_user
  ON session_players (session_id, user_id);

CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  plan       INTEGER NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_user ON reports (user_id, created_at DESC);
`;

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
            last_roll_at, report_submitted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

/** A `ReportSink` backed by the same database as the rooms. */
export function sqliteReportSink(queries: SqliteRoomQueries) {
  return {
    async record(report: { userId: string; plan: number; text: string }): Promise<void> {
      queries.recordReport(report);
    },
  };
}
