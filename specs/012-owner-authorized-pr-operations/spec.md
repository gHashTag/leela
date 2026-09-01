# Specification: Owner-authorized PR operations

## Problem

The repository governance categorically refused commits, PR merges, deployments,
messages, and secret configuration even after the owner explicitly authorized a
specific operation. That left `main` without `railway.json`; Railway deployment
`891e24fb` failed before build while the verified artifact remained elsewhere.

## Contract

- `main` accepts no direct or forced pushes.
- With an explicit owner request, an agent may create a task branch, push it,
  open a PR to `main`, wait for required checks, and merge the PR.
- Explicitly scoped deployments, publishing, and messages are allowed and must
  be verified against the resulting live state.
- Secrets use protected inputs and are never printed, logged, committed, or
  placed in process arguments. A secret pasted into chat is rotated first.
- Missing access, data, 2FA, or approval is reported as the actual blocker.

## Acceptance

- `AGENTS.md`, `CLAUDE.md`, and the constitution state the same authority.
- A regression test rejects the former absolute prohibition.
- The full repository gate passes before the policy reaches `main`.
