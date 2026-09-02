# Plan: Telegram-native acquisition surfaces

## Architecture

1. Update the Z.AI Coding Plan default to GLM-4.7 and retain provider business
   codes in `ModelError`, so 1113 is circuit-broken and can be probed without
   copying provider response bodies into logs.
2. Add a small acquisition module that owns the closed source vocabulary,
   parses `/start` and signed `start_param` values, builds Main Mini App links,
   and records first touch best-effort.
3. Add an `AcquisitionStore` beside the payment funnel, with memory and SQLite
   adapters. SQLite uses one additive table keyed by player and joins it only
   into aggregate completed-day reads.
4. Extend signed Telegram launch identity with bounded `start_param`. Let the
   `/api/game` callback create and persist a solo private room when none exists,
   then return the same standing contract already used by the board.
5. Handle `guest_message` at raw middleware level because the installed
   grammY Bot API types predate Bot API 10.0. Call `answerGuestQuery` through
   the raw API. Handle supported `inline_query` through grammY. Both share one
   pure plan-card composer and a Main Mini App CTA.
6. Publish aggregate per-source start/purchase rows in the existing daily
   revenue report. Keep the public-post counter for its daily-post health
   question; acquisition is a separate first-touch view.
7. After merge, set Railway's explicit `ZAI_MODEL=glm-4.7`, configure Guest,
   Inline and Main Mini App in BotFather, then verify `getMe`, signed game
   continuity, source aggregates, coder canary and anonymized logs.

## Safety

- Guest and inline content sees plan text plus the caller's current question,
  never private journal data or unrelated chat context.
- BotFather changes are limited to the named production bot and existing HTTPS
  board. No Telegram users or public channels are messaged by deployment.
- First-touch writes are idempotent and analytics failures are swallowed after
  an anonymous categorical log line.
- Provider probes print status and code only.

## Verification

Run focused bot/AI tests through RED and GREEN, normal and strict typechecks,
`bun run verify`, `node scripts/audit-unread.mjs`, and
`node scripts/audit-configs.mjs`. Record checkpoints after the focused suite,
full gate, independent review and live deployment.

