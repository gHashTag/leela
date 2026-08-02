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
  MAX_SEATS,
  TOTAL_PLANS,
  WIN_LOKA,
  canRoll,
  isRuleSetId,
  owesReport,
  ruleSetById,
} from '@leela/engine';
import type {
  NewGameStepRow,
  Player,
  SessionPlayerRow,
  SessionRow,
} from './schema';

/**
 * A state the engine could have produced, or a complaint saying why not.
 *
 * One statement of the rule, because there are three readers of these columns
 * and they were not agreeing. `checkSeat` had it — plan on the board, a run of
 * at most two sixes, out of play only on the win square — with a comment
 * explaining that a database is as writable by hand as `localStorage`.
 * `stateFromLegacy` has its own. `stateFromPlayer` had none at all, and that is
 * the one the published app's rows come through.
 *
 * What passed it, measured rather than guessed: plan 999 reads back as a game
 * where every throw is refused as `stop` and the player never moves again, with
 * nothing anywhere reporting a fault; plan 41.5 walks a board of half squares
 * that has no text for any of them; and `is_finished` on plan 41 — the row
 * `checkSeat` names in its own message as *not a game* — let the player stroll
 * off the winning square to 47.
 *
 * @param complain  How to report a fault, so each caller names its own row.
 */
function checkPlayable(state: GameState, complain: (what: string) => never): void {
  if (!whole(state.loka, 1, TOTAL_PLANS)) complain(`plan ${state.loka} is off the board`);
  if (!whole(state.previous_loka, 0, TOTAL_PLANS)) {
    complain(`previous plan ${state.previous_loka} is off the board`);
  }
  if (!whole(state.position_before_three_sixes, 0, TOTAL_PLANS)) {
    complain(`fallback square ${state.position_before_three_sixes} is off the board`);
  }
  if (!whole(state.consecutive_sixes, 0, 2)) {
    complain(`a run of ${state.consecutive_sixes} sixes cannot have been stored`);
  }
  if (typeof state.is_finished !== 'boolean') complain('is_finished is not a boolean');
  // Out of play means on the win square and nowhere else — the engine only
  // ever sets the flag there. "Finished on plan 41" is not a game.
  if (state.is_finished && state.loka !== WIN_LOKA) {
    complain(`finished on plan ${state.loka}, which is not the win square`);
  }
}

/**
 * Read a player row as the state the engine expects.
 *
 * @throws StoredRowsError when the row is not a game the engine could have
 *         reached. Thrown for the reason `sessionFromRows` throws: a caller
 *         handed a verdict about an impossible row has no way to know it was
 *         impossible, and `canPlayerRoll` answered *may roll* to every one of
 *         them.
 */
export function stateFromPlayer(player: Pick<
  Player,
  'plan' | 'previous_plan' | 'consecutiveSixes' | 'positionBeforeThreeSixes' | 'isFinished'
>): GameState {
  const state: GameState = {
    loka: player.plan ?? 1,
    previous_loka: player.previous_plan ?? 0,
    direction: '',
    consecutive_sixes: player.consecutiveSixes ?? 0,
    position_before_three_sixes: player.positionBeforeThreeSixes ?? 0,
    is_finished: player.isFinished ?? false,
  };

  // After the defaults, not before: a null column is an unwritten one, and the
  // value it stands in for is a legal opening state.
  checkPlayable(state, (what) => {
    throw new StoredRowsError(`stored player: ${what}`);
  });

  return state;
}

/**
 * The column updates that persist a new state.
 *
 * `needsReport` is the engine's answer, not a second copy of the rule. It was
 * written here by hand as `loka !== previous_loka && !is_finished`, which is
 * `owesReport` as it stood a week ago and wrong three ways since:
 *
 * - a snake that carries a player back to the square they left is an arrival,
 *   and that condition reads it as no move at all;
 * - the winning square is an arrival too — the one the published app always
 *   asks about — and `is_finished` dismissed it;
 * - and it never asked the variant, so `reportAfterSix` had no effect on what
 *   the database believed.
 *
 * A player persisted through this mapping therefore got a free throw where the
 * same game held in memory would have asked for a report: two surfaces playing
 * different games, which is the defect this whole repository exists to have
 * fixed once.
 *
 * Computed at *write* time on purpose. `players` has no direction column, so a
 * state read back out of a row cannot tell a jump home from a refused throw —
 * the column is the memory of what the engine decided while it still knew.
 */
