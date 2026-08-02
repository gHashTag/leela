/**
 * Migrating a player off the published app.
 *
 * `com.leelagame` v6.5.1 keeps players in Firebase under a shape that predates
 * every column here. This is the one place that knows both shapes, written as
 * pure functions so the conversion can be tested without a database and
 * without Firebase.
 *
 * What the legacy shape does NOT carry, and why each gap is safe:
 *
 *   - `previous_plan` — never stored. Recovered from the move history when
 *     there is one, and set equal to the current plan otherwise, which reads
 *     as "has not moved yet" rather than inventing a move.
 *   - the sixes counters — the published app has no three-sixes rule, so a run
 *     was never tracked. Zero is correct, not a guess.
 *   - `ruleset` — set to `legacy-mobile` so a migrated player keeps playing the
 *     game they installed. Nothing about their rules changes on migration.
 */

import { stateFromKept, type GameState } from '@leela/engine';
import type { NewPlayer } from './schema';

/** A player document as the published app stores it in Firebase. */
export interface LegacyUser {
  email: string;
  /** True once the player has reached Cosmic Consciousness. */
  finish: boolean;
  firstGame: boolean;
  firstName: string;
  lastName: string;
  /** Epoch ms of the player's last roll. 0 when they have never rolled. */
  lastStepTime: number;
  /** Firebase uid. */
  owner: string;
  /** Current plan, 1..72. */
  plan: number;
  /** True once the player has entered the game with a six. */
  start: boolean;
  history: LegacyHistoryEntry[];
  /** False while the player owes a report on their current plan. */
  isReported: boolean;
  avatar?: string;
  lang?: string;
  intention?: string;
}

export interface LegacyHistoryEntry {
  plan: number;
  /** The die value that produced this entry. */
  count: number;
  /** 'cube' | 'snake' | 'arrow' | 'liberation' | 'start' */
  status: string;
  createDate: number;
}

export class LegacyMigrationError extends Error {}

/**
 * Read a legacy user as engine state.
 *
 * The legacy app tracks "in the game" with a separate `start` flag, while the
 * engine folds that into `is_finished` — a player is out of play when they sit
 * on WIN_LOKA waiting for a six, whether that is before their first game or
 * after they won one.
 */
export function stateFromLegacy(user: LegacyUser): GameState {
  if (!Number.isInteger(user.plan) || user.plan < 1 || user.plan > 72) {
    throw new LegacyMigrationError(`user ${user.owner}: plan ${user.plan} is off the board`);
  }

  // The rule itself is `@leela/engine`'s. It was written here for the Firebase
  // documents, and the phone needs the same four facts out of the offline store
  // the published app keeps on the device — where importing this package, which
  // is a database driver, is not something a React Native bundle can do.
  return stateFromKept(user);
}

/**
 * A full player row for a migrated account.
 *
 * @param user  The Firebase document.
 * @param id    The id this player will have in the new database. Kept separate
 *              from the Firebase uid, which is preserved in `legacyId` so the
 *              two systems can be reconciled after the fact.
 */
export function playerFromLegacy(user: LegacyUser, id: string): NewPlayer {
  const state = stateFromLegacy(user);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  return {
    id,
    legacyId: user.owner,
    plan: state.loka,
    previous_plan: state.previous_loka,
    consecutiveSixes: state.consecutive_sixes,
    positionBeforeThreeSixes: state.position_before_three_sixes,
    isFinished: state.is_finished,
    isStart: user.start,
    // The gate keys off this, so an unreported player stays blocked after the
    // move rather than getting a free roll out of the migration.
    needsReport: !user.isReported,
    fullName: name.length > 0 ? name : undefined,
    avatar: user.avatar,
    intention: user.intention,
    language: normaliseLanguage(user.lang),
    // Keep them on the rules they installed.
    ruleset: 'legacy-mobile',
    // The export carries one timestamp and it is the report's: the published
    // app sets `lastStepTime` in `startStepTimer`, which it calls when a post
    // is created. It was being read as the throw, which only looked right
    // while the wait was measured from throws.
    lastRollAt: user.lastStepTime > 0 ? new Date(user.lastStepTime) : null,
    lastReportAt: user.lastStepTime > 0 ? new Date(user.lastStepTime) : null,
  };
}

