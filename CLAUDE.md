# Working in this repository

Leela: one engine, one dataset, several surfaces. Assembled from twenty-five
repositories in which the rules had been written out ten times and disagreed six
ways.

**Read `.specify/memory/constitution.md` first.** It is short, and every line of
it is there because breaking it cost something. `MIGRATION.md` is the record of
how each principle was learned — read the relevant pass before arguing with one.

## The work

Spec-driven, through [spec-kit](https://github.com/github/spec-kit). A task of
any size goes:

```
/speckit.specify    what and why, no implementation
/speckit.plan       stack and approach
/speckit.tasks      an actionable list
/speckit.implement  execute it
```

`/speckit.clarify` before planning when the ask is ambiguous;
`/speckit.analyze` after tasks to check the artefacts agree with each other.

Specs live in `specs/<nnn>-<slug>/`. A one-line fix does not need three
documents — but anything that changes behaviour, adds a surface, or transfers
something from `leela-src` does, because the reasoning is the part that gets
lost.

## Before you write anything

`/Users/playra/leela-src` holds the twenty-five source repositories. **Read
them.** Do not infer what the published app did; open it. The first board that
shipped here was the illustration from the rules screen rather than the game
board, and it survived a pass because it looked close.

## Gates

All of it, in every package, before a commit:

```bash
npx vitest run
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.src.json
```

and at the root:

```bash
node scripts/audit-unread.mjs     # fields written and never read; exports with no caller
node scripts/audit-configs.mjs    # every workspace held to the strict config
bun scripts/board-overlay.mjs out.svg   # the engine's jumps drawn over the painting
```

Green means green. If the audit names something you just wrote, the answer is
usually to delete it rather than to add a waiver.

## Tests

A test asserts **the shape of the defect**, not the cases already found. Where
the shape can be checked exhaustively — every square, every die value, every
state a played-out game reaches, every language — check it exhaustively.

An audit gets a companion test that feeds it something bad and requires it to
complain. A check that has never failed has not been shown to work.

## Boundaries

- Push to `unified` only. Never `main`, never force.
- No archiving, deleting or creating repositories.
- No deploying, publishing to stores, or sending messages.
- Never touch the keystore or a secret.
- The rules of the game never change silently: a change in behaviour is a new
  `RuleSet`.
- Work needing an irreversible action or data nobody has is skipped and
  reported, not approximated.

## Verifying by looking

The mini app is a phone game. When a change is visual, build it and look:

```bash
cd apps/miniapp && npx vite build && npx vite preview --port 4173
xcrun simctl boot "iPhone 16 Pro"
```

then open `http://localhost:4173/` in the simulator. Three defects were found
this way that no test would have caught — an invisible gem, a word printed
across the die, and a board a square out of true.