export function playerUpdateFromState(state: GameState, rules: RuleSet, message?: string) {
  return {
    plan: state.loka,
    previous_plan: state.previous_loka,
    consecutiveSixes: state.consecutive_sixes,
    positionBeforeThreeSixes: state.position_before_three_sixes,
    isFinished: state.is_finished,
    needsReport: owesReport(state, rules),
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
  player: Pick<Player, 'needsReport' | 'lastRollAt' | 'lastReportAt'>,
  now: number,
): TurnContext {
  return {
    // The column records the debt; the engine asks about the payment.
    reportSubmitted: !(player.needsReport ?? false),
    lastRollAt: player.lastRollAt ? player.lastRollAt.getTime() : null,
    lastReportAt: player.lastReportAt ? player.lastReportAt.getTime() : null,
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
  player: Pick<Player, 'needsReport' | 'lastRollAt' | 'lastReportAt' | 'ruleset'> &
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
/**
 * A row that cannot be read as a game.
 *
 * Thrown rather than returned as `null` so a caller cannot forget it: the
 * alternative was casting each column into engine state and finding out three
 * files later, when `rules.reports` threw on undefined for every command sent
 * to that chat.
 */
export class StoredRowsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoredRowsError';
  }
}

/** A whole number in a range, which is what every column here should hold. */
function whole(value: unknown, from: number, to: number): boolean {
  return Number.isInteger(value) && (value as number) >= from && (value as number) <= to;
}

/**
 * Check a seat before it becomes a player.
 *
 * The rule is the one the mini app's storage loader uses, for the same reason:
 * a saved game must be one the engine could have produced. A database is as
 * writable by hand as `localStorage`, and it is read by everyone at the table
 * rather than by one player.
 */
function checkSeat(seat: SessionPlayerRow, at: number): void {
  const complain = (what: string) => {
    throw new StoredRowsError(`seat ${at} (${seat.user_id ?? 'no user'}): ${what}`);
  };

  if (typeof seat.user_id !== 'string' || seat.user_id.length === 0) complain('has no user id');
  if (!whole(seat.seat, 0, MAX_SEATS - 1)) complain(`seat number ${seat.seat} is not a seat`);

  // The columns a lone `players` row has too, judged by the one rule.
  checkPlayable(
    {
      loka: seat.plan,
      previous_loka: seat.previous_plan,
      direction: seat.direction ?? '',
      consecutive_sixes: seat.consecutive_sixes,
      position_before_three_sixes: seat.position_before_three_sixes,
      is_finished: seat.is_finished,
    } as GameState,
    complain,
  );

  if (typeof seat.report_submitted !== 'boolean') complain('report_submitted is not a boolean');
}

export function sessionFromRows(
  // `ruleset` is typed nullable rather than following the column, because rows
  // written before the column existed read back as null.
  session: Pick<SessionRow, 'id' | 'turn_index' | 'roll_count'> & { ruleset: string | null },
  seats: ReadonlyArray<SessionPlayerRow>,
): Session {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);

  if (ordered.length === 0) throw new StoredRowsError('a table with no seats');
  if (ordered.length > MAX_SEATS) {
    throw new StoredRowsError(`${ordered.length} seats at a table of ${MAX_SEATS}`);
  }

  const taken = new Set<number>();
  ordered.forEach((seat, at) => {
    checkSeat(seat, at);
    if (taken.has(seat.seat)) {
      throw new StoredRowsError(`two players in seat ${seat.seat}`);
    }
    taken.add(seat.seat);
  });

  // A stale turn index points at nobody, and `currentPlayer` then throws for
  // every command the chat receives rather than for the row that is wrong.
  if (!whole(session.turn_index, 0, ordered.length - 1)) {
    throw new StoredRowsError(
      `turn ${session.turn_index} at a table of ${ordered.length}`,
    );
  }
  if (!whole(session.roll_count, 0, Number.MAX_SAFE_INTEGER)) {
    throw new StoredRowsError(`${session.roll_count} rolls taken`);
  }

  // A variant that no longer exists is not a variant to guess at: falling back
  // to `classic` would change the rules of a game already in progress.
  const ruleset = session.ruleset ?? 'classic';
  if (!isRuleSetId(ruleset)) {
    throw new StoredRowsError(`no rule set named "${ruleset}"`);
  }

  return {
    id: session.id,
    turnIndex: session.turn_index,
    rollCount: session.roll_count,
    rules: ruleSetById(ruleset),
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
        lastReportAt: seat.last_report_at ? seat.last_report_at.getTime() : null,
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
    last_report_at:
      player.lastReportAt === null || player.lastReportAt === undefined
        ? null
        : new Date(player.lastReportAt),
  };
}
