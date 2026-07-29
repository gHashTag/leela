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

import { WIN_LOKA, type GameState } from '@leela/engine';
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

  // A player who has not started, or who has finished, is out of play.
  const outOfPlay = !user.start || user.finish;

  return {
    loka: outOfPlay ? WIN_LOKA : user.plan,
    previous_loka: previousPlanFrom(user),
    direction: directionFromStatus(latestEntry(user)?.status),
    // The published app has no three-sixes rule, so there is no run to carry.
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: outOfPlay,
  };
}

/** The most recent history entry, or undefined for a player who never rolled. */
function latestEntry(user: LegacyUser): LegacyHistoryEntry | undefined {
  if (!Array.isArray(user.history) || user.history.length === 0) return undefined;
  // The app unshifts, so index 0 is newest — but do not trust it; sort.
  return [...user.history].sort((a, b) => b.createDate - a.createDate)[0];
}

/**
 * Where the player stood before their current plan.
 *
 * Read from the second-newest history entry. With no history to read, return
 * the current plan: equal values mean "has not moved", which is what
 * `owesReport` and the report gate both key off.
 */
function previousPlanFrom(user: LegacyUser): number {
  if (!Array.isArray(user.history) || user.history.length < 2) return user.plan;
  const sorted = [...user.history].sort((a, b) => b.createDate - a.createDate);
  return sorted[1].plan;
}

/** Map a legacy history status onto a direction. */
function directionFromStatus(status: string | undefined): GameState['direction'] {
  switch (status) {
    case 'snake':
      return 'snake 🐍';
    case 'arrow':
      return 'arrow 🏹';
    case 'liberation':
      return 'win 🕉';
    case 'cube':
      return 'step 🚶🏼';
    default:
      // 'start', or anything a future export adds.
      return '';
  }
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
    lastRollAt: user.lastStepTime > 0 ? new Date(user.lastStepTime) : null,
  };
}

/** Legacy rows store locales loosely; reduce to a primary subtag. */
function normaliseLanguage(lang: string | undefined): string {
  if (!lang) return 'en';
  const primary = lang.toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(primary) ? primary : 'en';
}

/**
 * Convert a batch, keeping failures rather than aborting.
 *
 * A migration that stops on the first bad row leaves the database half full
 * and tells you nothing about the rest. Report every failure at once instead.
 */
export function migrateBatch(
  users: ReadonlyArray<LegacyUser>,
  idFor: (user: LegacyUser) => string,
): { migrated: NewPlayer[]; failures: Array<{ owner: string; reason: string }> } {
  const migrated: NewPlayer[] = [];
  const failures: Array<{ owner: string; reason: string }> = [];

  for (const user of users) {
    try {
      migrated.push(playerFromLegacy(user, idFor(user)));
    } catch (error) {
      failures.push({
        owner: user?.owner ?? '(no owner)',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { migrated, failures };
}
