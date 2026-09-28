# UX Improvement Plan V41 — Cross-Cutting UX Hardening

**Cycle:** 41  
**Date:** 2026-08-08  
**Theme:** Haptics, destructive-action safety, empty/error states, and game clarity

## 1. Weak spots

- No tactile feedback anywhere in the app; buttons, dice, reactions, and bookmarks feel dead.
- Destructive actions (`Start Over`, `Sign Out`, `Delete account`, admin `Delete`/`Ban`) fire immediately with no confirmation and no feedback.
- Empty/error states are inconsistent or missing: offline profile shows a blank screen, profile tabs can hang on Firestore errors, GameScreen stacks unrelated cards above the board.
- The onboarding is only 3 steps and the copy is invisible on light mode.
- AI stream parsing re-reads `responseText` from `buffer.length`, duplicating reasoning and dropping the final chunk.
- `getIMG` calls a dead Firebase Storage bucket on every avatar lookup, causing native-bridge overload and unresponsive taps.
- Fixed-width buttons clip long titles like "Start the journey".
- The profile tab bar divides nine tabs into equal slices, so labels wrap into unreadable fragments.

## 2. Competitors / patterns

- **Apple HIG**: tactile feedback confirms state changes; destructive actions require explicit confirmation.
- **Calm / Duolingo**: empty states use icon + friendly copy + CTA; onboarding rules are introduced just-in-time.
- **Strava / Instagram**: profile tabs are icon-first, scroll horizontally, and announce selected state to screen readers.
- **Headspace**: paywall hero and body copy sit in distinct vertical layers instead of overlapping.

## 3. Decomposed plan

1. **Tactile feedback foundation**
   - Add `src/utils/haptics.ts` safe wrapper around `react-native-haptic-feedback`.
   - Wire `triggerHaptic` into `Pressable`, `Button`, `LoadingButton`, `Dice`, `BookmarkButton`, `Reactions`, and destructive-action dialogs.
2. **Destructive-action safety**
   - Create reusable `ConfirmDialog` and `useConfirmActions` hook.
   - Guard post/comment/reply `Delete`, `Ban`, `Ban and delete`, admin accept/hide, `Start Over`, `Sign Out`, and `Delete account`.
3. **Empty/error state infrastructure**
   - Create `SceneStates` component (loading/error/empty/ready).
   - Apply it to `HistoryScene`, `AiAnswersScene`, `BookmarksScene`, `ReportsScene`, and `OfflineProfileScreen`.
4. **Game clarity**
   - Add contextual `GameTooltip` above the board (`six`, `snake`, `arrow`, `report`).
   - Expand onboarding to 9 steps with readable theme-aware copy.
   - Move game-state cards (DailyVerse, streaks, journal) to the profile tab so GameScreen is the game.
5. **Reliability fixes**
   - Fix `streamZaiChat` SSE parsing with a stable `readOffset` and drain loop.
   - Make `getIMG` avoid Firebase Storage requests and return placeholder/absolute URLs.
   - Add `ErrorBoundary` around the navigation tree.
6. **Polish**
   - Make `Button` use `minWidth`/`maxWidth` and shrink-to-fit text.
   - Replace fixed-loading/full-button swaps with `LoadingButton` in auth and intention flows.
   - Redesign `SecondaryTab` as a scrollable, icon-first tab bar with accessibility roles.
7. **Tests + localization**
   - Add tests for haptics, Pressable, LoadingButton, ConfirmDialog, ConfirmAction, ErrorBoundary, SceneStates, Dice, useHistoryData, aiStream, getIMG.
   - Update `en` and `ru` translation blocks for `sceneStates`, `errorBoundary`, `offlineProfile`, `gameTips`, and extended onboarding.
8. **Run the full Jest suite and keep it green.**

## 4. Success metrics

- Every primary tap has tactile feedback.
- No destructive action executes without an explicit confirmation dialog.
- Empty/error states exist on every profile/offline list surface.
- GameScreen shows only the board, dice, and the one relevant rule tooltip.
- 275 tests green with no regressions.
