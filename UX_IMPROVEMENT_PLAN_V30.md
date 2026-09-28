# UX Improvement Plan V30

**Cycle:** 25  
**Date:** 2026-08-08  
**Theme:** Consolidated Profile / Settings tab with Pro upsell and account tools

## 1. Weak spots

- Subscription status, restore purchase, data export, language, support, sign-out, and diagnostics are scattered across the tab bar (`TabBar`), `ProfileScreen` sub-scenes, modals, and dev-only entries.
- `SessionHealthScene` currently mixes four unrelated concerns: crash-free status, data export, subscription management, and dev diagnostics.
- There is no single place where a user can see their Pro status, manage subscription, restore purchases, export data, change language, get support, or sign out.
- `ProfileScreen` has 9 secondary tabs; some (sound toggle, bedtime reminder, AI persona) are settings, while others (reports, history, bookmarks) are content. The settings/content split is unclear.
- There is no Pro upsell surface for non-subscribers within the profile area.

## 2. Competitors / patterns

- **Duolingo / Calm / Headspace**: a single "Profile" screen with a settings gear; settings groups are Account, Subscription, Notifications, Help, Legal. Pro status is shown in a card at the top.
- **Spotify**: account page surfaces plan type, payment/redeem, data privacy download, language, and sign-out in one scrollable list.
- **Apple HIG (Settings)**: group related items, use disclosure indicators, keep destructive actions at the bottom.
- **RevenueCat Customer Center**: consolidate restore, cancellation survey, and plan management under a "Manage subscription" row.

## 3. Decomposed plan

1. Create `src/utils/settingsMenu.ts` with typed menu sections and actions:
   - `Account`: edit profile, language, sign out;
   - `Subscription`: status card, restore purchases, manage subscription;
   - `Data & Privacy`: download my data, diagnostics (dev-only);
   - `Support`: contact support, leave feedback, rules, help;
   - `Legal`: privacy policy, terms of use.
2. Add locale keys `settings.*`, `subscriptionStatus.*`, `account.*` to all 10 locales with en/ru/fr translations and en fallback.
3. Create `src/components/SettingsMenu/index.tsx` — a grouped list using the existing `Button`/`ButtonSimple`/`Text` components, with section headers, row disclosure styles, and a top Pro status card for non-subscribers.
4. Create a new `SettingsScene` in `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.tsx` and add it to the `OwnTabView` tabs.
5. Move data export, manage subscription, and diagnostics from `SessionHealthScene` into `SettingsScene`; keep `SessionHealthScene` focused on crash-free status.
6. Wire actions:
   - edit profile → `USER_EDIT`;
   - language → show a language picker (reuse `AiLanguageToggle` or a new simple picker);
   - restore purchases → `useRevenueCat().restorePermissions()`;
   - manage subscription → `SUBSCRIPTION_SCREEN`;
   - download data → existing `SessionHealthScene` export handler (extract into `src/utils/dataExport` share helper);
   - diagnostics → `DIAGNOSTICS_SCREEN` (dev-only);
   - support/feedback → `onLeaveFeedback` or mailto;
   - rules → `RULES_SCREEN`;
   - privacy/terms → existing `openURLPolicy` / `openURLEula`;
   - sign out → `OnlinePlayer.SignOut()`.
7. Add a Pro upsell card at the top of `SettingsScene` when the user is not Pro.
8. Add tests:
   - `src/utils/settingsMenu.test.ts` for menu structure;
   - `src/components/SettingsMenu/SettingsMenu.test.tsx` for rendering and actions;
   - update `ProfileScreen` tests if any.
9. Run full Jest suite.

## 4. Success metrics

- Jest suite stays green.
- `ProfileScreen` has a visible "Settings" tab.
- Settings scene groups account, subscription, data, support, legal actions.
- Pro status card appears for non-subscribers.
