# UX Improvement Loop Report — Wave 048

## Completed item

**v2 item 3.2 — Add comment threading (reply to a specific comment).**

### What changed

- Extended the data model for threaded replies:
  - Added `parentReplyId?: string | null` and `replyToOwnerName?: string | null` to `FormReplyCom` and `ReplyComT` in `src/types/types.ts`.
  - Updated `PostStore.replyComment()` in `src/store/PostStore.ts` to persist `parentReplyId` and `replyToOwnerName` on Firestore.
- Added a new action to the comment menus:
  - `src/components/Cards/CommentCard/ModalActions.ts` now includes **"Reply in thread"** alongside the existing flat "Reply". It opens the text modal with `@username ` pre-filled and stores `replyToOwnerName`.
  - `src/components/Cards/SubCommentCard/ModalActions.ts` also gets **"Reply in thread"**, so players can reply directly to a nested reply. The reply is anchored to the same top-level comment (`commentId`) and linked to its parent reply (`parentReplyId`).
- Added `actions.replyThread` i18n keys in `src/locales/en/translation.json` (`"Reply in thread"`) and `src/locales/ru/translation.json` (`"Ответить в треде"`).
- Existing `SubCommentCard` already renders the flat list of replies under each top-level comment, so the new fields can be displayed in a future wave without breaking the current UI.

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
| 3. Social & Community | 3.2 Comment threading | ✅ |
| 3. Social & Community | 3.3 Reactions | ⬜ |
| 3. Social & Community | 3.4 User profile with posts/streak | ⬜ |
| 3. Social & Community | 3.5 Report bookmarking | ⬜ |
| 4. Monetization & Pro | 4.1–4.5 | ⬜ |
| 5. Game Board Depth | 5.1–5.5 | ⬜ |
| 6. Performance & Stability | 6.1–6.5 | ⬜ |
| 7. Accessibility & Localization | 7.1–7.5 | ⬜ |
| 8. Discoverability & Onboarding | 8.1–8.4 | ⬜ |

## Cooperation options for the next loop

1. **Continue section 3** — implement reactions (3.3) for quick 🙏 ❤️ 🔥 feedback on comments and reports, or report bookmarking (3.5) for a private reflection journal.
2. **Start section 5** — add the board legend overlay (5.1) explaining planes, chakras, and arrows.
3. **Start section 8** — add the interactive "How to play" tutorial overlay (8.1) or App Store review prompt after positive AI answers (8.3).
