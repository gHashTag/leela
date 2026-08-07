# Leela UX Improvement Loop Report — Wave 079

## Date
2026-08-07

## Plan item
`UX_IMPROVEMENT_PLAN_V3.md` §1.3 — *Add a weekly play recap card on the game screen with total rolls, reports, and streak.*

## What was done
1. Created `src/components/WeeklyRecap/index.tsx`
   - Computes the current calendar-week bounds (Sunday–Saturday).
   - Counts rolls from `OfflinePlayers.store.histories` or `OnlinePlayer.store.history` based on `DiceStore.online`.
   - Counts reports from `PostStore.store.ownPosts`.
   - Reads reflection streak from `StreakJournal` entries via `loadEntries()` and `computeStreak()`.
   - Renders a compact three-stat card with labels for rolls, reports, and streak.
2. Exported `WeeklyRecap` from `src/components/index.ts`.
3. Wired `<WeeklyRecap />` into `src/screens/Tabs/GameScreen/index.tsx` after `<StreakMilestone />`.
4. Added `weeklyRecap.*` keys to both `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
   `title`, `rolls`, `reports`, `streak`.
5. Added `src/components/WeeklyRecap/WeeklyRecap.test.tsx` verifying the card renders the title and all three stat labels.
6. Marked §1.3 complete in `UX_IMPROVEMENT_PLAN_V3.md`.

## Verification
- `npx jest --runInBand` → **56 suites, 217 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` → **bundle written successfully**.

## Commit
`fb69446` — `wave 079: add weekly play recap card on game screen`

## Plan status table
| Section | Item | Status |
|---|---|---|
| 1.1 | Shareable streak-milestone card at 7 days | ✅ wave 077 |
| 1.2 | Streak-break recovery button | ✅ wave 078 |
| 1.3 | Weekly play recap card | ✅ wave 079 |
| 1.4 | "Welcome back" prompt after 7 days inactive | ⬜ open |
| 2.1 | AI answer language toggle | ⬜ open |
| 2.2 | Freeform follow-up input in AI answer card | ⬜ open |
| 2.3 | Bookmark AI answers by plane | ⬜ open |
| 3.1 | "New replies" badge on community tab | ⬜ open |
| 3.2 | Report hashtags / topics filter | ⬜ open |
| 3.3 | Follow other players | ⬜ open |
| 4.1 | Yearly plan nudge | ⬜ open |
| 4.2 | Family / household Pro plan | ⬜ open |
| 4.3 | Pro trial ended win-back offer | ⬜ open |
| 5.1 | In-app changelog | ⬜ open |
| 5.2 | "Download my data" button | ⬜ open |
| 5.3 | Richer Sentry tags for deep-link/share/review flows | ⬜ open |

## Cooperation options for the following wave
1. **Continue section 1** — implement §1.4 ("welcome back" prompt after 7 days of inactivity) to close the retention chapter.
2. **Start section 2** — implement §2.1 (AI answer language toggle) to deepen the AI companion experience.
3. **Start section 5** — implement §5.3 (richer Sentry tags for deep-link, share, and review-prompt flows) to improve observability and trust.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
