# UX Improvement Loop Report — Wave 046

## Completed item

**v2 item 2.6 — Surface the exact scripture quote that grounded the answer.**

### What changed

- Added `src/utils/aiSources.ts`:
  - `extractSources(text)` parses the `Sources:` / `Источники:` section that the AI already appends to every answer.
  - Splits entries by semicolon and extracts `Reference — "quote"` pairs.
  - Strips surrounding quote marks and tolerates multiple dash styles.
- Added `src/utils/aiSources.test.ts` covering empty text, missing markers, single/multiple English sources, Russian markers, reference-only fallback, mixed quote marks, and text before the marker.
- Added `src/components/AiSources/index.tsx`:
  - Renders a "Sources" / "Источники" section under AI answers.
  - Each source is shown as a card with the scripture reference in bold and the exact quote in italics beneath it.
  - Returns `null` when no sources are found, so non-source answers are unchanged.
- Wired `AiSources` into `src/components/Cards/CommentCard/index.tsx` inside the existing AI-only block, below the answer and above feedback/follow-ups.
- Updated the AI system prompt in `src/locales/en/translation.json` and `src/locales/ru/translation.json` to request a brief direct quote after each scripture reference in the `Sources:` / `Источники:` line.
- Added `aiSources.title` i18n strings for `en` (`Sources`) and `ru` (`Источники`).

### Verification

- `npx jest` — 27 suites, **97 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — **bundle produced successfully**.
- Validated `en` and `ru` translation JSON with `python3 -m json.tool`.

## Plan status

| Section | Item | Status |
|---|---|---|
| 1. Retention & Daily Habit | 1.1 Daily verse push | ✅ |
| 1. Retention & Daily Habit | 1.2 Weekly streak summary | ✅ |
| 1. Retention & Daily Habit | 1.3 Resume last game | ✅ |
| 1. Retention & Daily Habit | 1.4 Bedtime/reminder setting | ✅ |
| 1. Retention & Daily Habit | 1.5 Intention prompt | ✅ |
| 2. AI Guide Experience | 2.1 AI guide persona | ✅ |
| 2. AI Guide Experience | 2.2 Follow-up questions | ✅ |
| 2. AI Guide Experience | 2.3 Cache last 5 AI answers | ✅ |
| 2. AI Guide Experience | 2.4 Thumbs up/down feedback | ✅ |
| 2. AI Guide Experience | 2.5 Simplify long answers | ✅ |
| 2. AI Guide Experience | 2.6 Surface scripture quote | ✅ |
| 3. Social & Community | 3.1–3.5 | ⬜ |
| 4. Monetization & Pro | 4.1–4.5 | ⬜ |
| 5. Game Board Depth | 5.1–5.5 | ⬜ |
| 6. Performance & Stability | 6.1–6.5 | ⬜ |
| 7. Accessibility & Localization | 7.1–7.5 | ⬜ |
| 8. Discoverability & Onboarding | 8.1–8.4 | ⬜ |

## Cooperation options for the next loop

1. **Continue section 3** — start the social/community work with report feed filters (3.1) or comment reactions (3.3).
2. **Start section 5** — deepen the game board with the board legend overlay (5.1), roll history (5.3), or sound toggle (5.5).
3. **Start section 8** — add onboarding/discoverability improvements such as the interactive tutorial (8.1) or App Store review prompt after positive AI answers (8.3).
