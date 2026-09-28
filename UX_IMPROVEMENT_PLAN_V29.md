# UX Improvement Plan V29

**Cycle:** 24  
**Date:** 2026-08-08  
**Theme:** Offline game save, resume, and recovery

## 1. Weak spots

- `OfflinePlayers` store is already persisted via `mobx-persist-store`, but `DiceStore` is also persisted. However, when a user kills the app mid-offline-game, the next launch does not offer a "Resume game" path; `SelectPlayersScreen` always starts a fresh game.
- There is no way to see that a saved offline game exists from `WelcomeScreen` or `Hello`.
- `OfflinePlayers.resetGame()` calls `AsyncStorage.clear()`, which wipes **all** storage including onboarding state, settings, and now game-tooltips — it is too destructive.
- There is no UI to abandon an in-progress offline game without clearing all storage.
- Online game state is tied to the remote profile, so resume is server-backed; offline resume is the only missing piece.

## 2. Competitors / patterns

- **Chess.com / Lichess**: local games are auto-saved; the home screen shows "Continue playing" with the board position and whose turn it is.
- **Monopoly / Scrabble GO**: explicit save slot and "Resume" vs "New game" choice when returning to an offline match.
- **Apple HIG (State restoration)**: preserve and restore the user's place in a task, especially for multi-step flows like a game.
- **Headspace offline mode**: resumes the last session automatically but keeps a visible "Start new session" option.

## 3. Decomposed plan

1. Create `src/utils/offlineGameResume.ts`:
   - `getOfflineGameState()` — read persisted `OfflinePlayers` + `DiceStore` from `mobx-persist-store` keys or expose store state.
   - `hasSavedOfflineGame()` — true if any player has `start === true && finish === false`.
   - `clearOfflineGame()` — reset only offline game state (no `AsyncStorage.clear()`).
   - `resumeOfflineGame()` — helper that restores `DiceStore` flags and navigates to game.
2. Add a resume card to `SelectPlayersScreen` when a saved offline game exists:
   - show current player count, current player turn, and last plane;
   - primary CTA "Resume game";
   - secondary "Start new game" (clears old state and starts fresh).
3. Add a resume card to `WelcomeScreen` / `Hello` when a saved offline game exists, so users do not have to navigate into offline flow to discover it.
4. Update `OfflinePlayers.resetGame()` to use the targeted `clearOfflineGame()` helper instead of `AsyncStorage.clear()`.
5. Add localization keys:
   - `offlineResume.title`, `offlineResume.subtitle`, `offlineResume.resume`, `offlineResume.newGame`, `offlineResume.playerTurn`, `offlineResume.plane`, `offlineResume.abandon`.
6. Add tests:
   - `src/utils/offlineGameResume.test.ts`;
   - update `SelectPlayersScreen` test;
   - update `WelcomeScreen` / `Hello` tests.
7. Run full Jest suite.

## 4. Success metrics

- Jest suite stays green.
- Returning to `SelectPlayersScreen` with a saved offline game shows a resume card.
- Starting a new game clears only offline game state.
- `WelcomeScreen` / `Hello` surface the resume card when applicable.
