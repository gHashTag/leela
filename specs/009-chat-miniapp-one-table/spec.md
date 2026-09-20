# Chat and mini app are one table

## What

When the bot opens the Telegram mini app from a running table, the board shows
that table and a throw made on the board is the same authoritative throw the
chat records. The browser must not start a second local game behind a button
labelled as the table's board.

## Why

The bot and the browser already call the same engine, but they keep different
sessions and use different dice. Equal rules do not make two independent games
equal. A player can therefore stand on one plan in chat and another in the mini
app after a single throw.

## Acceptance

- A board button sent for a table carries only that table's id; no game state or
  credential is trusted from the URL.
- The Railway service validates Telegram `initData`, checks that its user is
  seated at that table, and returns the stored session.
- A mini-app throw is decided by `commands.roll`, persisted before it is shown,
  recorded in the move log, and broadcast to the chat.
- Concurrent throw requests for one table cannot both consume the same turn.
- A launch without a table id remains the existing standalone browser game.
- A linked launch that cannot authenticate or load never silently falls back to
  a second local game.
- Bot, WebGL, engine, content and journal gates pass, followed by the root gate.

## Boundaries

- No game rule changes and no new `RuleSet`.
- Reports and companion conversation remain on their existing transports; this
  change joins the table state and its throws.
- Deployment is not performed from this checkout, per the repository boundary.

