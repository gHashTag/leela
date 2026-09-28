# Autonomous UX Improvement Loop Report
**Cycle:** 27  
**Date:** 2026-08-08  
**Theme:** Profile / content consolidation — separate identity+content from settings

---

## 1. Research findings

### Weak spots in the current ProfileScreen tab organization
- `ProfileScreen` mixed **content** tabs (reports, history, bookmarks, saved answers, intention) with **settings/preference** tabs (sound, bedtime reminder, AI guide, session health, account settings) in a single 10-tab horizontal bar.
- The `SecondaryTab` bar is text-only, crowded, and has no grouping or icons, making it hard to scan and easy to mis-tap.
- Preference scenes (`BedtimeReminder`, `SoundToggle`, `AiPersonaScene`, `SessionHealthScene`) lived as standalone tabs, while `SettingsScene` already grouped account, subscription, data, support, and legal rows. This created a split-brain: some preferences were in tabs, others in the settings list.
- Users had to hunt across two different tab categories for related controls.
- There was no test coverage for the ProfileScreen tab assembly or the content/settings split.

### Competitors / patterns consulted
- **Apple HIG**: task-specific controls belong on the screens they affect; settings are for app-wide, rarely changed, account-level controls. A profile screen should focus on identity and a handful of high-value actions, with a single Settings entry point.
- **Calm / Headspace / Duolingo**: Profile tab shows identity + content/stats + one "Settings" gear; preferences (sound, reminders, persona) live inside Settings grouped under Preferences/Notifications.
- **Spotify / Instagram**: profile is content-first; account and preferences are reachable through a single settings row.
- **2025 settings-IA guidance** ([Settings Studio](https://setting.page/settings-information-architecture-account-app-admin), [Netguru](https://www.netguru.com/blog/how-to-improve-app-settings-ux), [VP0 Journal](https://vp0.com/blogs/how-to-design-an-ios-settings-screen)): group settings by scope (Personal / App / Account / Danger Zone), keep destructive actions at the bottom, and avoid using the profile as a junk drawer.

---

## 2. Implementation summary

### 2.1 `src/screens/Tabs/ProfileScreen/index.tsx` — content-only tabs
- Reduced the tab bar from 10 tabs to 6 tabs:
  - **Content/identity**: `reports`, `history`, `intentionOfGame`, `aiAnswers`, `bookmarks`.
  - **Settings entry**: `settings`.
- Removed top-level tabs for `bedtimeReminder`, `soundToggle`, `aiPersona`, and `sessionHealth`.
- Cleaned up imports: removed `AiPersonaSelector`, `SoundToggle`, `BedtimeReminder`, and scene imports that are no longer used as tabs.

### 2.2 `src/utils/settingsMenu.ts` — new Preferences section
- Added preference actions: `sound`, `bedtimeReminder`, `aiGuide`, `sessionHealth`.
- Added a `preferences` section at the top of the settings menu.
- `sessionHealth` remains dev-only (`__DEV__`), consistent with the existing diagnostics convention.
- Updated `src/utils/settingsMenu.test.ts` to expect the new section and verify preference rows.

### 2.3 `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.tsx` — expandable preferences
- Imported `SoundToggle`, `BedtimeReminder`, `AiPersonaSelector`, and `AiLanguageToggle`.
- Added `expandedPreference` state and `togglePreference(action)` helper.
- Added an inline `InlineSessionHealth` component that reuses `useSessionHealth` and the session-health reset logic without the full-screen flex layout.
- When a preference row is pressed, the corresponding control card renders inline below the menu:
  - `sound` → `SoundToggle` card.
  - `bedtimeReminder` → `BedtimeReminder` card.
  - `aiGuide` → combined `AiPersonaSelector` + `AiLanguageToggle` card.
  - `sessionHealth` → `InlineSessionHealth` card.
- Re-pressing the same row collapses the card.

### 2.4 Localization
- Added `settings.preferencesSection`, `settings.sound`, `settings.bedtimeReminder`, `settings.aiGuide`, `settings.sessionHealth` to all 10 locale files.
- Translated into English, Russian, and French; other locales fall back to English.

### 2.5 Tests
- Created `src/screens/Tabs/ProfileScreen/index.test.tsx` with one test that asserts ProfileScreen now renders only content + settings tabs and no longer shows the removed preference tabs.
- Extended `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx` with a test for the new Preferences section and preference rows in dev mode.
- Added utility mocks for `soundSettings`, `bedtimeReminder`, `aiPersona`, and `aiLanguage` so the inline preference components can load and render in tests.

---

## 3. Verification

```
Test Suites: 93 passed, 93 total
Tests:       417 passed, 417 total
```

The TypeScript checker still reports pre-existing React-type mismatch errors across the codebase, but no new errors were introduced by this cycle. The reorganized `ProfileScreen`, updated `SettingsScene`, and new `Preferences` section all compile and pass.

---

## 4. Collaboration options for the next loop

### Option A — Accessible settings polish: icons, value labels, haptics, and confirmation states
Every settings row currently uses only a chevron. Add leading icons, value labels (e.g. showing the current language next to "Language" and the selected persona next to "AI guide"), haptic feedback on tap, and toast/banner confirmation after destructive or state-changing actions. This directly addresses the 2025 best-practice themes of clear feedback, Dynamic Type support, and 44 pt touch targets.

### Option B — Subscription lifecycle reminders: renewal/expiration nudges and billing-issue recovery
With `CustomerInfo` now available in `RevenueCatProvider`, add proactive in-app nudges before renewal, trial-to-paid conversion prompts, and a dedicated billing-issue recovery card that deep-links users to update their payment method before access lapses.

### Option C — Profile identity polish: stats card, recent content preview, and edit flow
The Profile header currently shows only avatar, name, and plan. Add a lightweight stats card (streak days, report count, bookmark count), a "recent reports" preview card on the profile landing tab, and a clearer edit-profile entry point so the identity tab feels like a hub rather than a launcher for tabs.

---

## 5. Files changed

- `src/screens/Tabs/ProfileScreen/index.tsx`
- `src/screens/Tabs/ProfileScreen/index.test.tsx` (new)
- `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.tsx`
- `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx`
- `src/utils/settingsMenu.ts`
- `src/utils/settingsMenu.test.ts`
- `src/locales/*/translation.json` (10 files)
- `UX_IMPROVEMENT_PLAN_V32.md` (new)

---

*Report generated by the autonomous UX improvement loop for Leela.*
