# Wave 074 — App Store review prompt after the third positive AI answer

**Plan item:** `UX_IMPROVEMENT_PLAN_V2.md` §8.3 — Add App Store review prompts after the third positive AI answer.

## What changed

1. **Review-prompt tracking** (`src/utils/reviewPrompt.ts`)
   - Added `recordPositiveAiAnswer()`, `resetPositiveAiAnswerCount()`, `getPositiveAiAnswerCount()`, `canRequestReview()`, `markReviewRequested()` and `hasReviewBeenRequested()`.
   - Uses AsyncStorage keys `@aiThumbsUpCount` and `@reviewRequested`.
   - Gate is 3 positive AI answers and the user must not have already been prompted.

2. **Constants refactor** (`src/constants.ts`)
   - Removed the old `@positiveEvents` based logic and replaced it with imports from `src/utils/reviewPrompt.ts`.
   - `maybeRequestReview()` now reads from the new utility and still shows the existing localized alert, then calls `onLeaveFeedback()` → `markReviewRequested()`.

3. **Thumbs-up trigger** (`src/components/AiFeedback/index.tsx`)
   - When a user presses thumbs up for the first time on a given AI answer (`wasNewUpvote`), the app calls `recordPositiveAiAnswer()` then `maybeRequestReview()`.
   - If the third upvote pushes the count over the threshold, the review prompt is shown.

4. **Tests** (`src/utils/reviewPrompt.test.ts`)
   - Covers counting, the threshold gate, the "already requested" guard, and reset.

5. **Component tests** (`src/components/AiFeedback/AiFeedback.test.tsx`)
   - Added a test asserting that a new thumbs-up records a positive AI-answer event.

## Verification

- `npx jest --runInBand` — **53 suites passed, 206 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — bundle written successfully.
- The remaining `tsc` errors in `src/components/AiFeedback/index.tsx` are pre-existing React 18 / `@types/react` JSX incompatibility issues across the repo and are not introduced by this change.

## Plan status

- `§8.3` marked complete in `UX_IMPROVEMENT_PLAN_V2.md`.
- Next open item: `§8.4` — Add a public "share report as link" option.

## Cooperation options for the next wave

1. **Implement §8.4** — add a public "share report as link" option using the existing `buildReportLink` Branch helper.
2. **Return to section 2** — improve AI guide experience (personas, follow-up questions, offline cache).
3. **Add analytics instrumentation** — log thumbs-up/share/invite events to validate which UX items are moving the needle before continuing.
