# UX Improvement Plan V36

**Cycle:** 31  
**Date:** 2026-08-08  
**Theme:** Pro upsell and subscription state polish in SettingsScene

## 1. Weak spots

- The free-user Pro upsell card (`settings.proUpsellTitle`) is a plain block of text with a button. It does not show:
  - how long a trial lasts,
  - the effective monthly/yearly price,
  - what the user currently has vs. what Pro unlocks.
- The Pro status card for subscribers lists plan name, price, expiration, and auto-renew, but the layout is stacked and dense; there is no visual hierarchy or value labels like in `SettingsMenu`.
- The "Manage subscription" and "Change plan" rows in `SettingsMenu` show no value labels, so users cannot see their current renewal date or plan without tapping.
- There is no haptic feedback when tapping subscription CTAs or after restoring purchases.
- There is no trial-countdown or "Trial active" badge for users who are on a free trial.
- The upsell card uses the same visual style as the Pro status card, making the two states less distinct.

## 2. Competitors / patterns

- **Apple App Store / Settings**: subscription rows show the current plan name, renewal date, and price as value labels; trial users see "Trial — expires …".
- **Spotify**: the premium upsell card shows a clear "Start free trial — 1 month" CTA with a secondary price footnote.
- **Headspace**: trial state is surfaced as a badge on the plan row and a countdown in settings.
- **Calm**: free vs. premium comparison uses a small feature checklist inside the upsell card.

## 3. Decomposed plan

1. **Extend `subscriptionInfo` with trial state** (`src/utils/subscriptionInfo.ts`):
   - Add `trialEndDate` and `isTrial` fields parsed from the active entitlement.

2. **Add a `SubscriptionStatusCard` component** (`src/components/SubscriptionStatusCard/index.tsx`):
   - Accept `subscriptionInfo` and `isPro`.
   - For free users: render a visually distinct upsell card with:
     - Pro icon (`✨` or `:star2:`),
     - title,
     - short feature list,
     - primary CTA ("See plans" / "Start trial"),
     - haptic on press.
   - For Pro subscribers: render a status card with:
     - plan name as the main headline,
     - value-label rows for price, renewal/expiry, auto-renew,
     - trial badge when applicable,
     - billing-issue banner.

3. **Update `SettingsMenu` to show subscription value labels** (`src/utils/settingsMenu.ts` + `SettingsScene.tsx`):
   - Pass subscription-derived labels into `buildSettingsMenu`:
     - `manageSubscription`: "Renews …" or "Trial until …" or "Manage".
     - `changePlan`: current plan name.
   - Use the same value-label style introduced in cycle 28.

4. **Add haptic feedback to subscription actions in `SettingsScene`**:
   - `haptics.impactLight` on restore purchases, manage subscription, change plan, and upsell CTA.
   - `haptics.confirm` + toast after restore purchases succeeds or fails (existing toast extended with haptic).

5. **Add locale keys** (all 10 locales, en/ru/fr translated, others fall back to en):
   - `settings.proUpsellFeature1` — "AI guide for every roll"
   - `settings.proUpsellFeature2` — "Daily verses & streak journal"
   - `settings.proUpsellFeature3` — "Community reports & replies"
   - `subscriptionStatus.trialUntilShort` — "Trial until {{date}}"
   - `subscriptionStatus.renewsOnShort` — "Renews {{date}}"
   - `subscriptionStatus.expiresOnShort` — "Expires {{date}}"
   - `subscriptionStatus.manageValue` — "Manage"

6. **Add tests**:
   - Extend `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx` to assert:
     - trial badge renders for trial users,
     - subscription value labels appear on `manageSubscription` / `changePlan` rows,
     - haptics fire on restore purchases and upsell CTA.

7. **Run the full Jest suite and ensure it stays green**.

## 4. Success metrics

- Free users see a visually distinct Pro upsell card with a feature checklist and a clear CTA.
- Pro subscribers see a status card with value-label rows and a trial badge when applicable.
- Subscription rows in `SettingsMenu` show value labels (renewal/plan name).
- Subscription CTAs trigger haptic feedback.
- Jest suite stays green and coverage is added for the new component.
