# SKILL: purposeful_blocker_resolution

RULE:
on any blocker,
do not surrender;
enumerate workarounds,
choose safest,
ask owner only if needed.

APPLY_TO:
- pane slots full;
- resource limits;
- CI queue;
- merge conflicts;
- browser evidence;
- unreachable UI states in E2E;
- any other blocker.

## Procedure

1. NAME the blocker concretely (what, where, why it blocks).
2. ENUMERATE at least 3 workarounds, including:
   - driving the thing properly with better tooling;
   - seeding/preparing state instead of driving;
   - an alternate entry point (deeplink, config, direct call);
   - asking the owner to do one manual step.
3. CHOOSE the safest that does not cross boundaries
   (no product/config changes, no secrets, no foreign resources).
4. EXECUTE with verification (evidence, not claims).
5. ESCALATE to the owner only with concrete options, never just "blocked".

## Report format

```text
BLOCKER:
WORKAROUNDS:
OWNER_DECISION_REQUESTED:
STATUS:
BLOCKERS:
```
