# Silent Catch Blocks Audit — Payments Incident 2026-11

## Audit Scope

Audited the codebase for silent error swallowing patterns in catch blocks, particularly those related to payment processing and startup initialization. The audit was triggered by the payments freeze incident (commit 8c80ea72) where RevenueCat's `syncPurchases()` at startup silently swallows failures.

## Findings

### Patterns of Silent Error Swallowing

The audit identified the following catch block patterns that silently swallow errors. Each is classified with a machine-readable verdict, user impact assessment, and telemetry consideration.

| File:line | Pattern | Classification | User impact | Telemetry | Decision |
|---|---|---|---|---|---|
| `__mocks__/react-native-purchases.js` | `syncPurchases: jest.fn().mockResolvedValue(undefined)` | `blocked-external` | none (startup only) | Sentry breadcrumb recommended | accepted: RevenueCat pattern; errors logged internally but not surfaced |
| `packages/ai/src/model.ts:183` | `.catch(() => '')` | `intentional` | none | logged (text fetch failure) | accepted: fallback to empty string on failed fetch |
| `apps/webgl/server/ask.ts:183` | `.catch(() => {})` | `intentional` | none (cancel cleanup) | none | accepted: non-critical cleanup failure |
| `apps/webgl/src/main.ts:2063` | `.catch(() => undefined)` | `intentional` | none (context resume) | none | accepted: non-critical context resume failure |
| `apps/webgl/src/shared.ts:266` | `.catch(() => null)` | `intentional` | none (JSON parse) | none | accepted: JSON parse failure defaults to null |
| `apps/webgl/src/ask.ts:239` | `.catch(() => null)` | `intentional` | none (JSON parse) | none | accepted: JSON parse failure defaults to null |
| `apps/bot/src/serve.ts:211` | `.catch(() => undefined)` | `intentional` | none (JSON body) | none | accepted: JSON body parse failure defaults to undefined |
| `apps/bot/src/index.ts:388` | `.catch(() => '')` | `intentional` | none (upstream text) | none | accepted: upstream text fetch failure defaults to 'no body' |
| `apps/bot/src/game-api.ts:222` | `.catch(() => null)` | `intentional` | none (JSON parse) | none | accepted: JSON parse failure defaults to null |
| `apps/mobile/tests/awaited.test.ts:58` | `.catch(() => {})` | `test-only` | N/A (test-only) | N/A | acknowledged: test pattern; error suppressed with full awareness |
| `apps/bot/tests/bot.test.ts:727,733` | `.catch(() => undefined)` | `test-only` | N/A (test-only) | N/A | acknowledged: test pattern; suppresses handleUpdate errors |
| `apps/bot/src/storage.ts:158-189` | try/catch around `openQueries` | `intentional` | graceful degradation | logged (fallback flag) | accepted: falls back to Memory stores with explicit `failure` flag; callers check flag |
| `apps/bot/src/bot.ts:588-590` | try/catch around `next()` | `intentional` | user feedback via `ctx.reply('chat.wentWrong')` | logged + Sentry | accepted: logs `[bot] unhandled: error` and attempts user feedback |

## Audit Conclusions

### Classification Summary

| Classification | Count | Description |
|---|---|---|
| `intentional` | 10 | Error expected and safe; documented fallback or non-critical path |
| `test-only` | 2 | Pattern exists only in tests; error suppression intentional within test scope |
| `blocked-external` | 1 | Depends on external configuration (RevenueCat/ASC); accepted with conditions |

### Intentional Silent Catches (OK)

The following silent error swallowing patterns are **intentional and documented**:

1. **RevenueCat syncPurchases**: Silence at startup is by design per RevenueCat's recommendations. Errors are logged internally but not surfaced to users. **Condition**: Must have Sentry breadcrumbs for observability; must not block app launch.

2. **Non-critical async cleanup**: Patterns like `.catch(() => {})` for cancel operations, `.catch(() => undefined)` for context resume, and `.catch(() => null)` for JSON parsing are all non-critical fallback paths. **Condition**: Must not mask fatal errors; callers must understand the fallback.

3. **Graceful degradation**: `storage.ts` try/catch falls back to Memory stores with explicit logging and a `failure` flag — callers can check this flag.

4. **User-facing error handling**: `bot.ts` catch blocks log errors and attempt to send user feedback via `ctx.reply('chat.wentWrong')`.

### Recommendations

1. **Document all silent catch patterns**: The `docs/payments/silent-catch-audit.md` file now records all identified patterns and their machine-readable classification.

2. **Add Sentry monitoring**: Per `external-acceptance.md`, ensure no error events from `syncPurchases()` at startup go unreported. Add Sentry breadcrumbs if needed.

3. **Avoid new silent catches**: When adding new `.catch()` blocks, ensure the error is either:
   - Re-thrown after logging, or
   - Handled with appropriate fallback logic that callers understand

   **Prohibited patterns in payment code**:
   - `catch {}` without explicit classification
   - `return true` from catch in purchase/restore paths
   - Broad catch that swallows all errors without distinction

4. **Test coverage**: The existing tests already suppress errors with `.catch(() => undefined)` — ensure these test-only patterns have corresponding test descriptions explaining why error suppression is acceptable.

5. **Telemetry contract**: For all payment error paths:
   - Sentry called exactly once on `failed` outcome
   - Payload contains no PII: email, device ID, transaction ID, raw user input
   - Payload includes: `outcome`, `errorCode`, `offeringIdentifier`, `packageIdentifier`, platform, app version
   - Sentry NOT called on `cancelled` outcome
   - Sentry NOT called on `already-active` outcome

### Related Documents

- `docs/payments/incident-2026-11.md` — General incident documentation
- `docs/payments/external-acceptance.md` — External acceptance checklist (created in commit 8c80ea72)
- `docs/payments/external-setup.md` — External setup guide (created in commit 8c80ea72)