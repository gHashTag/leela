# UX Improvement Plan V46 — Accessibility-First Game Screen Pass

**Cycle:** 46  
**Date:** 2026-08-08  
**Focus area:** Core gameplay accessibility: screen-reader announcements, dynamic labels, focus, and assistive settings.

## 1. Research summary

### Weak points found
- `GameBoard` only labels the current cell and the whole board image; the 72 cells are otherwise silent, so a VoiceOver user has no sense of the board layout or special squares.
- `Dice` announces a generic label but does not speak the rolled value after a roll on iOS, because React Native `accessibilityLiveRegion` does not work on VoiceOver.
- `TurnIndicator` and `RollResultAnnouncement` already use `accessibilityLiveRegion`, but iOS will not read them automatically without an imperative announcement.
- The app has a `SoundToggle` but no user-facing haptic intensity or reduced-motion controls.
- Several buttons (`Button`, `ButtonSimple`, `ButtonWithIcon`) do not forward `accessibilityLabel`/`accessibilityHint`, so icon-only or visual-only CTAs can be ambiguous to assistive tech.
- There is no central `AccessibilityAnnouncements` helper, so dynamic state changes (turn change, roll result, win, snake/arrow landing) are inconsistent across iOS and Android.

### Competitor patterns
- **Deyesfree / Dice World / TableEx** announce dice results, totals, and board events via VoiceOver or self-voicing TTS.
- **Keeping Score!** announces score changes with player names and ranks.
- **React Native docs** confirm `accessibilityLiveRegion` is Android-only; iOS requires `AccessibilityInfo.announceForAccessibility`.
- **2025 mobile accessibility guidelines** recommend independent haptic toggles, reduced motion, high contrast, and gameplay speed controls.

## 2. Decomposed plan

### A. `AccessibilityAnnouncements` helper — new utility
- Wrap `AccessibilityInfo.announceForAccessibility` with a safe cross-platform function.
- On Android, optionally skip if a live region is already present; on iOS, always announce.
- Provide a `useAccessibilityAnnouncements` hook for components.

### B. Announce game events from `GameScreen`
- Announce turn changes via `TurnIndicator` using the new helper.
- Announce roll results via `RollResultAnnouncement` using the new helper.
- Announce snake/arrow landings and win state when they occur.

### C. Improve `GameBoard` cell accessibility
- Add `accessibilityLabel` to every numbered cell: "Cell {{cell}}, {{plane}} chakra".
- Mark snakes and arrows with a hint, e.g. "Cell 10, foot of an arrow" / "Cell 12, head of a snake".
- Keep the current cell accessible and focused.

### D. Button accessibility forwarding
- Extend `Button`, `ButtonSimple`, and `ButtonWithIcon` to accept and forward `accessibilityLabel`, `accessibilityHint`, and `accessibilityRole`.
- Default the label to the button title so existing buttons become accessible automatically.

### E. Assistive settings foundation
- Add `HapticToggle` and `ReducedMotionToggle` components (new).
- Persist preferences via AsyncStorage (`@hapticEnabled`, `@reducedMotionEnabled`).
- Wire `Pressable` and `Dice` to respect `hapticEnabled`.
- Add `loadHapticEnabled` / `saveHapticEnabled` utility alongside `soundSettings`.

### F. Tests
- Add `AccessibilityAnnouncements.test.ts`.
- Add `HapticToggle.test.tsx` and `ReducedMotionToggle.test.tsx`.
- Extend `Button.test.tsx` / `ButtonSimple.test.tsx` / `ButtonWithIcon.test.tsx` if they exist; otherwise add targeted tests.
- Add a `GameBoard` cell-label test.
- Ensure `yarn test --runInBand` stays green.

## 3. Expected outcome
- All dynamic game events are announced on iOS via VoiceOver and on Android via live regions.
- Buttons provide accessible labels/hints by default.
- Users can disable haptics and reduce motion.
- Test count grows by ~6–10 and stays green.
