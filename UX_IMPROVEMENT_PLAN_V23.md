# UX Improvement Plan V23 — Dice Roll Recovery from Hung/Interrupted Rolls

**Date:** 2026-08-08  
**Cycle:** 19  
**Focus area:** Dice component roll reliability and recovery

---

## Research summary

### Weak spots in the current dice flow
- `Dice.handleSpin` (`src/components/Dice/index.tsx:55-69`) starts an `Animated.timing` and, in its completion callback, calls `updateStep()` without `await`, `catch`, or timeout. If `updateStep()` hangs or the animation completion never fires, `canRoll` is never re-enabled.
- There is no cleanup on unmount: `spinValue`, the active animation, and a `setTimeout(() => setCanRoll(true), 200)` are left running if the component unmounts mid-roll.
- There is no visible "Roll again" affordance when the roll fails. The only recovery path is leaving the screen.
- `canRoll` is local React state, so it resets to `true` on re-mount even if a previous roll left game state inconsistent.
- `updateStep()` is called from the animation completion, which means a network/persistence failure during the step update can leave the die visually finished but game state unchanged, with no feedback.

### Competitor / pattern research
- **Dice Services Update (Brickmill Games)** added a 10-second timeout to dice-roll services and a request ID (`rid`) so the client can ignore late/stale server responses and avoid getting stuck due to out-of-order replies.
- **mifki blog** recommends a command/response queue preserved across reconnections, so users never need to manually retry actions after network interruptions.
- **Dice Vice devlog** added a "stuck-state detector" so when a player has no valid moves, a recovery button appears immediately to recover from softlock.
- **Pixels Developer’s Guide** emphasizes handling wireless delays/failures gracefully, showing spinners during async operations, offering retry or virtual-roll fallback, avoiding popups, and integrating connection/roll status into the UI.
- **artoryx** notes the importance of refresh signals and responsive result boards in mobile gaming to maintain player trust.

### Patterns to adopt
1. Treat the roll as a bounded async operation: animation + `updateStep()` + re-enable, all guarded by a timeout.
2. Use `AbortController` or a timeout promise to detect a hung roll and surface a "Roll again" button.
3. Add `useEffect` cleanup that stops the animation and clears the timeout on unmount.
4. Catch `updateStep()` failures, show a localized inline error, and reset `canRoll` so the user can retry.
5. Keep a `rollStatus` (`idle | rolling | success | error`) so the UI can show appropriate affordances.

---

## Goals

1. Never leave the die permanently disabled after a failed or interrupted roll.
2. Give the user a one-tap "Roll again" path when the step update fails.
3. Clean up timers/animations on unmount to prevent state updates on unmounted components.
4. Bound the entire roll + step-update operation with a timeout.

---

## Decomposed tasks

### Task 1 — Make the roll operation bounded and recoverable
- Update `src/components/Dice/index.tsx`:
  - Introduce `rollStatus: 'idle' | 'rolling' | 'error'`.
  - Replace the bare `Animated.timing(...).start(() => { ... })` with a helper that returns a promise resolved on animation completion.
  - Await `OnlinePlayer.updateStep()` / `OfflinePlayers.updateStep()` in the animation completion and catch errors.
  - Wrap animation + step update in a `Promise.race` against a 10 s timeout.
  - On success, re-enable the die. On timeout/error, set `rollStatus: 'error'` and show a retry button.

### Task 2 — Cleanup on unmount
- Add a `useEffect` cleanup that:
  - stops the active `Animated.timing`;
  - clears any pending timeout;
  - aborts the timeout controller if one is used.

### Task 3 — UI affordances
- While `rollStatus === 'rolling'`, show a subtle spinner or label near the die.
- When `rollStatus === 'error'`, show an inline error text + "Roll again" button.
- Keep the die disabled while rolling or when game rules lock it (`isOpacity`).

### Task 4 — Localization
- Add keys:
  - `dice.rolling`
  - `dice.rollAgain`
  - `dice.rollFailed`
  - `dice.rollTimeout`
- Update all 10 locale files.

### Task 5 — Tests
- Create/update `src/components/Dice/index.test.tsx`:
  - die is disabled while rolling;
  - retry button appears after a failed/timed-out roll;
  - tapping retry triggers a new roll.
- Update `src/utils/aiStream.test.ts` is not in scope for this cycle.

### Task 6 — Report and memory
- Write `AUTONOMOUS_UX_LOOP_REPORT_2026-08-08_cycle19.md`.
- Update memory index.

---

## Success criteria

- A hung or failed roll does not leave the die permanently disabled.
- A "Roll again" button appears inline after a roll failure.
- Animation and timers are cleaned up on unmount.
- Jest: 80+ suites, 348+ tests passing.

---

## Next-cycle options (preview)

- A: Apply cancel/retry/partial-output pattern to `ChatScreen` AI chat.
- B: Consolidated Profile/Settings tab with Pro upsell and account tools.
- C: Onboarding resume-state persistence and clearer progress recovery.
