/**
 * @leela/db — the persisted shape of a game.
 *
 * Carried over from NeuroLeelaAgent/db/schema.ts so existing rows keep working,
 * with three additions the unification needs:
 *
 *   - `ruleset` on players, so a game stays reproducible when the rules change
 *   - `game_steps`, a full move log; the app only ever kept the latest position
 *   - `legacy_id` on players, to map a migrated `com.leelagame` account
 */

import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: text('id').primaryKey(),
  /** Current plan, 1..72. */
  plan: integer('plan').notNull().default(1),
  previous_plan: integer('previous_plan').default(0),
  updated_at: timestamp('updated_at').defaultNow(),
  created_at: timestamp('created_at').defaultNow(),
  message: text('message'),
  avatar: text('avatar'),
  fullName: text('full_name'),
  intention: text('intention'),
  isStart: boolean('is_start').default(false),
  isFinished: boolean('is_finished').default(false),
  consecutiveSixes: integer('consecutive_sixes').default(0),
  positionBeforeThreeSixes: integer('position_before_three_sixes').default(0),
  needsReport: boolean('needs_report').default(false),

  /**
   * Which rule variant this player's game runs under: 'classic',
   * 'neuroleela', 'legacy-mobile' or 'online'. Defaults to what the newest app
   * shipped, so migrating a row without setting it changes nothing.
   */
  ruleset: text('ruleset').notNull().default('neuroleela'),

  /** When this player last rolled. Drives the cooldown between turns. */
  lastRollAt: timestamp('last_roll_at'),

  /** Firebase uid of a migrated com.leelagame account, when there was one. */
  legacyId: text('legacy_id'),

  /** Preferred content language, a primary subtag like `ru`. */
  language: text('language').notNull().default('en'),
});

/**
 * Every move, not just the latest position.
 *
 * The shipped app overwrote `players.plan` on each roll and kept a history
 * only in Firebase, per device. Recording moves here makes a game auditable,
 * replayable through `@leela/engine`'s `replay()`, and comparable across
 * surfaces.
 */
export const gameSteps = pgTable('game_steps', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  /** 1..6 */
  roll: integer('roll').notNull(),
  from_plan: integer('from_plan').notNull(),
  to_plan: integer('to_plan').notNull(),
  /** 'step 🚶🏼' | 'snake 🐍' | 'arrow 🏹' | 'stop 🛑' | 'win 🕉' */
  direction: text('direction').notNull(),
  /** The square a snake or an arrow caught the player on, when one did. */
  jumped_from: integer('jumped_from'),
  is_game_start: boolean('is_game_start').default(false),
  is_game_finished: boolean('is_game_finished').default(false),
  is_three_sixes_reset: boolean('is_three_sixes_reset').default(false),
  /** The variant in force for this move, copied so history survives a change. */
  ruleset: text('ruleset').notNull().default('neuroleela'),
  created_at: timestamp('created_at').defaultNow(),
});

/**
 * A group game: several players sharing one board.
 *
 * The published app seated up to six players on one device and had no way to
 * play a group game across devices. Sessions are that missing piece, and the
 * reason they are modelled here rather than inside the app.
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  /** Who opened the table; they facilitate it. */
  host_id: text('host_id').notNull(),
  /** Which variant everyone at this table plays. */
  ruleset: text('ruleset').notNull().default('classic'),
  /** Index into the seats, of whoever holds the turn. */
  turn_index: integer('turn_index').notNull().default(0),
  /** Rolls taken at this table, across all seats. */
  roll_count: integer('roll_count').notNull().default(0),
  /**
   * Seed for the session's die. Storing it makes the whole game replayable
   * and lets a player verify a roll they did not witness.
   */
  dice_seed: integer('dice_seed'),
  /**
   * True while the table is still taking players. Flipped once the host
   * starts, which is the same thing as "play has begun".
   */
  is_open: boolean('is_open').notNull().default(true),
  /** Language the table is played in, a primary subtag like `ru`. */
  language: text('language').notNull().default('en'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

/** One seat at a session. Mirrors `SeatedPlayer` in the engine. */
export const sessionPlayers = pgTable('session_players', {
  id: serial('id').primaryKey(),
  session_id: text('session_id').notNull(),
  user_id: text('user_id').notNull(),
  /** Seat order, 0-based. Determines who follows whom. */
  seat: integer('seat').notNull(),
  name: text('name'),
  plan: integer('plan').notNull().default(68),
  previous_plan: integer('previous_plan').notNull().default(0),
  /** How this player reached their current plan. Empty before their first roll. */
  direction: text('direction').notNull().default(''),
  consecutive_sixes: integer('consecutive_sixes').notNull().default(0),
  position_before_three_sixes: integer('position_before_three_sixes').notNull().default(0),
  is_finished: boolean('is_finished').notNull().default(true),
  last_roll_at: timestamp('last_roll_at'),
  /** False while this player owes a report on the plan they are standing on. */
  report_submitted: boolean('report_submitted').notNull().default(true),
});

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  plan_number: integer('plan_number').notNull(),
  content: text('content').notNull(),
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const chatHistory = pgTable('chat_history', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  plan_number: integer('plan_number').notNull(),
  user_message: text('user_message').notNull(),
  ai_response: text('ai_response').notNull(),
  /** Set when the exchange is about a specific report. */
  report_id: integer('report_id'),
  /** 'report' | 'question' | 'general' */
  message_type: text('message_type').notNull().default('report'),
  created_at: timestamp('created_at').defaultNow(),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type SessionPlayerRow = typeof sessionPlayers.$inferSelect;
export type NewSessionPlayerRow = typeof sessionPlayers.$inferInsert;
export type GameStepRow = typeof gameSteps.$inferSelect;
export type NewGameStepRow = typeof gameSteps.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ChatHistory = typeof chatHistory.$inferSelect;
export type NewChatHistory = typeof chatHistory.$inferInsert;
