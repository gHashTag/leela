# Plan: public Telegram outreach

## Architecture

1. Add a small `public-outreach` engine beside the private initiative. Pure
   functions choose the UTC-day plan, validate configuration and deep-link
   payloads, compose the localized post, and compute the next scheduled strike.
2. Reuse `Guide.engage(..., reportOwed: true)` for the public reflection
   question. This keeps the proven plan-only prompt, model circuit breaker, and
   locale-complete proactive output guard rather than creating a weaker public
   prompt path.
3. Add a `PublicOutreachStore` contract with memory and SQLite adapters. One row
   per UTC day stores plan, successful send time, model/canonical flag, and an
   aggregate number of deep-link starts; it stores no audience identity or text.
4. Arm outreach only after Telegram polling has started. Run once immediately
   to close a first-deploy gap, then schedule the configured UTC hour. A
   successful day is never sent again; failures remain eligible.
5. Teach the private `/start` transport to open and start a solo table when no
   table exists, then offer the same signed board route every other command uses.
   Attribute valid `public_<day>` payloads best-effort to the aggregate store.
6. Configure only the production channel. Telegram's existing linked-discussion
   contract distributes the same post into the group and exposes comments,
   avoiding duplicate messages and a second destination secret.

## Safety and operations

- Public content contains canonical plan text and a bounded plan-only bridge;
  it never reads intentions, reports, histories, usernames, or player ids.
- The public target is not printed on failures. The startup line says enabled or
  disabled, language, hour, and whether storage is durable.
- The button uses an official `t.me` deep link to the current bot username.
  `startapp` is deliberately not used until Telegram reports a Main Mini App.
- No message is sent from tests. APIs, clocks, schedules, and storage are all
  injected.
- The production target and permissions are read before configuration; no bot
  is added to a group and no group permissions are changed.

## Verification

Run focused RED/GREEN tests for the new engine, store, SQLite migration and bot
start flow; then `bun run verify`, `node scripts/audit-unread.mjs`, and
`node scripts/audit-configs.mjs`. Push the task branch, open a PR, wait for every
configured check, merge, configure Railway variables, observe a successful
deployment, and probe the published post, discussion linkage and deep-link flow.
