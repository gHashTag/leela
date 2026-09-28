# Autonomous UX Improvement Loop — Cycle 12 Report

**Date:** 2026-08-08
**Loop started:** 2026-08-07
**Cycle:** 12
**Status:** Completed, tests green

---

## 1. Weak spots researched this cycle

We focused on the finalization of the `gameTodaySummary` A/B experiment that was introduced in earlier cycles. Open risks were:

- **Indecision surface:** The experiment had exposure tracking but no clear "apply recommendation" path. A product owner had no UI to see the current recommendation, exposure count, or to act on it.
- **Legacy-card kill switch coupling:** `gameTodaySummary` was being used as a proxy for hiding legacy cards. If the experiment was rolled back, cards could reappear unexpectedly.
- **Stale telemetry:** `getExperimentStatus` returned hard-coded `exposures: 0` and did not surface real exposure counts.
- **Diagnostics discoverability:** The dev-only diagnostics screen existed but lacked experiment-specific controls.

## 2. Competitor / pattern research

We did not add new competitor research this cycle; instead we applied established UX patterns observed in previous cycles:

- **Kill switches as first-class flags:** Modern growth teams keep experiment treatment and legacy removal as separate flags (e.g., Notion, Linear). This prevents a losing variant from resurrecting dead UI.
- **Recommendation UI in dev tools:** Apps like Spotify and Duolingo expose internal "experiment console" screens for product/QA to manually apply winners during rollout.
- **Exposure + decision transparency:** Analytics tools (PostHog, Amplitude) expose count + first-exposure age to operators. We mirrored that in the diagnostics card.

## 3. Decomposed plan and implementation

### Task 1: Separate `legacyGameCards` kill switch
- Updated `src/utils/featureFlags.ts`: added `legacyGameCards` with default `true`.
- Updated `src/utils/featureFlags.test.ts` to cover the new flag default.

### Task 2: Decision helper with recommendation application
- Updated `src/utils/experimentDecision.ts`:
  - Added `recommendExperiment('gameTodaySummary')` with configurable `minExposures`, `minDays`, and `winningRatio` thresholds.
  - Added `applyExperimentRecommendation(name)` that:
    - enables `gameTodaySummary` and disables `legacyGameCards` for `keepSummary`;
    - disables `gameTodaySummary` and enables `legacyGameCards` for `keepLegacy`;
    - is a no-op for `insufficientData`.
  - Added dev helpers `recordSyntheticExposure` and `resetExperiments`.
- Updated `src/utils/experimentDecision.test.ts` with coverage for thresholds and flag application.

### Task 3: Exposure analytics
- Updated `src/utils/experimentAnalytics.ts`:
  - Added `getExposureCount(experiment)` based on `@leela:experiment:count:`.
  - `trackExperimentExposure` now increments the count only once per session.

### Task 4: Diagnostics experiment console
- Rewrote `src/screens/DiagnosticsScreen/index.tsx`:
  - Shows current `gameTodaySummary` summary text, exposure count, computed recommendation, and current flag states.
  - Added "Apply recommendation" button calling `applyExperimentRecommendation('gameTodaySummary')`.
  - Added "Toggle legacy cards" button to manually flip `legacyGameCards`.
  - Preserved cancellation-survey sync/clear controls from previous cycles.
  - Added pull-to-refresh.

### Task 5: Localization
- Added keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `diagnostics.exposureCount`, `diagnostics.recommendation`, `diagnostics.flags`, `diagnostics.applyRecommendation`, `diagnostics.toggleLegacy`.

### Task 6: `GameScreen` wiring verification
- Confirmed `src/screens/Tabs/GameScreen/index.tsx` already:
  - Tracks exposure via `trackExperimentExposure('gameTodaySummary', enabled)`.
  - Conditionally renders legacy cards only when `showLegacyCards` is true.

## 4. Test results

```
Test Suites: 73 passed, 73 total
Tests:       309 passed, 309 total
Snapshots:   0 total
Time:        ~9.4s
```

- Fixed `experimentStatus.test.ts` by setting the exposure count to 12 to satisfy the 10-exposure minimum threshold.
- No new TypeScript or ESLint regressions introduced in changed files.

## 5. Files changed in this cycle

- `src/utils/featureFlags.ts`
- `src/utils/featureFlags.test.ts`
- `src/utils/experimentAnalytics.ts`
- `src/utils/experimentDecision.ts`
- `src/utils/experimentDecision.test.ts`
- `src/utils/experimentStatus.ts`
- `src/utils/experimentStatus.test.ts`
- `src/screens/DiagnosticsScreen/index.tsx`
- `src/screens/Tabs/GameScreen/index.tsx` (verified, no edit needed)
- `src/locales/en/translation.json`
- `src/locales/ru/translation.json`

## 6. Three cooperation options for the next loop

### Option A — Product-led deep dive (recommended)
You review the diagnostics screen and the experiment recommendation logic, then tell me whether to:
- ship `gameTodaySummary` to 100% of users,
- keep it as a dev-only experiment and add real success metrics (roll completion, retention),
- or kill the experiment and keep legacy cards.
I will implement the chosen rollout path, add analytics events, and update the test suite.

### Option B — Fully autonomous next wave
I continue the loop without waiting for input: I research the next weakest UX area (likely onboarding, paywall, or social/activity engagement), create a decomposed plan, implement all improvements, run tests, and deliver the next report with three new options. The durable cron job (`*/15 * * * *`) already scheduled will keep firing reminders.

### Option C — Stabilize and audit
Pause feature work for one cycle and focus on:
- running a full TypeScript strictness pass on changed files,
- adding end-to-end/detox smoke tests for the new screens,
- documenting the feature-flag/experiment conventions in `CLAUDE.md` or a new `docs/ux-experiments.md`.
This reduces tech debt before the next wave of UX changes.

---

**Next action:** awaiting your choice of A, B, or C. Default is B if you say "next wave" or re-trigger the loop.
