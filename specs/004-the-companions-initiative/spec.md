# The companion's initiative: a daily word from the plan you stand on

The owner's ask (2026-08-22): a cron that sends players a quote from the game
for the plan they stand on, to draw them back into play — the companion given
agency, skills and memory. Shaped by a three-angle research pass (retention
mechanics, notification UX, mindfulness-app patterns); every choice below
cites its finding.

## What ships (v1)

Once a day, at a fixed hour, the bot writes privately to each ELIGIBLE player:
the canon text of the plan they stand on (a rotating excerpt, never the one
they most recently received — Duolingo's recency penalty), one line naming
where they stand, and one call back into the game. One message, one CTA
(Braze anatomy finding), with the way out said plainly in the first message
ever sent (`/quiet` — opt-out first-class).

Eligible: seated at a table, standing on a real plan, reachable in private
(the bot has a direct channel), active within the last 14 days (CURR
dominates: make the live loop sticky before resurrecting the lapsed), not
quieted, and not already nudged today (hard cap: protect the channel —
Groupon's grave).

## The companion's skills and experience

The engine is a set of *skills* — message templates with sleeping conditions,
Duolingo's sleeping-arms shape. v1 ships one skill (the plan's daily word);
the design leaves the list open (comeback-on-fresh-start is the named second
skill, NOT built now). Its *experience* is per-player memory: what was sent,
when, which excerpt — kept in the same storage the games live in, in memory
when the games are (and saying so, as storage already does).

## Rejected, with reasons

- **Consecutive-day streaks** — the field's own teardowns document play-to-
  protect-the-number; for a reflection game that is performative practice,
  the exact opposite of the product.
- **Purchasable streak insurance** — monetized anxiety; fails the honesty
  value outright.
- **Per-user send-time optimization** — Telegram exposes no timezone; a fixed
  morning hour (env-set) is the honest v1, and the hour is one variable to
  move later, not a per-user model to guess.
- **Model-written nudges** — a daily model call per player buys spend and
  variance for no measured need; the canon already owns the words. The model
  stays where the player asks.

## Acceptance

- The tick is injectable (a test never waits a day) and idempotent per day.
- Every branch tested: quieted, blocked (channel refused thereafter),
  lapsed, unseated, plan text missing in a language, the rotation, the cap.
- `/quiet` toggles and answers in the player's language; the command is in
  the registered menu.
- A summary log line per tick: sent / skipped and why — an operator reads
  one line, not a scroll.
- All gates green, README counts regenerated, and the first live tick
  observed on Railway.
