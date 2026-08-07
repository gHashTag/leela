# Autonomous UX Improvement Loop — Wave 39

**Date:** 2026-08-07
**Branch:** `leela-ai-streaming-vedic`
**Commit:** `98b8760`
**Plan item:** UX_IMPROVEMENT_PLAN_V2.md **1.4** — Add gentle bedtime/reminder setting in the profile screen.

## What was changed

- Added `src/utils/notifications/bedtimeReminder.ts`
  - Loads/saves `{ enabled, hour, minute }` from AsyncStorage (`@bedtimeReminder`).
  - Computes the next local reminder timestamp, rolling forward to tomorrow if the time has already passed.
  - Schedules or cancels a daily notifee trigger notification based on the enabled state.
- Added `src/utils/notifications/bedtimeReminder.test.ts`
  - Tests default settings, save/load, next-timestamp math, and schedule/cancel behavior.
- Added `src/components/BedtimeReminder/index.tsx`
  - Card with a moon icon, title, description, hour stepper (18–23), and enable toggle.
  - Persists changes and reschedules the notification on every interaction.
- Added `src/components/BedtimeReminder/BedtimeReminder.test.tsx`
  - 3 cases covering render, hour adjustment, and toggle.
- Updated `src/components/index.ts` to export `BedtimeReminder`.
- Updated `src/screens/Tabs/ProfileScreen/index.tsx`
  - Added a "Reminder" tab (`bedtimeReminder`) to the profile tab view.
- Updated `src/screens/Tabs/OfflineProfileScreen/index.tsx`
  - Rendered `<BedtimeReminder />` in the `SectionList` footer.
- Added i18n strings in `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `bedtimeReminder.tab`, `.title`, `.description`, `.enabled`, `.decrease`, `.increase`, `.notificationTitle`, `.notificationBody`, `.notificationChannelName`.
- Marked v2 plan item **1.4** as complete.

## Verification

- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` completed successfully.
- Full Jest run: **15 suites, 49 tests passed** (up from 40).

## Notes

- The reminder time is constrained to 18:00–23:00 to keep it in the bedtime window and avoid accidental early-morning notifications.
- The card is rendered in both online and offline profile screens so the setting is always reachable.
- No credentials, API keys, signing assets, or remote pushes were modified.
