# Daily revenue growth report for Stars operators

Leela records successful Telegram Stars purchases, refunds, the paid-play
funnel and public-post starts, but today an operator has to query production by
hand to see whether revenue is growing. The bot should deliver one compact,
privacy-minimal report for each completed UTC day to the people already trusted
to operate Stars payments.

## Evidence and platform contract

- Telegram describes Stars as virtual items that a bot owner may later convert
  to a reward; this report therefore uses `XTR` and never invents a fiat value.
- Telegram's Bot API exposes the bot's current Stars balance through
  `getMyStarBalance`. The local entitlement ledger remains the source for
  Leela's product sales and refunds because it can distinguish those sales from
  other balance movements.
- `LEELA_REVENUE_REPORT_RECIPIENTS` is a report-only list of Telegram user ids.
  It grants no refund authority. When it is absent, the existing closed
  `LEELA_STARS_OPERATORS` list remains a backward-compatible fallback; an
  explicitly malformed report list disables delivery rather than being read
  partially or widening authority.

Primary sources:

- <https://core.telegram.org/bots/payments-stars>
- <https://core.telegram.org/bots/api#getmystarbalance>

## Observable contract

### One truthful completed-day snapshot

- At a configurable UTC hour, default `01:00`, the bot reports the immediately
  preceding completed UTC day and compares it with the day before that.
- A first enabled startup after the hour catches up the latest completed day;
  startup before the hour waits for the configured hour. Missed older days are
  not replayed as a burst.
- The report names the UTC date and includes:
  - gross recorded Stars, recorded refunds and net recorded Stars;
  - absolute and percentage net change from the preceding day, with `new`/`n/a`
    semantics when the earlier denominator is zero;
  - purchase count, distinct payer count and average Stars per purchase;
  - first daily `trial → paywall → invoice → purchase → return` milestones;
  - starts attributed to that day's public invitation;
  - the current bot Stars balance when Telegram makes it available;
  - one deterministic growth focus grounded only in the aggregate observations.
- Gross and net are explicitly described as Leela-recorded Stars, not cash,
  withdrawable balance or a promise about Telegram chargebacks.

### Private, durable and failure-isolated delivery

- Recipients are exactly the valid ids from
  `LEELA_REVENUE_REPORT_RECIPIENTS`, or from `LEELA_STARS_OPERATORS` only when
  the report-only variable is absent. No valid recipient list means no
  scheduler and no sends.
- Revenue reporting requires durable SQLite. An in-memory deployment stays
  dark rather than emitting a partial or restart-forgetful financial report.
- Every successful recipient delivery is capped durably by `(UTC day,
  recipient)`. Concurrent ticks, polling restarts and Railway redeploys do not
  duplicate a report.
- The recipient/day is atomically claimed in SQLite before the Telegram call.
  A known send refusal releases the claim; an indeterminate process crash keeps
  it reserved rather than risk duplicating a message Telegram may have accepted.
- One blocked or unavailable recipient does not suppress another recipient.
  A failed send is not marked delivered.
- A claim failure suppresses that recipient's send because avoiding a
  duplicate is safer than guessing. A marker write failure after Telegram
  accepts the message is held in-process and logged without identity.
- A balance lookup failure does not suppress the local aggregate report; its
  balance line says unavailable.
- A snapshot read failure sends nothing and emits one anonymous diagnostic.
- Logs never contain recipient ids, usernames, player ids, charge ids, invoice
  payloads or per-player amounts. The Telegram message contains aggregates only.

### Growth focus without invented causality

- The focus labels milestone counts as same-day first events, not a cohort
  conversion rate.
- It may point to the largest observed downstream gap, a public invitation with
  no starts, a zero-revenue acquisition day, or positive net momentum.
- It never claims that one event caused another, changes a price, contacts a
  player, refunds a payment or initiates a purchase.

## Acceptance

- A deterministic RED test proves the scheduler/report module and durable
  reporting store do not yet exist.
- Unit tests cover complete-day selection, before-hour waiting, daily growth
  arithmetic including zero denominators, content, every growth-focus branch,
  multi-recipient isolation, concurrent deduplication, send/read/write/balance
  failures and restart idempotence.
- SQLite tests cover aggregate revenue/refund/payer/milestone/public-start
  queries, additive migration and per-recipient delivery markers.
- Focused tests, normal and strict bot typechecks, `bun run verify`, both root
  audits, independent review, all PR checks, merge, Railway deployment, startup
  evidence and a fresh live delivery/runtime probe pass.

## Non-goals

- No price, entitlement duration, free-move allowance, refund authority,
  payment initiation, public post, player message or game rule changes.
- No faked `successful_payment`, refund, Stars balance movement or withdrawal.
- No fiat conversion, revenue forecast, causal attribution or access to an
  individual player's financial history.
