/**
 * The bridge between a database row and the engine's `GameState`.
 *
 * Keeping this in one place is the point of the split: the engine never learns
 * what a column is, and the persistence layer never learns a rule.
 */

import { type GameState, type MoveEvent, ruleSetById, type RuleSet } from '@leela/engine';
import type { NewGameStepRow, Player } from './schema';

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
