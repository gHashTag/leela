# Loop 2 Report — Leela UX Continuous Improvement

**Date:** 2026-08-07  
**Branch:** `leela-ai-streaming-vedic`  
**Commits:** `735da9c`

## What was done

### 1. Reports feed: Firestore index failure recovery
- **Root cause:** the `Posts` query filtered by `language` and ordered by `createTime`, which requires a composite Firestore index. Without it the snapshot listener failed silently and the feed stayed empty.
- **Fix in code:**
  - `PostScreen` now detects `firestore/failed-precondition` and falls back to an unfiltered query, applying the language filter in memory via `PostStore.fetchPosts(snap, lang)`.
  - Added an explicit error state with a **Retry** button so players are never left with a blank screen.
  - `PostStore.fetchPosts` accepts an optional `language` parameter for the fallback path.
- **Backend fix:** created the missing composite index in Firebase Console for `Posts`: `language` ASC, `createTime` DESC, `__name__` DESC. The index is now building/enabled.
- **i18n:** added `online-part.postsLoadError` and `online-part.retry` in all supported locales.

### 2. Dice: explain why the cube is locked
- Added a visible label under the cube plus a `ToastAndroid` hint when the player taps a disabled cube.
- Messages distinguish between "report not written yet" and "step timer locked for X".

### 3. Chat / AI: surface failures instead of failing silently
- `ChatScreen.onSend` now shows a native `Alert` when AI streaming fails.
- `CreatePost` already kept report text on screen for retry; this loop solidified the error path.

### 4. Core reliability
- `captureException` now stringifies errors with `readable()` so logs show real messages instead of `[object Object]`.
- `RevenueCatProvider` validates the SDK key prefix (`appl_` / `goog_`) before configuring, preventing an invalid key from blocking app startup.
- `index.js` wraps Firebase messaging setup in `try/catch` so builds without messaging still boot.
- Routing fix: Z.AI Coding Plan keys now hit `/api/coding/paas/v4`; non-streaming comment generation disables reasoning to avoid empty answers.

### 5. iOS revival tooling
- Committed `ios/Podfile`, `Podfile.lock`, and `AppDelegate.mm` updates for the Xcode 26 build.
- Added `patches/react-native-image-crop-picker+0.40.2.patch` and `scripts/patch-boost-url.js`.

## Verification
- iOS bundle compiles: `react-native bundle --platform ios` → success.
- Reports tab loads on iPhone 17 simulator with real posts visible (verified by temporarily setting `MAIN/TAB_BOTTOM_1` as initial route).

## Updated plan status

| Section | Done | Remaining |
|---------|------|-----------|
| 1. Report & AI Flow | 4 / 6 | 1.5 draft persistence, 1.6 pipeline progress |
| 2. Comments & Community | 2 / 5 | 2.3 optimistic comment, 2.4 empty-state illustration, 2.5 edit/delete comments |
| 3. Game Board & Dice UX | 1 / 5 | 3.1 haptics/dice animation, 3.3 piece movement animation, 3.4 current plane highlight, 3.5 arrow/snake explanation |
| 4. Onboarding, Trust & Pro | 0 / 4 | all |
| 5. Stability & Observability | 0 / 4 | all |
| 6. Competitive Differentiation | 0 / 4 | all |

## Three cooperation options for the next loop

1. **Game Board feel** — finish 3.1 (haptic dice roll), 3.3 (animated piece movement), and 3.4 (current plane highlight) so the board feels alive and modern.
2. **Trust & onboarding** — implement 4.1 (short onboarding), 4.2 (sample AI answer before paywall), and 4.4 (review prompt after a win).
3. **Stability first** — add 5.2 (global offline banner), 5.3 ("Report a bug" log-capture button), and 5.4 (feed/detail skeletons) so the app degrades gracefully everywhere.

---

## Sources

- [Z.AI Chat Completion API](https://docs.z.ai/api-reference/llm/chat-completion)
- [Z.AI Thinking / Reasoning](https://docs.z.ai/guides/capabilities/thinking)
- [Firebase Firestore composite indexes](https://firebase.google.com/docs/firestore/query-data/indexing)
- `UX_IMPROVEMENT_PLAN.md` (project file)
