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
import { hasWon } from './game';
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
  /**
   * When they last filed a report, in epoch ms. Null if they never have.
   *
   * Read only when the variant measures the wait from the report, which is
   * what the published app does.
   */
  lastReportAt: number | null;
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
  // A player who has *won*, under rules that do not let them start again.
  //
  // `finished` was declared as a reason and returned from nowhere: this
  // function's only mention of it was the type. So every surface wrote the
  // check itself — the bot's `if (hasWon(player.state)) return { say:
  // 'finished' }`, the mini app's own `canRoll`, the phone's `isOver` — and the
  // phone's asked a different question, `isSessionOver`, which is true only
  // once *everybody* has finished and would have left the die open to a winner
  // at a shared table.
  //
  // `hasWon` rather than `is_finished`, because the flag says two things and
  // only one of them is this one: a player waiting to enter carries it too, and
  // for them the answer below is right.
  if (hasWon(state) && !rules.mayReenterAfterWinning) {
    return { allowed: false, reason: 'finished', nextAllowedAt: null, waitMs: 0 };
  }

  // Not yet in the game: nothing to report on, nothing to wait for.
  if (state.is_finished) return ALLOWED;

  if (rules.requireReportBeforeRoll && !context.reportSubmitted) {
    return { allowed: false, reason: 'report-required', nextAllowedAt: null, waitMs: 0 };
  }

  // The published app starts the day when the report is written, not when the
  // die is thrown: `startStepTimer` is called from `CreatePost` and nowhere
  // else. A player who takes three days to write still waits a day afterwards.
  const since = rules.cooldownFrom === 'report' ? context.lastReportAt : context.lastRollAt;

  if (rules.turnCooldownMs > 0 && since !== null) {
    const nextAllowedAt = since + rules.turnCooldownMs;
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
  // `is_finished` says two different things in this shape, and only one of them
  // is "nothing to report". A player who has not entered the game carries it —
  // the 68 ambiguity — and owes nothing. A player who has just *won* carries it
  // too, and the winning square is the one arrival the published app always
  // asks about: `if (stepCount !== 6 || plan === 68)` navigates to the plan
  // with `report: true`, six or no six. Cosmic Consciousness is the square a
  // whole game was played to reach, and the gate was skipping it.
  if (state.is_finished && !hasWon(state)) return false;

  // The winning square, which is the one arrival the published app always asks
  // about and the one the contract cannot ask about at all: landing on 68 sets
  // `isStart = false` there, which both removes the gate and makes
  // `createReport` revert. A variant that demanded one would lock an on-chain
  // winner out of beginning again.
  if (hasWon(state)) return rules.reportOnWinningSquare;

  // The question is whether the player *arrived*, not whether the square
  // changed. Those come apart in exactly one place on this board: standing on
  // 8, a four takes you to 12, and the snake at 12 puts you back on 8. The
  // player moved, was bitten, and ended where they began — the most eventful
  // turn there is — and the gate opened as if nothing had happened.
  //
  // Both surviving sources of truth disagree with that. The published app's
  // `entities` returns nothing only when the throw overshoots 72; a snake
  // writes its history and navigates to the plan with `report: true`, with no
  // comparison of squares anywhere. The deployed contract requires a fresh
  // report before every roll once the player is in play, likewise without
  // comparing. This is a defect rather than a variant: no shipped ruleset wants
  // the other behaviour, so there is no flag to choose it with.
  if (state.loka === state.previous_loka && !arrivedByJump(state)) return false;

  // The published app writes a six's history and nothing else: no report, no
  // day's wait. A run of sixes is one move, reported once, at the end of it —
  // which is what the extra turn is *for*. See `createHistory`, which gates on
  // `values.count !== 6`.
  if (!rules.reportAfterSix && arrivedOnSix(state)) return false;

  return true;
}

/**
 * Whether what someone wrote counts as a report.
 *
 * The published app refuses fewer than a hundred characters —
 * `yup.string().trim().min(100)` in `CreatePost` — because a line typed to open
 * the gate is not a reflection. Traditional Leela sets no count, so `classic`
 * asks only that something was written.
 *
 * Trimmed first: whitespace is not writing, and a gate opened by spaces is the
 * rule with its point removed.
 */
export function isReport(text: string, rules: RuleSet = DEFAULT_RULESET): boolean {
  const written = text.trim();
  return written.length > 0 && written.length >= rules.minReportChars;
}

/**
 * Whether the throw that brought a player here was a six.
 *
 * Read from the state rather than remembered, because the state is what the
 * next roll has. `consecutive_sixes` is incremented by every six and cleared by
 * everything else; entering the game is the exception, since it is written
 * fresh — and nothing else moves a player off the win square.
 */
/**
 * A player who has not entered the game.
 *
 * `is_finished` says two things in this shape — the 68 ambiguity, met six times
 * now — and telling them apart takes `hasWon`. Three surfaces were doing it by
 * hand (`render.ts` twice, the mini app's `view.ts` once) and a fourth,
 * `describeStandings`, was not: it printed the raw square, so a player who had
 * never thrown a six was listed as standing on **68**, the winning square.
 *
 * Kept next to `hasWon` rather than in each caller, because "waiting" and
 * "finished" are the same question asked twice and the answer has to come from
 * one place.
 */
export function isWaitingToEnter(state: GameState): boolean {
  return state.is_finished && !hasWon(state);
}

/**
 * A throw refused because the player is not on the board yet.
 *
 * `isBlocked` covers two different refusals, and a surface that shows one
 * message for both tells a player waiting to enter that they are short of room
 * on a board they have never stood on. The other refusal is an overshoot past
 * 72, which only somebody in play can manage.
 *
 * Both surfaces worked this out separately and wrote the same three-part
 * condition — `isBlocked && from === WIN_LOKA && to === WIN_LOKA` — and the bot
 * spent a while with the wrong message before copying the mini app's fix. That
 * is the fourth rule found written out by hand outside this package in as many
 * passes, so it gets a name here before it drifts a second time.
 *
 * A player who has already won and is throwing to begin again is in the same
 * position — on 68, needing a six — and is told the same thing, which is right.
 */
export function needsSixToEnter(event: {
  isBlocked: boolean;
  from: number;
  to: number;
  wasComplete: boolean;
}): boolean {
  return (
    event.isBlocked &&
    event.from === WIN_LOKA &&
    event.to === WIN_LOKA &&
    // And not thrown by somebody who has finished. Their refused throw is
    // identical in every other respect — same square, same flag, same blocked
    // event — and this function was written to tell refusals apart, so the one
    // pair it could not tell apart was the pair that mattered: a player who
    // has just completed the game does not need telling how to enter it.
    !event.wasComplete
  );
}

/**
 * A turn that moved the player and left them where they started.
 *
 * Only a jump can do this — a snake or an arrow after the step — so the
 * direction is what tells an arrival apart from a throw that was refused. A
 * refused throw leaves `'stop 🛑'` and is not an arrival: `entities` returns
 * nothing when the throw would overshoot 72, and a player who could not move
 * has nothing new to write about.
 */
export function arrivedByJump(state: GameState): boolean {
  if (state.loka !== state.previous_loka) return false;
  return state.direction === 'snake 🐍' || state.direction === 'arrow 🏹';
}

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
