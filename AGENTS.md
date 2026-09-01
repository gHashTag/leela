# AGENTS.md

Instructions for any coding agent working in this repository. Claude Code reads
`CLAUDE.md`; this file is the tool-neutral entry point and the shorter statement
of what is not negotiable.

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

## Operating posture

Own the requested outcome, not a partial attempt. A request to fix, build, or
update this repository authorizes the normal reversible work needed to finish
it: inspect source and logs, choose an in-scope implementation, create a task
branch, edit, test, commit, push, open a PR, wait for every configured check,
and merge the PR. Do not ask the owner to perform steps the agent can perform.
Stop before integration only when the owner says `review only`, `draft`, or
`do not merge`.

When the request concerns an existing live Leela surface, `fix`, `ship`,
`deploy`, `check production`, and follow-ups such as `do it` inherit that
surface as the concrete target. Continue through its existing deployment and
configuration path, then inspect runtime logs and probe the live result. A
green dashboard is evidence about a job, not evidence that the player-facing
flow works.

Be proactive inside the named outcome:

- Follow one root cause across every surface that shares the affected engine,
  state, identity, payment, or content contract. Do not leave the same defect
  alive next door.
- Use repository evidence and the canonical engine or published donor as the
  default. Make a reasonable, reversible choice when several in-scope options
  are equivalent, and record the choice; do not turn it into a blocking
  question.
- Diagnose a failed command, build, deploy, or check and try the safe repair or
  fallback. Do not stop at the first error, queued run, stale deployment, or
  misleading status panel.
- Continue until the change is merged, the requested live target is verified,
  or a concrete blocker needs authority, unavailable data, or an irreversible
  decision. Report the blocker with the evidence already gathered.
- Report completion with commit/PR, checks, deployment, live probes, and any
  remaining operational gap. Never claim success from code or status alone.

Proactivity does not expand the product brief. New pricing, new infrastructure,
new repositories, destructive migrations, public announcements, purchases,
and access to unrelated accounts still require an explicit owner decision.

## Gates

Every package must be green before integration:

```bash
bun run verify
```

Root audits:

```bash
node scripts/audit-unread.mjs
node scripts/audit-configs.mjs
```

## Boundaries

- Direct pushes to `main` are forbidden. A requested repository change implies
  integration unless the owner asks for review-only work: create a task branch,
  push it, open a PR to `main`, wait for every configured check, and merge it.
- Force-pushing shared or protected branches is forbidden.
- Archiving, deleting, or creating repositories requires an explicit owner
  request naming the target.
- A request about an existing live surface authorizes deployment to that named
  surface and the operational configuration needed by the requested change.
  Updating the named bot's menu, commands, webhook, or a non-charging invoice
  probe through its API is deployment work. So are operational messages to
  platform control bots such as `@BotFather` when they affect only that named
  bot and no direct API or CLI path exists. Creating infrastructure, changing
  prices, charging money, or messaging users or public channels is not implied.
- A secret may be configured only for an explicitly authorized target through
  a protected input path. Never print it, put it in source control, or expose it
  in logs or process arguments. When the owner supplies a newly rotated secret
  and explicitly names where to install it, install it without repeating it;
  use a secret setter, protected environment input, or stdin. If its provenance
  or rotation is uncertain, stop and request rotation.
- The rules of the game never change silently: a change in behaviour is a new
  `RuleSet`.
- Work needing an irreversible action or data nobody has is skipped and
  reported, not approximated.

## Workflow

Spec-driven, through [spec-kit](https://github.com/github/spec-kit): specify →
plan → tasks → implement, with artefacts in `specs/<nnn>-<slug>/`. Agents
without those commands should still write the spec and the plan down before
implementing; the reasoning is the part that gets lost.
