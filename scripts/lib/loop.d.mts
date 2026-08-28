/**
 * Types for `loop.mjs`, so a check can import it without a directive.
 *
 * Beside the module for the same reason `status.d.mts` is: the scripts run
 * under `node` and `bun` without a build, the tests that share them are
 * TypeScript, and one declaration says what the shapes are where a
 * `@ts-expect-error` in every importer would only say to stop asking.
 */

import type { Finding } from './status.d.mts';

/** An hour: how long a lock may go without a sign of life before it is stale. */
export const STALE_AFTER_MS: number;

/** Six hours: the longest one iteration may hold the lock even while speaking. */
export const HELD_AT_MOST_MS: number;

/**
 * The exit code for "somebody living has it" — deliberately not 1, because
 * node exits 1 for a module it cannot find and this script's own absence must
 * not read as a refusal.
 */
export const HELD: number;

/** What `take` should do about a lock in this state. */
export function takeVerdict(state: LockState): { code: number; taken: boolean; say: string };

/** A day: how long the loop may be silent before silence is a finding. */
export const SILENT_AFTER_MS: number;

/**
 * Whoever wrote the lock file.
 *
 * `shape` records which of the two formats was read — `bare` is the epoch-only
 * lock every iteration wrote until 2026-08-28, and it names no process, which
 * is why `pid` is nullable rather than assumed.
 */
export interface Holder {
  at: number | null;
  /**
   * The last time the holder said it was still there, or null.
   *
   * Null on every lock written before 2026-08-29 and on any iteration that
   * never marks one — and null is not zero: the reader falls back to `at`.
   */
  beat: number | null;
  marks: number;
  pid: number | null;
  host: string | null;
  shape: 'named' | 'bare' | 'unreadable';
}

export interface LockState {
  state: 'free' | 'held' | 'abandoned';
  ageMs: number | null;
  /** How long since the last sign of life, which is what the hour bounds. */
  silentMs: number | null;
  /** The sentence the report prints, naming which half of the rule decided. */
  why: string;
}

export interface Heartbeat {
  at: number;
  iteration: string | null;
  commit: string | null;
  note: string;
}

export interface Schedule {
  cron: string;
  lastFiredAt: number | null;
}

/** Null when there is no lock at all; never throws on a lock it cannot parse. */
export function holderFrom(text: string | null | undefined): Holder | null;

/** The lock a holder writes to say it is still there. `at` is carried, never restamped. */
export function markedFrom(
  holder: Holder,
  options: { now: number; step?: string; pid?: number | null; host?: string | null },
): { at: number; iso: string; beat: number; marks: number; pid: number | null; host: string | null; step: string };

/** The last sign of life: the mark if there is one, otherwise the taking. */
export function lastSignFrom(holder: Holder | null): number | null;

/**
 * Silence, and a cap. The pid a lock names is written by a command that exits
 * before the work starts, so it can never say whether the holder is working —
 * but the holder itself can, and `mark` is how it does.
 */
export function lockState(
  holder: Holder | null,
  options: { now: number; staleAfterMs?: number; heldAtMostMs?: number },
): LockState;

/** Null for absent, malformed, or undated — all of which mean "no mark". */
export function heartbeatFrom(text: string | null | undefined): Heartbeat | null;

/** The scheduled task whose prompt contains `mentions`, or null. */
export function cronFrom(text: string | null | undefined, mentions: string): Schedule | null;

export function loopFindings(options: {
  holder: Holder | null;
  heartbeat: Heartbeat | null;
  cron: Schedule | null;
  now: number;
  silentAfterMs?: number;
}): Finding[];
