# Cycle 44 / wave 090 — UX-autonomy report

**Date:** 2026-08-08  
**Focus:** polish the **community feed and AI chat** experiences: remove dead-end empty states, add starter prompts to the AI chat, make engagement actions more accessible, and add an inline comment composer.

## 1. Research

### Weak points found
- `ChatScreen` dropped users into an empty composer after one welcome bubble; no guidance on what to ask.
- No starter prompts for the AI assistant; users had to type from scratch.
- `PostScreen` empty state used generic copy regardless of the active filter.
- Engagement buttons in `PostCard`/`CommentCard` lacked consistent accessibility labels and explicit haptics.
- `DetailPostScreen` forced every reply through a full-screen `INPUT_TEXT_MODAL`, breaking context.
- `FeedFilter` chips gave no tactile feedback and had no `accessibilityRole`.

### Competitor patterns applied
- **Koder Design / AuditBuffet:** AI chat empty state with 3–4 starter chips that pre-fill (not auto-send) the composer.
- **Stream chat UX:** seed first experience; inline onboarding beats modal tours.
- **Bluesky / HiveSnaps:** haptic feedback on engagement, optimistic UI, accessibility roles on buttons.
- **Twitter/X:** post cards designed for skimming with clear CTAs.

## 2. Plan

Full plan is in `UX_IMPROVEMENT_PLAN_V44.md`. Highlights:
1. Add `ChatStarterPrompts` to `ChatScreen` with controlled input text.
2. Personalize `PostScreen` empty copy by feed filter.
3. Add haptics and accessibility labels to engagement buttons.
4. Add `InlineCommentInput` to `DetailPostScreen`.
5. Add haptics to `FeedFilter`.
6. Cover with tests.

## 3. Implemented

### AI chat
- `src/components/ChatStarterPrompts/index.tsx` (new)
  - Renders 4 localized starter chips above the composer when only the welcome message exists.
  - Tapping a chip sets `GiftedChat` input text via controlled `text`/`onInputTextChanged` props.
  - Chips do not auto-send; user reviews before sending.
  - Haptic feedback on chip tap; accessibility labels.
- `src/screens/Tabs/ChatScreen/index.tsx`
  - Added `inputText` state and controlled composer.
  - Used `renderChatFooter` to place starter prompts above the composer.

### Community feed
- `src/screens/Tabs/PostScreen/index.tsx`
  - Empty headline now adapts: `myPosts` shows "You haven't shared a report yet..."; other filters show "Be the first to share a reflection".
- `src/components/FeedFilter/index.tsx`
  - Added `triggerHaptic('impactLight')` on chip selection.
  - Added `accessibilityRole="button"`.

### Engagement accessibility & haptics
- `src/components/Buttons/ButtonVectorIcon/index.tsx`
  - Added `accessibilityLabel` and `testID` props; forwarded to `Pressable`.
  - Replaced invalid `activeOpacity` with `pressedStyle={{ opacity: 0.7 }}`.
- `src/components/Cards/PostCard/usePostActions.ts`
  - Added explicit haptic feedback to `handleLike` and `handleComment`.
- `src/components/Cards/PostCard/index.tsx`
  - Added accessibility labels to comment, like, and share buttons; added testIDs.
- `src/components/BookmarkButton/index.tsx`
  - Added `useTranslation` and dynamic `accessibilityLabel` (save/remove bookmark).
- `src/components/Cards/CommentCard/index.tsx`
  - Added `accessibilityLabel` to comment-menu button.
- `src/components/Cards/SubCommentCard/index.tsx`
  - Added `accessibilityLabel` to reply-menu button.

### Inline comment composer
- `src/components/InlineCommentInput/index.tsx` (new)
  - Sticky bottom input with `KeyboardAvoidingView`.
  - Creates optimistic comment and calls `PostStore.createComment` on send.
  - Haptic feedback on send; disabled when text is too short.
- `src/screens/DetailPostScreen/index.tsx`
  - Wrapped `FlatList` in a flex container and mounted `InlineCommentInput` at the bottom.
  - Moved `useTranslation` above `newComment` to fix a pre-existing closure/declaration order TypeScript warning.

### Localization
- Added `chatStarters.*` keys in en/ru.
- Added `online-part.noPostsFiltered` and `online-part.noPostsHeadline` in en/ru.
- Added accessibility labels: `like`, `unlike`, `comments`, `sharePost`, `bookmark`, `removeBookmark`, `commentMenu`, `commentInput`, `sendComment`.

### Tests
- `src/components/ChatStarterPrompts/ChatStarterPrompts.test.tsx` (new)
- `src/components/InlineCommentInput/InlineCommentInput.test.tsx` (new)
- `src/components/FeedFilter/FeedFilter.test.tsx` (new)

## 4. Verification

```text
Test Suites: 76 passed, 76 total
Tests:       295 passed, 295 total
Snapshots:   0 total
Time:        ~29-33 s
```

All tests pass. `tsc --noEmit` still reports the 403 pre-existing `TS2786` JSX-type errors across the repo. The only remaining non-TS2786 errors in changed files are pre-existing in `ChatScreen` (apiMessages type, implicit any event) and `PostScreen` (NativeError namespace, `uid` type in `filterPosts`); none were introduced by this cycle.

## 5. Known limitations / next-loop candidates
- Inline comment input is plain-text only; it does not yet support the same rich actions (translate, AI reply) as the modal flow.
- AI starter prompts are static; a future loop could make them contextual to the current game plane or last report.
- No analytics events were added for chat starters or inline comment usage.
- PostCard engagement buttons now have labels/testIDs but the underlying `Reactions` component could also benefit from per-reaction accessibility labels.

## 6. Three cooperation options for the next loop

### Option A — Contextual AI chat starters
Make starter chips adapt to the user's current state:
- If a game is in progress: "What does plane {{plane}} mean?"
- If a report was just completed: "Reflect on my last report"
- Add a small plane-aware suggestion engine and tests.

### Option B — Feed engagement analytics + reactions polish
Instrument like/comment/share/bookmark events and add per-reaction accessibility labels, reaction counts, and a double-tap-to-like gesture on post cards. Add tests for the new interactions.

### Option C — Report composer UX hardening
Polish the `CreatePost` / report flow:
- autosave indicator, clearer min-char error, voice-input hint, and a preview of how the report will look in the feed.
- Add inline validation feedback and tests.
