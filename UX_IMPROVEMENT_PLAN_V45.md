# UX Improvement Plan V45 — Core Game Screen Feedback & Accessibility

**Cycle:** 45  
**Date:** 2026-08-08  
**Focus area:** GameScreen / Dice / GameBoard / turn awareness / multi-modal feedback

## 1. Research summary

### Weak points found
- The dice still calls raw `Vibration.vibrate()` on landing and disabled states instead of the curated haptic utility, so the feel is inconsistent with the rest of the app.
- There is no visible current-player indicator on the board screen beyond the header text; in offline multiplayer it is hard to tell whose turn it is at a glance.
- The dice result is only visual (an image). There is no accessibility announcement of the rolled value or the move that follows, and no turn-change announcement for assistive tech.
- `BoardLegend` exists but has no entry point from `GameScreen` (the state is initialised to `false` and never toggled), so the board symbology is undiscoverable during play.
- `FirstRollCoachMark` fires a `notificationWarning` haptic on first load, which feels negative for a celebratory first-roll moment.
- `IntentionPrompt` saves/skips silently: no haptic or visual confirmation, so the action feels unacknowledged.
- `GameTooltip` only shows `six`/`report`; it does not surface the `arrow` or `snake` tips even though the locale already supports them, missing the moment when those rules matter.

### Competitor patterns
- **Ludo/Snakes-and-Ladders apps** use a top HUD banner, color-coded active-player glow, and a large centred dice button.
- **2025 mobile board-game UX** recommends a multi-modal "feedback triple": visual animation + short sound + light haptic on every dice roll and turn change.
- **Board Game Arena UX guidelines** require every action to explain what happened, with short animations (0.5–0.8 s) and independent toggles for SFX/haptics.
- **Cradle Ludo accessibility PR** adds `aria-live` regions to turn labels, dice values, and move history so screen readers announce state changes automatically.

## 2. Decomposed plan

### A. `Dice` multi-modal polish
- Replace `Vibration.vibrate()` in `handleSpin` completion with `triggerHaptic('impactLight')`.
- Replace the disabled-roll `Vibration.vibrate()` with `triggerHaptic('notificationWarning')` (already impactMedium on start of roll).
- Expose `testID="dice-roll"` and `testID="dice-locked-text"` for tests.
- Keep accessibility label dynamic with the current value: "Roll the dice, current value {{count}}".

### B. `RollResultAnnouncement` — new component
- A screen-reader-only / small visual status region that announces: "Rolled {{count}}, moving from {{from}} to {{to}}".
- Uses `accessibilityLiveRegion="polite"` and a short-lived visible badge so the result is also readable without a screen reader.
- Mounted inside `GameScreen` below the dice.

### C. `TurnIndicator` — new component
- Shows the current player number in offline mode and the online step status (e.g. time remaining / take step).
- Adds a subtle colored dot/avatar ring and fires `triggerHaptic('impactLight')` only when the turn changes.
- Uses `accessibilityLiveRegion="polite"` so turn changes are announced.
- Mounted above the board in `GameScreen`.

### D. `BoardLegend` entry point on `GameScreen`
- Add a small `ButtonLink` / icon row under the dice: "Board legend".
- Open the existing `BoardLegend` modal on press, with haptic.
- This makes the legend usable without leaving the game.

### E. `FirstRollCoachMark` haptic tone-down
- Change the initial haptic from `notificationWarning` to `impactLight` to avoid a negative first impression.

### F. `IntentionPrompt` save feedback
- Trigger `triggerHaptic('impactLight')` on save and `triggerHaptic('notificationWarning')` on skip.
- Show a brief inline toast/label that the intention was saved.

### G. `GameTooltip` arrow/snake contextual tips
- Extend `GameTooltip` to support all existing tips; in `GameScreen` detect the latest move status from the current player's history and show `arrow`/`snake` tips when the last move was an arrow or snake and has not been dismissed.
- Add `testID="game-tooltip"` and update existing `GameTooltip` tests.

### H. Tests & verification
- Add `Dice.test.tsx` improvements: haptic on land, dynamic accessibility label.
- Add `TurnIndicator.test.tsx` and `RollResultAnnouncement.test.tsx`.
- Add a test verifying `BoardLegend` opens from `GameScreen`.
- Ensure no new non-TS2786 TypeScript errors and that `yarn test --runInBand` stays green.

## 3. Expected outcome
- Core gameplay has consistent haptic/audio/visual feedback triple.
- Players always know whose turn it is and what was rolled.
- Board symbology is reachable mid-game.
- First-roll coaching feels welcoming, not alarming.
- Screen-reader users get live announcements of turns and rolls.
- Test count should grow by ~6–10 new tests and stay green.
