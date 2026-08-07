# Leela UX Improvement Loop Report — Wave 080

## Date
2026-08-07

## Plan item
`UX_IMPROVEMENT_PLAN_V3.md` §1.4 — *Add a "welcome back" prompt after 7 days of inactivity.*

## What was done
1. Created `src/components/WelcomeBack/index.tsx`
   - Persists the last app-open timestamp in AsyncStorage under `@lastAppOpen`.
   - On mount, compares the stored timestamp to now in whole calendar days.
   - Shows a modal when at least 7 days have passed since the last recorded open.
   - Suppresses repeated prompts within the same calendar day via `@welcomeBackSeen`.
   - Updates the stored open timestamp after checking.
2. Exported `WelcomeBack` from `src/components/index.ts`.
3. Wired `<WelcomeBack />` into `src/screens/Tabs/GameScreen/index.tsx` after `<WeeklyRecap />`.
4. Added `welcomeBack.*` keys to both `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
   `title`, `body`, `continue`.
5. Added `src/components/WelcomeBack/WelcomeBack.test.tsx` covering:
   - prompt shows after 7 days of inactivity,
   - prompt does not show after 1 day,
   - prompt does not repeat on the same day.
6. Marked §1.4 complete in `UX_IMPROVEMENT_PLAN_V3.md`, closing section 1.

## Verification
- `npx jest --runInBand` → **57 suites, 220 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` → **bundle written successfully**.

## Commit
`6e399d8` — `wave 080: add welcome back prompt after 7 days of inactivity`

## Plan status table
| Section | Item | Status |
|---|---|---|
| 1.1 | Shareable streak-milestone card at 7 days | ✅ wave 077 |
| 1.2 | Streak-break recovery button | ✅ wave 078 |
| 1.3 | Weekly play recap card | ✅ wave 079 |
| 1.4 | "Welcome back" prompt after 7 days inactive | ✅ wave 080 |
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
1. **Start section 2** — implement §2.1 (AI answer language toggle) to make the AI companion respond consistently in the player's language.
2. **Continue section 2** — implement §2.2 (freeform "ask a follow-up" input inside the AI answer card) for deeper AI engagement.
3. **Start section 5** — implement §5.3 (richer Sentry tags for deep-link, share, and review-prompt flows) to improve observability and trust.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
