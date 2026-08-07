# Wave 075 — Public "share report as link" option

**Plan item:** `UX_IMPROVEMENT_PLAN_V2.md` §8.4 — Add a public "share report as link" option.

## What changed

1. **Reused existing report link helper** (`src/utils/linking/linkHelpers.ts`)
   - `buildReportLink(reportId, reportText)` already generated Branch short URLs to `reply_detail/:postId`.

2. **Localized share message** (`src/components/Cards/PostCard/usePostActions.ts`)
   - `handleShareLink()` now builds the link and opens the native `Share` sheet with a localized message that includes the plane number and the deep-link.
   - Added error handling and a guard so missing posts are skipped silently.

3. **i18n** (`src/locales/en/translation.json`, `src/locales/ru/translation.json`)
   - Added `report.shareTitle` and `report.shareMessage` keys for both languages.

4. **Tests** (`src/components/Cards/PostCard/usePostActions.test.ts`)
   - Added tests covering the happy path (localized share with plan and link) and the missing-data guard.

## Verification

- `npx jest --runInBand` — **54 suites passed, 208 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — bundle written successfully.

## Plan status

- `§8.4` marked complete in `UX_IMPROVEMENT_PLAN_V2.md`.
- Section 8 (Discoverability & Onboarding) is now fully complete.
- Next possible work areas:
  - Section 1 still has room for deeper retention hooks (already all checked in v2).
  - Section 2 (AI Guide Experience) could be expanded with analytics or richer personas.
  - Section 5 (Game Board Depth) could receive haptics or animation polish.

## Cooperation options for the next wave

1. **Close the v2 plan loop with a retro/analytics pass** — instrument the most-used v2 features (thumbs up, share report, referral link) with lightweight Sentry breadcrumbs.
2. **Reopen section 2** — add AI answer rating reasons or a "save this answer" quick action.
3. **Reopen section 5** — add subtle haptic feedback on dice roll and plane movement to deepen the board experience.
