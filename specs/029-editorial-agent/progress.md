# Editorial integration checkpoint

Implementation date: 2026-09-12. Source implementation is separate from live
role assignment, credential provisioning and deployment verification.

## Architecture decisions

- Leela keeps its existing Telegram token, poller and game authority. A
  separate editorial module uses the selected language model with its own
  SOUL, public canonical text and skills, without room or player-journal data.
- The intended target is `@playom`, but only Telegram's actual private sender
  ID plus a separate trusted owner's durable approval grants the content role.
  No identity database search or username-only grant was performed.
- The shared root Trinity SOUL and personal public SOUL in 999 are not project
  configuration. Neither is overwritten by this integration.
- The optional 999 credential is server-enforced, not merely a client
  allowlist. Six private-draft tools are advertised and dispatched; alternate
  credential routes cannot upgrade the scope.

## Independent review lessons incorporated

- Checking role validity only after a slow operation hides its reply but does
  not stop writes. Native revoke aborts work, and current authority is checked
  before each new MCP request. Already dispatched writes cannot be rolled back.
- Locking only before creation is too late if a competing importer has
  already read stale lists. The durable sentinel is acquired before list and
  reconciliation, not after them.
- Unknown write outcomes survive restarts as a retained sentinel. There is
  no lease expiry that silently authorizes a duplicate. Recovery requires
  stopping importers and manually reconciling remote drafts.
- Both repositories accept the same canonical positive safe-integer identity
  domain. JSON-RPC null and malformed envelopes must produce errors, not
  uncaught property-access exceptions.
- Runtime context must contain each template and all public plans a selected
  brief needs. A document elsewhere in the kit is not necessarily in the model
  prompt. The five complete templates live inside days 1, 2, 3, 5 and 12.
  Days 9 and 10 explicitly declare their additional canonical plans through
  bounded `related_plans` metadata. The loader supplies these public texts;
  the model cannot fetch arbitrary URLs. Actual-package tests cover this boundary.
- Telegram is a transport, not the `telegram` historical RuleSet. The bot's
  default new room uses `classic`; content must name the verified variant.

## Verification boundaries

Final local measurement: all 12 workspace suites pass, 5,425 tests in total,
including 1,411 bot tests. The unfiltered editorial subset has 177 tests.
Ordinary and strict types pass across the workspaces; all 19 remaining
configured static audits pass. README counts are generated from this run.
The 999 workflow's exact 211-test selection and service typecheck also pass
locally on Node 22. Independent review reports no remaining confirmed local
P0/P1/P2 blocker. These results do not substitute for CI or live activation.

Local tests use temporary storage and network doubles. Independent probes
connect the real local Leela bridge to the real local 999 MCP dispatcher and
schemas, including import/repeat, owner mismatch, revocation and concurrent
imports. No real model call, charge, private message or remote content mutation
is part of this verification.

The root content rebuild refuses to run without the external `leela-src`
donor tree. It is not forced: the existing language datasets must not be
dropped. The remaining workspace types, audits and suites are run separately.
Use Node 22 for this checkout's current Node SQLite and tooling requirements;
default Node 20 cannot execute all existing suites.

The separate 999 general test-typecheck has 11 pre-existing diagnostics
unchanged from its base. Service types and the scoped security regressions are
checked separately, without claiming a clean general test gate.

The paired [999 PR #2350](https://github.com/gHashTag/999-multibots-telegraf/pull/2350)
is open. Its [dedicated security CI](https://github.com/gHashTag/999-multibots-telegraf/actions/runs/34681935425)
did not start: GitHub reported failed recent account payments or a spending
limit requiring adjustment. This is an infrastructure blocker, not a passed
CI run or a measured test failure. No billing settings were changed.

## Free-text conversation (2026-09-13)

The owner asked for feedback with the agent inside the bot, not only through
slash commands. `registerEditorialCommands` now also registers a
`message:text` handler, ahead of the game's text catch-all, that answers plain
text from the approved content administrator in her private chat.

- Everything else falls through to the game unchanged: group text, any text
  starting with `/`, senders without an active approved grant, malformed
  sender shapes, and an administrator who currently holds a table. The last
  check is an injected `seated` hook; `bot.ts` supplies the same lookup
  `answerInWords` makes for a private chat (`store.get(chatId)`, then
  `store.roomOf`). The editorial module still has no room or report store.
- The answer uses the same model, timeout, in-flight cap and revoke abort as
  drafts. The system prompt carries the SOUL, the skills and the plan's day
  titles with the same honesty, no-tools and no-publication rules; a full slot
  remains the job of `/content_draft`. A short per-user memory of at most
  twelve exchanges lives in process memory only and is erased on revoke.
- Requests are recorded as `content_chat` in the durable request log: they
  count against the 30-per-minute cap and are deduplicated by update ID, but
  they are not in the expensive class, so a chat message never blocks or is
  blocked by the draft/999 spacing. Messages above 2000 characters are
  refused before the model is called. Output validation and error texts are
  those of the draft path.
- `/agent help` now says the administrator may also write in free text.

Measured locally with network doubles on Node 22: the editorial suite grows
from 60 to 72 tests, the bot suite from 1,411 to 1,423; ordinary and strict
types pass. No live model call, live Telegram delivery or production grant was
exercised; this section does not claim the live conversation is working.

## Activation still requires

1. Successful configured CI and owner approval for merge/deployment.
2. Verified persistent storage and trusted numeric owner configuration.
3. A private `/agent_claim` from the actual target account and a different
   trusted owner's `/agent_approve` action.
4. A dedicated key bound to that approved numeric ID in the 999 render
   service, with the same secret held only server-side in Leela.
5. Private status verification, one explicit draft and one explicit import,
   followed by a no-duplicate repeat check.

Production credentials were not available for this implementation. These
files do not assert that the live role, private delivery or 999 activation is
already working.
