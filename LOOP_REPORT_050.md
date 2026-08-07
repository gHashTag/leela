# UX Improvement Loop Report — Wave 050

## Completed item

**v2 item 3.4 — Add user profile screen with public posts and streak.**

### What changed

- Extended `src/screens/Tabs/ProfileScreen/useScrollGesture.ts` to support a third tab (`panGesture2`, `scrollViewGesture2`, `scrollOffset2`, `blockScrollUntilAtTheTop2`).
- Added `src/utils/historyStreak.ts` with `computeHistoryStreak(history)` — converts game `HistoryT[]` timestamps into local calendar dates and reuses the existing `computeStreak` from `StreakJournal`.
- Added `src/utils/historyStreak.test.ts` with 6 tests covering empty history, today-only, consecutive days, yesterday-as-last, gaps, and same-day deduplication.
- Added `src/screens/UserProfileScreen/PublicPostsScene.tsx`:
  - Subscribes to `Posts` where `ownerId == profile ownerId` and `accept == true`, ordered by `createTime` descending.
  - Paginates with a local `limit` state, renders `PostCard` with an explicit `post` prop so the global feed cache is not needed.
  - Uses the new third-tab gesture set from `TabContext`.
- Updated `src/components/Cards/PostCard/index.tsx` to accept an optional `post?: PostT` prop and use it in preference to the global store lookup, enabling the public-posts list to render cards outside the feed cache.
- Updated `src/screens/UserProfileScreen/index.tsx`:
  - Computes `streak` from the loaded profile history and shows a 🔥 streak row under the header when greater than zero.
  - Adds a third "Posts" tab (`publicPosts`) that renders `PublicPostsScene` with the profile `ownerId`.
- Added i18n keys under `profile.*` in `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `profile.publicPosts`, `profile.streakDay`, `profile.streakDays`, `profile.noPublicPosts`.

### Verification

- `npx jest` — 30 suites, **116 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — **bundle produced successfully**.
- Validated `en` and `ru` translation JSON with `python3 -m json.tool`.

## Plan status

| Section | Item | Status |
|---|---|---|
| 1. Retention & Daily Habit | 1.1–1.5 | ✅ |
| 2. AI Guide Experience | 2.1–2.6 | ✅ |
| 3. Social & Community | 3.1 Public reports feed filter | ✅ |
| 3. Social & Community | 3.2 Comment threading | ✅ |
| 3. Social & Community | 3.3 Reactions | ✅ |
| 3. Social & Community | 3.4 User profile with posts/streak | ✅ |
| 3. Social & Community | 3.5 Report bookmarking | ⬜ |
| 4. Monetization & Pro | 4.1–4.5 | ⬜ |
| 5. Game Board Depth | 5.1–5.5 | ⬜ |
| 6. Performance & Stability | 6.1–6.5 | ⬜ |
| 7. Accessibility & Localization | 7.1–5 | ⬜ |
| 8. Discoverability & Onboarding | 8.1–8.4 | ⬜ |

## Cooperation options for the next wave

1. **Finish section 3** — implement report bookmarking (3.5) so players can save meaningful reports and AI answers to a private reflection journal.
2. **Start section 5** — add the board legend overlay (5.1) explaining planes, chakras, snakes, and arrows directly on the game board.
3. **Start section 8** — add the interactive "How to play" tutorial overlay (8.1) for first-time players or the App Store review prompt after positive AI answers (8.3).
