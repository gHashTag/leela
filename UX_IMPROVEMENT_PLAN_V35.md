# UX Improvement Plan V35

**Cycle:** 30  
**Date:** 2026-08-08  
**Theme:** ActivityScreen and community feed empty states, pull-to-refresh, and list UX polish

## 1. Weak spots

- `ActivityScreen` has an empty state, but it is static and does not explain *how* to get replies (e.g., share a report, comment on others).
- The pull-to-refresh implementation only refetches avatars and read-state; it does not give the user tactile or visual feedback that a refresh completed.
- There is no haptic feedback when pressing activity items, marking all read, or tapping the empty-state CTA.
- The empty state uses a generic lotus emoji (`🪷`) which is not strongly tied to the "replies" concept.
- The "Mark all read" header action has no confirmation or undo, so a mis-tap can clear unread state without feedback.
- Error state retry is visually identical to the empty state CTA, making it easy to mis-read.
- The community feed entry points (`WelcomeScreen`, `Hello`) mention community features but do not surface recent activity or a direct "See community" path.

## 2. Competitors / patterns

- **Instagram / Threads**: empty activity screen shows a contextual illustration, a short "When people interact with your posts, you'll see it here" message, and a primary "Find people to follow" CTA.
- **Reddit**: inbox empty states explain how to trigger notifications (comment, upvote, post) and use a themed icon.
- **Apple HIG (Pull-to-refresh)**: pair the refresh control with a brief haptic tick and a status change (e.g., unread dot cleared) to confirm completion.
- **Duolingo**: empty states use a character illustration and a clear single action.

## 3. Decomposed plan

1. **Improve `ActivityScreen` empty state** (`src/screens/ActivityScreen/index.tsx`):
   - Replace generic lotus with a speech-bubble / notification themed icon (`💬` or `:speech_balloon:`).
   - Add a two-line explanation: what appears here and what to do next.
   - CTA: "Explore community" (existing) plus a secondary "Share a report" when the user has no own posts.

2. **Add haptic feedback to all interactive surfaces in `ActivityScreen`**:
   - `haptics.impactLight` on row press, mark-all-read, empty CTA, retry.
   - `haptics.confirm` after mark-all-read succeeds and after pull-to-refresh completes.

3. **Strengthen pull-to-refresh completion feedback**:
   - Keep `RefreshControl`; after `onRefresh` resolves, emit a brief `notify.toast` when new items arrived or when the list is up to date.
   - Add a small "Updated just now" hint below the header when the user pulled to refresh.

4. **Add a confirmation step for "Mark all read"**:
   - Show an `Alert.alert` confirmation before marking all items read, with Cancel / Confirm.
   - On confirm, call `haptics.confirm` and a toast.

5. **Differentiate the error state**:
   - Use a warning icon (`⚠️`), red-tinted retry button, and a "Try again" label distinct from the empty CTA.

6. **Surface a community teaser on `WelcomeScreen` and `Hello`**:
   - Add a small "Community activity" row to the value cards or above the primary CTA with a sparkles/people icon and a label like "See what others shared".
   - This is a low-risk navigation shortcut, not a heavy data fetch.

7. **Add locale keys** (all 10 locales, en/ru/fr translated, others fall back to en):
   - `activity.emptyHint` — "Share a report or comment on others to start conversations."
   - `activity.shareReport` — "Share a report"
   - `activity.updatedNow` — "Updated just now"
   - `activity.markAllReadConfirm` — "Mark all replies as read?"
   - `activity.markAllReadConfirmMessage` — "You won't see unread badges any more."
   - `activity.markedAllRead` — "All replies marked as read"
   - `activity.errorRetry` — "Try again"

8. **Add tests**:
   - Extend `src/screens/ActivityScreen/index.test.tsx` for improved empty-state copy, pull-to-refresh toast, mark-all-read confirmation, and error-state retry.
   - Add a small test for the community teaser on `WelcomeScreen`.

9. **Run the full Jest suite and ensure it stays green**.

## 4. Success metrics

- `ActivityScreen` empty state has a contextual icon, clearer copy, and a secondary CTA.
- All interactive surfaces in `ActivityScreen` trigger haptic feedback.
- Pull-to-refresh provides a toast confirmation when complete.
- "Mark all read" shows a confirmation alert and a toast on success.
- Error state is visually distinct from empty state.
- Jest suite stays green and coverage is added for the new behavior.
