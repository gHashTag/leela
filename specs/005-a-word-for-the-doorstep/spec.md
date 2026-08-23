# A word for a player who never entered

## What the first live tick said

2026-08-23, 06:00 UTC, the initiative's first real run in production:

    [initiative] sent 0; skipped: not-standing 1

The engine worked exactly as designed. But the one player it found is
skipped **for ever**: `not-standing` is the first clause of the sleeping
condition, and a player who joined and never threw a six stands on no plan,
so the daily word — which is the plan's own text — has nothing to send.

That is right about the daily word and wrong about the player. Somebody who
opened the game, took a seat, and never got their six is the likeliest of
all to be lost, and the current design answers them with silence for ever.

## What this proposes

A third sleeping arm, disjoint from the other two by the same construction:
one activity age and one board state select exactly one word or none.

| Arm | Who | What it says |
|---|---|---|
| daily | standing, active within 14 days | the plan's own text |
| fresh start | standing, lapsed 14–35 days, Monday | begin again |
| **doorstep** | **seated, never entered, joined within 14 days** | **what a six opens** |

Bounds, so it cannot become a nag: at most **three** doorstep words ever, one
per day at most (the existing cap governs it), and nothing after the
fourteenth day — a player who did not throw in two weeks with three
invitations has answered. `/quiet` governs it like everything else, and the
first one carries the way out as the first word always does.

## What it must not say

No guilt, no counting of what was missed, no "you still haven't" — the same
rule the fresh-start arm keeps. It says what the six opens, because that is
the true and useful thing: the board has 72 planes and the first throw is
the only door.

## Acceptance

- The three arms are disjoint by test: for every combination of standing,
  activity age, joined age and weekday, at most one arm fires.
- The count is bounded and tested at its edges: the third is sent, the
  fourth never is, and a player who enters mid-way stops receiving it.
- Copy exists in en and ru, in the nudge idiom, and says nothing untrue.
- The summary line keeps naming what it skipped and why.
