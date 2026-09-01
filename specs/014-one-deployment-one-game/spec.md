# Specification: One deployment, one game

## Problem

The bot API had the synchronized game while GitHub Pages continued serving an
older board bundle. A player therefore saw chat plan 6 and local plan 41 in one
Telegram window even though the API already knew the correct state.

## Contract

- The Railway service serves the reviewed 3D board and the bot API from one
  image and one origin.
- The board calls that same origin for game state and rolls.
- Telegram's global menu button opens that Railway board.
- Static paths cannot escape the built artifact.
- API routes keep their existing authentication and CORS contract.

## Acceptance

- The Docker image builds and carries the 3D board, classic board, and docs.
- The production root returns the new bundle and `/api/game` remains live.
- Runtime logs name both the board root and the Telegram listener.
- Telegram `getChatMenuButton` returns the Railway URL after the update.
