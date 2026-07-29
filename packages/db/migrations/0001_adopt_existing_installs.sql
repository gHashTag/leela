-- Adopting a database that already ran NeuroLeela.
--
-- The Expo app created `players`, `reports` and `chat_history` without the
-- columns the unified engine needs. Run this instead of 0000 when the tables
-- already exist; it only adds what is missing and never rewrites a value.
--
-- Safe to re-run. Safe to run after 0000.

-- Columns the engine needs -----------------------------------------------------

ALTER TABLE players ADD COLUMN IF NOT EXISTS ruleset      text NOT NULL DEFAULT 'neuroleela';
ALTER TABLE players ADD COLUMN IF NOT EXISTS legacy_id    text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS language     text NOT NULL DEFAULT 'en';
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_roll_at timestamp;

-- `neuroleela` is deliberately the default: every row that predates this
-- migration was created by the Expo app and was playing those rules. Setting
-- it to anything else would silently change the game under a live player.

-- Backfill ---------------------------------------------------------------------

-- Rows written before `last_roll_at` existed have `updated_at` as the closest
-- honest approximation of when the player last acted. Only fill rows that have
-- actually moved — a player still waiting to enter has never rolled.
UPDATE players
   SET last_roll_at = updated_at
 WHERE last_roll_at IS NULL
   AND updated_at IS NOT NULL
   AND previous_plan IS NOT NULL
   AND previous_plan <> 0;

-- Constraints ------------------------------------------------------------------
-- Added after the backfill so an existing bad row surfaces as a failure here
-- rather than corrupting the backfill.

CREATE UNIQUE INDEX IF NOT EXISTS players_legacy_id_key
  ON players (legacy_id) WHERE legacy_id IS NOT NULL;

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_ruleset_known;
ALTER TABLE players ADD CONSTRAINT players_ruleset_known
  CHECK (ruleset IN ('classic', 'neuroleela', 'legacy-mobile', 'online'));

-- Left as NOT VALID: existing rows are not checked, new writes are. A player
-- sitting on a bad plan is a bug to investigate, not a reason to block the
-- migration on a live database.
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_plan_on_board;
ALTER TABLE players ADD CONSTRAINT players_plan_on_board
  CHECK (plan BETWEEN 1 AND 72) NOT VALID;

-- Find any offenders before validating:
--   SELECT id, plan FROM players WHERE plan NOT BETWEEN 1 AND 72;
-- Then, once clean:
--   ALTER TABLE players VALIDATE CONSTRAINT players_plan_on_board;
