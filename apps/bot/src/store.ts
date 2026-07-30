/**
 * Where rooms live between messages.
 *
 * An interface rather than a table, because the bot should be runnable with
 * nothing but a process — and because the Postgres implementation belongs in
 * `@leela/db`, next to the rest of the schema, not here.
 */

import type { Room } from './commands';

export interface RoomStore {
  get(chatId: string): Promise<Room | null>;
  save(room: Room): Promise<void>;
  delete(chatId: string): Promise<void>;
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
}

/** A sink that drops reports, for running the bot without storage. */
export const discardReports: ReportSink = {
  async record() {
    // Nothing. The gate still works; the writing is simply not kept.
  },
  // No `history`: nothing was kept, and saying so beats showing an empty list.
};

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
    this.rooms.set(room.chatId, room);
  }

  async delete(chatId: string): Promise<void> {
    this.rooms.delete(chatId);
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
