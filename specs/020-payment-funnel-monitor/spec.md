# Payment conversion with a live sync alarm

The Stars rail is live and the server-authoritative three-move allowance is
already shared by Telegram chat and the Mini App. What production cannot answer
today is whether a player reaches the rail, whether an invoice is delivered,
whether a confirmed payer returns to play, or whether the signed `/api/game`
door has drifted back into the 403/split-state failure reported in screenshots.

## Evidence and platform contract

- Telegram's current digital-goods guide requires `XTR`, an empty
  `provider_token`, a pre-checkout answer within ten seconds, delivery only
  after `successful_payment`, and durable retention of the Telegram charge id
  for refunds.
- A production `/pro month` drive on 2026-09-01 was handled in 171 ms and
  rendered a 150 Stars invoice in Telegram Desktop. No payment was confirmed
  by that probe.
- The existing `scripts/status.mjs` proves unsigned private routes remain shut,
  but deliberately cannot prove that a correctly signed `/api/game` request
  opens or that its position matches the durable room.

Primary source: <https://core.telegram.org/bots/payments-stars>.

## Observable contract

### Privacy-minimal funnel

- The bot records the first time each player reaches each ordered milestone:
  `trial`, `paywall`, `invoice`, `purchase`, and `return`.
- `trial` means the third successful free move was durably recorded.
- `paywall` means a fourth move was refused for lack of an active entitlement,
  from chat or the Mini App API.
- `invoice` means Telegram accepted `sendInvoice`, not merely that an offer was
  rendered.
- `purchase` means the matching `successful_payment` was durably recorded.
- `return` means a successful move was durably recorded while the player held
  a live entitlement.
- Milestones are idempotent per player. Retries and repeated offers do not
  inflate a player funnel.
- Persistence contains only the existing Telegram player key, milestone name,
  and first timestamp. It copies no report, intention, username, message id,
  invoice payload, price, or charge id into analytics.
- Operator output contains aggregate milestone counts only. It never prints a
  funnel player key or correlatable per-event success line.
- A funnel read or write failure is observable in anonymous diagnostics and
  cannot refuse a move, suppress an invoice, delay pre-checkout, discard a
  confirmed entitlement, or silence the player.

### Signed production monitor

- One repository command performs a non-mutating probe inside the active
  Railway container.
- It selects the most recently active seated player without printing the
  player key, signs fresh Telegram init data with the runtime token without
  printing either value, and asks the public `/api/game` endpoint.
- A pass requires HTTP 200, `plan === state.loka`, and equality with the durable
  room's plan and language. It also requires the served `moved`, `entitled`,
  and `canSubscribe` values to equal the durable access decision.
- The same probe requires a bad signature to answer 401 and a foreign Origin to
  answer 403. A 403 on the valid same-origin/no-Origin signed read is a failure.
- No active game is a distinct `cannot tell` result, never a false all-clear.
- Output is a compact pass/fail/cannot-tell statement with no secret or player
  identifier. The command has distinct exit codes for those three states.
- A recurring thread monitor runs the command and reports only failures or
  cannot-tell states, together with the current deployment and sanitized logs.

### Real Stars checkout

- Production Telegram must render the configured 150 XTR month invoice.
- The payment interface is opened and inspected up to, but not including, the
  final consequential payment action.
- The final Stars confirmation belongs to the signed-in account owner. After
  that click, the continuation gate is verified through the successful payment
  receipt, durable entitlement, and a successful post-payment move.

## Acceptance

- A deterministic RED test names the missing funnel store and each missing
  production attribution boundary before implementation.
- Memory and SQLite implementations agree on idempotence, ordered milestones,
  migration, aggregate output, and failure isolation.
- The live monitor's verdict is tested over matching, stale, 401/403, malformed,
  unreachable, and no-game cases without network or secrets.
- Focused bot tests, normal and strict typechecks, the full bot suite,
  `bun run verify`, explicit root audits, independent review, PR checks, merge,
  Railway deployment, exact-release audit, production monitor, and Telegram
  invoice probe pass.

## Non-goals

- No price, free-move count, entitlement duration, refund authority, game rule,
  language, companion prompt, or Mini App layout changes in this wave.
- No automatic purchase, Stars balance change, or synthetic
  `successful_payment` sent to production.
- Telegram legal/support copy is not invented without an owner-approved policy
  and support destination.
