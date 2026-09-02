# Plan: send one daily aggregate Stars growth brief

1. Add a narrow durable reporting boundary that reads two completed UTC days
   from `entitlements`, `payment_funnel` and `public_posts`, and records a
   per-recipient delivery marker. Keep it absent from in-memory storage.
2. Build a pure report composer for XTR arithmetic, growth labels and one
   observational focus, localized through the existing message catalogue.
3. Build an injected daily scheduler that uses the existing Stars operator
   allow-list, asks Telegram for the current bot balance, sends independently
   to each recipient, and caps delivery across concurrency and restarts.
4. Wire and describe the feature in the production entry point with an
   explicit startup line and safe disabled reasons.
5. Prove RED/GREEN with focused memory and SQLite tests, then run package and
   repository gates, independent review, PR checks, merge, deploy, configure
   `01:00 UTC`, and verify fresh production evidence without printing ids or
   secrets.
