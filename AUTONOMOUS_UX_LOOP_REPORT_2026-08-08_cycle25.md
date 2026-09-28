# Autonomous UX Improvement Loop Report
**Cycle:** 25  
**Date:** 2026-08-08  
**Theme:** Consolidated Profile / Settings tab with Pro upsell and account tools

---

## 1. Research findings

### Weak spots in the current profile/settings flow
- Subscription status, restore purchase, data export, language, support, diagnostics, and sign-out were scattered across `TabBar`, `ProfileScreen` sub-scenes, modals, and dev-only entries.
- `SessionHealthScene` mixed crash-free status with a dev diagnostics button, making its purpose unclear.
- There was no single place where a user could see Pro status, manage subscription, restore purchases, export data, change language, get support, or sign out.
- `ProfileScreen` had 9 secondary tabs; the split between content (reports, history, bookmarks) and settings (sound, bedtime, AI persona) was fuzzy.
- No Pro upsell surface existed for non-subscribers inside the profile area.

### Competitors / patterns consulted
- **Duolingo / Calm / Headspace**: a single Profile screen with a settings gear; groups are Account, Subscription, Notifications, Help, Legal; Pro status shown in a top card.
- **Spotify**: account page surfaces plan type, payment/redeem, data privacy download, language, and sign-out in one scrollable list.
- **Apple HIG (Settings)**: group related items, use disclosure indicators, keep destructive actions at the bottom.
- **RevenueCat Customer Center**: consolidate restore, cancellation survey, and plan management under a "Manage subscription" row.
- **2025 iOS settings best-practice sources** ([VP0 Journal](https://vp0.com/blogs/how-to-design-an-ios-settings-screen), [Rork Lab](https://rorklab.net/en/articles/rork-dev/rork-app-settings-screen-practical-implementation-guide), [SaaSUI](https://www.saasui.design/blog/saas-settings-page-ux-patterns)) reinforce grouped lists, transparent subscription status, clear renewal/price info, separated destructive actions, 44 pt touch targets, and accessible labels.

---

## 2. Implementation summary

### 2.1 `src/utils/settingsMenu.ts` — typed menu model
- Already defined `SettingsAction`, `SettingsRow`, `SettingsSection`, and `buildSettingsMenu(isDev, isOnline)`.
- Returns sections: Account, Subscription, Data & Privacy, Support, Legal.
- Filters diagnostics to dev builds and sign-out to online users.

### 2.2 `src/components/SettingsMenu/index.tsx` — reusable grouped list
- New component extracted from `SettingsScene`.
- Renders section headers and grouped rows with disclosure chevrons.
- Supports destructive row styling and dark-mode section background.
- Uses direct imports of `Space` and `Text` to avoid the `components/index.ts` circular import that was confusing the test renderer.
- Added `src/components/SettingsMenu/SettingsMenu.test.tsx` with 3 tests: sections/rows render, row press fires action, destructive flag honored.
- Registered the component in `src/components/index.ts`.

### 2.3 `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.tsx` — settings scene
- Uses `buildSettingsMenu` and the new `SettingsMenu` component.
- Top card shows Pro upsell for free users and a status card for everyone.
- Wires every action:
  - edit profile → `USER_EDIT`;
  - language → native `Alert` picker calling `i18n.changeLanguage`;
  - sign out → `OnlinePlayer.SignOut()` with confirmation;
  - restore purchases → `useRevenueCat().restorePermissions()`;
  - manage subscription → `SUBSCRIPTION_SCREEN` for blocked/free users, otherwise shows cancellation survey;
  - download data → shareable JSON export via `exportToJsonFile`;
  - diagnostics → `DIAGNOSTICS_SCREEN` (dev-only);
  - support/feedback → `onLeaveFeedback`;
  - rules/help → `RULES_SCREEN`;
  - privacy/terms → existing policy URL helpers;
  - Pro CTA → `SUBSCRIPTION_SCREEN`.
- Updated `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx` to 5 tests covering Pro upsell, sections, CTA, edit profile, and manage subscription.

### 2.4 `src/screens/Tabs/ProfileScreen/Tabs/SessionHealthScene.tsx` — scope cleanup
- Removed the dev diagnostics button and `openDiagnostics` helper so the scene is focused only on crash-free status.
- Removed the unused `navigation` prop.
- Updated `src/screens/Tabs/ProfileScreen/index.tsx` to pass `SessionHealthScene` directly without wrapping it in a navigation proxy.

### 2.5 `src/components/CancellationSurveyModal/index.tsx` — testability/accessibility fix
- Changed imports of `Text` and `Space` from the circular `components/index.ts` to their direct component paths.
- Made `accessibilityViewIsModal` conditional on `visible`. A hidden Modal with `accessibilityViewIsModal={true}` was causing React Native Testing Library to treat all sibling text as hidden from accessibility, which broke `getByText` in `SettingsScene` tests.

### 2.6 Localization
- `settings.*` keys exist in all 10 locale files (en/ru/fr translated, others fall back to en).
- No new keys were required this cycle; the existing V30 keys covered the surface.

---

## 3. Verification

```
Test Suites: 91 passed, 91 total
Tests:       407 passed, 407 total
```

The TypeScript checker still reports pre-existing React-type mismatch errors across the codebase, but no new errors were introduced by this cycle. The new `SettingsMenu` component, refactored `SettingsScene`, cleaned `SessionHealthScene`, and modal fix all compile and pass.

---

## 4. Collaboration options for the next loop

### Option A — Subscription transparency: plan details, renewal date, and upgrade/downgrade paths
The Settings tab now has the right shape, but the Pro status card only shows "Free" / "Pro". Add the current plan name, renewal date, price, and explicit upgrade/downgrade flows so users never wonder what they are paying for or when it renews. Competitors (Spotify, Calm, RevenueCat Customer Center) all surface this above the fold.

### Option B — Profile / content consolidation: split content tabs from settings tabs
`ProfileScreen` still mixes reports/history/bookmarks (content) with sound/bedtime/AI persona (settings). Move the settings-type tabs into `SettingsScene` or a dedicated settings flow, leaving Profile focused on the user's content and identity. This matches Apple HIG's guidance to keep task-specific controls out of global settings.

### Option C — Accessible settings polish: row icons, value labels, haptic feedback, and confirmation states
Every row currently uses only a chevron. Add leading icons, value labels (e.g. showing the current language), haptic feedback on tap, and toast/banner confirmation after destructive or state-changing actions. This directly addresses the 2025 best-practice themes of clear feedback, Dynamic Type support, and 44 pt touch targets.

---

## 5. Files changed

- `src/components/SettingsMenu/index.tsx` (new)
- `src/components/SettingsMenu/SettingsMenu.test.tsx` (new)
- `src/components/index.ts`
- `src/components/CancellationSurveyModal/index.tsx`
- `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.tsx`
- `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx`
- `src/screens/Tabs/ProfileScreen/Tabs/SessionHealthScene.tsx`
- `src/screens/Tabs/ProfileScreen/index.tsx`

---

*Report generated by the autonomous UX improvement loop for Leela.*
