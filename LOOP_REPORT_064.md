# Autonomous UX Improvement Loop Report — Wave 064

**Date:** 2026-08-07
**Plan item:** UX_IMPROVEMENT_PLAN_V2.md §6.3 — Add a memory-leak audit for chat subscriptions and listeners.
**Status:** Complete

## What changed

- Added `src/utils/listenerRegistry.ts` — a central audit registry for long-lived Firebase listeners with:
  - `registerListener(screen, unsubscribe)` and `subscribeTracked(screen, factory)` to wrap subscriptions.
  - `dispose(id)`, `disposeScreen(screen)`, and `disposeAll()` for controlled teardown.
  - `getActiveListeners()` and `activeListenerCount()` for runtime inspection / logging.
  - `__DEV__` warning when a listener id is overwritten before disposal.
- Audited and wrapped all active Firestore/RTDB subscriptions in:
  - `src/hooks/useGameAndProfileIsOnline.ts`
  - `src/Navigation.tsx` (minimum-version check)
  - `src/screens/Tabs/PostScreen/index.tsx`
  - `src/screens/Tabs/GameScreen/index.tsx`
  - `src/screens/Tabs/ProfileScreen/Tabs/ReportsScene.tsx`
  - `src/screens/DetailPostScreen/index.tsx`
  - `src/screens/UserProfileScreen/index.tsx`
  - `src/screens/UserProfileScreen/PublicPostsScene.tsx`
- Added `src/utils/listenerRegistry.test.ts` covering registration, disposal by id, by screen, global dispose, and `subscribeTracked`.

## Verification

- `npx jest --silent --no-coverage` — 44 suites, 163 tests passed.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — completed successfully.

## Commit

```
wave 064: add memory-leak audit for chat subscriptions and listeners
```

Commit: `f7a035b`
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## Updated plan status

| Section | Open items after this wave |
|---------|---------------------------|
| 6. Performance & Stability | 6.4, 6.5 |
| 7. Accessibility & Localization | 7.1–7.5 |
| 8. Discoverability & Onboarding | 8.1–8.4 |

The next lowest-numbered open item is **6.4** — Add offline queue for reports created without connectivity.

## Cooperation options for the next wave

1. **Continue section 6** — implement §6.4 offline queue for reports created without connectivity, persisting failed posts in AsyncStorage and retrying when the network comes back.
2. **Start section 7** — implement §7.1 full VoiceOver route labels for the tab navigator to improve screen-reader navigation.
3. **Pick a quick onboarding win** — implement §8.1 add a short "How to play" interactive tutorial overlay, reusing existing modal components.
