# UX Improvement Plan V38 — UserProfileScreen resilience, empty states & tab accessibility

## Goal
Make the public profile screen resilient, accessible, and informative: never hang on Firestore errors, never show blank tabs, and give screen-reader users full context.

## Research summary
- **Internal weak spots**:
  - `UserProfileScreen/index.tsx:61-93`: Firestore `onSnapshot` has no error callback; failure leaves user stuck on `<Spin>` forever.
  - `RenderHistoryTab`: renders nothing when `history` is empty.
  - `RenderIntentionOfGameTab`: renders blank view when `intention` is empty.
  - `SecondaryTab`: tabs are plain `Pressable` with no `accessibilityRole="tab"`, `accessibilityState={{ selected }}`, or labels.
  - `PublicPostsScene`: already has `ListEmptyComponent`, but no error state or retry.
- **Competitor patterns**: Instagram/Strava/Duolingo use clear profile headers, tab bars with selected-state announcements, empty states with icon + copy + CTA, pull-to-refresh, and accessible touch targets ≥ 44pt.

## Decomposed implementation plan

### 1. Firestore listener error handling + retry
- Update `UserProfileScreen` `useEffect` to pass an error callback to `onSnapshot`.
- Add `loadError` / `isRetrying` state.
- On error: capture exception, stop spinner, render an error card with retry CTA.
- Retry re-subscribes to the listener.
- Add locale keys: `profile.loadErrorTitle`, `profile.loadErrorBody`, `profile.retryLoad`.

### 2. Empty states for history and intention tabs
- `RenderHistoryTab`: when `history.length === 0`, render a centered empty card with icon, copy, and optional CTA to start a game.
- `RenderIntentionOfGameTab`: when `intention` is empty, render placeholder copy encouraging the user to set an intention.
- Reuse existing `profile.noPublicPosts` style if applicable; add keys:
  - `profile.emptyHistoryTitle`, `profile.emptyHistoryBody`
  - `profile.emptyIntentionTitle`, `profile.emptyIntentionBody`

### 3. Accessible `SecondaryTab`
- Add `accessibilityRole="tab"` to each tab `Pressable`.
- Add `accessibilityState={{ selected: isFocused }}`.
- Add `accessibilityLabel` combining title + selected state (e.g. `t('accessibility.tabSelected', { title })` / `t('accessibility.tabUnselected', { title })`).
- Ensure each tab has min hit target height `s(44)` (add padding or minHeight).

### 4. Haptics on tab switch
- In `SecondaryTab` `onPress` call `haptics.impactLight()`.
- Import from `src/utils/haptics`.

### 5. Pull-to-refresh on profile tabs
- Wrap history and public-posts scroll surfaces with `RefreshControl`.
- Re-subscribe / re-fetch on refresh.
- Add `profile.pullToRefresh` accessibility hint if useful (optional).

### 6. PublicPostsScene error state
- Track `loadError` in addition to `loading`.
- If Firestore query errors and posts empty, render error card with retry button that re-subscribes.
- Add keys: `profile.postsLoadErrorTitle`, `profile.postsLoadErrorBody`.

### 7. Screen-level tests
- Create `src/screens/UserProfileScreen/index.test.tsx` covering:
  - renders loading state,
  - renders profile header after load,
  - shows error state when listener fails,
  - retry triggers re-subscription,
  - history empty state renders,
  - intention empty state renders,
  - tabs have `tab` accessibility role and selected state,
  - tab switch fires haptic.

### 8. Locale keys
Add to `src/locales/en/translation.json` (and placeholders for other languages):
- `profile.loadErrorTitle`, `profile.loadErrorBody`, `profile.retryLoad`
- `profile.emptyHistoryTitle`, `profile.emptyHistoryBody`
- `profile.emptyIntentionTitle`, `profile.emptyIntentionBody`
- `profile.postsLoadErrorTitle`, `profile.postsLoadErrorBody`
- `accessibility.tabSelected`, `accessibility.tabUnselected`

## Success criteria
- All 462 existing tests still pass.
- New `UserProfileScreen/index.test.tsx` passes with ≥ 8 tests.
- No infinite spinner on Firestore failure.
- No blank tabs.
- VoiceOver can navigate tabs with selected-state announcement.

## Estimated effort
1 engineering cycle (~20–30 file edits, one new test file).
