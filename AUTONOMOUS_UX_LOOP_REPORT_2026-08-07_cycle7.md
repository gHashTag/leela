# Autonomous UX Loop Report — Cycle 7 — 2026-08-07

## Loop parameters

- **Cadence:** every 15 minutes (`*/15 * * * *`)
- **Job ID:** `988c3acc`
- **Scope:** iOS/Android Leela app (`/Users/playra/leela-src/leela`)
- **Previous report:** `AUTONOMOUS_UX_LOOP_REPORT_2026-08-07_cycle6.md`
- **Plan:** `UX_IMPROVEMENT_PLAN_V10.md`

## What was done this cycle

### 1. Weak-point audit (continued)

- Verified cycle 6 fixes (feed filters `withReplies`/`byPlan`, unread-replies badge, experiment exposure tracking).
- Confirmed data export currently shares raw JSON as a message — hard to save and easy to truncate in chat/share targets.
- Confirmed there is no screen listing *who* replied to *which* report; the badge is only a signal.
- Confirmed the `gameTodaySummary` experiment has no documented decision rule for removing the legacy layout.

### 2. Competitor research

| Source | Pattern to borrow |
|---|---|
| [react-native-share file sharing](https://github.com/react-native-community/react-native-share/issues/411) | Share JSON as a real `.json` file from cache/temp directory, clean up afterward |
| [Firebase A/B Testing docs](https://firebase.google.com/docs/ab-testing/ab-concepts) | Pre-define primary metric, guardrails, minimum runtime, then ship/kill based on data |
| [Stream activity feed deep-link](https://getstream.io/activity-feeds/docs/react-native/notification-feeds/) | Notification payload carries `target` + `comment` IDs for contextual deep-link |
| [Spotify risk-aware decisions](https://engineering.atspotify.com/2024/03/risk-aware-product-decisions-in-a-b-tests-with-multiple-metrics/) | Ship only if treatment is superior on success metrics and non-inferior on guardrails |

### 3. Decomposed plan

Created/updated `UX_IMPROVEMENT_PLAN_V10.md` with cycle 7 focus on **data export productionization + Activity/Notifications screen seed + experiment decision helper**.

### 4. Implemented in this cycle

#### Phase B — Game Screen Experiment

- **B10** Added `src/utils/experimentDecision.ts`:
  - Configurable `minExposures`, `minDays`, and `winningRatio`.
  - Reads stored exposure events and returns `keepSummary`, `keepLegacy`, or `insufficientData`.
  - Added `src/utils/experimentDecision.test.ts`.
- `GameScreen` already calls `trackExperimentExposure` from cycle 6, so decision data accumulates automatically.

#### Phase F — Data Export Productionization

- **F1–F3** Updated `src/utils/dataExport.ts`:
  - Added `exportToJsonFile()` that writes the export to `rn-fetch-blob` cache dir as `leela-export-YYYY-MM-DD.json`.
  - Added `cleanupExportFile()` to delete the temp file after sharing.
- **F4** Updated `SessionHealthScene`:
  - Replaced raw-JSON `Share.share()` with `react-native-share` + file URI.
  - Added MIME type `application/json`, `failOnCancel: false`, cancellation detection, and cleanup in `finally`.
- **F5** Added localized `dataExport.shareMessage` and `dataExport.error` strings in `en` and `ru`.

#### Phase C — Community Trust Features (deepened)

- **C4-deepen** Added `src/screens/ActivityScreen/index.tsx`:
  - Lists replies to the current user's posts: author name, plan number, and comment preview.
  - Real-time Firestore listener on `Comments` where `postId in` the user's own posts (capped at 10 for Firestore limit).
  - Tapping an item navigates to `DETAIL_POST_SCREEN` with `postId` (deep-link seed).
  - Calls `markRepliesAsSeen()` on mount.
  - Added empty state with localized copy.
- Registered `ACTIVITY_SCREEN` in `src/types/types.ts`, `src/Navigation.tsx`, `src/utils/lazyScreens.ts`, and `src/screens/index.ts`.
- Updated `src/TabBar.tsx`:
  - When the community tab has unread replies and is not focused, tapping the tab opens `ACTIVITY_SCREEN` instead of the feed, giving users direct access to their notifications.

### Files changed

```
src/Navigation.tsx
src/TabBar.tsx
src/screens/index.ts
src/screens/ActivityScreen/index.tsx
src/screens/Tabs/ProfileScreen/Tabs/SessionHealthScene.tsx
src/types/types.ts
src/utils/dataExport.ts
src/utils/experimentDecision.ts
src/utils/experimentDecision.test.ts
src/utils/lazyScreens.ts
src/locales/en/translation.json
src/locales/ru/translation.json
UX_IMPROVEMENT_PLAN_V10.md
AUTONOMOUS_UX_LOOP_REPORT_2026-08-07_cycle7.md
```

### Validation

- Full Jest suite: **67 suites passed, 265 tests passed**.
- ESLint run still blocked by pre-existing missing `@react-native/eslint-config`.

### Remaining work

- Run `yarn install` + `cd ios && pod install` to activate `react-native-haptic-feedback` from cycle 4.
- **C4-polish** Activity screen: avatars, relative timestamps, pull-to-refresh, grouped replies, mark individual threads as read, and expand Firestore `in` query batching beyond 10 posts.
- **B-experiment** After collecting more exposure events, call `recommendExperiment('gameTodaySummary')` and remove the legacy stacked cards if the summary wins.
- **D2–D3** Family plan and Pro trial ended win-back offer.

## Cooperation options for the next loop

1. **Polish the Activity screen** — add avatars, relative timestamps, grouped replies, pull-to-refresh, and mark individual threads as read; expand Firestore batching beyond 10 posts.
2. **Finalize the game screen experiment** — after collecting more exposure events, run `recommendExperiment('gameTodaySummary')` and remove the legacy stacked cards if the summary wins.
3. **Monetization nudges (D2–D3)** — family plan option and Pro trial ended win-back offer.
