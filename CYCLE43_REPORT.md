# Cycle 43 / wave 089 — UX-autonomy report

**Date:** 2026-08-08  
**Focus:** turn **Profile tab empty states** from dead ends into activation moments.

## 1. Research

### Weak points found
- `SceneStates` empty state showed only a title and optional message — no icon, no CTA, no contextual guidance.
- Every profile scene (History, Reports, Bookmarks, AI Answers, Intention) repeated the same sparse empty pattern.
- The `ProfileScreen` header looked complete (avatar, name, plan) even when intention, avatar, name, or first report were missing.
- `IntentionOfGame` scene was blank when no intention was set — just an edit icon and empty space.
- `OfflineProfileScreen` had no first-win reinforcement; the win celebration lived only on `GameScreen`.
- Error states in scenes used generic copy and did not reassure the user.

### Competitor patterns applied
- **Duolingo / Slack / Notion empty states:** icon + headline + supporting copy + one primary CTA, tone matched to context.
- **LogRocket / Setproduct profile UX:** empty profile fields become CTAs; progress indicators and benefit-driven copy boost completion.
- **Trophy / Octalysis gamification:** day-1 achievements and visible progress markers improve retention.
- **Apple HIG:** provide recovery actions and keep copy concise.

## 2. Plan

Full plan is in `UX_IMPROVEMENT_PLAN_V43.md`. Highlights:
1. Enrich `SceneStates` empty state with optional `icon`, `message`, and `action`.
2. Update every profile scene empty state with contextual copy and a primary CTA (or educational guidance).
3. Add a dismissible `ProfileCompletionCard` under the `ProfileScreen` header.
4. Add a one-time first-win banner to `OfflineProfileScreen`.
5. Improve error-state copy in `SceneStates`.
6. Cover changes with tests.

## 3. Implemented

### Components
- `src/components/SceneStates/index.tsx`
  - Empty state now supports `icon`, `message`, and `action`; renders icon, fallback `EmptyComments`, headline, explanation, and a `Button` when an action is provided.
  - Error state now includes a more reassuring `errorMessage` fallback.
  - CTA triggers haptic feedback.
- `src/components/ProfileCompletionCard/index.tsx` (new)
  - Computes 4-step completion (avatar, name, intention, first report), shows a card with the next missing step, a progress bar, and a primary CTA.
  - Dismissible per session; haptic feedback on appear/CTA/dismiss.

### Profile scenes
- `src/screens/Tabs/ProfileScreen/Tabs/HistoryScene.tsx`
  - Empty state: 🎲 "Your journey starts here" → CTA to `SELECT_PLAYERS_SCREEN`.
- `src/screens/Tabs/ProfileScreen/Tabs/ReportsScene.tsx`
  - Empty state: 📜 "No reports yet" → CTA to `SELECT_PLAYERS_SCREEN`.
- `src/screens/Tabs/ProfileScreen/Tabs/BookmarksScene.tsx`
  - Empty state: 🔖 "Saved answers live here" with educational message (no CTA because bookmarks are created elsewhere).
- `src/screens/Tabs/ProfileScreen/Tabs/AiAnswersScene.tsx`
  - Empty state: ✨ "No AI answers yet" → CTA to `SELECT_PLAYERS_SCREEN`.
- `src/screens/Tabs/ProfileScreen/Tabs/IntentionOfGame.tsx`
  - Empty state: compass-style empty block with "Set your intention" + CTA to `CHANGE_INTENTION_SCREEN`.
- `src/screens/Tabs/ProfileScreen/index.tsx`
  - Added `ProfileCompletionCard` under header with step routing.
- `src/components/OwnTabView/index.tsx`
  - Relaxed `Scene` type from `(props?: any) => JSX.Element` to `React.ComponentType<any>` to allow memo-wrapped components like `BedtimeReminder` and `SoundToggle`.

### Offline profile
- `src/screens/Tabs/OfflineProfileScreen/index.tsx`
  - One-time first-win banner shown when history becomes non-empty; auto-dismisses after 4 seconds.
  - Banner has `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`, and localized label.

### Localization
- Added new English keys in `src/locales/en/translation.json`:
  - `sceneStates.errorMessage`
  - `profileEmpty.*` for all scene copy and CTAs
  - `profileCompletion.*` for completion card
  - `offlineProfile.firstWinBanner`
- Added corresponding Russian translations in `src/locales/ru/translation.json`.

### Tests
- `src/components/SceneStates/SceneStates.test.tsx`
  - Added enriched empty-state test (icon, message, action).
- `src/components/ProfileCompletionCard/ProfileCompletionCard.test.tsx` (new)
  - Tests render, CTA, and dismiss.

## 4. Verification

```text
Test Suites: 73 passed, 73 total
Tests:       288 passed, 288 total
Snapshots:   0 total
Time:        ~28-30 s
```

All tests pass. `tsc --noEmit` still reports the 403 pre-existing `TS2786` JSX-type errors across the repo, but no new non-TS2786 errors were introduced by changed files after the `OwnTabView` interface fix. ESLint remains broken in this environment due to a missing `@react-native` shareable config.

## 5. Known limitations / next-loop candidates
- First-win banner is per app launch, not persisted; making it truly one-time requires a storage flag.
- Profile completion card is dismissed only in memory; persistence was intentionally skipped to keep the loop small.
- No analytics events were added for empty-state CTAs or completion-card interactions.
- Empty-state icons are emoji; a future loop could swap them for themed illustrations.

## 6. Three cooperation options for the next loop

### Option A — Analytics + empty-state funnel
Instrument every empty-state CTA and the completion card so we know which profile steps users complete and where they drop off. Build a lightweight event helper, add tests, and update the report with baseline metrics.

### Option B — Personalized profile nudges
Make the `ProfileCompletionCard` and empty states adapt to the user’s last action:
- If they just finished a game but have no intention, prioritize intention.
- If they have an intention but no avatar, prioritize avatar.
- Add a "next recommended step" algorithm and corresponding tests.

### Option C — Achievements / streak foundation
Introduce a lightweight achievement system for the profile:
- "First roll", "First six", "First arrow", "First report", "First win".
- Render a small badge row on `ProfileScreen` and a "first badge" empty state in a new "Journey" tab or overlay.
- Add helper, store-backed flags, and tests.
