# UX Improvement Plan V32

**Cycle:** 27  
**Date:** 2026-08-08  
**Theme:** Profile / content consolidation — separate identity+content from settings

## 1. Weak spots

- `ProfileScreen` currently shows 10 top-level tabs that mix **content** (reports, history, bookmarks, saved answers, intention) with **settings/preferences** (sound, bedtime reminder, AI guide, session health, account settings).
- The `SecondaryTab` bar is text-only, crowded, and has no grouping or icons, making it hard to scan and easy to mis-tap.
- Settings-type scenes (`BedtimeReminder`, `SoundToggle`, `AiPersonaScene`, `SessionHealthScene`) live as standalone tabs, while `SettingsScene` already groups account, subscription, data, support, and legal rows. This creates a split-brain: some preferences are in tabs, others are in the settings list.
- Users must hunt across two different tab categories for related controls.
- There is no test coverage for the ProfileScreen tab assembly or the content/settings split.

## 2. Competitors / patterns

- **Apple HIG**: task-specific controls belong on the screens they affect; settings are for app-wide, rarely changed, account-level controls. A profile screen should focus on identity and a handful of high-value actions, with a single Settings entry point.
- **Calm / Headspace / Duolingo**: Profile tab shows identity + content/stats + one "Settings" gear; preferences (sound, reminders, persona) live inside Settings grouped under Preferences/Notifications.
- **Spotify / Instagram**: profile is content-first; account and preferences are reachable through a single settings row.
- **2025 settings-IA guidance** ([Settings Studio](https://setting.page/settings-information-architecture-account-app-admin), [Netguru](https://www.netguru.com/blog/how-to-improve-app-settings-ux)): group settings by scope (Personal / App / Account / Danger Zone), keep destructive actions at the bottom, and avoid using the profile as a junk drawer.

## 3. Decomposed plan

1. Reorganize `ProfileScreen` tabs into **content-only** tabs plus a single **Settings** entry point:
   - Keep: `reports`, `history`, `intentionOfGame`, `aiAnswers`, `bookmarks`, `settings`.
   - Remove from tab bar: `bedtimeReminder`, `soundToggle`, `aiPersona`, `sessionHealth`.
2. Move preference controls into `SettingsScene` under a new **Preferences** section:
   - `settings.sound` row → push to a `SoundToggle` inline card.
   - `settings.bedtimeReminder` row → push to a `BedtimeReminder` inline card.
   - `settings.aiGuide` row → push to an `AiPersonaSelector` inline card.
   - `settings.sessionHealth` row → push to a `SessionHealthScene` inline card (dev/diagnostic).
3. Update `src/utils/settingsMenu.ts`:
   - Add preference actions: `sound`, `bedtimeReminder`, `aiGuide`, `sessionHealth`.
   - Add a `preferences` section above Account/Subscription.
   - Keep diagnostics dev-only; session health can stay dev-only or be visible depending on existing convention.
4. Add locale keys to all 10 locales:
   - `settings.preferencesSection`, `settings.sound`, `settings.bedtimeReminder`, `settings.aiGuide`, `settings.sessionHealth`.
   - Translate en/ru/fr; others fall back to en.
5. Update `SettingsScene.tsx`:
   - Render the preference rows with disclosure chevrons.
   - When a preference row is pressed, render an inline card below the menu (or navigate to a simple sub-scene).
   - Use a lightweight `InlinePreferenceCard` component to keep the scene self-contained.
6. Add tests:
   - Create `src/screens/Tabs/ProfileScreen/index.test.tsx` that asserts ProfileScreen now renders only content + settings tabs.
   - Extend `SettingsScene.test.tsx` to assert preference rows render and expand.
7. Run the full Jest suite and ensure it stays green.

## 4. Success metrics

- ProfileScreen shows 6 tabs or fewer (content + settings).
- SettingsScene has a Preferences section with sound, bedtime reminder, AI guide, and session health rows.
- Jest suite stays green.
- New ProfileScreen test asserts tab count and content/settings split.
