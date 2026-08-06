# AGENTS.md

Instructions for any coding agent working in this repository. Claude Code reads
`CLAUDE.md`, which is the same content; this file is the tool-neutral copy of
the two things that are not negotiable.

## Read first

1. `.specify/memory/constitution.md` — the principles. Short, and every line is
   there because breaking it cost something.
2. `MIGRATION.md` — how each principle was learned. Read the relevant pass
   before arguing with one.
3. `CLAUDE.md` — the working instructions in full.

## The two rules that matter most

**Read the sources.** `/Users/playra/leela-src` is where the repositories this
was assembled from are kept. Do not infer what the published app did — open it.
The first board that shipped here was the illustration from the rules screen
rather than the game board, and it survived a pass because it looked close.

`MIGRATION.md` inventories all twenty-five. Not all of them are on this disk:
`bun scripts/audit-copies.mjs` names which are present and which are absent, and
qualifies its findings with how much of the tree it read. A donor that is not
there is a thing to say out loud, not a gap to fill in by inference.

**Assert the shape, not the case.** A test that lists what broke passes the
moment the next thing breaks differently. Where the shape can be checked
exhaustively — every square, every die value, every state a played-out game
reaches, every language — check it exhaustively.

## Gates

Every package must be green before a commit:

```bash
npx vitest run
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.src.json
```

Root audits:

```bash
node scripts/audit-unread.mjs
node scripts/audit-configs.mjs
```

## Boundaries

- Push to `unified` only. Never `main`, never force-push.
- No archiving, deleting or creating repositories.
- No deploying, publishing to stores, or sending messages.
- Never touch the keystore or a secret.
- The rules of the game never change silently: a change in behaviour is a new
  `RuleSet`.
- Work needing an irreversible action or data nobody has is skipped and
  reported, not approximated.

## Workflow

Spec-driven, through [spec-kit](https://github.com/github/spec-kit): specify →
plan → tasks → implement, with artefacts in `specs/<nnn>-<slug>/`. Agents
without those commands should still write the spec and the plan down before
implementing; the reasoning is the part that gets lost.
