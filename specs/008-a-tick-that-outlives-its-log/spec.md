# A tick that outlives its log

## What keeps not being read

The companion's initiative fires once a day at 06:00 UTC and says one line:

    [initiative] sent 0; skipped: not-standing 1

That line is the only evidence the daily word works. It has been the top
backlog item for six iterations and has been read **once**, on 2026-08-23,
which is how the doorstep arm came to be written. Every attempt since has
found the same thing: `railway logs` shows the current container's output, and
the container had restarted after 06:00, so the tick was gone.

The failure is not the logging. It is that **a fact worth checking lives only
in a stream that resets.**

## What this proposes

The bot remembers its last tick, and says so at startup.

- One row, upserted: when the tick ran, how many words went out, and the skip
  reasons with their counts.
- The startup banner prints it, beside the lines that already say which
  database is open and how many languages are in memory:

      Last daily word: 2026-08-24 06:00 UTC — sent 1; skipped: quieted 1.

- A deployment that has never ticked says so plainly rather than printing an
  empty sentence.

## What this deliberately does not do

**No HTTP route.** The obvious design is `GET /api/tick` so the dashboard can
ask at any moment, and it was rejected on measurement: the summary says how
many people the bot wrote to, the database currently holds one player, and
`sent 1` on a public endpoint is a fact about a person. The loop's own
boundaries say to protect the notification channel; a public counter of it is
the opposite. If a route is ever wanted it needs the allow-list `/api/ask`
already has, and a CLI has no `Origin` to offer.

**No history.** One row, not a table of every tick. The question is "did the
last one work", and a log of every morning is a thing to prune, back up and
eventually misread. The row is overwritten each day.

**No change to what the tick does.** This records what already happens. The
summary is the object `runTick` already returns and already logs.

## Acceptance

- The summary survives a restart: written on a tick, read on the next boot,
  printed in the banner.
- A bot that has never ticked prints a sentence saying so, not a blank.
- The stored row round-trips through the real storage, including the skip
  reasons and their counts, and a test proves it by writing one and reading it
  from a reopened database.
- The banner sentence is a pure function of the record, so a test can hold it
  without a process.
- The existing `[initiative]` log line stays exactly as it is. It is what an
  operator watching live reads, and this is for the operator who arrived late.

## Why this closes the backlog item

Backlog 1 has said "WATCH tomorrow's tick" since 2026-08-23 and has been
unwatchable four times. After this, the answer to "did the daily word work" is
in the banner of every deploy, which the loop already reads for the release
line — and the item stops being a thing to remember to look at.
