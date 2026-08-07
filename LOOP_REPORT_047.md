# UX Improvement Loop Report — Wave 047

## Completed item

**v2 item 3.1 — Add a public reports feed filter (newest / most discussed / my posts).**

### What changed

- Added `src/utils/postFeedFilter.ts`:
  - `PostFeedFilter` union type: `newest | mostDiscussed | myPosts`.
  - `filterPosts(posts, filter, uid)` sorts/filter the public feed in memory.
    - `newest` preserves the existing `createTime` descending order.
    - `mostDiscussed` sorts by comment count descending, with `createTime` as a tiebreaker.
    - `myPosts` limits results to the current user.
  - `countPostsForFilter` gives the expected count for UI headers.
- Added `src/utils/postFeedFilter.test.ts` with 7 tests covering each filter and null-uid fallback.
- Added `src/components/FeedFilter/index.tsx`:
  - Inline segmented/chip control with three options and active styling.
  - Uses the existing `Pressable` component and matches the chip pattern from `FollowUpQuestions`.
- Wired the filter into `src/screens/Tabs/PostScreen/index.tsx`:
  - Added local `feedFilter` state and applied `filterPosts` to the raw `PostStore.store.posts` before rendering.
  - Rendered `FeedFilter` in the `ListHeaderComponent` below the reports header.
- Added `feedFilter.*` i18n keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `newest`, `mostDiscussed`, `myPosts`.

### Verification

- `npx jest` — 28 suites, **104 tests passed**.
- `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ios.bundle --reset-cache` — **bundle produced successfully**.
- Validated `en` and `ru` translation JSON with `python3 -m json.tool`.

## Plan status

| Section | Item | Status |
|---|---|---|
| 1. Retention & Daily Habit | 1.1–1.5 | ✅ |
| 2. AI Guide Experience | 2.1–2.6 | ✅ |
| 3. Social & Community | 3.1 Public reports feed filter | ✅ |
| 3. Social & Community | 3.2 Comment threading | ⬜ |
| 3. Social & Community | 3.3 Reactions | ⬜ |
| 3. Social & Community | 3.4 User profile with posts/streak | ⬜ |
| 3. Social & Community | 3.5 Report bookmarking | ⬜ |
| 4. Monetization & Pro | 4.1–4.5 | ⬜ |
| 5. Game Board Depth | 5.1–5.5 | ⬜ |
| 6. Performance & Stability | 6.1–6.5 | ⬜ |
| 7. Accessibility & Localization | 7.1–7.5 | ⬜ |
| 8. Discoverability & Onboarding | 8.1–8.4 | ⬜ |

## Cooperation options for the next loop

1. **Continue section 3** — implement comment threading (3.2) so players can reply to a specific comment, or reactions (3.3) for quick 🙏 ❤️ 🔥 feedback.
2. **Start section 5** — add the board legend overlay (5.1) to explain planes, chakras, and arrows directly on the board.
3. **Start section 8** — add the interactive "How to play" tutorial overlay (8.1) or App Store review prompt after positive AI answers (8.3).
