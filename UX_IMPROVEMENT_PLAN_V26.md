# UX Improvement Plan V26

**Cycle:** 21  
**Date:** 2026-08-08  
**Theme:** Onboarding resume card and safer launch-state recovery

## 1. Weak spots

- `Navigation.tsx` only checks `@onboardingComplete`. If a user dropped out mid-onboarding, the next launch replays from step 1 because `OnboardingScreen` reads `@onboardingStep` but nothing communicates that state at the entry gate.
- `OnboardingScreen` writes `@onboardingStep` but never validates whether the saved step is still in range after onboarding copy changes; it also never cleans up stale state when a user completes onboarding through a different path.
- `WelcomeScreen` and `Hello` currently show the same static content for everyone. A returning user who already started onboarding has no visual cue to "continue" and may tap away.
- There is no way to reset onboarding from the auth screens. A user who skipped or wants to rewatch rules has to reinstall.
- The onboarding step is not exposed to analytics; the team cannot distinguish drop-offs by step.

## 2. Competitors / patterns

- **Duolingo**: shows a bright "Continue your lesson" card on the home screen with exact progress (e.g., "Unit 1, Lesson 3 of 5"). The card is the primary CTA until the lesson is complete.
- **Headspace**: onboarding is chunked into days; the app surfaces a resume tile on the welcome screen and an explicit "Start over" secondary action.
- **Apple HIG (Launch experience)**: do not make users re-enter information they already provided; provide a clear path to resume and a low-friction way to restart.
- **Spotify / Netflix**: guest/welcome screens use contextual bottom sheets with two CTAs (continue / restart) instead of a single primary button.

## 3. Decomposed plan

1. Create utility `src/utils/onboardingResume.ts` that reads `@onboardingStep` and `@onboardingComplete`, returns `{ canResume, step, totalSteps }`, and exposes `clearOnboardingProgress()` and `markOnboardingComplete()`.
2. Update `Navigation.tsx` to read resume state. If onboarding is not complete but a saved step exists, go to `ONBOARDING_SCREEN`; keep current behavior otherwise.
3. Add a resume card to `WelcomeScreen` and `Hello` when onboarding is in progress:
   - title: "Continue your introduction" / localized;
   - subtitle with step count;
   - primary CTA: "Continue";
   - secondary: "Start over".
4. Add locale keys `onboarding.resumeTitle`, `onboarding.resumeSubtitle`, `onboarding.continue`, `onboarding.startOver`, `onboarding.restartHint` to en/ru and fallback en for the rest.
5. Wire "Start over" to clear `@onboardingStep` and restart onboarding from step 1.
6. Add tests:
   - `src/utils/onboardingResume.test.ts` for state helpers;
   - update `src/screens/WelcomeScreen/index.test.tsx` to assert resume card visibility;
   - update `src/screens/Authenticator/Hello/index.test.tsx` to assert resume card visibility and start-over action.
7. Run full Jest suite and ensure no regressions.

## 4. Success metrics

- Jest suite stays green.
- Returning users with a saved onboarding step see a resume card on `WelcomeScreen` and `Hello`.
- "Start over" clears progress and restarts onboarding.
