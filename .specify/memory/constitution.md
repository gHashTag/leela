# Leela Constitution

Leela is one game with several surfaces: an engine, a dataset in 22 languages, a
Telegram bot, a mini app, a book, and a deployed contract. It was assembled from
twenty-five repositories in which the rules had been written out ten times and
disagreed six ways.

Every principle below is here because breaking it cost something. The passes
that found each one are in `MIGRATION.md`.

## Core Principles

### I. One description of the rules

The engine is the rules. Nothing else may re-derive them.

Ten copies of the board across twenty-five repositories disagreed six ways; four
of them were a Snakes and Ladders set rather than Leela. Since then the same
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

`/Users/playra/leela-src` holds the twenty-five repositories this came from. Read
them. The first board that shipped was the illustration from the rules screen
rather than the board, and it survived a pass because it looked close.

## Boundaries

These are not judgement calls.

- Push to `unified` only. Never to `main`, never force.
- No archiving, deleting or creating repositories.
- No deploying, publishing to stores, or sending messages.
- Never touch the keystore or a secret. A key pasted into a conversation is
  compromised: use it if asked, say so, and say to rotate it.
- **The rules of the game never change silently.** A change in behaviour is a new
  `RuleSet` — which is why the two divergences in the deployed contract are
  `onchain` rather than bugs.
- Work that needs an irreversible action or data nobody has — a Firebase dump,
  another player's reports — is skipped and reported, not approximated.

## Gates

Green means all of it, in every package:

```bash
npx vitest run                          # 1117 tests
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.src.json   # what ships, with noUncheckedIndexedAccess
node scripts/audit-unread.mjs           # fields written and never read, exports with no caller
node scripts/audit-configs.mjs          # every workspace held to the strict config
```

A field nobody reads is a question nobody asked. An export with no caller is code
no caller has disagreed with. Both are reported, and the answer is usually to
delete rather than to waive.

## Governance

This constitution is what the passes learned; `MIGRATION.md` is how they learned
it, and is the record to read before arguing with a principle here.

An amendment needs the same evidence the principle did: something that broke, and
a test that would have caught it.

**Version**: 1.0.0 | **Ratified**: 2026-07-30 | **Last Amended**: 2026-07-30
