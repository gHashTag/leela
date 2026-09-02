# Telegram-native acquisition surfaces

The owner's request (2026-09-02): enable Leela's Z.AI Coding Plan companion,
Guest Mode, Inline Mode and Main Mini App, and make Telegram acquisition
sources visible in analytics instead of collapsing them into one public count.

## Measured production gap

- Telegram `getMe` reports `supports_guest_queries=false`,
  `supports_inline_queries=false` and `has_main_web_app=false`.
- The deployed companion uses the Coding endpoint but falls back to the stale
  `glm-4.6` default. Z.AI's current Coding Plan list is GLM-5.1,
  GLM-5-Turbo, GLM-4.7 and GLM-4.5-Air.
- Minimal calls to the correct Coding endpoint with GLM-4.7, GLM-4.5-Air and
  GLM-5-Turbo all return HTTP 429 with provider code 1113. That is a
  subscription/balance gate, not a code path which another endpoint may hide.
- Only the daily public post has an acquisition counter. Direct bot starts,
  inline results, guest replies and Main Mini App launches are not comparable.

Primary platform contracts:

- <https://core.telegram.org/bots/api#answerguestquery>
- <https://core.telegram.org/bots/api#answerinlinequery>
- <https://core.telegram.org/bots/features#guest-bots>
- <https://core.telegram.org/bots/webapps#direct-link-mini-apps>
- <https://docs.z.ai/devpack/faq>

## Product contract

### Coding Plan companion

- Leela remains on `https://api.z.ai/api/coding/paas/v4`; it never silently
  moves a Coding Plan key to pay-as-you-go.
- GLM-4.7 is the default coder model. An explicit `ZAI_MODEL` still wins.
- Provider code 1113 is classified as an operator-actionable exhausted Coding
  Plan and opens the existing model circuit breaker. Logs expose only the HTTP
  and provider codes, never credentials, prompts or response bodies.
- A privacy-safe live canary can prove whether the configured coder answers.
  The game keeps its canonical fallback while the external plan is unavailable.

### Guest and inline discovery

- A guest invocation gets exactly one localized, plan-grounded answer. If the
  caller already has a game, Leela uses only that player's current plan and the
  invocation text; private intention, reports and journey never enter a public
  answer. A new caller receives the deterministic plan of the day.
- An inline query returns a localized, shareable plan card. Empty and arbitrary
  query text cannot make Leela reveal player state or write into a chat by
  itself; the user must choose the result.
- Both results carry one button into the Main Mini App with a signed
  `startapp=guest` or `startapp=inline` campaign. Model absence uses canonical
  text rather than suppressing the surface.
- Guest and inline handlers are rate-bounded, length-bounded and never read chat
  history or member lists.

### Main Mini App continuity

- BotFather's Main Mini App points to the production HTTPS board already used
  by the bot keyboard.
- A Telegram-signed Main Mini App launch with no existing room creates the same
  durable private solo game as `/start`; a later bot command resumes it.
- `start_param` is accepted only after Telegram signature verification and is
  exposed only as a bounded acquisition tag.

### First-touch acquisition analytics

- The first valid source for a Telegram user wins and survives restarts. The
  closed source set is `direct`, `public`, `guest`, `inline`, `mini_app`.
- Storage retains only the existing numeric player key, source, bounded
  campaign and first timestamp. It never copies username, chat id, message,
  report, intention, provider output, invoice payload or charge id.
- Unknown or malformed payloads are counted as `direct`; forged Mini App
  payloads are refused before attribution.
- Daily operator reports show first starts and first purchases per source as
  aggregate counts. Attribution failure never gates start, play or payment.

## Acceptance

- RED tests first prove the stale coder default, unhandled guest/inline updates,
  absent Main Mini App first-contact flow and collapsed acquisition analytics.
- Guest and inline results are locale-aware, Telegram-size-safe, single-CTA and
  canonical on model failure; guest state reads never include private journal
  fields.
- Memory and SQLite adapters agree on first-touch/idempotence and older
  production databases migrate additively.
- Signed `start_param` is accepted, invalid signatures never attribute, and a
  Main Mini App first launch creates one durable game without duplicating it.
- The full gate, root audits, independent review, PR checks, merge, Railway
  deploy and live probes pass. Live `getMe` must show the three Telegram flags
  enabled. The coder canary may remain FAIL only with a fresh 429/1113 result
  and an explicit external subscription/balance blocker.

## Non-goals

- No new provider, pay-as-you-go endpoint, purchase, price, public post,
  unsolicited player message, privacy-mode change or game-rule change.
- No attribution built from unsigned browser query parameters.

