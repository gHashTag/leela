# A public word that opens the game

The owner's request (2026-09-02): Leela should publish into the project's
public Telegram channel and group and turn readers into players, using the
companion without turning the community into an automated notification feed.

## Evidence and product rules

- Telegram documents channels as the broadcast surface and a linked discussion
  group as the place where each channel post is automatically forwarded and
  becomes a comment thread. The production channel `@leelachakraapp` is linked
  to the `Yoga Phangan` discussion supergroup, so one channel send is the one
  post on both surfaces; a second group send would be a duplicate.
- Telegram's `web_app` keyboard is private-chat only. A public inline button
  therefore uses the official bot deep-link form and opens a private `/start`
  flow. The bot does not currently expose a Main Mini App, so a `startapp` link
  would be false.
- The research behind `specs/016-plan-aware-engagement` favours autonomy,
  relevance, a single clear next action, and a hard frequency cap. Public
  outreach follows the same rules: one useful canonical teaching, one gentle
  question, one play button, once per UTC day. No streaks, urgency, diagnosis,
  invented progress, or repeated knocks.
- The HEART measurement rule already used by
  `specs/017-engagement-conversions` requires an observable acquisition signal.
  The deep-link payload identifies the publication day and only an aggregate
  start count is retained. No reader or player identifier, message text,
  report, intention, invoice, or model output is copied into outreach metrics.

Primary Telegram sources:

- https://core.telegram.org/api/discussion
- https://core.telegram.org/bots/features#deep-linking
- https://core.telegram.org/bots/api#sendmessage
- https://core.telegram.org/bots/webapps

## What ships

- A configured Russian public channel receives one `Plan of the day` post per
  UTC day. On the first enabled production start it publishes immediately if
  that day has no successful post; later sends are scheduled at a configured
  UTC hour.
- The plan rotates deterministically through all 72 plans. Its title and
  excerpt come only from `@leela/content`; the companion supplies at most two
  short plan-grounded sentences ending in exactly one gentle question.
- The companion receives only language and plan. The existing proactive safety
  guard rejects commands, game actions, links, pressure, diagnosis, praise,
  wrong question shape, and oversized output. Canonical localized wording is
  used on absence, cooldown, timeout, refusal, or unsafe output.
- The post has one inline CTA leading to
  `https://t.me/<this bot>?start=public_<utc-day>`. No direct Mini App URL is
  published because it would open without Telegram's signed identity and split
  the game from the chat.
- A private first-contact `/start` opens and starts a one-player durable game,
  answers in the Telegram user's language, and offers the existing board
  keyboard. Existing private games resume; group `/start` keeps its current
  table-start semantics.
- SQLite remembers successful publication days and aggregate deep-link starts.
  A restart or deployment cannot knowingly publish the same day twice. Memory
  deployments keep the same behaviour for their process and say that they are
  not durable, as the rest of the bot does.
- The feature is dark unless `LEELA_PUBLIC_CHANNEL` is valid. Language and hour
  are separately configurable and fall back to Russian and 07:00 UTC.

## Acceptance

- RED tests first prove there is no public scheduler, daily deduplication, or
  playable first-contact start in the current bot.
- Plan selection covers exactly 1..72 and repeats only after 72 UTC days.
- Every composed post fits Telegram's 4096-character bound, includes canonical
  plan content, exactly one question, and exactly one play CTA.
- Model failure and unsafe model output publish the canonical post; a Telegram
  send failure records no successful day and is retried on the next start/tick.
- Memory and SQLite stores agree on publication deduplication and aggregate
  start attribution; older production databases migrate additively.
- A channel send is not followed by a direct discussion-group send. Production
  preflight proves the bot may post to the configured channel and that Telegram
  reports a linked discussion group.
- The full repository gate and root audits pass; the change is reviewed in a
  PR, merged to `main`, deployed by the existing Railway service, and verified
  with a real public post, its discussion copy, a working deep-link start, and
  privacy-safe startup/runtime logs.
