/**
 * @leela/engine — the rules of Leela, and nothing else.
 *
 * Import this from the mobile app, the bot, the site and the Inngest
 * functions. If you find yourself reimplementing a rule outside this package,
 * that rule belongs in here instead.
 */

export {
  ARROWS,
  MAX_ROLL,
  SIXES_TO_RESET,
  SNAKES,
  START_LOKA,
  TOTAL_PLANS,
  WIN_LOKA,
  arrowAt,
  isOnBoard,
  snakeAt,
} from './board';

export {
  getDirectionAndPosition,
  handleConsecutiveSixes,
  validatePosition,
} from './rules';
export type { PositionOutcome, SixesOutcome } from './rules';

export { allPlans, applyRoll, hasWon, initialState, replay, rollDie } from './game';

export {
  CLASSIC,
  DEFAULT_RULESET,
  LEGACY_MOBILE,
  NEUROLEELA,
  RULESETS,
  ruleSetById,
} from './rulesets';
export type { RuleSet } from './rulesets';

export type {
  DiceRoller,
  Direction,
  GameState,
  MoveEvent,
  MoveResult,
} from './types';
