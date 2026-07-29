/**
 * A room, on disk.
 *
 * Splitting a `Room` into rows and back is pure, so it can be tested exactly —
 * and it needs to be, because the failure mode is silent: a game that reloads
 * with the wrong turn holder, or in the wrong language, looks like a game.
 *
 * The actual queries live behind `RoomQueries`, a four-method interface. That
 * keeps this file free of a driver and lets the store be tested against a fake
 * without a Postgres to hand.
 */

import { sessionFromRows, sessionUpdate, seatUpdate } from '@leela/db';
import type { SessionPlayerRow, SessionRow } from '@leela/db';
import { resolveLanguage } from '@leela/content';
import type { Room } from './commands';
import type { RoomStore } from './store';

/** The session row a room writes, minus the columns the database fills in. */
export interface StoredSession {
  id: string;
  host_id: string;
  ruleset: string;
  turn_index: number;
  roll_count: number;
  dice_seed: number | null;
  is_open: boolean;
  language: string;
}

/** A seat row, minus the surrogate key. */
export interface StoredSeat {
  session_id: string;
  user_id: string;
  seat: number;
  name: string | null;
  plan: number;
  previous_plan: number;
  direction: string;
  consecutive_sixes: number;
  position_before_three_sixes: number;
  is_finished: boolean;
  last_roll_at: Date | null;
  report_submitted: boolean;
}

/** Split a room into the rows that represent it. */
export function roomToRows(room: Room): { session: StoredSession; seats: StoredSeat[] } {
  const base = sessionUpdate(room.session);

  return {
    session: {
      id: room.chatId,
      // Seat zero opened the table; that is the whole definition of the host.
      host_id: room.session.players[0].id,
      ruleset: base.ruleset,
      turn_index: base.turn_index,
      // The engine's roll count and the bot's are the same number, so storing
      // both would be two places to get out of step.
      roll_count: room.rollsTaken,
      dice_seed: room.seed,
      // `is_open` means "still taking players", which is the inverse of started.
      is_open: !room.started,
      language: room.language,
    },
    seats: room.session.players.map((player, seat) => ({
      session_id: room.chatId,
      user_id: player.id,
      seat,
      name: player.name ?? room.names[player.id] ?? null,
      ...seatUpdate(player),
    })),
  };
}

/** Rebuild a room from its rows. Seats may arrive in any order. */
export function roomFromRows(
  session: Pick<
    SessionRow,
    'id' | 'turn_index' | 'roll_count' | 'dice_seed' | 'is_open'
  > & { ruleset: string | null; language: string | null },
  seats: ReadonlyArray<SessionPlayerRow>,
): Room {
  const engineSession = sessionFromRows(session, seats);

  const names: Record<string, string> = {};
  for (const seat of seats) {
    if (seat.name) names[seat.user_id] = seat.name;
  }

  return {
    chatId: session.id,
    session: engineSession,
    // A row written before `dice_seed` existed still has to produce a die;
    // zero is a valid seed and keeps the game deterministic either way.
    seed: session.dice_seed ?? 0,
    rollsTaken: session.roll_count,
    language: resolveLanguage(session.language),
    started: !session.is_open,
    names,
  };
}

/**
 * The queries a room store needs. Four methods, so a fake is cheap.
 *
 * Implementations must apply `upsertSession` and `replaceSeats` atomically —
 * a room half-written after a roll is a game with the wrong turn holder.
 */
export interface RoomQueries {
  loadSession(chatId: string): Promise<SessionRow | null>;
  loadSeats(chatId: string): Promise<SessionPlayerRow[]>;
  /** Insert or update the session row and replace its seats, in one transaction. */
  save(session: StoredSession, seats: StoredSeat[]): Promise<void>;
  remove(chatId: string): Promise<void>;
}

/** A room store backed by the database. */
export class DatabaseRoomStore implements RoomStore {
  constructor(private readonly queries: RoomQueries) {}

  async get(chatId: string): Promise<Room | null> {
    const session = await this.queries.loadSession(chatId);
    if (!session) return null;

    const seats = await this.queries.loadSeats(chatId);
    // A session with no seats is corrupt rather than empty — a table always
    // has at least the host. Treat it as absent instead of crashing a chat.
    if (seats.length === 0) return null;

    return roomFromRows(session, seats);
  }

  async save(room: Room): Promise<void> {
    const { session, seats } = roomToRows(room);
    await this.queries.save(session, seats);
  }

  async delete(chatId: string): Promise<void> {
    await this.queries.remove(chatId);
  }
}
