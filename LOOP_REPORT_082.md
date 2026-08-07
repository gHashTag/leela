# UX Improvement Loop Report — Wave 082

**Date:** 2026-08-07
**Plan item:** UX_IMPROVEMENT_PLAN_V3.md §2.2
**Branch:** leela-ai-streaming-vedic

## What was implemented

Added a freeform "ask a follow-up" input inside the AI answer card.

When a player sees Leela's answer, the existing follow-up chips now have an additional dashed chip: "Ask your own question…". Tapping it opens the same `INPUT_TEXT_MODAL` used by preset chips, but with an empty text field so the player can type a custom follow-up. The submitted text is posted as a regular comment on the same post, matching the existing flow.

### Files changed

- `src/components/FollowUpQuestions/index.tsx` — added a freeform chip and shared `openInput` helper.
- `src/components/FollowUpQuestions/FollowUpQuestions.test.tsx` — added tests for the freeform chip and empty `initialText`.
- `src/locales/en/translation.json` — added `followUpQuestions.askFreeform`.
- `src/locales/ru/translation.json` — added Russian translation.
- `UX_IMPROVEMENT_PLAN_V3.md` — marked §2.2 complete with wave 082.

## Verification

- `npx jest --runInBand --no-cache` — **59/59 suites passed, 233/233 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — **bundle written successfully**.

## Notes

- No new dependencies or native changes; the feature reuses `INPUT_TEXT_MODAL` and `PostStore.createComment`.
- The preset chips continue to work exactly as before; only a new chip was appended.
- The pre-existing MobX `autorun` console error from `DiceStore.ts` still appears during some tests but does not cause failures.

## Commit

`edf72d5` — wave 082: add freeform follow-up input inside AI answer card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

---

## Plan status after this wave

| Section | Status |
|---------|--------|
| 1. Retention & Re-engagement | ✅ Complete |
| 2.1 AI answer language toggle | ✅ wave 081 |
| 2.2 Freeform follow-up input | ✅ wave 082 |
| 2.3 Bookmark AI answers by plane | ⬜ Open |
| 3.1 New-replies badge | ⬜ Open |
| 3.2 Hashtag/topic filter | ⬜ Open |
| 3.3 Follow other players | ⬜ Open |
| 4.1 Yearly plan nudge | ⬜ Open |
| 4.2 Family Pro plan | ⬜ Open |
| 4.3 Trial-ended win-back | ⬜ Open |
| 5.1 In-app changelog | ⬜ Open |
| 5.2 Download my data | ⬜ Open |
| 5.3 Richer Sentry tags | ⬜ Open |

## Cooperation options for the next wave

1. **Start section 2.3** — allow players to bookmark AI answers and browse them by plane, building on the existing bookmark and cached-answer infrastructure.
2. **Start section 3.1** — add a "new replies" badge to the community tab when the player has unread comments.
3. **Start section 5.1** — add an in-app changelog that highlights what's new after an update.
