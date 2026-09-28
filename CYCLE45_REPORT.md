# Cycle 45 Report — Core Game Screen Feedback & Accessibility

**Date:** 2026-08-08  
**Scope:** GameScreen, Dice, GameTooltip, FirstRollCoachMark, IntentionPrompt, plus two new components: `TurnIndicator` and `RollResultAnnouncement`.

## What was improved

1. **Multi-modal dice feedback**
   - Replaced raw `Vibration.vibrate()` in `Dice` with `triggerHaptic('impactLight')` on landing and `triggerHaptic('notificationWarning')` when the dice is locked, matching the curated haptic language used elsewhere.
   - The dice now exposes its current value in the accessibility label (`accessibility.rollDiceValue`) and adds `testID="dice-roll"` / `testID="dice-locked-text"`.

2. **Turn awareness (`TurnIndicator`)**
   - New component above the board shows the current player in offline mode and the online step status.
   - Fires a light haptic only when the player actually changes.
   - Uses `accessibilityLiveRegion="polite"` so assistive tech announces turn changes.

3. **Roll result announcement (`RollResultAnnouncement`)**
   - New component below the dice announces the last roll in plain text: "Rolled 4: 12 → 16".
   - Includes a screen-reader live region and a short visible badge that fades after 1.8 s.
   - Triggers a light haptic when a new roll lands.

4. **Board legend entry point**
   - Added a `ButtonLink` under the dice to open the existing `BoardLegend` modal.
   - The legend existed but had no in-game entry point; now players can check symbology without leaving the screen.

5. **Contextual `GameTooltip` tips**
   - `GameScreen` now detects when the last move was an `arrow` or `snake` and switches the tooltip to the matching tip.
   - Added `testID="game-tooltip"` to the tooltip card for tests.

6. **First-roll coaching tone**
   - Changed `FirstRollCoachMark`'s initial haptic from `notificationWarning` to `impactLight` so the first-roll moment feels welcoming rather than alarming.

7. **Intention prompt feedback**
   - Added haptic feedback on save (`impactLight`) and skip (`notificationWarning`) in `IntentionPrompt`.

8. **i18n**
   - Added English and Russian strings for `rollResult`, `turnIndicator.onlineBlocked`, and `accessibility.rollDiceValue`.

## Tests

- Added `RollResultAnnouncement.test.tsx`.
- Added `TurnIndicator.test.tsx`.
- Extended `Dice/index.test.tsx` to verify the dynamic accessibility label and testID.
- Full suite: **78 suites passed, 298 tests passed**.

## TypeScript

- Only the repo-wide pre-existing `TS2786` JSX-type mismatch errors appear in changed files; no new non-TS2786 errors were introduced.

## Files changed

- `src/components/Dice/index.tsx`
- `src/components/Dice/index.test.tsx`
- `src/components/FirstRollCoachMark/index.tsx`
- `src/components/GameTooltip/index.tsx`
- `src/components/IntentionPrompt/index.tsx`
- `src/components/TurnIndicator/index.tsx` (new)
- `src/components/TurnIndicator/TurnIndicator.test.tsx` (new)
- `src/components/RollResultAnnouncement/index.tsx` (new)
- `src/components/RollResultAnnouncement/RollResultAnnouncement.test.tsx` (new)
- `src/screens/Tabs/GameScreen/index.tsx`
- `src/components/index.ts`
- `src/locales/en/translation.json`
- `src/locales/ru/translation.json`
- `UX_IMPROVEMENT_PLAN_V45.md`
- `CYCLE45_REPORT.md`

## Three cooperation options for the next loop

1. **Deep-dive the dice/board animation** — Add a short tumbling animation, player-colored dice ring, and arrow/snake move preview to make every roll feel more physical.
2. **GameScreen HUD overhaul** — Consolidate the header messages, turn indicator, roll history, and last-move replay into a single, responsive game HUD with player avatars and a turn timer.
3. **Accessibility-first pass** — Add full VoiceOver labels to the board cells, turn announcements, and sound/haptic settings toggles so the game is playable without sight.
