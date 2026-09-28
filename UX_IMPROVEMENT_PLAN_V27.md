# UX Improvement Plan V27

**Cycle:** 22  
**Date:** 2026-08-08  
**Theme:** Contextual win review prompt and shareable achievement

## 1. Weak spots

- `canRequestReview` only checks `@aiThumbsUpCount` (>= 3). A user who wins the game but has not rated AI answers will never see a review prompt, even though `maybeRequestReview()` is called from `RequestReviewOnWin`.
- The review prompt is a generic `Alert.alert` with no visual connection to the win moment; it feels interruptive rather than celebratory.
- `WinCelebration` is purely decorative (pointerEvents="none") and offers no CTA. The positive emotion of reaching Cosmic Consciousness is not leveraged for sharing or rating.
- There is no shareable achievement card or message.
- `recordPositiveEvent()` increments a counter but the threshold logic never uses it.

## 2. Competitors / patterns

- **Duolingo**: milestone pop-ups include a primary "Share" CTA and a secondary "Continue"; ratings are requested after a streak or league achievement, not generically.
- **Headspace / Calm**: celebrate session milestones with full-screen cards and offer share + rate in a positive, non-blocking moment.
- **Apple HIG (Ratings and reviews)**: request a rating only after the user has had a positive experience; provide a way to dismiss and never re-ask.
- **Google Play guidelines**: in-app review should not be incentivized; share affordances should be easy to skip.

## 3. Decomposed plan

1. Update `src/utils/reviewPrompt.ts`:
   - Add `MIN_POSITIVE_EVENTS_BEFORE_REVIEW = 2`.
   - Change `canRequestReview` to return true if either AI thumbs up count >= 3 OR positive event count >= 2.
   - Add `getPositiveEventCount()` and `resetPositiveEventCount()`.
2. Create `src/utils/achievementShare.ts`:
   - Build a localized share message for reaching Cosmic Consciousness.
   - Wrap `react-native-share` with a try/catch + Sentry capture.
3. Enhance `src/components/WinCelebration/index.tsx`:
   - Keep the existing particle animation.
   - After the animation, render action buttons: **Share your win** and **Rate Leela**.
   - Make the container pointer-events auto only when endGame is true and allow taps on the CTAs.
   - Dismiss on background tap or explicit "Continue".
4. Add a `WinReviewModal` or integrate the review prompt into the win celebration using the existing `maybeRequestReview` flow.
5. Add locale keys:
   - `winCelebration.shareTitle`, `winCelebration.shareMessage`, `winCelebration.rate`, `winCelebration.share`, `winCelebration.continue`, `winCelebration.reviewMessage`.
6. Update `GameScreen` to pass the `onShareWin` / `onRequestReview` handlers to `WinCelebration`.
7. Add tests:
   - `src/utils/reviewPrompt.test.ts` for the new threshold logic;
   - `src/utils/achievementShare.test.ts` for share message building;
   - `src/components/WinCelebration/WinCelebration.test.tsx` for CTAs and animation.
8. Run full Jest suite.

## 4. Success metrics

- Jest suite stays green.
- `canRequestReview` returns true for users with 2+ positive events.
- `WinCelebration` renders share and rate CTAs after the win animation.
- Sharing builds a message that includes the app store link.
