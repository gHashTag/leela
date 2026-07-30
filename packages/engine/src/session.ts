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
      reportSubmitted: true,
    })),
    turnIndex: 0,
    rules,
    rollCount: 0,
  };
}

/** Whoever holds the turn. */
export function currentPlayer(session: Session): SeatedPlayer {
  return session.players[session.turnIndex];
}

/** Whether the player holding the turn may roll, and why not when they may not. */
export function canCurrentPlayerRoll(session: Session, now: number): TurnVerdict {
  const player = currentPlayer(session);
  const context: TurnContext = {
    reportSubmitted: player.reportSubmitted,
    lastRollAt: player.lastRollAt,
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
    if (!isPlayerDone(session.players[candidate])) return candidate;
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

  const nowOwesReport = session.rules.requireReportBeforeRoll && owesReport(state);

  const moved: SeatedPlayer = {
    ...player,
    state,
    lastRollAt: now,
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
export function submitReport(session: Session, playerId: string): Session {
  const index = session.players.findIndex((p) => p.id === playerId);
  if (index === -1) throw new SessionError(`no player ${playerId} in session ${session.id}`);

  const players = session.players.map((p, i) =>
    i === index ? { ...p, reportSubmitted: true } : p,
  );
  return { ...session, players };
}

/** Seats ordered by progress, for a leaderboard. Ties keep seating order. */
export function standings(session: Session): SeatedPlayer[] {
  return [...session.players].sort((a, b) => {
    const aDone = isPlayerDone(a) ? 1 : 0;
    const bDone = isPlayerDone(b) ? 1 : 0;
    if (aDone !== bDone) return bDone - aDone;
    return b.state.loka - a.state.loka;
  });
}
