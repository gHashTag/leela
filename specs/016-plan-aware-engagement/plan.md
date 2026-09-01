# Plan: plan-aware proactive engagement

## Architecture

1. Add a dedicated proactive prompt to `@leela/ai`. It reuses the same
   `PlanContext`, canonical `systemPrompt`, timeout, cooldown, and fallback
   machinery as report reflections and questions.
2. Add two localized canonical bridges: one reflection question for a closed
   report gate and one small-step observation for a ready player.
3. Inject a narrow companion and the existing report sink into
   `createInitiative`. Only selected daily/fresh-start candidates with an
   available companion read their intention/path and call the model.
4. Extend composition with the bridge and a state-correct CTA. The existing
   plan excerpt, standing line, board keyboard, `/quiet`, and delivery retry
   stay intact.
5. Extend the tick record additively with model/canonical counts so old stored
   rows remain readable and the next startup exposes what actually happened.

## Safety and load

- No new schedule, broadcast, database, or public endpoint.
- One model call at most per selected standing-player word; none for ineligible
  candidates or doorstep words.
- The existing sequential delivery remains; no parallel broadcast is added.
- The canonical bridge is the fallback for every model failure.
- Existing `/quiet` and once-per-day persistence remain the hard channel cap.

## Verification

Run the new focused test red before implementation, then the AI and bot suites,
the repository `bun run verify` gate, both required root audits, an independent
PR review, all configured GitHub checks, and finally Railway deploy/runtime
probes.
