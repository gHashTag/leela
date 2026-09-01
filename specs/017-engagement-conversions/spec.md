# Know whether the daily word brings a player back

The owner's continuation (2026-09-01): improve player engagement and loyalty
after shipping the plan-aware proactive companion. The first bounded wave is
to measure whether that word produces a reflection or a return to the die,
without retaining another copy of what the player said.

## The gap

The initiative now records delivery and whether its bridge came from the model
or canon. It cannot answer the product question that motivated it: did the
player respond or resume play after receiving the word? Delivery is an output,
not engagement.

## Research basis

- Google's HEART paper recommends mapping a product goal to observable user
  signals and then to metrics. Here the goal is renewed reflective play, the
  two signals are an accepted reflection and a successful die turn, and the
  metrics are bounded cohort totals rather than message delivery alone:
  https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/
- The European Commission's GDPR guidance says personal data should be
  adequate, relevant, and limited to what is necessary, and prefers anonymous
  data where possible. The implementation therefore retains neither writing
  nor analytics identities: only two deduplication markers in the already
  player-keyed nudge row, followed by aggregate operational counts:
  https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en

## Observable contract

- A delivered daily, fresh-start, or doorstep word opens a 24-hour attribution
  window identified by its existing `sent_at` timestamp.
- The first accepted reflection after that word counts once as a response.
- The first successful die turn after that word counts once as a roll, whether
  it came from Telegram chat or the Mini App HTTP route.
- A refused roll, rejected/empty writing, actions before the word, actions at
  or after 24 hours, and repeats of the same action do not count.
- A later delivered word opens a new window; each word can therefore earn at
  most one response and one roll per player.
- A timer tick that arrives before the prior window closes neither sends nor
  overwrites it. The scheduler retries after the exact remaining window time,
  so timer jitter cannot turn a daily cadence into a 48-hour gap.
- The last daily-word summary reports aggregate response and roll counts at
  startup and immediately before the next tick overwrites that summary.

## Privacy and product boundaries

- No message text, report text, plan, intention, user id, or model output is
  copied into metrics. Per-player deduplication stores only the `sent_at`
  timestamp already held for that player; logs and summaries contain aggregate
  counts only.
- Attribution does not update the nudge row's operational `updated_at`; it
  therefore preserves no hidden timestamp for the player's exact action time.
- There is no new message, schedule, endpoint, cookie, device identifier,
  streak, reward, or player-facing behaviour.
- Metrics are best-effort observability: failure to record them must never
  refuse a report, roll, or saved game.

## Acceptance

- A deterministic test first proves the current nudge store cannot attribute
  an action to a delivered word.
- Memory and SQLite stores agree on every boundary and deduplicate separately
  for response and roll.
- The SQLite migration is additive and an older production-shaped database
  reads zero conversions before any action.
- A successful Telegram report/move and successful Mini App roll reach the
  same attribution store; refusals do not.
- Startup and pre-next-tick operational summaries expose aggregate counts and
  contain no player identifier or writing.
- Existing daily-word eligibility, chat/Mini App state, payment gates, and all
  previous tests remain green.
- Full gate, root audits, independent review, PR checks, merge, Railway deploy,
  migration log, startup log, and public probe pass.
