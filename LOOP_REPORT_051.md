# UX Improvement Loop Report — Wave 051

## Completed item

**v2 item 3.5 — Add report bookmarking for private reflection journal.**

### What changed

- Added `src/utils/bookmarks.ts`:
  - `BookmarkT` type covering posts and AI comments.
  - AsyncStorage-backed helpers: `loadBookmarks`, `saveBookmarks`, `isBookmarked`, `addBookmark`, `removeBookmark`, `toggleBookmark`.
- Added `src/utils/bookmarks.test.ts` with 6 tests covering empty state, add, replace, remove, existence check, and toggle.
- Added `src/components/BookmarkButton/index.tsx`:
  - Loads the saved state, toggles on press, and switches between `bookmark-outline` and `bookmark` Ionicons.
  - Exported from `src/components/index.ts`.
- Wired bookmarking into cards:
  - `src/components/Cards/PostCard/index.tsx` — added a bookmark button in both detail and preview button rows.
  - `src/components/Cards/CommentCard/index.tsx` — added a bookmark button for AI comments (Leela answers) next to sources/feedback.
- Added `src/screens/Tabs/ProfileScreen/Tabs/BookmarksScene.tsx`:
  - Loads the user's saved bookmarks and renders them as a scrollable list.
  - Each item shows the plan avatar, author name, saved date, and a snippet of text.
  - Tapping an item opens the original report in `DETAIL_POST_SCREEN`.
  - The bookmark button on each row lets the user remove the saved entry.
- Exported `BookmarksScene` and added it as the last tab in the local `ProfileScreen`.
- Added `bookmarks.*` i18n strings in `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `tab`, `title`, `empty`, `removeLabel`.

### Verification

- `npx jest` — 31 suites, **122 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — **bundle produced successfully**.
- Validated `en` and `ru` translation JSON with `python3 -m json.tool`.

## Plan status

| Section | Item | Status |
|---|---|---|
| 1. Retention & Daily Habit | 1.1–1.5 | ✅ |
| 2. AI Guide Experience | 2.1–2.6 | ✅ |
| 3. Social & Community | 3.1–3.5 | ✅ |
| 4. Monetization & Pro | 4.1–4.5 | ⬜ |
| 5. Game Board Depth | 5.1–5.5 | ⬜ |
| 6. Performance & Stability | 6.1–6.5 | ⬜ |
| 7. Accessibility & Localization | 7.1–7.5 | ⬜ |
| 8. Discoverability & Onboarding | 8.1–8.4 | ⬜ |

## Cooperation options for the next wave

1. **Start section 4** — add the limited-time trial timer on the subscription screen (4.1) or a "Pro" badge on the profile and in the community (4.2).
2. **Start section 5** — add the board legend overlay explaining planes, chakras, snakes, and arrows (5.1).
3. **Start section 8** — add the interactive "How to play" tutorial overlay for first-time players (8.1).
