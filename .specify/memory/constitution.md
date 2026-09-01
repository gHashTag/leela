# Leela Constitution

Leela is one game with several surfaces: an engine, a dataset in 22 languages, a
Telegram bot, a mini app, a book, and a deployed contract. It was assembled from
twenty-five repositories in which the rules had been written out eighteen times
and disagreed six ways — the count `audit-copies` prints, not the one this
paragraph carried until 2026-08-06.

Every principle below is here because breaking it cost something. The passes
that found each one are in `MIGRATION.md`.

## Core Principles

### I. One description of the rules

The engine is the rules. Nothing else may re-derive them.

`bun scripts/audit-copies.mjs --src ../leela-src` is the thing that knows how
many copies of the board exist and how many of them play a different game. Cite
the command, not its answer: on 2026-08-06 it printed eighteen copies, of which
six disagree with the engine and four of those six are a hundred-square Snakes
and Ladders set rather than Leela. This sentence said "ten copies" until that
day — a figure nobody had re-derived against the disk it describes, in the one
principle whose subject is not trusting a copy. Since then the same
mistake has cost something five more times, always in the same shape: square 68
means "waiting to enter" *or* "has won" depending on how you got there, and every
place that re-derived the difference instead of asking `hasWon` got it wrong —
the leaderboard, `/new`, the mini app's header, the trail marker, and a
`ruleSetById` that returned `undefined` typed as a `RuleSet`.

Ask the function that knows. If there is no such function, write it once.

### II. A test asserts the shape of the defect

Not the cases already found. A test that lists what broke passes the moment the
next thing breaks differently.

Where the shape can be checked exhaustively, check it exhaustively: every square
and every die value, every state a played-out game reaches, every language in the
catalogue. Where a rule is about agreement between two artefacts — the Solidity
board and the engine's, the stylesheet and the layout it was transferred from —
assert the agreement, not one instance of it.

### III. A check that has never failed has not been shown to work

`compareConstants` was asked only about the contract that agrees, so it had never
once returned a divergence. A guard with no failing case is untested, not
passing. Every audit here carries a companion test that feeds it something bad
and requires it to complain.

### IV. Trust nothing that has been outside the process

`localStorage`, a database row, and a file that has been through a chat are all
writable by hand. The rule is not a list of fields to check: **a saved game must
be one the engine could have produced**, and anything else is refused rather than
half-read.

Refusal must be recoverable. A corrupt row reads as "no table here", not as a
chat that throws on every command for ever.

### V. Say what happened

Silence is indistinguishable from a broken program, and that is how this bot
first looked. Every command answers something. A failure a person must fix — a
wrong key, an empty balance — is named once and loudly, and not retried until it
can succeed; weather is retried quietly.

An operator should learn from a log line, not from a balance page.

### VI. The player's language, and the player's board

`room.language` once reached exactly one function. Every sentence the game says
about itself comes from the catalogue in `@leela/content`; plurals are the
language's own; two of the twenty-two languages read right to left, and the page
follows them.

The board does not. It is a diagram, and mirroring it moves plan 1 to the other
corner — so it is pinned, and in the bot its rows are isolated from the reader's
script.

Where the published app decided something visual, transfer the decision rather
than approximating it: the numbers come from `GameBoard`'s own layout, and being
1.4% wrong about the painting's height moved every snake.

### VII. Nothing here is a guess about the sources

`/Users/playra/leela-src` is where the repositories this came from are kept. Read
them. The first board that shipped was the illustration from the rules screen
rather than the board, and it survived a pass because it looked close.

All twenty-five are inventoried in `MIGRATION.md`; fewer than that are on any
given disk. `bun scripts/audit-copies.mjs` names which are present and which are
absent, and says how much of the tree each of its findings covers. What is not
there is reported as not there — never inferred from a repository that is.

## Boundaries

These are not judgement calls.

- Direct pushes to `main` are forbidden. When the owner explicitly requests
  integration, an agent may create a task branch, push it, open a PR to `main`,
  wait for every required check, and merge that PR.
- Force-pushing shared or protected branches is forbidden.
- Archiving, deleting, or creating repositories requires an explicit owner
  request naming the target.
- Deploying, publishing, or sending messages is allowed only when the owner
  explicitly requests the concrete operation and target. Verify the resulting
  live state before reporting success.
- A secret may be configured only for an explicitly authorized target through
  a protected input path. Never print it, put it in source control, or expose it
  in logs or process arguments. A secret pasted into chat is compromised and
  must be rotated before use.
- **The rules of the game never change silently.** A change in behaviour is a new
  `RuleSet` — which is why the two divergences in the deployed contract are
  `onchain` rather than bugs.
- Work that needs an irreversible action or data nobody has — a Firebase dump,
  another player's reports — is skipped and reported, not approximated.

## Gates

Green means all of it, in every package:

```bash
bun run verify                          # the gate: content, both typechecks, every package's tests
node scripts/audit-unread.mjs           # fields written and never read, exports with no caller
node scripts/audit-configs.mjs          # every workspace held to the strict config
```

`verify` is one command rather than four because the four have to agree: it
chains the content build, `typecheck`, `typecheck:strict` — which is where
`noUncheckedIndexedAccess` is applied to what ships — and then the test run, and
it runs the tests *per workspace*, which is the part that matters. Read
`package.json` for what it expands to; do not restate it here.

A field nobody reads is a question nobody asked. An export with no caller is code
no caller has disagreed with. Both are reported, and the answer is usually to
delete rather than to waive.

**What this block used to say, and why it is written down rather than quietly
replaced.** Until 2026-08-06 it named three commands and a test count, and all
four were false when somebody finally ran them. The count was a number that
appeared nowhere else in the tree and that no audit could see: `audit-claims`
reads README's table, `audit-scripts` reads the runtime a document names and not
the figures beside it, so a count in this file was unowned from the day it was
written. That is the whole argument for writing the command instead of its
answer — a command is re-derived every time it is read, and a number rots in
place while the document around it still reads as law. The bare `npx vitest run`
was not the gate either: from the root it collects the whole tree without the
per-workspace configuration and fails in packages that are green in their own
directory (measured 2026-08-06 — `apps/miniapp` passed 526 of 526 under its own
`vitest run` and failed twenty-eight of the same tests from the root, the same
minute). And the third line pointed `tsc` at a project file that has never
existed at this root; it had been exiting TS5058 — a path error, not a
type error — for as long as anyone had been pasting it.

## Governance

This constitution is what the passes learned; `MIGRATION.md` is how they learned
it, and is the record to read before arguing with a principle here.

An amendment needs the same evidence the principle did: something that broke, and
a test that would have caught it.

**Version**: 1.2.0 | **Ratified**: 2026-07-30 | **Last Amended**: 2026-09-01

The 2026-09-01 amendment replaces an absolute ban on agent integration and live
operations with scoped owner authorization and a PR-only path to `main`. The
evidence was deployment `891e24fb`: Railway followed `main`, where
`railway.json` was absent, while the verified artifact lived on `unified` and
had to be uploaded separately. An absolute ban prevented the agent from closing
that divergence even after the owner explicitly requested it. The new rule
keeps direct and force pushes forbidden, requires the full gate before merge,
and preserves secret non-disclosure.

The 2026-08-06 amendment changed no principle. It struck a boundary that
licensed direct pushing, and it replaced the gate commands with the one command
that runs — the evidence being that every command in that block had been
measured false the same day.
