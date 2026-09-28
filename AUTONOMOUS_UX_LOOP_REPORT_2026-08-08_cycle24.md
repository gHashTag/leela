# Autonomous UX Improvement Loop Report
**Cycle:** 24  
**Date:** 2026-08-08  
**Theme:** Offline game save, resume, and recovery

---

## 1. Research findings

### Weak spots in the current offline game flow
- `OfflinePlayers` store is already persisted via `mobx-persist-store`, and `DiceStore` is also persisted. However, when a user killed the app mid-offline-game, the next launch offered no "Resume game" path; `SelectPlayersScreen` always started a fresh game.
- There was no way to discover a saved offline game from `WelcomeScreen` or `Hello` without first entering the offline flow.
- `OfflinePlayers.resetGame()` called `AsyncStorage.clear()`, which wiped **all** storage — onboarding state, settings, game tooltips, review counts, and other user data — making it far too destructive.
- There was no UI to abandon an in-progress offline game without clearing all storage.
- Online game state is server-backed through the remote profile; offline resume was the only missing recovery piece.

### Competitors / patterns consulted
- **Chess.com / Lichess**: local games are auto-saved; the home screen shows "Continue playing" with the board position and whose turn it is.
- **Monopoly / Scrabble GO**: explicit save slot and "Resume" vs "New game" choice when returning to an offline match.
- **Apple HIG (State restoration)**: preserve and restore the user's place in a task, especially for multi-step flows like a game.
- **Headspace offline mode**: resumes the last session automatically but keeps a visible "Start new session" option.

---

## 2. Implementation summary

### 2.1 `src/utils/offlineGameResume.ts` — resume-state helpers
- Added `getOfflineGameState()` that inspects live `DiceStore` / `OfflinePlayers` state and returns `{ hasSavedGame, players, currentPlayer, currentPlan }`.
- Added `hasSavedOfflineGame()` as an async wrapper for the same check.
- Added `clearOfflineGame()` that resets only offline game arrays (`plans`, `start`, `finish`, `histories`) and calls `actionsDice.resetPlayer()`, without touching other AsyncStorage keys.
- Added `resumeOfflineGame(navigation)` that sets `DiceStore.online = false` and navigates to the game tab.

### 2.2 `src/store/OfflinePlayers.ts` — safer reset
- Replaced the destructive `AsyncStorage.clear()` in `resetGame()` with targeted resets of offline game arrays.
- Added a comment explaining why a full storage wipe was removed: it destroyed onboarding progress, settings, tooltips, and review counts.

### 2.3 `src/screens/SelectPlayersScreen/index.tsx` — resume card
- Added a resume card shown when a saved offline game exists, displaying:
  - title "Continue your offline game";
  - subtitle with player count and current player turn;
  - current plane number;
  - primary **Resume game** button;
  - secondary **Start new game** button that clears the old state.
- Selecting a player count now always clears any previous offline game before starting fresh.

### 2.4 `src/screens/WelcomeScreen/index.tsx` and `src/screens/Authenticator/Hello/index.tsx` — early resume discovery
- Added the same offline resume card above the main game-mode / value-preview content so returning users see the saved game before choosing online or offline.

### 2.5 Localization
- Added `offlineResume.*` keys to all 10 locale files:
  - `title`, `subtitle`, `resume`, `newGame`, `abandon`, `playerTurn`, `plane`.
- Translated into English, Russian, and French; other locales fall back to English.

### 2.6 Tests
- Added `src/utils/offlineGameResume.test.ts` (6 tests): initial state, saved game detection, finished game, online mode, clear state, async helper.
- Added `src/screens/SelectPlayersScreen/index.test.tsx` (4 tests): render selector, show resume card, resume game, start new game and clear state.
- Existing `WelcomeScreen` and `Hello` tests continue to pass with the new resume cards.

---

## 3. Verification

```
Test Suites: 88 passed, 88 total
Tests:       394 passed, 394 total
```

The TypeScript checker still reports pre-existing React-type mismatch errors across the codebase, but no new errors were introduced by this cycle. The new utility, updated `OfflinePlayers` reset, and all three screen changes compile and pass.

---

## 4. Collaboration options for the next loop

### Option A — Consolidated Profile / Settings tab with Pro upsell and account tools
Subscription status, restore purchase, data export, language, support, diagnostics, and sign-out are scattered across the tab bar and modals. Design a single Profile screen that surfaces all account tools and a Pro upsell.

### Option B — Apply cancel/retry/partial-output pattern to `CreatePost` AI stream
`CreatePost` has basic cancel/retry from cycle 18, but it does not yet persist partial output after a stop or offer "Edit report" pre-fill. Port the message-level recovery pattern there.

### Option C — Empty-state and pull-to-refresh polish for `ActivityScreen` / community feed
The Activity screen and community feed could benefit from clearer empty states, smoother pull-to-refresh, and better handling of zero unread replies.

---

## 5. Files changed

- `src/utils/offlineGameResume.ts` (new)
- `src/utils/offlineGameResume.test.ts` (new)
- `src/store/OfflinePlayers.ts`
- `src/screens/SelectPlayersScreen/index.tsx`
- `src/screens/SelectPlayersScreen/index.test.tsx` (new)
- `src/screens/WelcomeScreen/index.tsx`
- `src/screens/Authenticator/Hello/index.tsx`
- `src/locales/*/translation.json` (10 files)
- `UX_IMPROVEMENT_PLAN_V29.md` (new)

---

*Report generated by the autonomous UX improvement loop for Leela.*
