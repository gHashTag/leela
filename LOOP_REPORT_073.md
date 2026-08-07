# Wave 073 — Referral link with deep-link into the game board

**Plan item:** `UX_IMPROVEMENT_PLAN_V2.md` §8.2 — Add a referral link with a deep-link into the game board.

## What changed

1. **Branch referral link helper** (`src/utils/linking/linkHelpers.ts`)
   - Added `buildReferralLink(referralCode)` that creates a Branch Universal Object at `invite/<referralCode>` and returns a generated short URL.

2. **Deep-link routing** (`src/utils/linking/index.ts`)
   - Extended the custom `getStateFromPath` handler so any path containing `invite/` resolves to the game board:
     - `MAIN` → `TAB_BOTTOM_0` with the `referralCode` param.
   - This lets an invite link open the app directly on the game board.

3. **Referral share entry point** (`src/components/HeaderMaster/useActions.ts`)
   - Added an "Invite a friend to Leela" action to the profile header menu.
   - Uses the current Firebase user UID as the referral code, builds the Branch link, and opens the native `Share` sheet.

4. **i18n** (`src/locales/en/translation.json`, `src/locales/ru/translation.json`)
   - Added `referral.shareTitle`, `referral.shareMessage`, and `referral.error` keys for both languages.

5. **Type support** (`src/types/types.ts`)
   - Made `TAB_BOTTOM_0` params optional and added an optional `referralCode` field so the deep-link state is type-safe.

6. **Tests** (`src/utils/linking/linkHelpers.test.ts`)
   - Unit tests for `buildReportLink` and `buildReferralLink` (happy path and error path).
   - Routing test verifying `invite/<code>` resolves to `MAIN` → `TAB_BOTTOM_0`.

## Verification

- `npx jest --runInBand` — **52 suites passed, 201 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — bundle written successfully.

## Plan status

- `§8.2` marked complete in `UX_IMPROVEMENT_PLAN_V2.md`.
- Next open item: `§8.3` — Add App Store review prompts after the third positive AI answer.
