# Implementation plan

1. Inspect existing Leela companion, Telegram command and persistent storage
   boundaries and existing 999 identity/tool contracts.
2. Implement a separate editorial module with durable claims and role grants,
   owner approval/revocation and private-only commands.
3. Add a source-grounded Leela SOUL, a 30-slot unscheduled plan and focused
   reusable skills. Load the same assets into editorial prompts.
4. Integrate with 999 only through identity-bound, explicitly configured tools;
   leave public publication and personal profile replacement outside scope.
5. Verify role isolation, kit loading, model boundaries, source fidelity,
   deployment asset inclusion and existing game/payment regressions.

Do not add a second Telegram poller or point the production token at the 999
multi-bot registry. Leela remains the transport and game authority.
No change to frontend UI is required for the private command workflow.
