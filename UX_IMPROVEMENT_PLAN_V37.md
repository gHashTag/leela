# UX Improvement Plan V37 — SubscriptionScreen Paywall Polish

## Goal
Convert the SubscriptionScreen from a functional paywall into a polished, accessible, high-converting subscription surface with tactile feedback, clear error recovery, and compliant secondary actions.

## Research summary
- **Internal weak spots**: no haptics, no empty/error state when RevenueCat fails, dense `Text`-only secondary links without accessibility, "Manage subscription" shown to free users, footer hardcoded to near-white, `SampleAnswerModal` close glyph unlabeled.
- **Competitor patterns**: Calm/Headspace/Duolingo use multi-package selectors, clear trial timelines, accessible CTAs, and contextual hero copy. High-converting paywalls give tactile confirmation on selection and transparent trial/renewal microcopy.

## Decomposed implementation plan

### 1. Haptic feedback across the paywall
- `handlePackageSelection`: light impact when a plan card is pressed.
- `handlePurchase`: confirm when purchase starts; error haptic if purchase fails.
- `onAlreadyBought`/restore: confirm on success; error on failure.
- Modal open/close (SampleAnswer, ProFeatureExplainer, CancellationSurvey): light impact.
- Use existing `haptics` utility (`impactLight`, `confirm`, `error`).

### 2. Empty / error state for packages
- If `!isLoading && packages.length === 0`, render a centered card with:
  - icon / title / body explaining that plans could not be loaded,
  - Retry CTA that calls a refresh function,
  - Restore purchases secondary link.
- Add locale keys: `subscription.emptyTitle`, `subscription.emptyBody`, `subscription.retry`.
- Extract a small `SubscriptionEmptyState` component for testability.

### 3. Accessible secondary-action row
- Replace `Text`-only links with the existing `Pressable` component wrapper.
- Add `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityHint` for each link.
- Ensure each hit target is at least `s(44)` tall (padding).
- Keep visual style (underline, small text) unchanged.

### 4. Hide "Manage subscription" for non-subscribers
- Only render the manage-subscription link when `user?.pro === true`.
- Free users see: Already bought?, Why am I seeing this?, See sample answer.
- Pro users changing plans see all four links.

### 5. Dark-mode footer
- Use `useColorScheme` / `useTheme` `dark` flag.
- Footer background should be `dark ? '#1c1c1e' : 'rgba(255,255,255,0.95)'` with matching border color.
- Trust text and savings text must remain readable in both modes.

### 6. SampleAnswerModal accessibility
- Replace glyph-only close `Text` with `ButtonIcon` or `Pressable` with `accessibilityLabel={t('actions.close')}` and `accessibilityRole="button"`.
- Add `accessibilityHint` explaining it closes the sample answer.

### 7. PurchaseButton loading microcopy
- Keep existing disabled state; add `isPurchasing` prop so the subtitle can show a localized "Processing..." message while a purchase is in flight.
- Add locale key `subscription.processing`.

### 8. Screen-level test suite
- Create `src/screens/SubscriptionScreen/index.test.tsx` covering:
  - renders loading state,
  - renders package cards and pre-selects annual,
  - selection changes selected package,
  - haptic fires on selection,
  - purchase CTA is disabled when no package selected,
  - empty state renders when packages array is empty,
  - retry button calls refresh,
  - secondary links have correct accessibility roles,
  - manage subscription hidden for free users,
  - restore button accessible and triggers restore.

### 9. Locale keys
Add to `src/locales/en/translation.json` (and propagate to other supported locales where translators will later fill):
- `subscription.emptyTitle`, `subscription.emptyBody`, `subscription.retry`, `subscription.processing`
- `accessibility.closeScreenHint` if missing

## Success criteria
- All 450+ existing tests still pass.
- New `SubscriptionScreen/index.test.tsx` passes with ≥ 8 tests.
- No raw-key text in the paywall empty/error state.
- VoiceOver can navigate every interactive element with a meaningful label.

## Estimated effort
1 engineering cycle (~15–25 file edits, one new test file).
