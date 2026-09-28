# UX Improvement Plan V47 — Settings Screen for Accessibility Toggles

**Cycle:** 47  
**Date:** 2026-08-08  
**Focus area:** A centralized, grouped Settings screen for Sound / Haptics / Reduced Motion / AI Language.

## 1. Research summary

### Weak points found
- `SoundToggle`, `AiLanguageToggle`, `BedtimeReminder`, `SessionHealthScene` are currently exposed as tabs inside `ProfileScreen`. That is not a discoverable place for app preferences; users do not expect settings under their profile tab.
- `HapticToggle` and `ReducedMotionToggle` from cycle 46 are components but are not mounted anywhere, so the new toggles are unreachable.
- There is no central Settings scene; the only settings-like UI is scattered across the profile tab bar.
- The profile tab bar now has 9 scenes, many of which are not content (reports, history, intention) but configuration, making it dense and hard to scan.
- No grouped-section pattern exists for binary preferences; each toggle is a self-contained card, which is fine as a widget but noisy as a full list.

### Competitor patterns
- **iOS Settings** uses grouped table sections with concise labels, value labels, and native switches; each section has a header and optional footer.
- **Android Settings** groups related toggles, limits top-level density, shows current value as secondary text, and uses switches only for reversible binary states.
- **React Native 2025 best practice** is a single focusable row with the switch hidden from the accessibility tree, or `accessibilityRole="switch"` on the switch with a clear label.

## 2. Decomposed plan

### A. `SettingsScene` — new screen
- Create `src/screens/SettingsScene/index.tsx` as a full-screen scene with grouped sections.
- Use the existing `AppContainer` header and a vertical scroll layout.
- Sections:
  - **Experience**: Sound, Haptics, Reduced Motion.
  - **AI**: AI Language toggle (link to existing `AiLanguageToggle`).
  - **Account / Profile**: links to `USER_EDIT` and `SUBSCRIPTION_SCREEN`.
  - **Reminders**: Bedtime reminder row linking to a focused bedtime sub-screen (or inline the existing `BedtimeReminder`).
- Each row shows a title, optional subtitle/value, and a switch or chevron.

### B. `SettingsRow` — new reusable component
- A single `Pressable` row that wraps a label, subtitle, optional left icon, and trailing control (switch, value label, or chevron).
- Hides the inner `Switch` from the accessibility tree so the whole row is one focus target (`accessibilityRole="switch"`, `accessibilityState={{ checked }}`).
- Toggles trigger haptic feedback.

### C. Move toggles from Profile tab to Settings
- Remove `soundToggle`, `aiPersona`, `aiAnswers` from `ProfileScreen`’s `OwnTabView` (keep reports/history/intention/bookmarks/bedtime as content; or move bedtime to Settings too).
- Actually, keep content scenes in profile and move all configuration scenes to Settings:
  - Keep in profile: reports, history, intention, bookmarks.
  - Move to Settings: sound, haptics, reduced motion, AI language, AI persona, bedtime reminder, session health.
- Add a Settings entry point from `ProfileScreen` (a `ButtonWithIcon` or header right action).

### D. Add navigation route
- Add `'SETTINGS_SCENE'` to the navigation type and to the navigator where `SUBSCRIPTION_SCREEN` etc. are defined.
- Find the root navigator (likely `src/App.tsx` or `src/navigation`) and add the route.

### E. Tests
- Add `SettingsScene.test.tsx` and `SettingsRow.test.tsx`.
- Verify that toggles persist state and that the scene renders all sections.
- Run `yarn test --runInBand` and ensure no new non-TS2786 errors.

## 3. Expected outcome
- All app preferences live in one discoverable Settings scene.
- The profile tab becomes content-focused (reports, history, intention, bookmarks).
- The new Haptic / Reduced Motion toggles become reachable.
- Users get grouped, accessible rows with clear labels and haptic feedback.
- Test count grows by ~4–6 and stays green.
