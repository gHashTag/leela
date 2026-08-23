# This is not the improvement loop. It was.

**The live contract is `~/.leela/LOOP.md`, outside this repository.** If you
are an agent that opened this file looking for what to do next, close it and
read that one.

## Why this file is a pointer and not a contract

It used to be 1,362 lines: a standing contract for `apps/webgl` alone, a table
of invariants, a list of open work, and a journal running 2026-08-11 to
2026-08-17. On 2026-08-23 it was six days stale while the live loop had run
eighteen further iterations, **nothing in the repository referenced it**, and
its contract disagreed with the live one about where to work and which gates
to run.

That combination is the hazard: the live contract lives outside the repository,
so an agent working *inside* the repository finds this one first. Two
contracts, one of them wrong, and the wrong one is the discoverable one.

A pointer rather than a deletion, because a file that is simply gone sends the
next reader hunting — or recreating it.

## What moved, and where

- **The invariants — "what must not regress"** — are in
  [`NOTES.md`](NOTES.md), re-checked on 2026-08-23: every test file named
  still exists, every helper named still exists, and each invariant is named
  by a test that mentions it. That table was the durable part of this file.
- **The open-work list is gone, because two of its items were already false.**
  It said "the companion has no model" — `main.ts` wires `askOverHttp` to the
  deployed `/api/ask` — and "the intention is not asked for" — `askIntention`
  asks it. The same rot that put six false claims in `NOTES.md`, in a second
  unwatched file, which is the whole reason this one is a pointer now.
- **The journal is in git history**, entry by entry, with the commits beside
  it. `git log --follow -- apps/webgl/LOOP.md` reads it.

## The rule this file exists to state

**One contract, in one place, and the place is outside the repository.**
Anything durable that a loop learns belongs in a living document beside the
code — `NOTES.md` here — or in a skill. A second file that describes how to
work is a fork of the process, and a fork of the process rots faster than
code, because nothing compiles it and nothing tests it.
