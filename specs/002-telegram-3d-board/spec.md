# The Telegram mini app becomes the mobile game

## What

The mini app the bot opens today is the 2D board — a deliberately lighter
surface than the game the phone app ships. The owner's ask (2026-08-22):
carry the mobile experience into Telegram. Concretely:

1. The bot's Web App button opens the **3D board** (`apps/webgl`) — same
   engine, same rules, the surface the phone plays.
2. The companion **answers** there. `apps/webgl` NOTES.md names this weak
   point 3: "the reflection is a prompt, not an answer... a key needs a
   server". The server now exists — the bot service on Railway — so the key
   stays server-side and the board asks over HTTP.
3. The page behaves as a Telegram Mini App (theme, viewport, ready/expand)
   and degrades to a plain browser exactly as the 2D app does.

## What does not change

- The rules. The engine is the rules (Constitution I); no surface re-derives
  them.
- The 2D mini app is not deleted: it moves to `/leela/classic/` and stays
  reachable.
- No payment surface. The browser board is free; the toll is an App Store
  construct and does not transfer.
- No accounts, no analytics (weak point 4 is a privacy decision, not made
  here).

## Why now

The bot went live on Railway today (volume, companion zai:glm-4.6). The board
already speaks the ask protocol client-side (`askOverHttp`: POST
`{system, question}` to `askUrl()`, SSE `data:` frames streamed back) and lets
a host name the origin via `window.__leelaAsk`. Every piece exists; none are
joined.

## Acceptance

- `https://t27.ai/leela/` serves the 3D board; its companion streams a real
  answer produced by the server route.
- `https://t27.ai/leela/classic/` serves the 2D app unchanged.
- The bot's button opens the 3D board (`DEFAULT_MINI_APP_URL` unchanged).
- The route refuses cleanly: over-long questions, wrong origin, provider
  failure each answer with the JSON error shape `askOverHttp` already reads.
- All package gates green (`vitest`, `tsc`, `tsc -p tsconfig.src.json`), root
  audits green, and the deployed page passes an extended smoke-run.
