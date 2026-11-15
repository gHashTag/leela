# Incident Documentation: Payment Version Mismatch — 2026-11-14

## Incident Summary

On 2026-11-14, a payment processing regression was discovered where payments were being accepted without proper version validation of the fixture schema and ruleset version fields. This led to cross-version compatibility issues between the engine's `lila_v1` ruleset and fixture data generated with incorrect or missing version fields.

## Root Cause

The fixture generator (`scripts/generate-lila-p0-fixtures.ts`) was not consistently writing the `fixtureSchemaVersion` and `rulesetVersion` fields to the generated `lila-p0.json` fixture file. While the engine package (`packages/engine/src/rulesetVersion.ts`) defined these as a shared source of truth:

- `CURRENT_RULESET_VERSION = 'lila_v1'`
- `FIXTURE_SCHEMA_VERSION = 1`

The generator was either:
1. Not importing the version constants from the engine package, or
2. Writing hardcoded values that diverged from the engine's shared source of truth, or
3. Omitting the fields entirely in some code paths

This caused downstream consumers (parity runner, mobile apps, bot payment processing) to either silently accept malformed fixtures or fail with inconsistent error messages.

## Impact

- Parity runner (`scripts/lila-t27-parity.sh`) could not validate fixture consistency across engine versions
- Mobile apps using `GAME_KEY = 'leela.game.v1'` experienced state deserialization mismatches
- Bot payment processing (`apps/bot/tests/what-a-payment-buys.test.ts`) had undefined behavior when fixture versions were incorrect
- Silent acceptance of invalid fixtures allowed bad data to propagate through the corpus

## Resolution

### 1. Engine Shared Source of Truth

The engine package (`packages/engine/src/rulesetVersion.ts`) was confirmed as the single source of truth for both version fields:
- `CURRENT_RULESET_VERSION = 'lila_v1'` — used by the ruleset and parity checks
- `FIXTURE_SCHEMA_VERSION = 1` — used by the fixture format

### 2. Fixture Generator Update

The fixture generator (`scripts/generate-lila-p0-fixtures.ts`) was updated to import and use the shared source of truth:
```typescript
import { CURRENT_RULESET_VERSION, FIXTURE_SCHEMA_VERSION } from '../packages/engine/src/rulesetVersion';
// ...
fixtureSchemaVersion: FIXTURE_SCHEMA_VERSION,
rulesetVersion: CURRENT_RULESET_VERSION,
```

### 3. Schema Validation

The fixture schema validation (`packages/engine/src/game/rules/__fixtures__/lila-p0.schema.ts`) was verified to enforce:
- `fixtureSchemaVersion === 1`
- `rulesetVersion === 'lila_v1'`
- `generator.source === 'applyRoll'`
- All cases have required fields: `seed`, `state`, `face`, `expected`
- No unknown top-level fields

### 4. Parity Runner

The parity script (`scripts/lila-t27-parity.sh`) was created to:
- Validate `fixtureSchemaVersion` and `rulesetVersion` fields
- Verify fixture structural integrity against the schema
- Exit 0 on parity, exit 1 on any mismatch or invalid version

### 5. Version-Specific Tests

Vitest test file (`packages/engine/tests/lila-fixture-version.test.ts`) was created/verified to test:
- Validates `fixtureSchemaVersion` is 1
- Rejects `fixtureSchemaVersion !== 1`
- Validates `rulesetVersion` is `lila_v1`
- Rejects `rulesetVersion !== lila_v1`
- Validates `generator.source` is `applyRoll`
- Rejects unknown top-level fields
- Validates all cases have required fields

### 6. Silent Catch Block Audit

An audit was conducted for silent catch blocks in `apps/mobile/src/` that could swallow version validation errors. Specific findings and fixes are documented in the mobile app audit.

## Prevention

To prevent recurrence:

1. **Shared source of truth**: All version fields must come from `packages/engine/src/rulesetVersion.ts` — never hardcode version values.

2. **Schema validation in CI**: The `validateFixture` function must be called in CI for all generated fixtures.

3. **Parity runner gate**: The `scripts/lila-t27-parity.sh` script must pass before any fixture-pushing changes are merged.

4. **Version-aware tests**: All new fixture generation must pass `npx vitest run packages/engine/tests/lila-fixture-version.test.ts`.

5. **Audit silent catch blocks**: Regular audits of `apps/mobile/src/` and `apps/bot/src/` for catch blocks that silently swallow errors.

## Related Files

- `packages/engine/src/rulesetVersion.ts` — Shared source of truth
- `scripts/generate-lila-p0-fixtures.ts` — Fixture generator (updated to use shared versions)
- `packages/engine/src/game/rules/__fixtures__/lila-p0.schema.ts` — Schema validation
- `packages/engine/tests/lila-fixture-version.test.ts` — Version enforcement tests
- `scripts/lila-t27-parity.sh` — Parity validation script
- `docs/payments/incident-2026-11.md` — This document

## Closure Criteria (External Acceptance)
All acceptance checkpoints must pass before this incident is closed:

1. **TestFlight Sandbox Purchase**: Build and deploy to TestFlight sandbox environment
   - Environment: [Environment: Sandbox]
   - Purchase flow completes successfully with [Environment: Sandbox]
   - RevenueCat Customers shows active pro plan after purchase
   - Sentry captures exactly one `captureException` on `failed` outcome
   - No `return true` from catch in purchase path

2. **RevenueCat Customer Validation**: Verify active pro plan in Customers
   - RevenueCat dashboard shows customer with active pro plan
   - Customer info includes correct entitlements
   - Plan status is `active` (not `trialing`, `expired`, etc.)

3. **Restore Behavior**: Verify restore returns plan on second device
   - Restore purchase flow on fresh device/session
   - Previously purchased plan is returned/restored
   - No duplicate purchases
   - Sentry not called on `cancelled` or `already-active` outcomes

4. **Silent Catch Pattern Compliance**
   - All 13 silent catch blocks classified in `docs/payments/silent-catch-audit.md`
   - Zero `return true` from catch in purchase/restore paths
   - All `catch {}` blocks have explicit classification
   - All verdicts are valid (`intentional`, `test-only`, `blocked-external`, `needs-fix` with issue)

5. **CI Gates Pass**
   - `npx vitest run` — all tests pass
   - `npx tsc --noEmit` — no type errors
   - Silent catch audit CI script passes (13 records, valid classifications)
   - ESLint catch rules enforce no violations

## Acceptance Checklist
- [ ] TestFlight sandbox purchase validates [Environment: Sandbox]
- [ ] RevenueCat Customers shows active pro plan
- [ ] Restore returns plan on second device
- [ ] No `return true` from catch in purchase/restore paths
- [ ] All ESLint catch rules pass
- [ ] Silent catch audit: 13 records classified correctly
- [ ] CI/CD gates: vitest, tsc, parity runner all pass