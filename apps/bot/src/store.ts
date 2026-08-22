/**
 * Where rooms live between messages.
 *
 * An interface rather than a table, because the bot should be runnable with
 * nothing but a process — and because the Postgres implementation belongs in
 * `@leela/db`, next to the rest of the schema, not here.
 */

import type { Room } from './commands';

/** A table read back, and whether one was refused to give the answer. */
export interface ReadRoom {
  room: Room | null;
  /** True when a row is there and cannot be handed to the engine. */
  unreadable: boolean;
}

export interface RoomStore {
  get(chatId: string): Promise<Room | null>;
  /**
   * The table, and whether there is one that cannot be read.
   *
   * `get` answers `null` to both *no table here* and *there is a table and the
   * engine will not take it*, and two commands act on the difference. `/end`
   * replied *there is no table here* and left the row where it was, so the
   * chat had no way to clear it; `/new` has a guard against replacing a game in
   * progress, and the guard never fired, so the next `/new` wrote a fresh table
   * over every seat at that one — silently, with the reason in a server log
   * nobody at the table can read.
   *
   * Optional, like `roomOf`: a store that keeps rooms in memory cannot have an
   * unreadable one, and saying so by not having the method is this file's own
   * convention.
   */
  read?(chatId: string): Promise<ReadRoom>;

  save(room: Room): Promise<void>;
  delete(chatId: string): Promise<void>;
  /**
   * The table this player is seated at, wherever it is.
   *
   * A room is keyed by the chat it lives in, which is right for every command
   * a player sends at the table. `/ask` is not one of those: the companion
   * answers privately, so the natural place to ask is a private chat — and
   * there is no table there. A player seated in a group was told "take a seat
   * first" while holding one.
   *
   * Optional, like `ReportSink.history`: a store that cannot answer says so by
   * not having the method, and the caller falls back to the chat it is in
   * rather than pretending.
   */
  roomOf?(playerId: string): Promise<Room | null>;
  /**
   * Every table held, in the order they were last played, oldest first.
   *
   * Every method above answers for one chat, because every command arrives in
   * one. The companion's initiative is the first caller with no chat in hand —
   * it visits every seated player once a day — and until it, no store could
   * list what it holds. Optional under the file's own convention: a store that
   * cannot enumerate says so by not having the method, and the initiative
   * visits nobody rather than guessing.
   *
   * The order matters to a caller deduplicating seats: a player at two tables
   * is taken from the one they last played, which is `roomOf`'s answer too.
   */
  allRooms?(): Promise<Room[]>;
}

/**
 * Where a report goes once it is written.
 *
 * Separate from the room store because a report outlives the table it was
 * written at: it belongs to the player's own history of the game.
 */
export interface StoredReport {
  plan: number;
  text: string;
  createdAt: Date;
}

/** Where a move goes, so a game has a history a person can read. */
export interface StepSink {
  record(step: {
    userId: string;
    event: import('@leela/engine').MoveEvent;
    ruleset: import('@leela/engine').RuleSet;
  }): Promise<void>;
}

/** A sink that drops moves, for running without storage. */
export const discardSteps: StepSink = {
  async record() {
    // Nothing. The game still plays; the history is simply not kept.
  },
};

export interface ReportSink {
  /**
   * Keep one report.
   *
   * `at` is when it was *written*, which is not always now: a path arriving as
   * a file carries the moment each entry was made, sometimes a year ago. It
   * was not passed, so every imported entry was stamped with the moment of the
   * import — which falsified the whole history and, worse, made the same file
   * arrive as new every time, duplicating a player's path on each send.
   */
  record(report: {
    userId: string;
    plan: number;
    text: string;
    at?: Date;
  }): Promise<void>;
  /**
   * What a player has written, newest first.
   *
   * Optional: a sink that discards reports has nothing to return, and the
   * caller should say so rather than showing an empty history that looks like
   * the player never wrote anything.
   */
  history?(userId: string): Promise<StoredReport[]>;
  /**
   * What this player is playing for, and a way to set it.
   *
   * Optional together, and for the same reason `history` is: a sink that keeps
   * nothing has no question to return, and the caller must say so rather than
   * answer "you have not chosen one" — which would be a different and untrue
   * statement.
   */
  intention?(userId: string): Promise<string | null>;
  setIntention?(userId: string, text: string): Promise<void>;
}

/** Reports in memory. Enough for a single process and for tests. */
export class MemoryReportSink implements ReportSink {
  readonly reports: Array<{ userId: string; plan: number; text: string; createdAt: Date }> = [];

  constructor(private readonly now: () => number = Date.now) {}

