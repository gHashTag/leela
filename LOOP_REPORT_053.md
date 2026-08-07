# UX Improvement Loop Report — Wave 053

**Date:** 2026-08-07
**Wave:** 053
**Target item:** v2 4.2 — Add a "Pro" badge on the profile and in the community.

## What was done

- Added `src/components/ProBadge/index.tsx`, a small reusable fuchsia badge with a localized "Pro" label and a compact `small` variant.
- Added `src/utils/isPro.ts` helper that treats `status === 'Admin'` or `status === 'Free'` as Pro (matching the existing RevenueCat fallback logic).
- Added `src/utils/isPro.test.ts` with 4 tests covering null/undefined, regular users, banned users, and Admin/Free statuses.
- Wired the badge into the community:
  - `PostCard` — shows a small Pro badge next to the author name in both feed and detail views when the post is from a Pro user.
  - `CommentCard` and `SubCommentCard` — show a small Pro badge next to the comment author name when `item.pro` is true.
- Wired the badge into profiles:
  - `HeaderMaster` now accepts an optional `pro` prop and falls back to checking the current user's profile status; renders the badge under the name.
  - `ProfileScreen` passes `pro` for the current user.
  - `UserProfileScreen` reads the profile `status` from Firestore and passes `pro` for public profiles.
- Exported `ProBadge` from `src/components/index.ts`.
- Added `profile.proBadge` keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`.
- Marked v2 item **4.2** complete in `UX_IMPROVEMENT_PLAN_V2.md`.

## Verification

- `npx jest src/utils/isPro.test.ts --no-cache` — passed (4/4).
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — built successfully.

## Plan status

- [x] 1.1–1.5 Retention & Daily Habit
- [x] 2.1–2.6 AI Guide Experience
- [x] 3.1–3.5 Social & Community
- [x] 4.1 Show a limited-time trial timer on the subscription screen
- [x] 4.2 Add a "Pro" badge on the profile and in the community
- [ ] 4.3 Add a gift-subscription flow for friends/family
- [ ] 4.4 Add a pay-what-you-want yearly option for emerging markets
- [ ] 4.5 Explain each Pro feature with a short inline video/gif
- [ ] 5.1–5.5 Game Board Depth
- [ ] 6.1–6.5 Performance & Stability
- [ ] 7.1–7.5 Accessibility & Localization
- [ ] 8.1–8.4 Discoverability & Onboarding

**Next open item:** v2 4.3 — Add a gift-subscription flow for friends/family.

## Cooperation options for the next loop

1. **Continue section 4** — implement v2 4.3 (gift-subscription flow).
2. **Start section 5** — deepen the game board with legend, replay, roll history, or sound.
3. **Instrument v1 features** — add lightweight analytics for copy/share/haptic/report to validate which v2 items matter most.
