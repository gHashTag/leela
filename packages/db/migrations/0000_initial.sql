-- Leela: initial schema.
--
-- Written by hand rather than generated, because it has to be readable by
-- whoever runs it against a database that already holds live players. Every
-- statement is guarded so the file is safe to re-run.
--
-- Matches packages/db/src/schema.ts. If you change one, change both.

-- Players -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS players (
  id                          text PRIMARY KEY,
  plan                        integer NOT NULL DEFAULT 1,
  previous_plan               integer DEFAULT 0,
  updated_at                  timestamp DEFAULT now(),
  created_at                  timestamp DEFAULT now(),
  message                     text,
  avatar                      text,
  full_name                   text,
  intention                   text,
  is_start                    boolean DEFAULT false,
  is_finished                 boolean DEFAULT false,
  consecutive_sixes           integer DEFAULT 0,
  position_before_three_sixes integer DEFAULT 0,
  needs_report                boolean DEFAULT false,
  ruleset                     text NOT NULL DEFAULT 'neuroleela',
  legacy_id                   text,
  language                    text NOT NULL DEFAULT 'en',
  last_roll_at                timestamp
);

-- A migrated account must map to exactly one row, or reconciling the two
-- systems after the cutover is guesswork.
CREATE UNIQUE INDEX IF NOT EXISTS players_legacy_id_key
  ON players (legacy_id) WHERE legacy_id IS NOT NULL;

-- A plan off the board means something upstream is broken; refuse it here too.
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_plan_on_board;
ALTER TABLE players ADD CONSTRAINT players_plan_on_board
  CHECK (plan BETWEEN 1 AND 72);

-- The list must be the engine's `RULESETS`, all of it. It was not: this
-- constraint named four variants while `@leela/engine` declared six, having
-- gone stale once when `onchain` was added and again when `telegram` was.
-- A row written by either of those surfaces would have been refused here.
-- Corrected in place on 2026-08-06, adding `onchain` and `telegram`, because
-- no database has ever run this file — the Firebase and Supabase exports have
-- not happened and this repository holds no connection string (MIGRATION.md,
-- "Remaining, in order", item 2). Once it has run somewhere, add a forward
-- migration instead of editing this line.
-- Held by packages/db/tests/migrations.test.ts, which now derives the set from
-- the engine rather than restating it.
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_ruleset_known;
ALTER TABLE players ADD CONSTRAINT players_ruleset_known
  CHECK (ruleset IN ('classic', 'neuroleela', 'legacy-mobile', 'online', 'onchain', 'telegram'));

-- Move log ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS game_steps (
  id                   serial PRIMARY KEY,
  user_id              text NOT NULL,
  roll                 integer NOT NULL,
  from_plan            integer NOT NULL,
  to_plan              integer NOT NULL,
  direction            text NOT NULL,
  jumped_from          integer,
  is_game_start        boolean DEFAULT false,
  is_game_finished     boolean DEFAULT false,
  is_three_sixes_reset boolean DEFAULT false,
  ruleset              text NOT NULL DEFAULT 'neuroleela',
  created_at           timestamp DEFAULT now()
);

ALTER TABLE game_steps DROP CONSTRAINT IF EXISTS game_steps_roll_is_a_die;
ALTER TABLE game_steps ADD CONSTRAINT game_steps_roll_is_a_die
  CHECK (roll BETWEEN 1 AND 6);

CREATE INDEX IF NOT EXISTS game_steps_user_created_idx
  ON game_steps (user_id, created_at DESC);

-- Sessions ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sessions (
  id          text PRIMARY KEY,
  host_id     text NOT NULL,
  ruleset     text NOT NULL DEFAULT 'classic',
  turn_index  integer NOT NULL DEFAULT 0,
  roll_count  integer NOT NULL DEFAULT 0,
  dice_seed   integer,
  is_open     boolean NOT NULL DEFAULT true,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);

-- Same correction as on `players` above, and the same reason. `roomToRows`
-- writes `session.rules.id` straight into this column, so a Telegram-hosted
-- room would have been the first thing to hit the refusal. `onchain` and
-- `telegram` added 2026-08-06; these migrations have never been applied
-- anywhere, so this is an edit rather than a forward migration.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_ruleset_known;
ALTER TABLE sessions ADD CONSTRAINT sessions_ruleset_known
  CHECK (ruleset IN ('classic', 'neuroleela', 'legacy-mobile', 'online', 'onchain', 'telegram'));

CREATE TABLE IF NOT EXISTS session_players (
  id                          serial PRIMARY KEY,
  session_id                  text NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  user_id                     text NOT NULL,
  seat                        integer NOT NULL,
  name                        text,
  plan                        integer NOT NULL DEFAULT 68,
  previous_plan               integer NOT NULL DEFAULT 0,
  direction                   text NOT NULL DEFAULT '',
  consecutive_sixes           integer NOT NULL DEFAULT 0,
  position_before_three_sixes integer NOT NULL DEFAULT 0,
  is_finished                 boolean NOT NULL DEFAULT true,
  last_roll_at                timestamp,
  report_submitted            boolean NOT NULL DEFAULT true
);

-- Turn order depends on seats being distinct, and a player sits once.
CREATE UNIQUE INDEX IF NOT EXISTS session_players_seat_key
  ON session_players (session_id, seat);
CREATE UNIQUE INDEX IF NOT EXISTS session_players_user_key
  ON session_players (session_id, user_id);

-- The published app seated six.
ALTER TABLE session_players DROP CONSTRAINT IF EXISTS session_players_seat_range;
ALTER TABLE session_players ADD CONSTRAINT session_players_seat_range
  CHECK (seat BETWEEN 0 AND 5);

-- Reports and chat -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS reports (
  id          serial PRIMARY KEY,
  user_id     text NOT NULL,
  plan_number integer NOT NULL,
  content     text NOT NULL,
  likes       integer DEFAULT 0,
  comments    integer DEFAULT 0,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_user_idx ON reports (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_history (
  id           serial PRIMARY KEY,
  user_id      text NOT NULL,
  plan_number  integer NOT NULL,
  user_message text NOT NULL,
  ai_response  text NOT NULL,
  report_id    integer,
  message_type text NOT NULL DEFAULT 'report',
  created_at   timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_history_user_idx ON chat_history (user_id, created_at DESC);
