/**
 * A session: several players sharing one board.
 *
 * Leela is traditionally played in a facilitated group, and the published app
 * supported up to six players passing one device. The rewrite dropped that and
 * became single-player. None of the competing apps offer synchronous group
 * play either, so this is the part worth getting right.
 *
 * Like the rest of the engine, a session is a value: `advance` maps a session
 * and a roll onto the next session. Who stores it and how players reach it is
 * somebody else's problem.
 */

import { applyRoll, hasWon, initialState } from './game';
import { DEFAULT_RULESET, type RuleSet } from './rulesets';
import { canRoll, owesReport, type TurnContext, type TurnVerdict } from './turn';
import type { GameState, MoveEvent } from './types';

/** The published app seated six; the traditional game has no hard limit. */
export const MAX_SEATS = 6;

export interface SeatedPlayer {
  /** Stable id: a user id online, a seat number when sharing a device. */
  id: string;
  /** Display name, when there is one. */
  name?: string;
  state: GameState;
  /** When this player last rolled, epoch ms. Null before their first roll. */
  lastRollAt: number | null;
  /** Whether they have filed a report for the plan they are standing on. */
  reportSubmitted: boolean;
  /**
   * When they last filed one, epoch ms. Null if they never have.
   *
   * Kept because a variant may measure the wait between rolls from the report
   * rather than from the throw — see `cooldownFrom`. Required rather than
   * optional: `undefined` and `null` would be two ways to say "never", and a
   * round trip through a database turns the first into the second.
   */
  lastReportAt: number | null;
}

export interface Session {
  id: string;
  players: SeatedPlayer[];
  /** Index into `players` of whoever holds the turn. */
  turnIndex: number;
  rules: RuleSet;
  /** Rolls taken in this session, across all players. */
  rollCount: number;
}

export class SessionError extends Error {}

/** Seat a new session. Every player starts off the board, waiting for a six. */
export function createSession(
  id: string,
  players: ReadonlyArray<{ id: string; name?: string }>,
  rules: RuleSet = DEFAULT_RULESET,
): Session {
  if (players.length < 1 || players.length > MAX_SEATS) {
    throw new SessionError(`a session seats 1..${MAX_SEATS} players, got ${players.length}`);
  }

  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) {
    throw new SessionError('player ids must be unique within a session');
  }

  return {
    id,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      state: initialState(),
      lastRollAt: null,
      lastReportAt: null,
      reportSubmitted: true,
    })),
    turnIndex: 0,
    rules,
    rollCount: 0,
  };
}

/** Whoever holds the turn. */
/**
 * Whoever holds the turn.
 *
 * Throws on a turn index that points at nobody. The signature promised a
 * `SeatedPlayer` and would hand back `undefined` for a session read out of a
 * database with a stale `turn_index` — the caller then failed on `.id`, two
 * files away from the row that was wrong.
 */
export function currentPlayer(session: Session): SeatedPlayer {
  const player = session.players[session.turnIndex];
  if (!player) {
    throw new SessionError(
      `turn ${session.turnIndex} at a table of ${session.players.length}`,
    );
  }
  return player;
}

/** Whether the player holding the turn may roll, and why not when they may not. */
export function canCurrentPlayerRoll(session: Session, now: number): TurnVerdict {
  /**
   * A session nobody can move in, asked before the seat is.
   *
   * `advance` throws `SessionError` on a finished session, and this said
   * `allowed` for the same one: `canRoll` is asked about a *player*, and its
   * winner branch is guarded by `mayReenterAfterWinning`, which `classic` sets
   * true. So on the phone — one seat, so winning ends the session — the throw
   * button stayed lit on Cosmic Consciousness and pressing it threw inside the
   * handler. The last act of a finished game was a crash.
   *
   * The check has to answer for the act it precedes. Whether a winner may begin
   * again is still `canRoll`'s question and still the ruleset's to answer; this
   * is the prior one, and `advance` has always answered it the same way.
   */
  if (isSessionOver(session)) {
    return { allowed: false, reason: 'finished', nextAllowedAt: null, waitMs: 0 };
  }

  const player = currentPlayer(session);
  const context: TurnContext = {
    reportSubmitted: player.reportSubmitted,
    lastRollAt: player.lastRollAt,
    lastReportAt: player.lastReportAt,
    now,
  };
  return canRoll(player.state, context, session.rules);
}

/**
 * Pass the turn to the next player who is still playing.
 *
 * A player who has won keeps their seat but is skipped. When everyone has
 * finished the turn stays where it is — `isSessionOver` is the check for that.
 */
