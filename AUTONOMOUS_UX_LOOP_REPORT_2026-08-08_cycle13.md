# Autonomous UX Improvement Loop — Cycle 13 Report

**Date:** 2026-08-08
**Loop started:** 2026-08-07
**Cycle:** 13
**Status:** Completed, tests green

---

## 1. Weak spots researched this cycle

We selected the **Activity screen** as the highest-impact next surface. After cycles 7-8 built batched Firestore loading, relative timestamps, and pull-to-refresh, the screen still had four UX gaps:

- **Flat list, no context:** replies appeared as isolated rows with no visible link to the original post, making triage hard.
- **No read/unread state:** users could not tell which replies were new since their last visit.
- **Empty-state dead end:** the empty screen only said "No new replies yet" with no next step.
- **No bulk action:** there was no way to clear the unread dot for all replies at once.

## 2. Competitor / pattern research

- **Instagram / Stream notification feeds** group activity by target object and use actor-verb-object rows with a single unread dot. We adopted the "group by post" pattern.
- **Courier / UX Patterns Guide** recommend time-grouping (Today / Yesterday / This week / Earlier), a "Mark all as read" header action, and a meaningful empty-state CTA. We applied all three.
- **X Mentions** keeps replies flat, which is a known weakness; third-party tools like ThreadTrak fill the "group by thread" gap. We avoided the flat-reply anti-pattern.
- **A 2024 notification-management study** found pinning and topic grouping most valued long-term, but for one cycle grouping by post + read/unread gives the best engagement ROI.

Sources:
- [Courier — In-app notification center design: UX tips and examples](https://www.courier.com/blog/in-app-notification-center-design)
- [UX Patterns Guide — Activity feed UX Pattern](https://uxpatternsguide.com/patterns/activity-feed/)
- [Courier — Notification Center Best Practices and UX](https://www.courier.com/guides/how-to-build-a-notification-center/chapter-3-best-practices-for-notification-centers)
- [MOOST — Notification Center best practices](https://doc.moost.io/best-practices/user-experience/notification-center)
- [Lin et al. (2024) — Pinning, Sorting, and Categorizing Notifications](https://people.cs.nycu.edu.tw/~armuro/pubs/lin-et-al-2024-imwut.pdf)

## 3. Decomposed plan and implementation

### Task 1 — Read-state utility
- Created `src/utils/activityReadState.ts`:
  - `markActivityItemRead(postId, commentId)`
  - `markAllActivityItemsRead(items)`
  - `isActivityItemRead(postId, commentId)`
  - `getUnreadCount(items)`
  - `getReadKeySet(items)` (batch check for grouping helper)
  - Persist read IDs under `@leela:activityRead:<postId>:<commentId>`.
- Created `src/utils/activityReadState.test.ts`.

### Task 2 — Grouping + enrichment helper
- Created `src/utils/activityGrouping.ts`:
  - `groupActivityByPost(comments, posts, readKeys)` → post-centric sections with unread count and sorted comments.
  - `groupByTime(sections)` → `Today`, `Yesterday`, `This week`, `Earlier` buckets.
  - Sections sort unread-first, then by newest reply.
  - Post title/snippet derived from the existing `PostStore` data (no extra Firestore fetch).
- Created `src/utils/activityGrouping.test.ts`.

### Task 3 — Update ActivityScreen
- Rewrote `src/screens/ActivityScreen/index.tsx`:
  - Groups replies by post inside time buckets.
  - Section header shows plan number, post snippet, unread badge, and newest reply time.
  - Reply rows show an unread dot, bold preview for unread items, and dimmed read rows.
  - Tapping a reply marks it read and deep-links to `DETAIL_POST_SCREEN`.
  - Header right icon (✅) appears when there are unread replies; tapping marks all as read.
  - Empty state now has a title, subtitle, and "Explore community" CTA that opens the community tab.
  - Preserved pull-to-refresh, error state, retry.

### Task 4 — Localization
- Added keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `activity.repliesOnPlan`
  - `activity.emptyTitle`, `activity.emptySubtitle`, `activity.emptyCta`
  - `activity.markAllRead`
  - `activity.group.today`, `activity.group.yesterday`, `activity.group.thisWeek`, `activity.group.earlier`

### Task 5 — Tests
- Updated `src/screens/ActivityScreen/index.test.tsx` for the new empty-state CTA.
- Added `src/utils/activityReadState.test.ts` and `src/utils/activityGrouping.test.ts`.

## 4. Test results

```
Test Suites: 75 passed, 75 total
Tests:       320 passed, 320 total
Snapshots:   0 total
Time:        ~9.3s
```

- No new TypeScript or ESLint regressions introduced in changed files.

## 5. Files changed in this cycle

- `src/utils/activityReadState.ts` (new)
- `src/utils/activityReadState.test.ts` (new)
- `src/utils/activityGrouping.ts` (new)
- `src/utils/activityGrouping.test.ts` (new)
- `src/screens/ActivityScreen/index.tsx`
- `src/screens/ActivityScreen/index.test.tsx`
- `src/locales/en/translation.json`
- `src/locales/ru/translation.json`
- `UX_IMPROVEMENT_PLAN_V17.md` (new)

## 6. Three cooperation options for the next loop

### Option A — Ship gameTodaySummary to 100%
Make the experiment decision permanent: enable `gameTodaySummary` by default, disable `legacyGameCards`, and add real success metrics (roll completion rate, day-7 retention). I will instrument analytics events, update the recommendation thresholds, and clean up the legacy card code behind the kill switch.

### Option B — Real-time activity + local notifications (recommended)
Add live updates to the Activity feed and surface new replies as local in-app notifications / badges even when the user is not on the community tab. I will wire Firestore listeners to increment the unread badge, add a lightweight "new reply" toast, and ensure the Activity screen updates without a manual pull-to-refresh.

### Option C — Settings / Account tab
Create a dedicated settings/account screen that consolidates subscription management, data export, diagnostics, and account deletion with proper confirmation flows. This addresses the current problem of burying trust features inside the "Session health" tab.

---

**Next action:** awaiting your choice of A, B, or C. Default is B if you say "next wave" or re-trigger the loop.
