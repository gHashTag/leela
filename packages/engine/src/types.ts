/**
 * Engine types. Deliberately free of any transport, ORM or UI concern:
 * the engine only ever maps a state plus a roll onto a new state.
 */

/**
 * How the player arrived at their new position.
 *
 * The string values match the ones persisted by the shipped app so that
 * existing rows in `players.message` and `game_steps.direction` keep parsing.
 */
export type Direction =
  | 'step 🚶🏼'
  | 'snake 🐍'
  | 'arrow 🏹'
  | 'stop 🛑'
  | 'win 🕉';

/**
 * Everything the rules need to know about a player between two rolls.
 * This is the exact shape the app has always persisted, so a row from the
 * `players` table maps onto it field for field.
 */
export interface GameState {
  /** Current plan, 1..TOTAL_PLANS. */
  loka: number;
  /** Plan the player occupied before this move. */
  previous_loka: number;
  /** How the player got here. Empty before the first roll. */
  direction: Direction | '';
  /** Sixes rolled back to back, 0..2 (three resets the run). */
  consecutive_sixes: number;
  /** Position to fall back to when a third six lands. */
  position_before_three_sixes: number;
  /**
   * True while the player sits on WIN_LOKA — both before the game has begun
   * and after it has been won. A six is required to (re)enter play.
   */
  is_finished: boolean;
}

/** Result of applying a single roll. */
export interface MoveResult {
  /** The state to persist. */
  state: GameState;
  /** What happened, for messaging, analytics and replay. */
  event: MoveEvent;
}

export interface MoveEvent {
  /** The die value that produced this move. */
  roll: number;
  /** Where the player stood before the roll. */
  from: number;
  /** Where the player stands after the roll. */
  to: number;
  direction: Direction;
  /** True when this roll started a new game from WIN_LOKA. */
  isGameStart: boolean;
  /** True when this roll won the game. */
  isGameFinished: boolean;
  /** True when a third consecutive six reset the run. */
  isThreeSixesReset: boolean;
  /** True when the roll would have overshot the board and was refused. */
  isBlocked: boolean;
  /**
   * True when the player keeps the turn and throws again.
   * Always false under rulesets without `extraTurnOnSix`.
   */
  grantsExtraTurn: boolean;
  /**
   * Set when a snake or an arrow moved the player after the plain step.
   * `null` for an ordinary step.
   */
  jumpedFrom: number | null;
}

/** A source of die values. Injected so games can be replayed deterministically. */
export type DiceRoller = () => number;
