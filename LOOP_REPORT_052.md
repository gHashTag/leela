# UX Improvement Loop Report — Wave 052

**Date:** 2026-08-07
**Wave:** 052
**Target item:** v2 4.1 — Show a limited-time trial timer on the subscription screen.

## What was done

- Added `src/utils/trialTimer.ts` with helpers to compute remaining time, format a localized countdown, and persist a per-install 24-hour deadline in `AsyncStorage`.
- Added `src/utils/trialTimer.test.ts` with 8 tests covering time-left math, expired state, formatting, persistence, and reset.
- Added `src/components/TrialTimer/index.tsx`, a self-contained banner that loads the deadline, updates every second, and renders a 🔥 urgency message with the live countdown.
- Exported `TrialTimer` from `src/components/index.ts` and placed it below the header in `src/screens/SubscriptionScreen/index.tsx`.
- Added `trialTimer.*` keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`.
- Marked v2 item **4.1** complete in `UX_IMPROVEMENT_PLAN_V2.md`.

## Verification

- `npx jest src/utils/trialTimer.test.ts --no-cache` — passed (8/8).
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — built successfully.

## Plan status

- [x] 1.1–1.5 Retention & Daily Habit
- [x] 2.1–2.6 AI Guide Experience
- [x] 3.1–3.5 Social & Community
- [x] 4.1 Show a limited-time trial timer on the subscription screen
- [ ] 4.2 Add a "Pro" badge on the profile and in the community
- [ ] 4.3–4.5 remaining monetization items
- [ ] 5.1–5.5 Game Board Depth
- [ ] 6.1–6.5 Performance & Stability
- [ ] 7.1–7.5 Accessibility & Localization
- [ ] 8.1–8.4 Discoverability & Onboarding

**Next open item:** v2 4.2 — Add a "Pro" badge on the profile and in the community.

## Cooperation options for the next loop

1. **Continue section 4** — implement v2 4.2 (Pro badge on profile and community).
2. **Start section 5** — deepen the game board with legend, replay, roll history, or sound.
3. **Instrument v1 features** — add lightweight analytics for copy/share/haptic/report to validate which v2 items matter most.
