# Cycle 46 Report — Accessibility-First Game Screen Pass

**Date:** 2026-08-08  
**Scope:** Screen-reader announcements, dynamic accessibility labels, assistive settings (haptics / reduced motion), and button accessibility forwarding.

## What was improved

1. **Cross-platform accessibility announcements**
   - Added `src/utils/accessibilityAnnouncements.ts` with `announceForAccessibility`, wrapping `AccessibilityInfo.announceForAccessibility` safely.
   - Wired `TurnIndicator` and `RollResultAnnouncement` to call this helper on iOS/VoiceOver, because React Native `accessibilityLiveRegion` is Android-only.

2. **Board cell accessibility**
   - Every numbered cell in `GameBoard` now has an `accessibilityLabel` describing the cell number, chakra plane, and whether it is the foot of an arrow, head of a snake, or the final cell.
   - Added i18n keys for `cell`, `snakeHead`, `arrowBase`, and `finalCell` in `en` and `ru`.

3. **Button accessibility forwarding**
   - `Button`, `ButtonSimple`, and `ButtonWithIcon` now accept and forward `accessibilityLabel` and `accessibilityHint`, defaulting the label to the button title.
   - `Pressable` still triggers haptics but now respects the global haptic flag.

4. **Haptic settings**
   - Added `src/utils/hapticSettings.ts` (`loadHapticEnabled` / `saveHapticEnabled`) backed by `@hapticEnabled`.
   - Updated `triggerHaptic` to respect a global `hapticEnabled` flag via `setHapticEnabled`.
   - Added `HapticToggle` component (UI + persistence), exported from `src/components/index.ts`.

5. **Reduced-motion settings**
   - Added `ReducedMotionToggle` component with AsyncStorage persistence (`@reducedMotionEnabled`) and a global getter/setter (`isReducedMotionEnabled` / `setReducedMotionEnabled`) so future animations can read it.

6. **i18n**
   - Added `hapticToggle`, `reducedMotionToggle`, and `accessibilityAnnouncements` namespaces in English and Russian.

## Tests

- Added `accessibilityAnnouncements.test.ts`.
- Added `hapticSettings.test.ts`.
- Extended `haptics.test.ts` for the global flag.
- Added `Button/Button.test.tsx`.
- Added `HapticToggle/HapticToggle.test.tsx`.
- Added `ReducedMotionToggle/ReducedMotionToggle.test.tsx`.
- Added `GameBoard/GameBoard.test.tsx`.
- Full suite: **84 suites passed, 311 tests passed**.

## TypeScript

- Only the repo-wide pre-existing `TS2786` JSX-type mismatch errors and the same `ButtonWithIcon` reanimated type errors that existed before this cycle appear in changed files; no new non-TS2786 errors were introduced.

## Files changed

- `src/utils/accessibilityAnnouncements.ts` (new)
- `src/utils/accessibilityAnnouncements.test.ts` (new)
- `src/utils/hapticSettings.ts` (new)
- `src/utils/hapticSettings.test.ts` (new)
- `src/utils/haptics.ts`
- `src/utils/haptics.test.ts`
- `src/components/Pressable/index.tsx`
- `src/components/Buttons/Button/index.tsx`
- `src/components/Buttons/Button/Button.test.tsx` (new)
- `src/components/Buttons/ButtonSimple/index.tsx`
- `src/components/Buttons/ButtonWithIcon/index.tsx`
- `src/components/HapticToggle/index.tsx` (new)
- `src/components/HapticToggle/HapticToggle.test.tsx` (new)
- `src/components/ReducedMotionToggle/index.tsx` (new)
- `src/components/ReducedMotionToggle/ReducedMotionToggle.test.tsx` (new)
- `src/components/GameBoard/index.tsx`
- `src/components/GameBoard/GameBoard.test.tsx` (new)
- `src/components/TurnIndicator/index.tsx`
- `src/components/RollResultAnnouncement/index.tsx`
- `src/components/index.ts`
- `src/locales/en/translation.json`
- `src/locales/ru/translation.json`
- `UX_IMPROVEMENT_PLAN_V46.md`
- `CYCLE46_REPORT.md`

## Three cooperation options for the next loop

1. **Integrate toggles into a real Settings screen** — Create a `SettingsScene` with grouped rows for Sound, Haptics, Reduced Motion, Language, and High Contrast, so the new toggles are reachable without mounting them ad-hoc.
2. **VoiceOver-friendly onboarding tutorial** — Convert the onboarding screens into a screen-reader-first guided tour with focus traps, explicit next/previous labels, and an audio summary of the board rules.
3. **High-contrast and large-text polish** — Add a high-contrast board theme and widen the font-scale cap for non-board text, then audit all screens for WCAG AA contrast and minimum 44×44 pt touch targets.
