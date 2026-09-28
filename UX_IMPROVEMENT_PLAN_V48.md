# UX Improvement Plan V48 — High-Contrast Board Theme & Touch-Target Audit

**Cycle:** 48  
**Date:** 2026-08-08  
**Focus area:** Visual accessibility: high-contrast board theme, larger touch targets, and font-scale respect.

## 1. Research summary

### Weak points found
- `GameBoard` only has `light.png` and `dark.png` backgrounds. Neither is optimized for low vision or bright sunlight; the decorative artwork has low-contrast details.
- The app does not expose a user-facing high-contrast toggle, even though the Settings scene added in cycle 47 is the perfect place for it.
- `Text` component explicitly sets `allowFontScaling={false}` and caps font scale at 1.35, which limits system accessibility settings.
- Several small interactive elements in the UI (e.g., dice, small emoji header buttons, small +/- step buttons in `BedtimeReminder`, close icons) may fall below the recommended 44×44 pt touch target.
- There is no central theme provider beyond `useColorScheme`; a high-contrast mode would require ad-hoc color overrides everywhere.

### Competitor patterns
- **Goban3D / Blind Mahjong / Card World / Lost Cities** offer dedicated high-contrast modes and large-print options for low-vision board-game players.
- **Android/iOS accessibility guidelines** recommend following system theme, providing in-app overrides, using 4.5:1 text contrast, and 44×44 pt (iOS) / 48×48 dp (Android) touch targets.
- **Eevis Panula** shows a 4-option theme selector: System, Light, Dark, High Contrast.
- **WCAG 2.2 / Deque** recommends minimum 24×24 CSS px targets, but native best practice is 44×44 pt.

## 2. Decomposed plan

### A. Theme preference utility
- Add `src/utils/themeSettings.ts` with `loadThemePreference` / `saveThemePreference` backed by AsyncStorage (`@appTheme`).
- Supported values: `'system' | 'light' | 'dark' | 'highContrast'`.
- Add a global `setAppTheme` / `getAppTheme` helper so components can react to the chosen theme without re-implementing storage.

### B. High-contrast board render mode
- Add a high-contrast board background: `src/components/GameBoard/images/highContrast.png` (we will generate a simple programmatic view instead of requiring a new asset to avoid asset pipeline work).
- Actually: instead of an image asset, add a high-contrast fallback in `GameBoard` that hides the decorative background and renders the grid with bold colored cells, thick borders, and large numbers when `theme === 'highContrast'`.
- Keep the current active/previous/next cell highlights but make them stronger in high-contrast mode.

### C. Settings theme selector
- Add a `ThemeSelector` component (new) mounted in `SettingsScene` under a new "Appearance" section.
- Show four options as a segmented row or chips: System / Light / Dark / High Contrast.
- Persist choice and update the global theme immediately.

### D. Font-scale respect
- Keep the 1.35 cap for the game board itself (to preserve layout), but allow larger scaling for the rest of the app by removing `allowFontScaling={false}` from the global `Text` component and relying on the existing `applyFontScale` helper.
- Actually, the `Text` component already applies `fontScale` manually; we should keep `allowFontScaling={false}` so RN does not double-scale, but increase the cap from 1.35 to 1.6 for non-board text and keep 1.35 for board cells.
- Simpler approach for this cycle: raise `MAX_FONT_SCALE` from 1.35 to 1.5 in `fontScale.ts` and document that board cells clamp separately.

### E. Touch-target audit and fixes
- Audit small interactive elements and apply `minTouchTarget` or `hitSlop`:
  - `Dice` image wrapper already uses `minTouchTarget`; verify.
  - `Header` emoji buttons: ensure 44×44.
  - `BedtimeReminder` +/- step buttons: already 44×44? Check.
  - `ProfileCompletionCard` close "✕": wrap in a 44×44 touch target.
  - `GameTooltip` "Got it" / "Learn more" / "Hide all" text buttons: wrap in touch targets.
  - `SoundToggle` / `HapticToggle` / `ReducedMotionToggle` switches: the row should be one focus target; currently the whole card is not pressable except the switch.
- Add `minTouchTarget` to icon-only CTAs where missing.

### F. Tests
- Add `themeSettings.test.ts`.
- Add `ThemeSelector.test.tsx`.
- Extend `GameBoard.test.tsx` to verify high-contrast rendering path.
- Add a touch-target helper test verifying `MIN_TOUCH_SIZE`.
- Ensure `yarn test --runInBand` stays green.

## 3. Expected outcome
- Users can choose a high-contrast board theme in Settings.
- The board is readable in bright sunlight and for low-vision players.
- Touch targets across key interactive elements meet the 44×44 pt guideline.
- Text scaling respects system settings up to a higher cap.
- Test count grows by ~5–7 and stays green.
