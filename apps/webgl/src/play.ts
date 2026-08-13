import {
  DEFAULT_RULESET,
  type GameState,
  type MoveEvent,
  type RuleSet,
  applyRoll,
  hasWon,
  initialState,
  rollDie,
} from '@leela/engine';

/**
 * The game between the rules and the renderer.
 *
 * The renderer should never decide anything: it draws what this reports. So
 * this owns the state, asks the engine what a roll does, and turns the answer
 * into a list of hops for the piece to walk. Splitting it out this way is also
 * the only way any of it gets tested - a headless test can play a whole game
 * and never touch WebGL.
 *
 * A move is a *sequence* of positions, not one: landing on a snake head is two
 * hops (onto the head, then down to the tail), and showing it as one teleport
 * loses the thing that makes the board legible.
 */

export interface Hop {
  readonly from: number;
  readonly to: number;
  /** Why this hop happens, for the caption under the board. */
  readonly kind: 'step' | 'snake' | 'arrow' | 'win' | 'stay';
}

export interface Turn {
  readonly roll: number;
  readonly hops: readonly Hop[];
  readonly event: MoveEvent;
  readonly state: GameState;
  /** True when the player may roll again immediately. */
  readonly rollsAgain: boolean;
  readonly won: boolean;
}

const kindOf = (direction: string): Hop['kind'] => {
  if (direction.startsWith('snake')) return 'snake';
  if (direction.startsWith('arrow')) return 'arrow';
  if (direction.startsWith('win')) return 'win';
  if (direction.startsWith('stop')) return 'stay';
  return 'step';
};

/**
 * Splits one move into the hops that show it.
 *
 * The engine reports where the player ended and how. When that end came from a
 * snake or an arrow, the intermediate cell - the head or the foot - is where
 * the die actually put them, and the piece has to be seen there before it is
 * carried away. Otherwise a 3 that becomes a fall of 30 looks like a bug.
 */
export const hopsFor = (
  before: GameState,
  roll: number,
  after: GameState,
  event: MoveEvent,
): Hop[] => {
  const kind = kindOf(event.direction ?? after.direction ?? '');

  if (kind === 'stay' || before.loka === after.loka) {
    return [{ from: before.loka, to: after.loka, kind: 'stay' }];
  }

  if (kind === 'snake' || kind === 'arrow') {
    const landed = before.loka + roll;
    // Only insert the intermediate cell when the die really stopped there.
    if (landed !== after.loka && landed >= 1 && landed <= 72) {
      return [
        { from: before.loka, to: landed, kind: 'step' },
        { from: landed, to: after.loka, kind },
      ];
    }
  }

  return [{ from: before.loka, to: after.loka, kind }];
};

export class Play {
  private current: GameState;

  constructor(
    private readonly rules: RuleSet = DEFAULT_RULESET,
    private readonly roller: () => number = rollDie,
    start: GameState = initialState(),
  ) {
    this.current = start;
  }

  get state(): GameState {
    return this.current;
  }

  get plan(): number {
    return this.current.loka;
  }

  get finished(): boolean {
    return hasWon(this.current);
  }

  /**
   * True once the player is on the board.
   *
   * Before the first six the piece sits on the winning plan with `is_finished`
   * set - the engine's way of saying "not playing yet". Reading position alone
   * cannot tell that apart from having won, which is why the caption used to
   * pick the wrong sentence.
   */
  get entered(): boolean {
    return !this.current.is_finished;
  }

  /** Rolls once and reports everything the renderer needs to show it. */
  roll(): Turn {
    const before = this.current;
    const roll = this.roller();
    const { state, event } = applyRoll(before, roll, this.rules);
    this.current = state;

    return {
      roll,
      hops: hopsFor(before, roll, state, event),
      event,
      state,
      // A six earns another throw, but never after the game is over.
      rollsAgain: roll === 6 && !hasWon(state),
      won: hasWon(state),
    };
  }

  /** Starts a fresh game on the same rules. */
  reset(): void {
    this.current = initialState();
  }
}
