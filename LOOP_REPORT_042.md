# UX Improvement Loop Report — Wave 42

**Date:** 2026-08-07
**Commit:** `c79b4238ffa21e5b91aea6aaf73f325d1facb77b`
**Plan item:** v2 2.2 — Add follow-up questions inside the report answer card.

## Summary
Added a row of follow-up question chips under every AI-generated report answer. Tapping a chip opens the existing comment input modal pre-filled with the question so the player can edit and submit it as a new comment.

## Changes

### New files
- `src/utils/aiComment.ts` — `isAiComment(ownerId)` helper that detects Leela AI comments.
- `src/utils/aiComment.test.ts` — unit tests for the helper.
- `src/utils/followUpQuestions.ts` — `getFollowUpQuestions(t)` returning four localized reflection prompts.
- `src/utils/followUpQuestions.test.ts` — unit tests for the helper.
- `src/components/FollowUpQuestions/index.tsx` — chip row component that opens `INPUT_TEXT_MODAL` with the selected question.
- `src/components/FollowUpQuestions/FollowUpQuestions.test.tsx` — render and interaction tests.

### Modified files
- `src/components/index.ts` — exports `FollowUpQuestions`.
- `src/components/Cards/CommentCard/index.tsx` — detects AI comments and renders `FollowUpQuestions` below the answer text.
- `src/locales/en/translation.json` — added `followUpQuestions.title`, `q1`–`q4`.
- `src/locales/ru/translation.json` — added Russian translations for the same keys.
- `jest.setup.js` — extended the global `PostStore` mock so new component tests can import the store shape.
- `UX_IMPROVEMENT_PLAN_V2.md` — marked item **2.2** complete.

## Verification
- Jest: 22 suites, 67 tests passed.
- iOS bundle: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` completed successfully (pre-existing dependency warnings only).

## Updated plan status

| Section | Items | Completed | Next open |
|---|---|---|---|
| 1. Retention & Daily Habit | 5 | 5 | — |
| 2. AI Guide Experience | 6 | 2 | **2.3** |
| 3. Social & Community | 5 | 0 | 3.1 |
| 4. Monetization & Pro | 5 | 0 | 4.1 |
| 5. Game Board Depth | 5 | 0 | 5.1 |
| 6. Performance & Stability | 5 | 0 | 6.1 |
| 7. Accessibility & Localization | 5 | 0 | 7.1 |
| 8. Discoverability & Onboarding | 4 | 0 | 8.1 |

## Cooperation options for the next wave

1. **Continue section 2** — implement **2.3** (cache the last 5 AI answers for offline reading) so players can re-read Leela's guidance without connectivity.
2. **Start section 5** — implement **5.1** (board legend overlay) to help new players understand planes, chakras, arrows, and snakes.
3. **Instrument v1 features** — add lightweight analytics events for AI answer copy, follow-up chip taps, share, and report creation to validate which upcoming items matter most.
