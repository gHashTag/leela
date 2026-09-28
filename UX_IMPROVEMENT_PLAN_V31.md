# UX Improvement Plan V31

**Cycle:** 26  
**Date:** 2026-08-08  
**Theme:** Subscription transparency — plan, renewal, price, and management

## 1. Weak spots

- `RevenueCatProvider` only exposes a boolean `user.pro`. The full `CustomerInfo` object (active entitlement, expiration/renewal date, management URL, billing issue flags) is discarded after the pro check.
- `SettingsScene` shows only a static "Leela Pro" / "Free plan" label. Users cannot see:
  - which plan they are on (monthly/annual/family);
  - what they are currently paying;
  - when the subscription renews or expires;
  - whether auto-renew is enabled;
  - any billing issue that may cause loss of access.
- There is no direct path from Settings to the native subscription management page (`CustomerInfo.managementURL`).
- There is no in-app upgrade/downgrade flow. A monthly subscriber who wants to switch to annual must discover the paywall themselves.
- Locale keys for renewal, expiration, billing issue, and management actions do not exist.

## 2. Competitors / patterns

- **Calm / Headspace**: the Pro account card shows "Annual member — renews on …", a "Manage subscription" row, and a clear "Switch to annual" prompt for monthly users.
- **Spotify**: account overview surfaces current plan name, price, next billing date, and explicit "Change or cancel" button that opens platform subscription settings.
- **Apple HIG / RevenueCat Customer Center**: expose expiration/renewal dates, use platform management URLs, show all active subscriptions instead of hiding duplicates, and separate billing issue warnings.
- **2025 best-practice guidance** ([RevenueCat docs](https://www.revenuecat.com/docs/customers/customer-info), [RevenueCat iOS SDK 5.24.0 changelog](https://github.com/RevenueCat/purchases-ios/releases/tag/5.24.0)): expose `expirationDate`, `renewalDate`, `managementURL`, and `billingIssueDetectedAt` so users are never surprised by a renewal or lapse.

## 3. Decomposed plan

1. Extend `src/providers/RevenueCatProvider.tsx`:
   - Keep the real `CustomerInfo` type from `react-native-purchases`.
   - Add `customerInfo` to context state and expose it in `useRevenueCat()`.
   - Update `updateCustomerInformation` to store the full object.
   - Update `restorePermissions` to return the restored `CustomerInfo`.
2. Create `src/utils/subscriptionInfo.ts`:
   - Derive a plain `SubscriptionDisplayInfo` object from `CustomerInfo` + available `PurchasesPackage[]`.
   - Include: plan name, price string, expiration/renewal date, `willRenew`, `billingIssueDetectedAt`, `managementURL`, `store`, and an `isActive` flag.
   - Add helpers to format dates relative to locale.
3. Add locale keys to all 10 locales:
   - `subscriptionStatus.currentPlan`, `subscriptionStatus.renewsOn`, `subscriptionStatus.expiresOn`, `subscriptionStatus.price`, `subscriptionStatus.autoRenewOn`, `subscriptionStatus.autoRenewOff`, `subscriptionStatus.billingIssue`, `subscriptionStatus.manageSubscription`, `subscriptionStatus.changePlan`, `subscriptionStatus.freePlan`.
   - Translate into English, Russian, and French; other locales fall back to English.
4. Enrich `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.tsx`:
   - Read `customerInfo` from `useRevenueCat()` and compute `SubscriptionDisplayInfo`.
   - For Pro users, render a detailed status card with plan name, price, renewal/expiration date, and auto-renew badge.
   - Show a billing-issue warning row if `billingIssueDetectedAt` is present.
   - Add a "Manage subscription" row that opens `managementURL` via `Linking.openURL`.
   - Add a "Change plan" row that navigates to `SUBSCRIPTION_SCREEN` with an optional `initialPackageId` parameter.
   - Keep the existing pink upsell card for free users.
5. Update `src/screens/SubscriptionScreen/index.tsx`:
   - Accept an optional `initialPackageId` route param.
   - Pre-select the matching package if the user is already Pro and wants to change plan.
   - Highlight the currently active plan with a "Current plan" badge.
6. Add tests:
   - `src/utils/subscriptionInfo.test.ts` for deriving display info from sample `CustomerInfo` objects.
   - Extend `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx` to assert the new status card and action rows.
7. Run the full Jest suite and ensure it stays green.

## 4. Success metrics

- Jest suite stays green.
- `useRevenueCat()` exposes `customerInfo`.
- `SettingsScene` shows Pro users plan name, price, and renewal/expiration date.
- "Manage subscription" opens the platform management URL.
- "Change plan" navigates to `SubscriptionScreen` with the current plan highlighted.
- Locale keys exist for all new labels.
