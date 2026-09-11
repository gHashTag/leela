# Mini App invoice payment

Original prompt: «Сделай в мини аппе чтобы работало».

## Problem and evidence

The subscription button in the Telegram board calls `sendData` and then
`close`, after a 500 ms delay. Its guard treats signed `initData` as permission
to use `sendData`. Telegram only permits that method for reply-keyboard
launches, not menu/inline launches. The window can disappear without an offer
reaching the player. This is a source-confirmed defect; an iOS process crash
has not been reproduced.

Baseline: `915da65519a63b0594107c0272b761ffa9df2f0e`.

References:
- https://core.telegram.org/bots/webapps
- https://core.telegram.org/bots/api#createinvoicelink
- https://core.telegram.org/bots/payments-stars

## Required behavior

- A signed Telegram launch can load the deployment's existing priced tiers.
- The player chooses a tier and explicitly accepts the published terms before
  an invoice is created. No checkbox is preselected.
- The invoice opens inside Telegram via `WebApp.openInvoice`; the board never
  uses `sendData` or `close` for payment.
- Cancellation, network errors, unsupported hosts and rejected requests are
  visible, recoverable states. Repeated taps do not create concurrent invoices.
- Neither an SDK `paid` callback nor client storage grants access. The existing
  successful-payment handler and server entitlement remain authoritative.
- After server confirmation the paywall updates without reloading the board
  or discarding position, intention or reflections.
- Native mobile store handoff, current prices, durations, payment payloads,
  pre-checkout checks and refund behavior remain unchanged.

## Security and scope

Every payment HTTP request verifies Telegram's signature and freshness, uses
an allowed origin and bounded JSON input, and is rate limited. The server
chooses the price; client user IDs, prices and claims of payment grant nothing.
Token values and signed launch data must never enter browser bundles, logs or
reports. No actual charge is authorized by this task.

The legacy donor repositories and the user's offline Macs are not available
in this cloud checkout. This change targets the canonical current Mini App,
not an inferred legacy implementation.

## Completion boundary

Implement in a task branch, run local and CI gates, and create a PR. The user's
standing preference requires approval before merge. A preview with simulated
Telegram is not evidence of a production charge or iOS end-to-end success.
