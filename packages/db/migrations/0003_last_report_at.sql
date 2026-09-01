-- When the player last wrote, so the day can be measured from it.
--
-- The published app starts the wait between rolls at `startStepTimer`, which it
-- calls when a report is posted and nowhere else — not at the throw. The
-- `online` and `legacy-mobile` variants say so with `cooldownFrom: 'report'`,
-- and without this column the moment is lost on every restart: a player who
-- wrote yesterday would be asked to wait a day again.
--
-- Null means they have never written one, which is the state every existing row
-- is in and is exactly right for it: nothing to measure from, and the report
-- gate is what stops them until there is.
--
-- Safe to re-run. Safe to run after 0000, 0001 or 0002.

ALTER TABLE session_players ADD COLUMN IF NOT EXISTS last_report_at timestamp;

-- The same for a single player row. `players.last_roll_at` was filled from the
-- published app's `lastStepTime`, which that app sets in `startStepTimer` — at
-- the report. One timestamp came across and it was the wrong field's.
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_report_at timestamp;
