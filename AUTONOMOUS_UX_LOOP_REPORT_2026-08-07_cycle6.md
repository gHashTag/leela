# Autonomous UX Loop Report — Cycle 6 — 2026-08-07

## Loop parameters

- **Cadence:** every 15 minutes (`*/15 * * * *`)
- **Job ID:** `988c3acc`
- **Scope:** iOS/Android Leela app (`/Users/playra/leela-src/leela`)
- **Previous report:** `AUTONOMOUS_UX_LOOP_REPORT_2026-08-07_cycle5.md`
- **Plan:** `UX_IMPROVEMENT_PLAN_V9.md`

## What was done this cycle

### 1. Weak-point audit (continued)

- Verified cycle 5 fixes (`notify.ts`, updated `Info.plist`, data export CTA).
- Confirmed the public feed has only three hard-coded filters (`newest`, `mostDiscussed`, `myPosts`) and no topic-based discovery.
- Confirmed post authors have no in-app signal when someone replies to their report.
- Confirmed the `gameTodaySummary` experiment flag exists but has no analytics exposure tracking.

### 2. Competitor research

| Source | Pattern to borrow |
|---|---|
| [Mastodon hashtag menu #31393](https://github.com/mastodon/mastodon/issues/31393) | In-context hashtag/topic actions |
| [Bluesky stackable moderation](https://bsky.social/about/blog/03-12-2024-stackable-moderation) | User-chosen moderation/filter labels |
| [Activity feed UX Pattern](https://uxpatternsguide.com/patterns/activity-feed/) | Tab-bar badge + activity feed for replies |
| [Threaded discussion UX Pattern](https://uxpatternsguide.com/patterns/threaded-discussion/) | Preserve parent context and branch depth |
| [Mixpanel React Native feature flags](https://docs.mixpanel.com/docs/tracking-methods/sdks/react-native/react-native-flags) | Track experiment exposure once per session, persist in AsyncStorage |

### 3. Decomposed plan

Created/updated `UX_IMPROVEMENT_PLAN_V9.md` with cycle 6 focus on **community trust features + experiment analytics**.

### 4. Implemented in this cycle

#### Phase B — Game Screen Experiment Analytics

- **B9** Added `src/utils/experimentAnalytics.ts`:
  - Tracks `gameTodaySummary` experiment exposure once per app session.
  - Persists last exposure in AsyncStorage to deduplicate across re-renders.
  - Logs to console today; ready to be replaced by a real analytics SDK (Mixpanel/Amplitude/PostHog).
- Wired tracking into `src/screens/Tabs/GameScreen/index.tsx` when the variant is resolved.
- Added `src/utils/experimentAnalytics.test.ts`.

#### Phase C — Community Trust Features

- **C4-seed** Added unread-replies badge:
  - Created `src/utils/unreadReplies.ts` to count replies to the current user's posts newer than the last seen time.
  - Added `markRepliesAsSeen()` call in `PostScreen` so the badge clears when the user opens the community feed.
  - Updated `src/components/Tab/index.tsx` to render a small red badge with `9+` cap.
  - Updated `src/TabBar.tsx` to pass the unread count to the community tab (`TAB_BOTTOM_1`).
  - Added `src/utils/unreadReplies.test.ts`.

- **C5** Added report topic filters:
  - Extended `PostFeedFilter` with `withReplies` and `byPlan` options in `src/utils/postFeedFilter.ts`.
  - `withReplies` filters posts that have at least one comment.
  - `byPlan` groups posts by `plan` number (Leela plane) in ascending order.
  - Replaced hard-coded filter list in `src/components/FeedFilter/index.tsx` with `FILTER_ORDER` exported from `postFeedFilter.ts`.
  - Updated `countPostsForFilter` to handle the new filters.
  - Added localized labels for `withReplies` and `byPlan` in `en` and `ru`.
  - Extended `src/utils/postFeedFilter.test.ts`.

### Files changed

```
src/TabBar.tsx
src/components/Tab/index.tsx
src/components/FeedFilter/index.tsx
src/screens/Tabs/GameScreen/index.tsx
src/screens/Tabs/PostScreen/index.tsx
src/utils/postFeedFilter.ts
src/utils/postFeedFilter.test.ts
src/utils/unreadReplies.ts
src/utils/unreadReplies.test.ts
src/utils/experimentAnalytics.ts
src/utils/experimentAnalytics.test.ts
src/locales/en/translation.json
src/locales/ru/translation.json
UX_IMPROVEMENT_PLAN_V9.md
AUTONOMOUS_UX_LOOP_REPORT_2026-08-07_cycle6.md
```

### Validation

- Full Jest suite: **66 suites passed, 261 tests passed**.
- ESLint run still blocked by pre-existing missing `@react-native/eslint-config`.

### Remaining work

- Run `yarn install` + `cd ios && pod install` to activate `react-native-haptic-feedback` from cycle 4.
- **C4-deepen** Build a dedicated Activity/Notifications screen with deep-linking to specific comments and per-thread read state.
- **C6-polish** Data export share-sheet, JSON preview, large-account queue.
- **B-experiment** Collect exposure/roll-completion data over several cycles and decide whether to remove the legacy stacked-card layout.
- **D2–D3** Family plan and Pro trial ended win-back offer.

## Cooperation options for the next loop

1. **Deepen the reply notification system** — build a dedicated Activity/Notifications screen, add deep-linking to specific comments, and support marking individual threads as read.
2. **Polish data export end-to-end** — share-sheet, JSON preview, large-account queue, and Firestore pagination.
3. **Analyze the game screen experiment** — collect a few cycles of exposure/roll-completion data and decide whether to remove the legacy stacked-card layout.