  async record(report: {
    userId: string;
    plan: number;
    text: string;
    at?: Date;
  }): Promise<void> {
    const { at, ...rest } = report;
    this.reports.push({ ...rest, createdAt: at ?? new Date(this.now()) });
  }

  async history(userId: string): Promise<StoredReport[]> {
    return this.reports
      .filter((report) => report.userId === userId)
      .map(({ plan, text, createdAt }) => ({ plan, text, createdAt }))
      .reverse();
  }

  private readonly intentions = new Map<string, string>();

  async intention(userId: string): Promise<string | null> {
    return this.intentions.get(userId) ?? null;
  }

  async setIntention(userId: string, text: string): Promise<void> {
    this.intentions.set(userId, text);
  }
}

/** A sink that drops reports, for running the bot without storage. */
export const discardReports: ReportSink = {
  async record() {
    // Nothing. The gate still works; the writing is simply not kept.
  },
  // No `history`: nothing was kept, and saying so beats showing an empty list.
};

/**
 * What the companion remembers about its own initiative, per player.
 *
 * The daily word (`initiative.ts`) must know three things to knock politely:
 * when it last knocked — so one day carries one message, whatever restarts a
 * tick; which excerpt it read out — so the next is never the one just heard;
 * and whether `/quiet` has closed the door. Kept in the same storage the games
 * live in, in memory when the games are, because the companion's memory should
 * not outlive the games it is a memory of — nor be lost while they survive.
 */
export interface NudgeRecord {
  /** When the daily word was last sent, epoch ms. Null before the first. */
  sentAt: number | null;
  /** Index of the excerpt that send carried. Null before the first. */
  excerpt: number | null;
  /** Whether `/quiet` has turned the daily word off. */
  quieted: boolean;
}

/** A record for a player never written to: the three "not yet" answers. */
export const NEVER_NUDGED: NudgeRecord = { sentAt: null, excerpt: null, quieted: false };

export interface NudgeStore {
  /** What is remembered about this player. Never null: absence is `NEVER_NUDGED`. */
  of(userId: string): Promise<NudgeRecord>;
  /** Remember a send: the moment, and which excerpt it carried. */
  record(userId: string, sent: { at: number; excerpt: number }): Promise<void>;
  /** `/quiet` — both directions, because coming back is part of the command. */
  setQuieted(userId: string, quieted: boolean): Promise<void>;
}

/** Nudge memory in memory. Enough for a single process and for tests. */
export class MemoryNudgeStore implements NudgeStore {
  private readonly records = new Map<string, NudgeRecord>();

  async of(userId: string): Promise<NudgeRecord> {
    return this.records.get(userId) ?? NEVER_NUDGED;
  }

  async record(userId: string, sent: { at: number; excerpt: number }): Promise<void> {
    const held = await this.of(userId);
    this.records.set(userId, { ...held, sentAt: sent.at, excerpt: sent.excerpt });
  }

  async setQuieted(userId: string, quieted: boolean): Promise<void> {
    const held = await this.of(userId);
    this.records.set(userId, { ...held, quieted });
  }
}

/**
 * Rooms in memory.
 *
 * Fine for a single process and for tests. A restart loses every game in
 * progress, which is why it is not the default in production.
 */
export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  async get(chatId: string): Promise<Room | null> {
    return this.rooms.get(chatId) ?? null;
  }

  async save(room: Room): Promise<void> {
    // Deleted first so the map's order is the order of last play, which is what
    // `roomOf` reads to answer "which of your tables did you mean".
    this.rooms.delete(room.chatId);
    this.rooms.set(room.chatId, room);
  }

  async delete(chatId: string): Promise<void> {
    this.rooms.delete(chatId);
  }

  /**
   * The table this player sits at, most recently played first.
   *
   * `save` re-inserts, so the map's order is the order tables were last
   * touched — the newest is what a player asking a question means.
   */
  async roomOf(playerId: string): Promise<Room | null> {
    let found: Room | null = null;
    for (const room of this.rooms.values()) {
      if (room.session.players.some((player) => player.id === playerId)) found = room;
    }
    return found;
  }

  /** Every table held, oldest-played first — the map's own insertion order. */
  async allRooms(): Promise<Room[]> {
    return [...this.rooms.values()];
  }

  /** Rooms currently held. Exposed for tests and for a health endpoint. */
  get size(): number {
    return this.rooms.size;
  }
}

/**
 * A seed for a new room.
 *
 * Derived from the chat id and a caller-supplied number rather than from
 * `Math.random()`, so a room's die is reproducible from values that are
 * already recorded, and two rooms opened in the same millisecond still differ.
 */
export function seedFor(chatId: string, salt: number): number {
  let hash = 2166136261;
  for (const char of `${chatId}:${salt}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
