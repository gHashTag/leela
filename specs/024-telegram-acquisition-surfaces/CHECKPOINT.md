# Checkpoint

## Scope

One bounded reliability wave: keep Leela on Z.AI Coding Plan, add Guest Mode,
Inline Mode and Main Mini App runtime support, and persist first-touch source
analytics through the daily aggregate revenue report. No prices, player data,
public posts or provider plan were changed.

## RED evidence

- AI provider tests initially failed on the stale `glm-4.6` default and missing
  provider-code/circuit-breaker behaviour.
- discovery/storage tests initially failed because acquisition, guest/inline
  and Main Mini App first-contact modules did not exist.
- `live-ai-monitor.test.ts` initially failed to resolve the absent canary.

## GREEN evidence

- `bun run --filter @leela/ai test`: 111 tests passed after the provider fix.
- `bun run --filter @leela/bot test`: 76 files and 1,152 tests passed after the
  acquisition and Telegram transport implementation.
- `bunx vitest run apps/bot/tests/live-ai-monitor.test.ts`: 6 tests passed.
- `bun run --filter @leela/bot typecheck`: passed.
- `bun run --filter @leela/ai typecheck`: passed.
- `git diff --check`: passed.

## Measured external state

- Production uses the Coding endpoint (`ZAI_PLAN=coding`).
- Minimal requests to supported Coding models returned HTTP 429 / provider
  code 1113. This is an external quota/access blocker; the implementation does
  not switch to pay-as-you-go.
- Before operational configuration, Telegram reported Guest Mode, Inline Mode
  and Main Mini App as disabled. Post-merge verification remains pending.

## Independent review

- The first review found two concrete defects: the incoming guest caller was
  read from the wrong Bot API field, and malformed or unknown signed
  `start_param` values could be attributed as `mini_app`.
- Both were reproduced with RED tests and repaired. The same reviewer returned
  PASS after 40/40 focused tests and the bot typecheck passed.

## Remaining gates

Merge through PR, deploy, configure the three BotFather surfaces, then verify
the Railway deployment, Telegram flags, signed game monitor, AI canary and
sanitized startup/error logs.

## Full gate

- First `bun run verify` correctly failed because the new plan document was not
  in the audited documentation set and README's measured test counts were
  stale.
- Added the plan to `scripts/audit-scripts.mjs` and ran
  `node scripts/audit-claims.mjs --write`; README now records 5,019 tests.
- Re-ran `bun run verify`: both typecheck layers passed, all 20 runnable audits
  passed, and all 5,019 tests passed across 12 workspaces.
- Re-ran ESLint, Knip, dependency-cruiser and actionlint after review repairs;
  all passed.
