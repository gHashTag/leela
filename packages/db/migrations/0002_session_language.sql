-- A table is played in one language, and it has to survive a restart.
--
-- The bot held the room's language in memory alongside the seed and the roll
-- count, both of which the sessions table already stores. Without this column a
-- restarted game silently reverts to English for everyone at the table.
--
-- Safe to re-run. Safe to run after 0000 or 0001.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- English is the right default here, not a guess: it is what `resolveLanguage`
-- falls back to, so a row written before this column behaves exactly as it did.
