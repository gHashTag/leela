# UX Improvement Loop Report — Wave 41

**Date:** 2026-08-07
**Commit:** `6b9b66f662e0304c872dd181f9b1a08cc9f4b360`
**Plan item:** v2 2.1 — Allow players to choose an AI guide persona (scholar, friend, guru).

## Summary
Implemented an AI guide persona selector that lets players choose between a Vedic scholar, supportive friend, or spiritual guru. The chosen persona is persisted in AsyncStorage and appended to the system prompt used by `CreatePost`, `PostCard` AI comments, and `ChatScreen`.

## Changes

### New files
- `src/utils/aiPersona.ts` — `AiPersona` type, `AI_PERSONAS`, `loadAiPersona`, `saveAiPersona`, `buildSystemMessage`.
- `src/utils/aiPersona.test.ts` — tests for default/fallback, save/load, invalid values, and system message construction.
- `src/components/AiPersonaSelector/index.tsx` — radio-style selector that loads and persists the persona.
- `src/components/AiPersonaSelector/AiPersonaSelector.test.tsx` — render and interaction tests.
- `src/screens/Tabs/ProfileScreen/Tabs/AiPersonaScene.tsx` — profile tab scene wrapping the selector.

### Modified files
- `src/components/index.ts` — exports `AiPersonaSelector`.
- `src/screens/Tabs/ProfileScreen/index.tsx` — imports selector and adds an "AI Guide" tab.
- `src/screens/Tabs/ProfileScreen/Tabs/index.ts` — exports `AiPersonaScene`.
- `src/locales/en/translation.json` — added `aiPersona.tab/title/scholar/friend/guru`.
- `src/locales/ru/translation.json` — added Russian translations for the same keys.
- `src/components/CreatePost/index.tsx` — loads persona on mount and uses `buildSystemMessage(t, persona)` for AI stream and fallback.
- `src/components/Cards/PostCard/index.tsx` — loads persona in `onPressWand` and builds persona-aware system message.
- `src/screens/Tabs/ChatScreen/index.tsx` — loads persona before each send and uses persona-aware system message.
- `UX_IMPROVEMENT_PLAN_V2.md` — marked 2.1 complete.

## Verification
- Jest: 19 suites, 62 tests passed.
- iOS bundle: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` completed successfully (Metro warnings only, no errors).

## Next open item
v2 2.2 — Add follow-up questions inside the report answer card.
