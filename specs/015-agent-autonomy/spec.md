# Specification: Autonomous repository operation

## Problem

Repository instructions treated normal delivery steps as separate owner
decisions. Agents could implement a live fix and then stop before PR, merge,
deployment, configuration, or verification even when the requested outcome
clearly required those reversible steps.

## Contract

- A requested repository change implies branch, verification, PR, configured
  checks, and self-merge unless the owner explicitly asks for review-only work.
- A request about an existing live Leela surface includes deployment and
  operational configuration of that surface, including a platform control bot
  such as `@BotFather` when no direct API or CLI path exists.
- Agents follow one root cause across affected surfaces and keep working through
  diagnosable or transient failures.
- Completion requires live evidence when the request concerns production.
- Autonomy never implies destructive work, new infrastructure, pricing changes,
  charges, public messages, unrelated accounts, or unsafe secret handling.

## Acceptance

- `AGENTS.md`, `CLAUDE.md`, and the constitution state the same integration,
  deployment, and secret-handling boundaries.
- The instructions name a terminal outcome and require evidence for completion.
- Existing force-push, repository-destruction, game-rule, and irreversible-data
  boundaries remain intact.
