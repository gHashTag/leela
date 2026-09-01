# Plan: plan-aware proactive engagement

## Architecture

1. Add a dedicated proactive prompt to `@leela/ai`. It reuses the same
   `PlanContext`, canonical `systemPrompt`, timeout, cooldown, and fallback
   machinery as report reflections and questions, but reconstructs a narrow
   language-and-plan context so private writing cannot cross the boundary.
2. Add two localized canonical bridges: one reflection question for a closed
   report gate and one small-step observation for a ready player.
3. Inject a narrow companion into `createInitiative`. Only selected
   daily/fresh-start candidates inspect its status or call it; the call carries
   only language, plan number, and whether a report is owed.
4. Extend composition with the bridge and a CTA derived from the complete turn
   verdict, including minimum report length, turn ownership, cooldown, and
   completion. The existing plan excerpt, standing line, board keyboard,
   `/quiet`, and delivery retry stay intact.
5. Extend the tick record additively with model/canonical counts so old stored
   rows remain readable and the next startup exposes what actually happened.
6. Resolve a private reply through the player's most recent table when there
   is no private room, so a proactive reflection joins the shared game state.

## Safety and load

- No new schedule, broadcast, database, or public endpoint.
- One model call at most per selected standing-player word; none for ineligible
  candidates or doorstep words.
- The existing sequential delivery remains; no parallel broadcast is added.
- The canonical bridge is the fallback for every model failure, invalid shape,
  forbidden command/game action, manipulative pressure, unsupported diagnosis
  or praise, or response over 800 characters. Locale-aware action and pressure
  guards are compile-time complete over all supported languages.
- The first fallback or exception opens a circuit for the rest of the tick,
  bounding an outage to one provider wait rather than one wait per player.
- A companion adapter whose status check throws opens that same circuit rather
  than aborting delivery.
- No proactive prompt receives intention, report history, chat history, or a
  user identifier.
- Existing `/quiet` and once-per-day persistence remain the hard channel cap.

## Verification

Run the new focused test red before implementation, then the AI and bot suites,
the repository `bun run verify` gate, both required root audits, an independent
PR review, all configured GitHub checks, and finally Railway deploy/runtime
probes.
