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
   * 'neuroleela' or 'legacy-mobile'. Defaults to what the newest app shipped,
   * so migrating a row without setting it changes nothing.
   */
  ruleset: text('ruleset').notNull().default('neuroleela'),

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
export type GameStepRow = typeof gameSteps.$inferSelect;
export type NewGameStepRow = typeof gameSteps.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ChatHistory = typeof chatHistory.$inferSelect;
export type NewChatHistory = typeof chatHistory.$inferInsert;
