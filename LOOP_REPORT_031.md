# Loop 31 Report

## Summary
Completed item **8.2**: added a "What's new" changelog modal that is shown automatically after the app is updated to a new version.

## What was done
1. **Implemented 8.2**
   - `src/screens/Modals/WhatsNewModal/index.tsx`
     - New transparent modal screen styled like the existing network/update modals.
     - Shows the current app version and a scrollable list of changelog bullets.
     - Close button dismisses the modal with `navigation.goBack()`.
   - `src/hooks/useWhatsNewModal.ts`
     - Reads the last seen app version from AsyncStorage on app start.
     - If a previous version is stored and is lower than the current `package.json` version, opens the changelog modal.
     - Updates the stored version so the modal is not shown again until the next update.
     - Skips the modal on first install (no previous version stored), matching the intended "after app updates" behavior.
   - `src/Navigation.tsx`
     - Added `useWhatsNewModal()` to the root tab navigator.
     - Registered the new `WHATS_NEW_MODAL` screen inside the transparent modal group.
   - `src/constants.ts`
     - Added `OpenWhatsNewModal()` navigation helper.
   - `src/types/types.ts`
     - Added `WHATS_NEW_MODAL` to `RootStackParamList`.
   - `src/screens/Modals/index.ts` and `src/hooks/index.ts`
     - Exported the new modal component and hook.
   - `src/locales/en/translation.json` / `src/locales/ru/translation.json`
     - Added the `whatsNew` namespace (title, version label, close button, changelog items) for both languages.
2. **Verification**
   - `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` → bundle written successfully.
   - Validated both translation JSON files with `node -e "require(...)"`.
3. **Plan bookkeeping**
   - Marked item 8.2 as complete in `UX_IMPROVEMENT_PLAN.md`.

## Commit
`2b658e7` — `Wave 31: add 'What's new' changelog modal after app updates`

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

## Plan status

| Section | Items | Done | Remaining |
|---------|-------|------|-----------|
| 1. Report & AI Flow | 6 | 6 | 0 |
| 2. Comments & Community | 5 | 5 | 0 |
| 3. Game Board & Dice UX | 5 | 5 | 0 |
| 4. Onboarding, Trust & Pro | 4 | 4 | 0 |
| 5. Stability & Observability | 4 | 4 | 0 |
| 6. Competitive Differentiation | 9 | 9 | 0 |
| 7. Sharing & Accessibility | 4 | 4 | 0 |
| 8. Polish & Delight | 4 | 3 | 1 |
| **Total** | **41** | **40** | **1** |

## Cooperation options for the next loop

1. **Finish section 8** — implement the last remaining polish item (8.4: subtle win celebration animation when the player reaches liberation).
2. **Quality sweep** — run the full test suite, fix the pre-existing Sentry/Messaging teardown warnings, and tighten TypeScript in one area.
3. **Analytics-driven extension** — instrument the new copy/share/haptic/pull-to-refresh/changelog actions and use usage data to seed plan v2.
