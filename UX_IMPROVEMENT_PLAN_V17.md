# UX Improvement Plan V17 — Activity Screen Engagement Polish

**Date:** 2026-08-08
**Cycle:** 13
**Focus area:** Activity feed (replies to user's posts)

---

## Research summary

### Weak spots
The `ActivityScreen` added in cycles 7-8 successfully loads replies via batched Firestore queries, but it still presents them as a flat, low-context list. Users cannot quickly triage which post a reply belongs to, which replies are new, or what to do when the list is empty.

### Competitor / pattern research
- **Instagram / Stream notification feeds** group activity by target object and use actor-verb-object rows with a single unread dot.
- **Courier / UX Patterns Guide** recommend time-grouping (Today / Yesterday / Earlier), "Mark all as read", and a meaningful empty state.
- **X Mentions** keeps replies flat, which is a known weakness; third-party tools like ThreadTrak fill the "group by thread" gap.
- **2024 notification-management study** found pinning and topic grouping most valued, but for a first iteration grouping by post + read/unread gives the best engagement ROI.

---

## Goals

1. Reduce cognitive load: group replies by the post they belong to and show a post snippet.
2. Improve triage: surface read/unread state with a quiet dot and bold title.
3. Speed up interaction: add "Mark all as read" and deep-link each reply to the post.
4. Close empty-state dead end: show a CTA to explore community or create a post.
5. Keep implementation local-first: store read state in AsyncStorage, sync nothing to backend for now.

---

## Decomposed tasks

### Task 1 — Read-state utility
- Create `src/utils/activityReadState.ts`:
  - `markActivityItemRead(postId, commentId)`
  - `markAllActivityItemsRead(items)`
  - `isActivityItemRead(postId, commentId)`
  - `getUnreadCount(items)`
  - Persist read IDs under `@leela:activityRead:<postId>:<commentId>`.
- Create `src/utils/activityReadState.test.ts`.

### Task 2 — Grouping + enrichment helper
- Create `src/utils/activityGrouping.ts`:
  - `groupActivityByPost(comments, posts)` → sections with `postId`, `postTitle`, `postSnippet`, `comments`.
  - `groupByTime(sections)` → `Today`, `Yesterday`, `This week`, `Earlier`.
  - `sortActivitySections(sections)` → unread first, then newest comment.
- Create `src/utils/activityGrouping.test.ts`.

### Task 3 — Update ActivityScreen
- Read posts for each unique `postId` (batched `in` queries, limit 10 chunks) to get title + first line.
- Render grouped sections:
  - Header row: post title/snippet + unread count + timestamp of newest reply.
  - Reply rows: avatar, author name, relative time, preview text, unread dot.
- Add "Mark all as read" header button (only when unread items exist).
- Add empty state with CTA to open community feed.
- Preserve pull-to-refresh, error state, retry.

### Task 4 — Localization
- Add keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `activity.markAllRead`
  - `activity.unreadBadge` / `activity.unreadCount`
  - `activity.emptyTitle`, `activity.emptySubtitle`, `activity.emptyCta`
  - `activity.group.today`, `activity.group.yesterday`, `activity.group.thisWeek`, `activity.group.earlier`

### Task 5 — Tests
- Update `src/screens/ActivityScreen/index.test.tsx` for grouping, read state, empty state, mark-all-read.
- Keep Jest suite green.

### Task 6 — Report
- Write `AUTONOMOUS_UX_LOOP_REPORT_2026-08-08_cycle13.md`.

---

## Success criteria

- Activity screen groups replies by post with a visible post snippet.
- Unread replies show a dot and bold preview; read replies are dimmed/normal.
- "Mark all as read" clears all dots and updates unread count.
- Empty state shows a friendly message + CTA instead of blank space.
- Jest: 73+ suites, 309+ tests passing.

---

## Next-cycle options (preview)

- A: Ship `gameTodaySummary` to 100% and add real success metrics (roll completion, retention).
- B: Add real-time activity updates + push-style local notifications for new replies.
- C: Build a dedicated Settings/Account tab consolidating subscription, data export, diagnostics, and delete account.
