# The board in three dimensions — where this stands

A browser Leela on the same rules the phone plays. No install, no account, no
backend. Built on `@leela/engine`, so the rules are not reimplemented here and
cannot drift from the apps.

## Why a browser at all

Measured against the field on 2026-08-11:

| Competitor | Shape | What it costs a first-time player |
|---|---|---|
| Leela Chakra Ai (iOS/Android) | app + AI guru | install, account |
| Leela: The Game of Knowledge (iOS) | app, secularised | install, subscription trial |
| com.vtm.lila (Android) | app, virtual board | install |
| LeelaRoom | facilitator platform | a booked session, a host |
| Leela Quest | web adaptation | — |

The gap is the middle: **self-serve in a browser, with reflection, nothing to
install**. Everything above is either an app you must install or a session you
must book. A link that opens a playable board is the one thing none of them is.

## Weak points, named honestly

These are the places this can be wrong, listed so the next loop starts from
them rather than rediscovering them.

1. **The bundle is 490 kB.** three.js dominates it. Fine on wifi, poor on a
   phone on mobile data — the field's own guidance is under 8 s to first play.
   Code-splitting three.js behind the first frame is the obvious fix and is not
   done.
2. **No server means no shared table.** Seats exist in the model, but two
   people cannot sit at one board across two devices. That is the whole of what
   LeelaRoom sells.
3. **The reflection is a prompt, not an answer.** The phone app streams a
   model's reply; this asks the question and keeps what you write. Wiring a
   model in needs a key, and a key needs a server — see 2.
4. **Nothing is measured.** No analytics, so "does anyone finish a game" is
   unanswerable. Adding it is a privacy decision, not only a technical one.
5. **WebGL is assumed.** No canvas-2D fallback and no message when the context
   fails. On a locked-down browser the page is simply black.
6. **The tests cannot see the picture.** 258 of them cover geometry, rules,
   text and storage — everything except whether the board *looks* right. A
   render regression ships green.

## What is verified

- 258 tests pass, covering board geometry against the engine's own tables, the
  hop decomposition (a snake shown as landing-then-falling, not a teleport),
  seating, storage round-trips, and the readout in every supported language.
- Typecheck clean, production build clean.
- Played in a browser: the die reports 3 and the board says *"It takes a six to
  enter the game"* — the silence that made the phone app feel broken is not
  reproduced here.

## The next loop

Ordered by what unblocks the most:

1. Split three.js out of the entry chunk (weak point 1) — cheapest, most
   visible.
2. Canvas fallback and a WebGL failure message (5) — small, and removes a class
   of "black screen" reports.
3. A render smoke test: draw one frame headless, hash the pixels, fail on drift
   (6). Needs a GPU-less renderer in CI.
4. Only then a server, and only if 2 and 3 are wanted (shared tables, model
   replies).
