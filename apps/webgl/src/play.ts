import {
  type GameState,
  type MoveEvent,
  type SeatedPlayer,
  type Session,
  advance,
  currentPlayer,
  hasWon,
  isSessionOver,
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

/**
 * The table, and one throw of it.
 *
 * `Play` stood here: a wrapper holding one `GameState` and rolling it. It has
 * been replaced by the engine's `Session`, which has held several seats, a turn
 * index and the rotation between them since before this app existed —
 * `apps/miniapp/src/seats.ts` says so outright when it explains that it ports
 * the *seating* and lets `advance` rotate, because the published app wrote that
 * rotation out longhand as five branches and the engine already had it.
 *
 * What stays here is the part the engine has no opinion about: splitting a move
 * into the hops an animation walks. That is this surface's problem and it is
 * `hopsFor`, above.
 */
export interface Thrown {
  readonly roll: number;
  readonly hops: readonly Hop[];
  readonly event: MoveEvent;
  readonly session: Session;
  /** Whose throw it was. */
  readonly seatId: string;
  /**
   * That seat, as it stands *after* the move.
   *
   * Carried rather than looked up, because looking it up is the thing that goes
   * wrong: `advance` rotates the turn, so the session's current player after a
   * throw is the *next* seat, and a caller that reads the board back through
   * `currentPlayer` reports the wrong player's square. This surface did exactly
   * that — the header showed the next player's plan under the mover's sentence,
   * two different squares in one breath — and it was invisible for as long as
   * there was only ever one seat.
   */
  readonly moved: SeatedPlayer;
  /** True when the same seat throws again — a six, under variants that allow it. */
  readonly rollsAgain: boolean;
  readonly won: boolean;
  /**
   * True when there is nobody left who can still move.
   *
   * Not the same fact as `won`, and the difference is a whole table: `nextSeat`
   * skips a seat that has finished and goes on rotating, so one player reaching
   * Cosmic Consciousness at a table of three leaves two games in progress. The
   * board read `won` and seated a fresh table on it, which put those two back on
   * 68 waiting for a six with their throws gone — somebody else's win ending
   * your game, with nothing on screen to say why.
   *
   * At a table of one the two are the same answer, which is why it took a table
   * to see. `isSessionOver` is the engine's own question and is asked here
   * rather than in `main.ts`, because no rule lives in the wiring.
   */
  readonly tableOver: boolean;
}

/**
 * Rolls for whoever holds the turn.
 *
 * `advance` decides everything about the move and the rotation; this adds only
 * the hops. `now` is passed in because `advance` is pure and takes it — a
 * variant can measure a wait between throws, and a clock read inside the engine
 * would be a clock no test could set.
 */
export function throwFor(
  session: Session,
  roll: number,
  now: number = Date.now(),
): Thrown {
  const before = currentPlayer(session).state;
  const move = advance(session, roll, now);
  const moved = currentPlayerById(move.session, move.playerId);
  const after = moved.state;

  return {
    roll,
    hops: hopsFor(before, roll, after, move.event),
    event: move.event,
    session: move.session,
    seatId: move.playerId,
    moved,
    rollsAgain: move.keepsTurn,
    won: hasWon(after),
    tableOver: isSessionOver(move.session),
  };
}

/** A seat by id, because after a turn the current player is the *next* one. */
const currentPlayerById = (session: Session, id: string): SeatedPlayer => {
  const found = session.players.find((player) => player.id === id);
  if (!found) throw new Error(`no seat ${id} at this table`);
  return found;
};

/** True once a seat is on the board. Before the first six it sits on 68. */
export const entered = (player: SeatedPlayer): boolean => !player.state.is_finished;
