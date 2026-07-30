/**
 * The bridge between a database row and the engine's `GameState`.
 *
 * Keeping this in one place is the point of the split: the engine never learns
 * what a column is, and the persistence layer never learns a rule.
 */

import {
  type GameState,
  type MoveEvent,
  type RuleSet,
  type SeatedPlayer,
  type Session,
  type TurnContext,
  type TurnVerdict,
  canRoll,
  ruleSetById,
} from '@leela/engine';
import type {
  NewGameStepRow,
  Player,
  SessionPlayerRow,
  SessionRow,
} from './schema';

/** Read a player row as the state the engine expects. */
export function stateFromPlayer(player: Pick<
  Player,
  'plan' | 'previous_plan' | 'consecutiveSixes' | 'positionBeforeThreeSixes' | 'isFinished'
>): GameState {
  return {
    loka: player.plan ?? 1,
    previous_loka: player.previous_plan ?? 0,
    direction: '',
    consecutive_sixes: player.consecutiveSixes ?? 0,
    position_before_three_sixes: player.positionBeforeThreeSixes ?? 0,
    is_finished: player.isFinished ?? false,
  };
}

/** The column updates that persist a new state. */
export function playerUpdateFromState(state: GameState, message?: string) {
  return {
    plan: state.loka,
    previous_plan: state.previous_loka,
    consecutiveSixes: state.consecutive_sixes,
    positionBeforeThreeSixes: state.position_before_three_sixes,
    isFinished: state.is_finished,
    // A player owes a report whenever they actually moved and are still playing.
    needsReport: state.loka !== state.previous_loka && !state.is_finished,
    message: message ?? `Last move: ${state.direction}`,
    updated_at: new Date(),
  };
}

/** A row for the move log. */
export function gameStepRow(userId: string, event: MoveEvent, rules: RuleSet): NewGameStepRow {
  return {
    user_id: userId,
    roll: event.roll,
    from_plan: event.from,
    to_plan: event.to,
    direction: event.direction,
    jumped_from: event.jumpedFrom,
    is_game_start: event.isGameStart,
    is_game_finished: event.isGameFinished,
    is_three_sixes_reset: event.isThreeSixesReset,
    ruleset: rules.id,
  };
}

/** The variant a player's game runs under, falling back to the default. */
export function rulesForPlayer(player: Pick<Player, 'ruleset'>): RuleSet {
  return ruleSetById((player.ruleset ?? 'neuroleela') as RuleSet['id']);
}

/**
 * What the engine needs to decide whether a player may roll.
 *
 * `needs_report` was being written in three places and read in none — the exact
 * defect this project found in NeuroLeela and wrote a comment about, then
 * reproduced. The gate works for a seated player because a session carries
 * `reportSubmitted`; a lone row in `players` had the flag and no way to reach
 * `canRoll` with it.
 *
 * @param now  Epoch ms, passed in so this stays pure.
 */
export function turnContextFromPlayer(
  player: Pick<Player, 'needsReport' | 'lastRollAt'>,
  now: number,
): TurnContext {
  return {
    // The column records the debt; the engine asks about the payment.
    reportSubmitted: !(player.needsReport ?? false),
    lastRollAt: player.lastRollAt ? player.lastRollAt.getTime() : null,
    now,
  };
}

/**
 * Whether a player may roll, from their row alone.
 *
 * The whole point of keeping the flag: a caller with a `players` row and a
 * clock can now ask, instead of having to assemble a session first.
 */
export function canPlayerRoll(
  player: Pick<Player, 'needsReport' | 'lastRollAt' | 'ruleset'> &
    Pick<Player, 'plan' | 'previous_plan' | 'consecutiveSixes' | 'positionBeforeThreeSixes' | 'isFinished'>,
  now: number,
): TurnVerdict {
  return canRoll(stateFromPlayer(player), turnContextFromPlayer(player, now), rulesForPlayer(player));
}

// --- sessions ---------------------------------------------------------------

/**
 * Assemble a session from its row and its seats.
 *
 * Seats are ordered by `seat`, not by whatever order the query returned them
 * in — turn order depends on it.
 */
export function sessionFromRows(
  // `ruleset` is typed nullable rather than following the column, because rows
  // written before the column existed read back as null.
  session: Pick<SessionRow, 'id' | 'turn_index' | 'roll_count'> & { ruleset: string | null },
  seats: ReadonlyArray<SessionPlayerRow>,
): Session {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);

  return {
    id: session.id,
    turnIndex: session.turn_index,
    rollCount: session.roll_count,
    rules: ruleSetById((session.ruleset ?? 'classic') as RuleSet['id']),
    players: ordered.map(
      (seat): SeatedPlayer => ({
        id: seat.user_id,
        name: seat.name ?? undefined,
        state: {
          loka: seat.plan,
          previous_loka: seat.previous_plan,
          direction: (seat.direction ?? '') as GameState['direction'],
          consecutive_sixes: seat.consecutive_sixes,
          position_before_three_sixes: seat.position_before_three_sixes,
          is_finished: seat.is_finished,
        },
        lastRollAt: seat.last_roll_at ? seat.last_roll_at.getTime() : null,
        reportSubmitted: seat.report_submitted,
      }),
    ),
  };
}

/** The session-row updates that persist a session's own fields. */
export function sessionUpdate(session: Session) {
  return {
    turn_index: session.turnIndex,
    roll_count: session.rollCount,
    ruleset: session.rules.id,
    updated_at: new Date(),
  };
}

/** The seat-row updates for one player. */
export function seatUpdate(player: SeatedPlayer) {
  return {
    plan: player.state.loka,
    previous_plan: player.state.previous_loka,
    direction: player.state.direction,
    consecutive_sixes: player.state.consecutive_sixes,
    position_before_three_sixes: player.state.position_before_three_sixes,
    is_finished: player.state.is_finished,
    last_roll_at: player.lastRollAt === null ? null : new Date(player.lastRollAt),
    report_submitted: player.reportSubmitted,
  };
}
