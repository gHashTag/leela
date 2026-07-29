/**
 * @leela/engine — the rules of Leela, and nothing else.
 *
 * Import this from the mobile app, the bot, the site and the Inngest
 * functions. If you find yourself reimplementing a rule outside this package,
 * that rule belongs in here instead.
 */

export {
  ARROWS,
  BOARD_COLUMNS,
  BOARD_ROWS,
  BOARD_ROWS_COUNT,
  MAX_ROLL,
  SIXES_TO_RESET,
  SNAKES,
  START_LOKA,
  TOTAL_PLANS,
  WIN_LOKA,
  arrowAt,
  boardPosition,
  isOnBoard,
  snakeAt,
} from './board';

export {
  getDirectionAndPosition,
  handleConsecutiveSixes,
  validatePosition,
} from './rules';
export type { PositionOutcome, SixesOutcome } from './rules';

export { allPlans, applyRoll, hasWon, initialState, replay } from './game';

export { noRepeatRoller, rollDie, rollMany, seededRoller } from './dice';

export {
  auditBoard,
  compareRules,
  compareToReference,
  describeProblems,
  detectRules,
} from './audit';
export type { BoardFinding, BoardProblem, DetectedRules, Jumps } from './audit';

export { declaresBoard, extractBoards } from './extract';
export type { ExtractedBoard } from './extract';

export {
  CLASSIC,
  DEFAULT_RULESET,
  LEGACY_MOBILE,
  NEUROLEELA,
  ONCHAIN,
  ONLINE,
  RULESETS,
  ruleSetById,
} from './rulesets';
export type { RuleSet } from './rulesets';

export { ONE_DAY_MS, canRoll, formatWait, owesReport } from './turn';
export type { TurnBlockedReason, TurnContext, TurnVerdict } from './turn';

export {
  MAX_SEATS,
  SessionError,
  advance,
  canCurrentPlayerRoll,
  createSession,
  currentPlayer,
  isSessionOver,
  standings,
  submitReport,
} from './session';
export type { SeatedPlayer, Session, SessionMove } from './session';

export type {
  DiceRoller,
  Direction,
  GameState,
  MoveEvent,
  MoveResult,
} from './types';
