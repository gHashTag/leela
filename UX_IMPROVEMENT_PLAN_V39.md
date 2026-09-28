# UX Improvement Plan V39 — OfflineProfileScreen resilience, empty states & destructive-action feedback

## Goal
Make the offline profile screen usable and safe: clear empty/error states for history, and guarded, tactile destructive actions.

## Research summary
- **Internal weak spots**:
  - `OfflineProfileScreen/index.tsx`: no `ListEmptyComponent`, so new/offline users see only floating footer buttons on a blank background.
  - Destructive actions "Start Over" and "Sign Out" have no confirmation, haptic, or success toast.
  - `useHistoryData.ts` returns sections for all 6 players even when fewer are selected; no empty/error handling.
  - No tests for `OfflineProfileScreen` or `useHistoryData`.
- **Competitor patterns**:
  - Offline Mode UI best practice: communicate offline capability explicitly, show cached-state empty states with friendly copy, and avoid dead-ends.
  - Dangerous actions should use confirmation dialogs, haptics, and clear undo/recovery paths (Smashing Magazine 2024, platform HIGs).
  - Game UX: save/quit flows provide explicit confirmation before wiping progress.

## Decomposed implementation plan

### 1. Empty state for offline history
- Add `ListEmptyComponent` to `OfflineProfileScreen` `SectionList`.
- Show an icon, title, body, and CTA to start a new offline game.
- For online mode with empty history, show a similar empty state.
- Add locale keys: `offlineProfile.emptyHistoryTitle`, `offlineProfile.emptyHistoryBody`, `offlineProfile.startOfflineGame`.

### 2. Filter empty sections in `useHistoryData`
- For offline mode, filter out player sections with empty `data` so the list doesn't show 6 "Player N" headers when only 1–2 players played.
- Keep the order of remaining players.

### 3. Guard destructive actions with confirmation dialogs
- Wrap "Start Over" with `Alert.alert` confirmation:
  - Title: `offlineProfile.resetConfirmTitle`
  - Message: `offlineProfile.resetConfirmBody`
  - Buttons: Cancel / Reset
- Wrap "Sign Out" with existing `auth.signOutConfirm` if available, otherwise add `offlineProfile.signOutConfirmTitle` / `offlineProfile.signOutConfirmBody`.
- Add haptic `impactLight` on dialog open, `confirm` on success, `error` on failure.
- Show success toast after reset / sign-out.

### 4. Haptic feedback
- `Start Over`: light on press, confirm on reset, error on failure.
- `Sign Out`: light on press, confirm on success, error on failure.
- Optional: light haptic on history row press (future).

### 5. Improve loading/error states
- Keep existing `Spin` loading state.
- Add `try/catch` around reset/sign-out calls and surface `notify.toast` on failure.

### 6. Component + screen tests
- Create `src/screens/Tabs/OfflineProfileScreen/index.test.tsx` covering:
  - renders loading state,
  - renders empty state when no history,
  - shows start-over button,
  - shows sign-out button when online,
  - start-over confirmation dialog appears,
  - haptic fires on destructive action press,
  - success toast on reset.
- Add `src/hooks/useHistoryData.test.ts` covering:
  - returns only non-empty offline player sections,
  - returns reversed online history.

### 7. Locale keys
Add to `src/locales/en/translation.json`:
- `offlineProfile.emptyHistoryTitle`, `offlineProfile.emptyHistoryBody`, `offlineProfile.startOfflineGame`
- `offlineProfile.resetConfirmTitle`, `offlineProfile.resetConfirmBody`
- `offlineProfile.signOutConfirmTitle`, `offlineProfile.signOutConfirmBody`
- `offlineProfile.resetSuccess`, `offlineProfile.signOutSuccess`
- `offlineProfile.resetError`, `offlineProfile.signOutError`

## Success criteria
- All 470 existing tests still pass.
- New `OfflineProfileScreen` and `useHistoryData` tests pass.
- No blank offline profile for new users.
- Destructive actions require confirmation and provide haptic + toast feedback.

## Estimated effort
1 engineering cycle (~15–25 file edits, two new test files).
