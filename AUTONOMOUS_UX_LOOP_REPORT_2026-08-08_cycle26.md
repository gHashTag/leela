# Autonomous UX Improvement Loop Report
**Cycle:** 26  
**Date:** 2026-08-08  
**Theme:** Subscription transparency — plan, renewal, price, and management

---

## 1. Research findings

### Weak spots in the current subscription flow
- `RevenueCatProvider` only exposed a boolean `user.pro`. The full `CustomerInfo` object — active entitlement, expiration/renewal date, `managementURL`, billing issue flags — was discarded after the pro check.
- `SettingsScene` showed only a static "Leela Pro" / "Free plan" label. Users could not see their current plan name, price, renewal/expiration date, or auto-renew status.
- There was no direct path from Settings to the native subscription management page (`CustomerInfo.managementURL`).
- There was no in-app upgrade/downgrade flow. A monthly subscriber who wanted to switch to annual had to discover the paywall on their own.
- Locale keys for renewal, expiration, billing issue, and management actions did not exist.

### Competitors / patterns consulted
- **Calm / Headspace**: Pro account card shows "Annual member — renews on …", a "Manage subscription" row, and a clear "Switch to annual" prompt for monthly users.
- **Spotify**: account overview surfaces current plan name, price, next billing date, and explicit "Change or cancel" button that opens platform subscription settings.
- **Apple HIG / RevenueCat Customer Center**: expose expiration/renewal dates, use platform management URLs, show all active subscriptions, and separate billing issue warnings.
- **RevenueCat iOS SDK 5.24.0 / Customer Center redesign** ([RevenueCat docs](https://www.revenuecat.com/docs/customers/customer-info), [GitHub release](https://github.com/RevenueCat/purchases-ios/releases/tag/5.24.0)): exposes `expirationDate`, `renewalDate`, per-subscription `managementURL`, and billing issue fields so users are never surprised by a renewal or lapse.

---

## 2. Implementation summary

### 2.1 `src/providers/RevenueCatProvider.tsx` — expose full CustomerInfo
- Replaced the hand-rolled `CustomerInfoT` with the real `CustomerInfo` type from `react-native-purchases`.
- Added `customerInfo` and `isLoading` to context state and exposed them through `useRevenueCat()`.
- `updateCustomerInformation` now stores the full `CustomerInfo` object before checking entitlements.
- `restorePermissions` stores the restored `CustomerInfo` and returns it.

### 2.2 `src/utils/subscriptionInfo.ts` — display-info utility
- Added `getActiveProEntitlement()` to find the active `"pro plan"` entitlement.
- Added `parseRevenueCatDate()` for safe ISO date parsing.
- Added `buildSubscriptionDisplayInfo(customerInfo, packages)` returning:
  - `isActive`, `planName`, `planKind`, `price`, `expirationDate`, `willRenew`, `billingIssueDetectedAt`, `managementURL`, `store`, `productIdentifier`.
- The utility matches the active `productIdentifier` against available `packages` to recover the localized plan title and current price.

### 2.3 Localization
- Added `subscriptionStatus.*` keys to all 10 locale files:
  - `currentPlan`, `renewsOn`, `expiresOn`, `price`, `autoRenewOn`, `autoRenewOff`, `billingIssue`, `manageSubscription`, `changePlan`, `freePlan`, `trialUntil`.
- Added `settings.changePlan` to all 10 locales.
- Translated into English, Russian, and French; other locales fall back to English.

### 2.4 `src/utils/settingsMenu.ts` — change-plan row
- Added `changePlan` to `SettingsAction`.
- `buildSettingsMenu` now accepts an `isPro` option and shows the "Change plan" row only for Pro users.
- Updated `src/utils/settingsMenu.test.ts` to verify the conditional row.

### 2.5 `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.tsx` — detailed status card
- Reads `customerInfo` and `packages` from `useRevenueCat()` and derives `subscriptionInfo`.
- For Pro users, the green status card now shows:
  - "Leela Pro" header;
  - current plan name;
  - price;
  - renewal or expiration date;
  - auto-renew on/off status;
  - billing-issue warning banner when `billingIssueDetectedAt` is present.
- For free users, the card still shows "Free plan" and the pink upsell card remains.
- `manageSubscription` action now opens `CustomerInfo.managementURL` for Pro users via `openUrl`, falls back to the subscription screen for blocked/free users, and still shows the cancellation survey otherwise.
- `changePlan` action navigates to `SUBSCRIPTION_SCREEN` with the current `productIdentifier` as `initialPackageId`.
- Updated tests in `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx` (8 tests): free-user upsell, sections, CTA, edit profile, blocked-user manage subscription, detailed Pro card, change plan, and management-URL open.

### 2.6 `src/screens/SubscriptionScreen/index.tsx` — pre-select current plan
- Added `useRoute()` to read the optional `initialPackageId` param.
- Pre-selects the matching package when a Pro user arrives via "Change plan".
- Added a "Current plan" badge on the package that matches the active `productIdentifier`.
- Updated route types in `src/types/types.ts` so `SUBSCRIPTION_SCREEN` accepts `{ initialPackageId?: string }`.

### 2.7 Reusable `SettingsMenu` component
- `src/components/SettingsMenu/index.tsx` and its test (`SettingsMenu.test.tsx`) were completed in cycle 25 and are reused here for the settings rows.

---

## 3. Verification

```
Test Suites: 92 passed, 92 total
Tests:       415 passed, 415 total
```

The TypeScript checker still reports pre-existing React-type mismatch errors across the codebase, but no new errors were introduced by this cycle. The new `subscriptionInfo` utility, updated provider, enriched `SettingsScene`, and `SubscriptionScreen` route integration all compile and pass.

---

## 4. Collaboration options for the next loop

### Option A — Profile / content consolidation: split content tabs from settings tabs
`ProfileScreen` still mixes content tabs (reports, history, bookmarks) with settings tabs (sound, bedtime reminder, AI persona). Move the settings-type tabs into `SettingsScene` or a dedicated settings flow, leaving Profile focused on the user's content and identity. This matches Apple HIG's guidance to keep task-specific controls out of global settings.

### Option B — Accessible settings polish: icons, value labels, haptics, and confirmation states
Every settings row currently uses only a chevron. Add leading icons, value labels (e.g. showing the current language next to "Language"), haptic feedback on tap, and toast/banner confirmation after destructive or state-changing actions. This addresses the 2025 best-practice themes of clear feedback, Dynamic Type support, and 44 pt touch targets.

### Option C — Subscription lifecycle reminders: renewal/expiration nudges and billing-issue recovery
With `CustomerInfo` now available, add proactive in-app nudges before renewal, trial-to-paid conversion prompts, and a dedicated billing-issue recovery card that deep-links users to update their payment method before access lapses.

---

## 5. Files changed

- `src/providers/RevenueCatProvider.tsx`
- `src/utils/subscriptionInfo.ts` (new)
- `src/utils/subscriptionInfo.test.ts` (new)
- `src/utils/settingsMenu.ts`
- `src/utils/settingsMenu.test.ts`
- `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.tsx`
- `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx`
- `src/screens/SubscriptionScreen/index.tsx`
- `src/types/types.ts`
- `src/locales/*/translation.json` (10 files)
- `UX_IMPROVEMENT_PLAN_V31.md` (new)

---

*Report generated by the autonomous UX improvement loop for Leela.*
