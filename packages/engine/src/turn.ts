/**
 * When a player is allowed to roll.
 *
 * Leela is not a race. Landing on a plan is an invitation to sit with it: the
 * traditional practice is to reflect on the square you are on before moving
 * off it. The published app enforced exactly that — a player could not roll
 * until they had written a report, and online games put a day between moves.
 *
 * That rule lived in `OnlinePlayer.store` next to the Firebase calls and was
 * lost when the game was rewritten. It belongs here, with the other rules.
 */

import { START_LOKA, WIN_LOKA } from './board';
import { DEFAULT_RULESET, type RuleSet } from './rulesets';
import type { GameState } from './types';

/** Milliseconds in a day — the cooldown the published app used online. */
export const ONE_DAY_MS = 86_400_000;

export interface TurnContext {
  /**
   * Whether the player has filed a report for the plan they are standing on.
   * Ignored when the ruleset does not gate on reports.
   */
  reportSubmitted: boolean;
  /** When the player last rolled, in epoch ms. Null before their first roll. */
  lastRollAt: number | null;
  /** Now, in epoch ms. Passed in so this stays a pure function. */
  now: number;
}

export type TurnBlockedReason =
  /** The player owes a report for the plan they are on. */
  | 'report-required'
  /** The cooldown between rolls has not elapsed. */
  | 'cooldown'
  /** The game is over and this ruleset does not allow starting again. */
  | 'finished';

export interface TurnVerdict {
  allowed: boolean;
  reason: TurnBlockedReason | null;
  /**
   * When the player may roll next, in epoch ms.
   * Null when they may roll now, or when only a report stands in the way.
   */
  nextAllowedAt: number | null;
  /** Milliseconds left on the cooldown, 0 when none. */
  waitMs: number;
}

const ALLOWED: TurnVerdict = Object.freeze({
  allowed: true,
  reason: null,
  nextAllowedAt: null,
  waitMs: 0,
});

/**
 * May this player roll?
 *
 * Checked in the order a player experiences them: a report is owed before a
 * cooldown matters, because writing the report is what the wait is for.
 *
 * A player waiting on WIN_LOKA to enter the game is never gated — there is no
 * plan to reflect on until they are on the board.
 */
export function canRoll(state: GameState, context: TurnContext, rules: RuleSet): TurnVerdict {
  // Not yet in the game: nothing to report on, nothing to wait for.
  if (state.is_finished) return ALLOWED;

  if (rules.requireReportBeforeRoll && !context.reportSubmitted) {
    return { allowed: false, reason: 'report-required', nextAllowedAt: null, waitMs: 0 };
  }

  if (rules.turnCooldownMs > 0 && context.lastRollAt !== null) {
    const nextAllowedAt = context.lastRollAt + rules.turnCooldownMs;
    if (context.now < nextAllowedAt) {
      return {
        allowed: false,
        reason: 'cooldown',
        nextAllowedAt,
        waitMs: nextAllowedAt - context.now,
      };
    }
  }

  return ALLOWED;
}

/**
 * Does the player owe a report right now?
 *
 * True once they have moved to a new plan and the game is still running. This
 * is the same condition the database stores as `players.needs_report`.
 */
export function owesReport(state: GameState, rules: RuleSet = DEFAULT_RULESET): boolean {
  if (state.loka === state.previous_loka || state.is_finished) return false;

  // The published app writes a six's history and nothing else: no report, no
  // day's wait. A run of sixes is one move, reported once, at the end of it —
  // which is what the extra turn is *for*. See `createHistory`, which gates on
  // `values.count !== 6`.
  if (!rules.reportAfterSix && arrivedOnSix(state)) return false;

  return true;
}

/**
 * Whether the throw that brought a player here was a six.
 *
 * Read from the state rather than remembered, because the state is what the
 * next roll has. `consecutive_sixes` is incremented by every six and cleared by
 * everything else; entering the game is the exception, since it is written
 * fresh — and nothing else moves a player off the win square.
 */
export function arrivedOnSix(state: GameState): boolean {
  if (state.consecutive_sixes > 0) return true;
  return state.previous_loka === WIN_LOKA && state.loka === START_LOKA;
}

/**
 * Format a wait as `Hh Mm` / `Mm Ss`, for the "next step in…" label.
 * Returns an empty string when there is nothing to wait for.
 */
export function formatWait(waitMs: number): string {
  if (waitMs <= 0) return '';

  const totalSeconds = Math.ceil(waitMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
