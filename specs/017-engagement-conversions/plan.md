# Plan: privacy-minimal engagement conversions

## Architecture

1. Extend `NudgeStore` with one best-effort, non-throwing conversion operation for
   `response | roll`, bounded to the latest delivered word and 24 hours.
2. Keep only two deduplication timestamps per player, each equal to the
   existing nudge `sent_at`; derive aggregate counts for a tick by equality.
3. Attribute accepted report and move effects in the Telegram bot, and a
   successful Mini App move in the shared server adapter. Metric writes are
   caught and logged without changing the game result.
4. Add the derived aggregate to `lastTick` and `lastWordSaid`. Before a new tick
   overwrites the single durable row, log the completed previous summary.
5. Migrate the deployed SQLite volume additively through the existing schema
   reconciler; memory and SQLite implementations keep the same contract.

## Verification

Write and run the store contract test RED first. Reach focused GREEN across
store, SQLite, Telegram effect, Mini App roll, summary, restart/migration, then
run package suites, `bun run verify`, explicit root audits, independent review,
all GitHub checks, and the existing Railway production deploy/runtime probes.
