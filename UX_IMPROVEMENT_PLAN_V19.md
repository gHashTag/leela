# UX Improvement Plan V19 — Paywall Conversion Polish

**Date:** 2026-08-08
**Cycle:** 15
**Focus area:** Subscription / paywall conversion

---

## Research summary

### Weak spots
The `SubscriptionScreen` is the direct revenue surface but has several conversion leaks:

- **Weak CTA:** the purchase button only says "Buy Pro" with no price or trial context.
- **Visual hierarchy:** a large hero image takes 50% of the screen, pushing plan cards below the fold on small phones.
- **External exit leak:** the "free" Zealy quest link exits the app with no return hook.
- **No sticky CTA:** the purchase button scrolls with the content.
- **Distracting secondary links:** restore, manage/cancel, "Why am I seeing this?", sample answer, and gift all compete with the primary action.
- **No tests** for this conversion-critical screen.

### Competitor / pattern research
- **RevenueCat guide** recommends a value-first hero, annual-default package, sticky footer CTA, and explicit trial/savings copy.
- **Apphud / MWM** emphasize price anchoring, "Save X%" badges, equivalent monthly pricing, and a clear primary button.
- **Stormy AI (4,500+ A/B tests)** found "Continue" often outperforms descriptive CTAs, and "No commitment, cancel anytime" near the CTA lifts conversion.
- **Retention.blog** notes exit-intent winbacks can add 15–20% revenue, but the first priority is cleaning the core paywall.

### Patterns to adopt
1. Make the CTA reflect the selected package and trial state ("Continue — 7 days free").
2. Move the purchase button into a sticky bottom bar so it is always visible.
3. Remove or de-prioritize the external "free" quest link.
4. Add a subtle savings callout on the selected annual plan.
5. Keep secondary actions (restore, terms, etc.) grouped and low-contrast at the bottom.
6. Add component tests for the purchase button and subscription screen.

---

## Goals

1. Increase trial starts by making the primary action clearer and always visible.
2. Reduce paywall exits by removing the external Zealy quest CTA from the main surface.
3. Improve trust with clearer trial terms and cancellation language.
4. Add test coverage to the conversion-critical path.

---

## Decomposed tasks

### Task 1 — Smart PurchaseButton
- Update `src/components/PurchaseButton/index.tsx`:
  - Accept `trialText` / `priceText` props or derive them from `selectedPackage`.
  - Render a two-line button: primary label ("Continue") and secondary microcopy (trial terms / price / "Cancel anytime").
  - Keep existing `disabled` behavior.
- Add `src/components/PurchaseButton/index.test.tsx`.

### Task 2 — Sticky footer CTA
- Update `src/screens/SubscriptionScreen/index.tsx`:
  - Wrap plan cards in a `ScrollView`.
  - Render the purchase button + trust microcopy in a fixed bottom bar (`position: 'absolute'` or a separate footer view).
  - Keep CTA visible while scrolling.

### Task 3 — Remove external Zealy quest
- Remove the `onFree` link and its associated translation key `freeQuest` (if any) from the subscription screen.
- Preserve the `freeQuest` key in locales for now to avoid breaking other surfaces; just stop rendering it.

### Task 4 — Savings / trial callouts
- In `SubscriptionScreen`, when the selected package is annual, show a "Save vs monthly" line derived from the annual vs monthly price.
- Add localization keys: `subscription.saveVsMonthly`, `subscription.continue`, `subscription.cancelAnytime`, `subscription.trialTerms`.

### Task 5 — Secondary-link cleanup
- Group restore / terms / manage / sample answer into a compact footer row with low-contrast links.
- Keep gift subscription as a subtle text link.

### Task 6 — Localization
- Add keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `subscription.continue`
  - `subscription.trialTerms`
  - `subscription.cancelAnytime`
  - `subscription.saveVsMonthly`
  - `subscription.bestValue` (if not already present)

### Task 7 — Tests
- Add `src/screens/SubscriptionScreen/index.test.tsx`:
  - Renders plan cards.
  - Selecting a plan updates the CTA text.
  - Tapping purchase calls `purchasePackage` with the selected package.
  - Restore button calls `restorePermissions`.
- Add `src/components/PurchaseButton/index.test.tsx`.

### Task 8 — Report
- Write `AUTONOMOUS_UX_LOOP_REPORT_2026-08-08_cycle15.md`.

---

## Success criteria

- Purchase button shows contextual copy (trial / price / cancel anytime).
- Purchase button is visible without scrolling (sticky footer or top-of-fold placement).
- External Zealy quest link no longer appears on the paywall.
- Annual plan shows an explicit savings callout when selected.
- Jest: 76+ suites, 327+ tests passing.

---

## Next-cycle options (preview)

- A: Build a contextual hard paywall at the AI chat / report limit (not just the subscription screen) with an exit offer.
- B: Add an interactive first-throw onboarding mini-game to replace the remaining static cards.
- C: Add a value-first auth gate after onboarding with social proof and Pro benefit preview.
