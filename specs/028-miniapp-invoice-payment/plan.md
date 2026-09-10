# Implementation plan

## Server

Use the current `serveAsk` transport and `whoSent` authorization. Inject a
payment capability for deterministic tests and wire it from `index.ts` to
the existing Stars offering, terms, entitlement store and grammY API.

- `POST /api/subscription`, body `{language}`, returns
  `{tiers: [{id, stars, days}], termsUrl, entitled}`.
- `POST /api/invoice`, body `{language, tier, acceptedTerms: true}`, returns
  `{url}` from `createInvoiceLink`.
- Keep the existing consent-bound v2 invoice payload and one-off XTR purchase
  semantics. No recurring `subscription_period` is added.

## Client

Preserve the board's sheet and visual design. Isolate the purchase state
machine and transport from DOM wiring, reuse the shared content catalogue,
and retain the native host handoff. Validate server responses and invoice
URLs before passing them to the SDK.

Refresh server entitlement with bounded polling after `paid` or `pending`.
An inconclusive result must remain pending, not become paid or invite a
blind duplicate purchase.

## Verification

First prove the old closing path fails the new behavior test. Exercise
server guards and client recovery branches with deterministic fixtures.
Then run the repository gates and production web build. Browser QA uses a
simulated signed launch and intercepted payment responses, never live money.

## QA inventory

| Claim/control | Check |
| --- | --- |
| Subscribe button no longer closes board | Menu-launch mock records zero `sendData`/`close` calls |
| Existing tariffs displayed | Server fixture values appear in choices, no embedded live prices |
| Terms acceptance required | Invoice request cannot occur until explicit acceptance |
| Invoice opens inside Telegram | Real click triggers SDK double with validated invoice URL |
| Cancel and failure recover | SDK statuses leave board open and controls usable |
| Server alone opens access | `paid` with false entitlement stays locked; true unlocks paywall |
| Retry is safe | Double taps do not create concurrent invoice requests |
| Network and old-server failure | Timeout/503/404 produces actionable localized status |
| Native handoff preserved | Existing native-host tests remain green |
| Mobile layout | Screenshot at narrow phone and desktop widths; no clipping/overflow |
| Board data retained | Position and reflection fixture unchanged through payment flow |

Off-happy-path exploration includes malformed URLs and unsigned/expired
launches. Production verification after approved merge must inspect both
the bot deployment and the published board; a Pages success alone is not
payment verification.
