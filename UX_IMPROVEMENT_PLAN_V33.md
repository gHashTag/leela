# UX Improvement Plan V33

**Cycle:** 28  
**Date:** 2026-08-08  
**Theme:** Settings row polish — icons, value labels, haptics, and confirmation feedback

## 1. Weak spots

- `SettingsMenu` rows are text-only and show only a chevron. Users cannot tell the current state of a preference without expanding the inline card.
- The Language row does not display the currently selected language; users must open the alert to see it.
- There is no tactile feedback when tapping settings rows or changing preferences, which makes the screen feel static and unresponsive.
- Preference changes (sound, bedtime reminder, AI guide, AI language, language) give no confirmation, so users may wonder whether the change was saved.
- The inline preference components (`SoundToggle`, `BedtimeReminder`, `AiPersonaSelector`, `AiLanguageToggle`) save their own state but never notify the parent scene, so `SettingsScene` cannot update row value labels or emit confirmation feedback.

## 2. Competitors / patterns

- **Apple Settings app**: every row has a leading icon and a trailing value label (e.g., Wi-Fi network name, Bluetooth state). Toggles provide immediate visual and haptic feedback.
- **Calm / Headspace**: settings rows use simple icons and show current values ("On", "9:00 PM"). Changing a preference triggers a subtle toast or haptic tick.
- **Duolingo**: profile/settings rows surface selected language and notification time directly in the list, avoiding extra taps.
- **Spotify**: settings rows show the current value (e.g., streaming quality) and use light haptics on interaction.
- **2024-2025 mobile UX guidance**: surface state at the point of decision; pair visual feedback with haptics for action confirmation.

## 3. Decomposed plan

1. **Extend the settings row model** (`src/utils/settingsMenu.ts`):
   - Add optional `icon?: string` and `value?: string` to `SettingsRow`.
   - Assign a leading emoji icon to every row.
   - Accept a dynamic `values` map in `buildSettingsMenu` so `SettingsScene` can inject current labels.

2. **Update the row renderer** (`src/components/SettingsMenu/index.tsx`):
   - Render the leading icon before the title.
   - Render the trailing value label between the title and the chevron.
   - Keep destructive tint for `signOut`.

3. **Add change callbacks to inline preference components**:
   - `SoundToggle`: accept optional `onChange(enabled: boolean)`.
   - `BedtimeReminder`: accept optional `onChange(settings: BedtimeReminderSettings)`.
   - `AiPersonaSelector`: accept optional `onChange(persona: AiPersona)`.
   - `AiLanguageToggle`: accept optional `onChange(enabled: boolean)`.

4. **Load and surface current values in `SettingsScene`**:
   - Load sound enabled, bedtime reminder, AI persona, AI language, and current language on mount.
   - Pass computed value labels into `buildSettingsMenu`.
   - Recompute value labels when a preference changes via the new `onChange` callbacks.
   - Show the current language label next to the Language row.

5. **Add haptic and confirmation feedback**:
   - Call `haptics.impactLight()` at the start of every `handleAction` invocation.
   - Call `haptics.confirm()` and `notify.toast(...)` after sound, bedtime, AI persona, AI language, and language changes.

6. **Add locale keys** (all 10 locales, translate en/ru/fr, fall back to en for others):
   - `settings.valueOn`, `settings.valueOff`.
   - `settings.savedSound`, `settings.savedBedtime`, `settings.savedAiGuide`, `settings.savedAiLanguage`, `settings.savedLanguage`.

7. **Add tests**:
   - New `src/components/SettingsMenu/index.test.tsx` for icon + value label rendering.
   - Extend `src/screens/Tabs/ProfileScreen/Tabs/SettingsScene.test.tsx` for value labels, haptics on row press, and language-change toast.

8. **Run verification**:
   - Full Jest suite must stay green.
   - TypeScript must not introduce new errors.

## 4. Success metrics

- Every settings row has a leading icon.
- Preference rows show their current value label (`On`/`Off`, time, persona name).
- The Language row shows the currently selected language.
- `haptics.impactLight` fires on every settings row press.
- A confirmation toast appears after each preference change.
- Jest suite stays green and coverage is added for the new behavior.
