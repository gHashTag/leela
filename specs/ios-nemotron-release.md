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
- Native full suite rerun after explicit Jest imports: 103/103 suites and
  441/441 tests PASS (89.868 s under archive load).
- First archive exited 65 because Firebase resource was absent when Xcode
  captured its input graph. The existing 301-byte placeholder resource for
  this bundle ID was copied from the exact approved native source, privately
  and outside Git. A fresh archive invocation is in progress; no success claim.
- Dependency audit reports 62 findings (1 critical, 42 high); this is NOT a
  clean audit. Independent bounded triage found xmldom only in the Voice Expo
  config plugin; no native untrusted XML path. Axios uses fixed SendPulse URLs
  with the RN XHR adapter, Nanoid sizes are positive constants, and the native
  Markdown screen is not registered. No additional exploitable release blocker
  was established in these paths. Do not broadly upgrade dependencies during
  the archive; preserve these findings for a separate hardening effort.

## Checkpoint: signed archive

- Fresh archive retry: **ARCHIVE SUCCEEDED**, exit 0.
- Artifact: `build/leela-7.1-8.xcarchive`, 301 MB; app 7.1 (8),
  `xyz.ghashtag.dharma`, SDK `iphoneos26.5`.
- Actual artifact audit PASS: deep/strict code signature; shared /api/ask
  transport and consent marker present; verified public RevenueCat setting
  present; zero matches for known private configuration or NVIDIA credential
  shape. All 33 embedded board files byte-match the verified WebGL build.
- Native JS SHA-256:
  `bd4b1c64ef56a85bfdf1efcf948da1df0712d68488c7e9d4bbd167fafb792ae3`.
- IPA export and a Release simulator build are in progress. No App Store
  submission or publication. Privacy/login and actual sandbox transaction QA
  remain open gates.
- Independent artifact review also PASS: binary/dSYM UUID match
  `8324A00E-3042-39E7-A74B-972D1AEB8ED6`; app privacy manifest is present and
  syntactically valid. Its empty collected-data array does not establish
  disclosure correctness; reconcile it with policy/App Privacy before release.
- IPA export: **EXPORT SUCCEEDED**, 24 MB. Exported IPA identity is 7.1 (8)
  and its JS SHA-256 is identical to the verified archive. Upload started with
  submission/distribution skipped; no external tester notifications requested.

## Checkpoint: Apple processing

- Upload exited 0; App Store Connect accepted the package at 21:20:58 Bangkok.
- Read-only Apple API confirms build `0e6e4843-5924-415c-ad96-ac03460ee202`
  (8) is **VALID**. This is processing success, not App Review approval.
- Old 7.1 version remains PENDING_DEVELOPER_RELEASE; it has not been published
  or replaced. No external tester distribution or notification was requested.
- The uploaded build's export-compliance answer is still null and must be
  completed before distribution; do not infer TestFlight installability from
  processingState alone. App Privacy/login and sandbox transaction QA remain
  gates. Release simulator build/runtime check is still in progress.

## Follow-up contract: Firebase release configuration

Independent artifact review found a release blocker in build 8: the inherited
Firebase plist is a placeholder, so native startup intentionally disables
account/cloud functionality. An existing matching public Firebase app config
was located in the original native donor checkout without printing its values.

Before a replacement build leaves this machine, a read-only preflight must
reject missing, placeholder, wrong-bundle and incomplete Firebase resources;
accept the existing matching configured resource; and print no config values.
The exact archive must independently pass the same check. Build 8 remains
unreleased; the replacement uses unused build number 9. Runtime authentication
availability is a separate check from syntactic configuration validity.

- RED: the build-8 placeholder fails with invalid_api_key, missing_project_id
  and invalid_google_app_id. GREEN: four validator regressions pass, and the
  restored existing config passes without printing any values.
- Read-only Identity Toolkit project configuration returned HTTP 200. Its
  numeric project ID matches the config sender ID and app-ID project segment.
- Independent follow-up review: no blocking findings in restoration/preflight.
  Account/cloud end-to-end success remains unverified.
- Build-8 simulator compilation was deliberately interrupted after the
  artifact blocker was confirmed. Replacement archive and simulator build for
  7.1 (9) started from the corrected config; no predicted outcome recorded.
- Replacement native regressions: 103 suites / 441 tests PASS, 234.741 seconds
  under concurrent native build load.
- Initial build-9 archive intentionally interrupted (exit 75) after observing
  32 compiler processes and about 16 GiB swap on a 16 GiB host. Complete the
  simulator first, then retry archive with `xcodebuild -jobs 4`; this is resource
  scheduling, not a claimed compiler failure.

## Follow-up contract: native copy (owner correction)

Build 9 archive and simulator Release both compiled successfully. The actual
simulator opened onboarding and rendered the board after Skip. Its shared
WebGL status banner incorrectly described being outside Telegram. The owner
explicitly rejects this copy in the native mobile app. Do not upload build 9.

Prepare build 10 with shared spec 026: native hosts must have no chat-connection
status text, visually or accessibly, in any language; browser/Mini App diagnostics
must remain unchanged. Verify the rebuilt board on the simulator before export.
Existing social links are separate legacy features, not newly added game copy.

- Native-copy regression: RED reproduced the banner and unguarded DOM writes;
  GREEN covers every status in 22 languages. Independent review: no blockers.
- Full shared gate and all PR45 checks passed; merged to main as `915da655`.
- Build10 simulator Release succeeded; fresh install/relaunch rendered the
  board without the banner. Screenshot: `build/ios-7.1-10-board-settled.png`.
  All embedded board bytes match the rebuilt shared source. Native Jest passed
  103 suites / 441 tests. Native candidate source pushed as `700b084a` to PR44.
- Initial archive10 compiled/linked but Hermes signing failed with an internal
  error while disk space was 478 MiB. Preserve the verified simulator app at
  `build/leela-7.1-10-simulator.app`; remove only the owned rebuildable simulator
  cache, then retry signing/archive. No application/user data or sources removed.

- Retry archive10 succeeded after cache cleanup. Exact archive and IPA audits
  passed: identity 7.1(10), strict/deep signature, verified Firebase/public
  RevenueCat config, 33/33 board files matching shared source, no private/provider
  key matches. Independent artifact review found no blocking issue.
- Export succeeded. Initial upload failed with SSL EOF before transfer;
  retry succeeded at 23:05:12 Bangkok. App Store Connect processing must still
  be checked before claiming VALID. No App Review submission/public release.

- Read-only Apple API now confirms build `9d09eb43-a3d0-423a-9a8f-7b80ce602631`
  (10), uploaded 2026-09-07T09:05:57-07:00, processing **VALID**. The native-copy
  correction is implemented, merged in shared main, rebuilt, visually verified,
  signed, exported and uploaded. Publication remains gated by App Privacy/login,
  export compliance and actual account/purchase/restore QA. No old build released.
