# iOS release candidate: server-side companion

The owner requested an App Store release after the NVIDIA rollout. App Store
Connect currently holds approved/manual-release 7.1 (7), built from f6ef4ef9.
Independent inspection of that exact archive proves it still calls Z.AI from
the client. This release candidate must not carry provider credentials.

## Contract

- All three native AI entry points use the existing production companion API;
  native chat and bundled board preserve their answer/event contracts.
- Paid entitlement is recognized independently of the game's online flag,
  both at startup and after purchase/restore. Prices/products do not change.
- Preserve the existing bundle identity and published app capabilities.
- Bundle the verified current WebGL board and inspect the actual archive.
- No provider keys in source, JS bundles, logs or command arguments.
- Existing approved build remains unchanged until replacement is verified.

## Plan

1. Inspect exact approved artifact and signing/store access (done).
2. Add failing transport/entitlement regressions, then implement the repair.
3. Run tests, native build and independent review; record exact evidence.
4. Upload a uniquely numbered candidate, validate processing and submission
   readiness; never equate upload or Apple approval with runtime verification.

## Initial checkpoint

2026-09-07: Apple API access PASS; signing identities available; approved build
7.1 (7) still includes direct-Z.AI markers. No release request submitted.
Native branch f6ef4ef9 is separate from the current monorepo main. Work lives in
an isolated worktree; original dirty native build/source folders are untouched.

## Checkpoint: transport repair

- Exact-source probe RED: native XHR addressed api.z.ai, not production /api/ask.
- Exact-source probe GREEN after repair: production endpoint, no Authorization
  provider key, expected request/SSE answer contract, safe HTTP error text.
- All three native AI callers now share the server transport. Remaining tests
  await restoration of the native dependencies; this is not a full-test PASS.
- RevenueCat public SDK configuration from the original app returned HTTP 200
  and its existing pro-plan offering with three products. No purchase initiated,
  no price or product changed. The old archive's build configuration lacked this
  valid SDK setting; candidate builds must use the verified setting.
- In-progress: offline entitlement repair and startup/purchase/restore refresh.
- Still pending: complete test suite, signed archive, simulator/device QA,
  independent review, App Store candidate upload/submission. No store release.

## Checkpoint: release gates

- Native Jest: 103 suites / 441 tests PASS with LEELA_BOARD_REPO pointing to
  the current monorepo WebGL source. Transport, consent (including delayed
  storage revocation races), purchase cancellation/error and offline access
  have regressions. Queue tests now mock the actual shared transport.
- Production API limits are enforced before sending, with recent history
  pruned as complete turns and the latest question never silently truncated.
- AI text sharing requires explicit permission; refusal blocks the shared
  transport, Settings can revoke or ask again. Board play remains local.
- WebGL production build PASS. Full tsc is NOT green: the native baseline has
  incompatible JSX/test global types throughout the tree; record separately
  from passing runtime tests rather than claiming a typecheck PASS.
- CocoaPods hit RN 0.70's removed positional ERB API on Ruby 4; added a small
  reproducible patch-package patch using ERB's trim_mode keyword.
- Candidate remains 7.1 with new build 8; Info.plist now uses the project build
  number instead of silently remaining 5. No App Store mutations yet.
- Independent final scoped review: no blocking code findings; 24 focused tests
  and 3 RevenueCat React tests passed. A cold provider-only run timed out at
  5 seconds under build load; rerun with 30 seconds passed without assertion
  failures. Full native suite independently passed at the normal timeout.
- Actual native transport against production with synthetic input: PASS,
  nonempty Russian response, 140 characters, 3154 ms. No player data or provider
  credential used on the client side. This does not replace on-device QA.
- WebGL tests: 40 files / 620 tests PASS. CocoaPods: 81 dependencies, 106 pods
  installed. The lockfile changes checksums/tool version, not pod versions.
- Baseline TypeScript comparison loaded original f6ef4ef9 source in memory
  against the same installed dependencies: 926 pre-existing diagnostics.
  Candidate test-global collisions found during comparison were then fixed
  with explicit Jest imports; a full typecheck PASS is still not claimed.