/** Legacy rows store locales loosely; reduce to a primary subtag. */
function normaliseLanguage(lang: string | undefined): string {
  if (!lang) return 'en';
  const [primary = ''] = lang.toLowerCase().split(/[-_]/);
  return /^[a-z]{2}$/.test(primary) ? primary : 'en';
}

export interface MigrationFailure {
  /** The Firebase uid, or a note when the record has none. */
  owner: string;
  /**
   * Where in the export this record was, counting from zero.
   *
   * Without it, a dump with twelve broken records reports twelve identical
   * lines and an operator has no way to find any of them.
   */
  index: number;
  reason: string;
}

export interface MigrationReport {
  /** Rows to insert. */
  migrated: NewPlayer[];
  /** Accounts already in the database, left alone. */
  skipped: string[];
  /** Records that could not be converted, with the reason and where they were. */
  failures: MigrationFailure[];
}

export interface MigrateOptions {
  /** How to name a migrated player in the new database. */
  idFor: (user: LegacyUser) => string;
  /**
   * Firebase uids already present in `players.legacy_id`.
   *
   * Without this the batch is not re-runnable: a second pass returns rows that
   * already exist, and `players_legacy_id_key` rejects them — taking the whole
   * transaction down with them, including the accounts that had not been
   * migrated yet. A live migration is never one attempt.
   */
  alreadyMigrated?: Iterable<string>;
}

/**
 * Convert a batch, keeping failures rather than aborting.
 *
 * A migration that stops on the first bad row leaves the database half full and
 * tells you nothing about the rest. Report everything at once, in three
 * categories, so a second run is a no-op for whoever came across in the first.
 */
export function migrateBatch(
  users: ReadonlyArray<LegacyUser>,
  options: MigrateOptions | ((user: LegacyUser) => string),
): MigrationReport {
  // The old signature took the id function directly; keep it working.
  const { idFor, alreadyMigrated }: MigrateOptions =
    typeof options === 'function' ? { idFor: options } : options;

  const done = new Set(alreadyMigrated ?? []);
  const migrated: NewPlayer[] = [];
  const skipped: string[] = [];
  const failures: MigrationFailure[] = [];

  // An export can list the same account twice; the unique index would reject
  // the pair just as it rejects a re-run.
  const seen = new Set<string>();

  for (const [index, user] of users.entries()) {
    // A dump can contain a hole where a document was deleted. Say so in terms
    // an operator can act on, rather than letting a property access fail and
    // reporting "null is not an object (evaluating 'user.plan')".
    if (user === null || typeof user !== 'object') {
      failures.push({
        owner: '(not a record)',
        index,
        reason: `record ${index} is ${user === null ? 'null' : typeof user}, not an object`,
      });
      continue;
    }

    if (typeof user.owner !== 'string' || user.owner.length === 0) {
      failures.push({
        owner: '(no owner)',
        index,
        reason: `record ${index} has no owner, so it cannot be matched to an account`,
      });
      continue;
    }

    const owner = user.owner;

    if (done.has(owner)) {
      skipped.push(owner);
      continue;
    }

    if (seen.has(owner)) {
      failures.push({
        owner,
        index,
        reason: 'appears more than once in this export',
      });
      continue;
    }

    try {
      migrated.push(playerFromLegacy(user, idFor(user)));
      seen.add(owner);
    } catch (error) {
      failures.push({
        owner,
        index,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { migrated, skipped, failures };
}

/** A line an operator can read after a run. */
export function describeMigration(report: MigrationReport): string {
  const parts = [`${report.migrated.length} to migrate`];
  if (report.skipped.length > 0) parts.push(`${report.skipped.length} already migrated`);
  if (report.failures.length > 0) parts.push(`${report.failures.length} failed`);
  return parts.join(', ');
}
