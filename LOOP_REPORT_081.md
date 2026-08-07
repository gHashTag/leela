# UX Improvement Loop Report — Wave 081

**Date:** 2026-08-07
**Plan item:** UX_IMPROVEMENT_PLAN_V3.md §2.1
**Branch:** leela-ai-streaming-vedic

## What was implemented

Added a user-facing AI answer language toggle that forces Leela's answers to match the app's UI language.

### Files changed

- `src/utils/aiLanguage.ts` *(new)* — AsyncStorage-backed preference (`@forceAiLanguage`) plus helpers to build the language instruction and full system message.
- `src/utils/aiLanguage.test.ts` *(new)* — unit tests for the preference and instruction builder.
- `src/constants.ts` — `generateComment` now appends the language instruction via `buildAiSystemMessage` when the toggle is enabled.
- `src/components/CreatePost/index.tsx` — the streaming path now also builds the system message with the language instruction, so both streaming and fallback answers respect the toggle.
- `src/components/AiLanguageToggle/index.tsx` *(new)* — user toggle component rendered in the AI Guide profile tab.
- `src/components/AiLanguageToggle/AiLanguageToggle.test.tsx` *(new)* — unit tests for the toggle.
- `src/components/index.ts` — exports the new toggle component.
- `src/screens/Tabs/ProfileScreen/Tabs/AiPersonaScene.tsx` — renders `AiLanguageToggle` below the persona selector.
- `src/locales/en/translation.json` — added `aiLanguage.title`, `description`, `instruction`.
- `src/locales/ru/translation.json` — added Russian translations.
- `UX_IMPROVEMENT_PLAN_V3.md` — marked §2.1 complete with wave 081.

## Verification

- `npx jest --runInBand --no-cache` — **59/59 suites passed, 232/232 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — **bundle written successfully**.

## Notes

- The toggle defaults to off, so existing behavior is unchanged.
- The instruction is appended to the system prompt once per request; `generateComment` and the streaming helper both use `buildAiSystemMessage` to stay consistent.
- The pre-existing MobX `autorun` console error from `DiceStore.ts` still appears during some tests but does not cause failures.

## Commit

`b4d311c` — wave 081: add user-facing AI answer language toggle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
