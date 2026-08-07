# LOOP_REPORT_059 — Roll history strip above the dice

**Date:** 2026-08-07  
**Wave:** 059  
**Target:** v2 item 5.3 — Add a "roll history" strip above the dice.

## What was done

1. Created `src/components/RollHistory/index.tsx`
   - Displays the last 7 rolls as a horizontal strip of circular pills above the dice.
   - Reads history from `OnlinePlayer.store.history` when `DiceStore.online` is true, otherwise from the current offline player's history (`OfflinePlayers.store.histories[DiceStore.players - 1]`).
   - Reverses the history so the oldest roll appears on the left and the newest roll on the right, with the latest roll highlighted in bright turquoise.

2. Added `src/components/RollHistory/RollHistory.test.tsx`
   - Standard render-safety test matching recent wave patterns.

3. Exported `RollHistory` from `src/components/index.ts`.

4. Wired `RollHistory` into `src/screens/Tabs/GameScreen/index.tsx`
   - Placed directly above the `Dice` component so it reads as a natural "recent rolls" preview before the player rolls again.

5. Added i18n keys for `en` and `ru`:
   - `rollHistory.title` → "Roll history" / "История бросков"

6. Updated `jest.setup.js` store mock to include `OfflinePlayers.store.histories`, so the component renders safely under test.

7. Marked v2 item **5.3** complete in `UX_IMPROVEMENT_PLAN_V2.md`.

## Verification

- `npx jest src/components/RollHistory/RollHistory.test.tsx` — **pass** (2/2 tests).
- `npx jest --no-coverage` — **146 passed, 0 failed** (full suite green).
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — **success** (bundle written to `/tmp/ios.bundle`).

## Plan status

| Section | Item | Status |
|---|---|---|
| 4. UX Polish | 4.3 Gift subscription | ✅ wave 054 |
| 4. UX Polish | 4.4 Pay-what-you-want | ✅ wave 055 |
| 4. UX Polish | 4.5 Pro feature explainer | ✅ wave 056 |
| 5. Game Board Depth | 5.1 Board legend | ✅ wave 057 |
| 5. Game Board Depth | 5.2 Last-move replay | ✅ wave 058 |
| 5. Game Board Depth | **5.3 Roll history strip** | **✅ wave 059** |
| 5. Game Board Depth | 5.4 Previous/next plane highlights | ⏳ |
| 5. Game Board Depth | 5.5 Sound toggle/SFX | ⏳ |

## Cooperation options for the next wave

1. **Implement 5.4** — Highlight the previous and next planes during piece movement, making board transitions easier to follow.
2. **Implement 5.5** — Add a sound toggle and distinct dice/plane sound effects (haptic + optional audio assets).
3. **Jump to section 7** — Improve accessibility: increase dice/icon touch targets to 44×44 pt and add VoiceOver labels for the tab navigator.
