# Autonomous UX Improvement Loop — Cycle 15 Report

**Date:** 2026-08-08
**Loop started:** 2026-08-07
**Cycle:** 15
**Status:** Completed, tests green

---

## 1. Weak spots researched this cycle

We deliberately skipped another iteration on onboarding or Activity and looked for the next highest-impact surface. The strongest candidate was the **Subscription / paywall screen**:

- The purchase button only said "Buy Pro" with no price or trial context.
- A large hero image took ~50% of the screen, pushing plan cards below the fold on small phones.
- An external "free" Zealy quest link exited the app with no return hook.
- The primary CTA scrolled with the content instead of staying visible.
- Multiple secondary links (restore, manage/cancel, "Why am I seeing this?", sample answer, gift) competed with the purchase action.
- There was zero test coverage for this conversion-critical screen.

Other candidates (Hello auth gate, CreatePost streaming failure, Profile tab) were logged for future cycles.

## 2. Competitor / pattern research

- **RevenueCat guide** recommends value-first hero, annual-default package, sticky footer CTA, and explicit trial/savings copy.
- **Apphud / MWM** emphasize price anchoring, "Save X%" badges, equivalent monthly pricing, and a clear primary button.
- **Stormy AI (4,500+ A/B tests)** found "Continue" often outperforms descriptive CTAs, and "No commitment, cancel anytime" near the CTA lifts conversion.
- **Retention.blog** notes exit-intent winbacks can add 15–20% revenue, but the first priority is cleaning the core paywall.

Sources:
- [RevenueCat — Guide to mobile paywalls](https://www.revenuecat.com/blog/growth/guide-to-mobile-paywalls-subscription-apps)
- [Apphud — How to Design a High-Converting Subscription App Paywall](https://apphud.com/blog/design-high-converting-subscription-app-paywalls)
- [MWM — Paywall Design Best Practices](https://mwm.ai/guides/paywall-design-best-practices)
- [Stormy AI — 10 Mobile App Paywall Design Principles](https://stormy.ai/blog/10-mobile-app-paywall-design-principles)
- [Retention.blog — Expert Paywall Tips](https://www.retention.blog/p/expert-paywall-tips)

## 3. Decomposed plan and implementation

### Task 1 — Smart, contextual PurchaseButton
- Updated `src/components/PurchaseButton/index.tsx`:
  - Two-line button: primary label (`Continue`) + secondary microcopy (trial terms, cancel anytime).
  - Derives copy from the selected package using `react-native-purchases` intro-price data.
  - Stretches full width and keeps disabled state when no package is selected.
- Created `src/components/PurchaseButton/index.test.tsx` with 4 tests.

### Task 2 — Sticky footer CTA
- Updated `src/screens/SubscriptionScreen/index.tsx`:
  - Moved plan cards into a `ScrollView`.
  - Added an absolute-positioned footer containing the purchase button, optional savings callout, and trust line.
  - The CTA is now always visible without scrolling.
  - Reduced hero image height so more content appears above the fold.

### Task 3 — Remove external Zealy quest exit leak
- Removed the `onFree` Zealy quest link from the subscription screen.
- Preserved any existing locale key so nothing else breaks.

### Task 4 — Annual savings callout
- Added `computeAnnualSavings()` in `src/utils/subscriptionNudges.ts`.
- When the selected package is annual, the footer shows "Save $X (Y%) vs monthly".
- Added tests in `src/utils/subscriptionNudges.test.ts`.

### Task 5 — Secondary-link cleanup
- Grouped restore / help / manage / sample links into a compact, low-contrast row.
- Kept gift subscription as a subtle link.

### Task 6 — Localization
- Added to `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `subscription.continue`
  - `subscription.trialTerms`
  - `subscription.cancelAnytime`
  - `subscription.saveVsMonthly`
  - `subscription.selectPlan`

### Task 7 — Tests
- Added `src/components/PurchaseButton/index.test.tsx`.
- Extended `src/utils/subscriptionNudges.test.ts` for `computeAnnualSavings`.

## 4. Test results

```
Test Suites: 77 passed, 77 total
Tests:       334 passed, 334 total
Snapshots:   0 total
Time:        ~10.8s
```

- No new TypeScript or ESLint regressions introduced in changed files.

## 5. Files changed in this cycle

- `src/components/PurchaseButton/index.tsx`
- `src/components/PurchaseButton/index.test.tsx` (new)
- `src/screens/SubscriptionScreen/index.tsx`
- `src/utils/subscriptionNudges.ts`
- `src/utils/subscriptionNudges.test.ts`
- `src/locales/en/translation.json`
- `src/locales/ru/translation.json`
- `UX_IMPROVEMENT_PLAN_V19.md` (new)

## 6. Three cooperation options for the next loop

### Option A — Contextual hard paywall + exit offer
Place a paywall directly at the AI chat / report-limit gate (not only the subscription screen) and add an exit-intent discount offer when the user tries to dismiss. This targets users at the moment they hit a Pro feature, which typically converts better than a generic subscription screen.

### Option B — Interactive onboarding mini-game (recommended)
Replace the remaining static onboarding cards with a guided first throw: the user taps the die, rolls a six, lands on a plane, and writes a one-line report with inline coaching. This applies the "learn by doing" pattern the research flagged as strongest.

### Option C — Value-first auth gate after onboarding
Redesign the `HELLO` auth screen to show social proof and Pro benefit preview before asking the user to sign in/up. This closes the biggest drop-off point between onboarding and first value.

---

**Next action:** awaiting your choice of A, B, or C. Default is B if you say "next wave" or re-trigger the loop.
