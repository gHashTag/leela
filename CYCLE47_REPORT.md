# Cycle 47 Report — Settings Screen for Accessibility Toggles

**Date:** 2026-08-08  
**Scope:** A centralized Settings scene that groups Sound, Haptics, Reduced Motion, AI Language, Bedtime Reminder, and Account links, and declutters the Profile tab.

## What was improved

1. **New `SettingsScene` screen**
   - Added `src/screens/SettingsScene/index.tsx` as a full-screen scrollable settings page.
   - Uses the existing `AppContainer` header with a back arrow and a centered "Settings" title.
   - Sections: **Experience** (Sound, Haptics, Reduced Motion), **AI** (AI Language, AI Guide), **Reminders** (Bedtime reminder), **Account** (Edit profile, Subscription).

2. **Reusable `SettingsRow` component**
   - Added `src/components/SettingsRow/index.tsx` with a single focus target per row.
   - Supports a trailing switch, value label, or navigation chevron behavior.
   - The inner `Switch` is hidden from the accessibility tree so screen readers see one control per row.
   - Toggles trigger a light haptic.

3. **Grouped preference UX**
   - Moved configuration toggles out of `ProfileScreen`'s `OwnTabView`.
   - Profile tab now shows only content tabs: Reports, History, Intention, Bookmarks.
   - Added a "Settings" button with a gear icon above the tab view and a gear icon in the header right of `ProfileScreen`.

4. **Navigation integration**
   - Added `SETTINGS_SCENE` to `RootStackParamList` and to the root `Stack.Navigator`.
   - Exported `SettingsScene` from `src/screens/index.ts`.

5. **Toggles mounted and reachable**
   - `HapticToggle` and `ReducedMotionToggle` (cycle 46) are now rendered inside Settings.
   - `Sound` and `AI Language` are managed directly by `SettingsScene` and persisted via existing utilities.
   - `Bedtime reminder`, `AI guide`, `Edit profile`, and `Subscription` rows navigate to their existing screens.

6. **i18n**
   - Added a `settings` namespace in `en` and `ru` with section titles and row labels.

## Tests

- Added `SettingsRow/SettingsRow.test.tsx`.
- Added `SettingsScene/SettingsScene.test.tsx`.
- Full suite: **86 suites passed, 314 tests passed**.

## TypeScript

- Only the repo-wide pre-existing `TS2786` JSX-type mismatch errors and the same `ButtonWithIcon` reanimated type errors that existed before this cycle appear in changed files; no new non-TS2786 errors were introduced.

## Files changed

- `src/screens/SettingsScene/index.tsx` (new)
- `src/screens/SettingsScene/SettingsScene.test.tsx` (new)
- `src/components/SettingsRow/index.tsx` (new)
- `src/components/SettingsRow/SettingsRow.test.tsx` (new)
- `src/screens/Tabs/ProfileScreen/index.tsx`
- `src/Navigation.tsx`
- `src/types/types.ts`
- `src/screens/index.ts`
- `src/components/index.ts`
- `src/components/Buttons/ButtonWithIcon/index.tsx`
- `src/locales/en/translation.json`
- `src/locales/ru/translation.json`
- `UX_IMPROVEMENT_PLAN_V47.md`
- `CYCLE47_REPORT.md`

## Three cooperation options for the next loop

1. **High-contrast / large-text board theme** — Add a Settings toggle for a high-contrast board and relax the font-scale cap for non-board text, then audit contrast and touch targets across the app.
2. **VoiceOver-first onboarding** — Convert onboarding into a screen-reader-guided tour with focus management, explicit labels, and a spoken summary of board rules.
3. **Settings sub-screens** — Split AI guide, bedtime reminder, and subscription details into focused sub-pages reachable from Settings rows, so the main settings list stays short and scannable.
