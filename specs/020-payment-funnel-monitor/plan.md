# Plan: measure the paid journey and alarm on drift

1. Add a narrow `PaymentFunnelStore` contract with memory and SQLite parity,
   first-milestone idempotence, aggregate reads, and anonymous failure-isolated
   attribution helpers.
2. Instrument the five already-existing durable boundaries: third successful
   move, paywall refusal, accepted invoice, recorded payment, and successful
   entitled move. Keep pre-checkout pure and store-free.
3. Render aggregate funnel counts in the startup/operator evidence without
   adding a per-event success log.
4. Split a pure live-sync verdict from its Railway/container adapter. Test the
   verdict exhaustively, then make the adapter compare a freshly signed public
   `/api/game` response with SQLite without printing identity or credentials.
5. Run focused RED/GREEN, package, repository, audit, review, PR, CI, merge,
   deploy, exact-release, signed production, and Telegram checkout gates.
6. Install an hourly thread heartbeat that re-runs the non-mutating production
   monitor and stays quiet on a clean pass.
