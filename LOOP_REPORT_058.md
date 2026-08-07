# LOOP_REPORT_058 — Last-move replay for online games

**Date:** 2026-08-07  
**Wave:** 058  
**Target:** v2 item 5.2 — Show a replay of the last move for online games.

## What was done

1. Created `src/components/LastMoveReplay/index.tsx`
   - Reads `OnlinePlayer.store.history[0]` (the most recent online move).
   - Computes the previous plan from `history[1].plan`, falling back to `plan - count`.
   - Shows a compact replay row: previous plan → current plan, die value, localized status, and move date.
   - Status icons reuse the existing emoji convention (`:game_die:`, `:snake:`, `:bow_and_arrow:`, `:sun_with_face:`, `:sparkles:`).
   - Status colors: snake red, arrow bright-turquoise, liberation primary, start orange, default dim gray.

2. Added `src/components/LastMoveReplay/LastMoveReplay.test.tsx`
   - Basic render safety test matching the pattern of recent waves.

3. Exported `LastMoveReplay` from `src/components/index.ts`.

4. Wired `LastMoveReplay` into `src/screens/Tabs/GameScreen/index.tsx`
   - Rendered only when `DiceStore.online` is true, placed above the dice and the board legend button.

5. Added i18n keys for `en` and `ru`:
   - `lastMoveReplay.title`
   - `lastMoveReplay.move` with interpolation `{{from}}`, `{{to}}`, `{{count}}`, `{{status}}`
   - `lastMoveReplay.status.{cube,start,snake,arrow,liberation}`

6. Updated `jest.setup.js` store mock to include a sample `history` array for `OnlinePlayer.store`, so tests relying on the store shape render without crashing.

7. Marked v2 item **5.2** complete in `UX_IMPROVEMENT_PLAN_V2.md`.

## Verification

- `npx jest src/components/LastMoveReplay/LastMoveReplay.test.tsx` — **pass** (2/2 tests).
- `npx jest --no-coverage` — **143 passed, 1 pre-existing failure** in `src/utils/trialTimer.test.ts` (time-sensitive seconds assertion unrelated to this wave).
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — **success** (bundle written to `/tmp/ios.bundle`).

## Plan status

| Section | Item | Status |
|---|---|---|
| 4. UX Polish | 4.3 Gift subscription | ✅ wave 054 |
| 4. UX Polish | 4.4 Pay-what-you-want | ✅ wave 055 |
| 4. UX Polish | 4.5 Pro feature explainer | ✅ wave 056 |
| 5. Game Board Depth | 5.1 Board legend | ✅ wave 057 |
| 5. Game Board Depth | **5.2 Last-move replay** | **✅ wave 058** |
| 5. Game Board Depth | 5.3 Roll history strip | ⏳ |
| 5. Game Board Depth | 5.4 Previous/next plane highlights | ⏳ |
| 5. Game Board Depth | 5.5 Sound toggle/SFX | ⏳ |

## Cooperation options

- Ready for next wave (5.3) on request.
- Can iterate on replay UI placement, status labels, or date formatting if needed.