function nextSeat(session: Session, from: number): number {
  const count = session.players.length;
  for (let step = 1; step <= count; step++) {
    const candidate = (from + step) % count;
    const player = session.players[candidate];
    // `count` is never zero for a session `createSession` built, but the
    // modulo of zero is NaN and the seat it indexes is nobody — so the check
    // is here rather than in a comment about what cannot happen.
    if (player && !isPlayerDone(player)) return candidate;
  }
  return from;
}

/**
 * A player who reached Cosmic Consciousness after being on the board.
 *
 * Delegates to `hasWon` rather than repeating the condition: the same check
 * lived in three places, and the one in `game.ts` was wrong.
 */
function isPlayerDone(player: SeatedPlayer): boolean {
  return hasWon(player.state);
}

/** True once no seated player can still move. */
export function isSessionOver(session: Session): boolean {
  return session.players.every(isPlayerDone);
}

export interface SessionMove {
  session: Session;
  event: MoveEvent;
  /** The player who rolled. */
  playerId: string;
  /** True when the same player keeps the turn — a six, under variants that allow it. */
  keepsTurn: boolean;
  /** True when this roll left the player owing a report. */
  owesReport: boolean;
}

/**
 * Roll for whoever holds the turn.
 *
 * @param now  Epoch ms, passed in so this stays pure and testable.
 * @throws SessionError when the current player is not allowed to roll; the
 *         message names the reason so a caller can show it verbatim.
 */
export function advance(session: Session, roll: number, now: number): SessionMove {
  if (isSessionOver(session)) {
    throw new SessionError('every player has finished; the session is over');
  }

  const verdict = canCurrentPlayerRoll(session, now);
  if (!verdict.allowed) {
    throw new SessionError(`player may not roll: ${verdict.reason}`);
  }

  const player = currentPlayer(session);
  const { state, event } = applyRoll(player.state, roll, session.rules);

  const nowOwesReport = session.rules.requireReportBeforeRoll && owesReport(state, session.rules);

  // A throw that could not be made does not start the day's wait. The
  // published app never reaches `createHistory` when the throw would overshoot
  // the board, so a player who cannot move is not made to wait for it.
  const counts = !event.isBlocked || session.rules.refusedThrowStartsCooldown;

  const moved: SeatedPlayer = {
    ...player,
    state,
    lastRollAt: counts ? now : player.lastRollAt,
    // A player who moved owes a report before their next roll.
    reportSubmitted: !nowOwesReport,
  };

  const players = session.players.map((p, i) => (i === session.turnIndex ? moved : p));

  // A six keeps the turn, but only if the player can still act.
  const keepsTurn = event.grantsExtraTurn && !isPlayerDone(moved);

  const next: Session = {
    ...session,
    players,
    turnIndex: keepsTurn ? session.turnIndex : nextSeat({ ...session, players }, session.turnIndex),
    rollCount: session.rollCount + 1,
  };

  return {
    session: next,
    event,
    playerId: player.id,
    keepsTurn,
    owesReport: nowOwesReport,
  };
}

/**
 * Record that a player filed their report, unblocking their next roll.
 * A no-op for a player who did not owe one.
 */
export function submitReport(session: Session, playerId: string, at?: number): Session {
  const index = session.players.findIndex((p) => p.id === playerId);
  if (index === -1) throw new SessionError(`no player ${playerId} in session ${session.id}`);

  const players = session.players.map((p, i) =>
    i === index
      ? { ...p, reportSubmitted: true, lastReportAt: at ?? p.lastReportAt }
      : p,
  );
  return { ...session, players };
}

/**
 * Is this player still outside the game, waiting for a six?
 *
 * They sit on WIN_LOKA, which is the highest number on the board — so sorting
 * by `loka` alone put a player who had never rolled at the top of the table, as
 * though they were one square from winning. Same trap as `hasWon`: 68 means two
 * different things depending on how you got there.
 */
function isWaitingToEnter(player: SeatedPlayer): boolean {
  return player.state.is_finished && !hasWon(player.state);
}

/**
 * Seats ordered by progress, for a leaderboard.
 *
 * Three groups, in order: those who have finished, those on the board by how
 * far along they are, and those still waiting to enter. Ties keep seating
 * order.
 */
export function standings(session: Session): SeatedPlayer[] {
  const rank = (player: SeatedPlayer): number => {
    if (isPlayerDone(player)) return 2;
    return isWaitingToEnter(player) ? 0 : 1;
  };

  return [...session.players].sort((a, b) => {
    const byGroup = rank(b) - rank(a);
    if (byGroup !== 0) return byGroup;

    // Within a group, further along comes first. For two players waiting to
    // enter this is a no-op, which is why seating order survives.
    return b.state.loka - a.state.loka;
  });
}
