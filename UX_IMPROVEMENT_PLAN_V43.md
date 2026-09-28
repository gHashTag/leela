# UX Improvement Plan V43 — wave 089

## Goal
Turn the **Profile tab empty states** from dead ends into activation moments: give every empty scene a clear next step, celebrate early progress, and make the profile feel personally useful on day one.

## Weak points found

1. **Generic empty states.** `SceneStates` empty only shows a title and optional message. There is no built-in illustration, CTA button, or contextual hint. Every scene (Reports, Bookmarks, AI Answers, History) repeats the same sparse pattern.
2. **No “complete your profile” nudge.** The profile header shows avatar/name/plan, but there is no inline indicator when intention, avatar, or first report is missing. New users land on a profile that looks finished but contains only empty tabs.
3. **Empty `IntentionOfGame` scene is blank.** When no intention is set, the tab shows only an edit icon and an empty space. There is no prompt explaining why intention matters or a one-tap way to set it.
4. **No first-win celebration in profile.** The win celebration happens on `GameScreen`, but the `OfflineProfileScreen` / `HistoryScene` do not reinforce the milestone with a streak preview or "first game complete" badge hint.
5. **Scene error states lack retry context.** `SceneStates` already supports `onRetry`, but the copy is generic and does not explain what failed or reassure the user.
6. **Bookmarks and AI Answers empty states do not explain the feature.** A new user seeing "No bookmarks yet" does not know how to create one or why they would want to.

## Competitor patterns applied

- **Duolingo / Slack / Notion empty states:** icon + headline + supporting copy + one primary CTA, with tone matched to context.
- **LogRocket / Setproduct profile UX:** empty profile fields are CTAs themselves; progress indicators and benefit-driven copy increase completion.
- **Trophy / Octalysis gamification:** day-1 achievements and visible progress markers lift retention; badges tied to meaningful first actions work best.
- **Apple Human Interface Guidelines:** use system-appropriate empty states, provide recovery actions, and keep copy concise.

## Decomposed plan

### 1. Enrich `SceneStates` empty state
- Add optional `icon`, `message`, and `action` props to the empty state.
- Render a centered illustration emoji/icon, a bold headline, a short explanation, and a primary `Button` when an action is provided.
- Add haptic feedback on the empty-state CTA.
- Keep the existing API backward-compatible: old calls with only `title` continue to work.

### 2. Update every profile scene empty state
- **HistoryScene:** when empty, show a dice icon + "Your journey starts here" + "Play your first game to see your path through the 72 planes." + CTA "Play now" → `SELECT_PLAYERS_SCREEN`.
- **ReportsScene:** when empty, show a scroll icon + "No reports yet" + "Each plane asks for a reflection; your first report appears here." + CTA "Start a game" → `SELECT_PLAYERS_SCREEN`.
- **BookmarksScene:** when empty, show a bookmark icon + "Saved answers live here" + "Tap the bookmark on any AI answer to return to it." (no primary CTA; educational empty state).
- **AiAnswersScene:** when empty, show a sparkle icon + "No AI answers yet" + "Complete a report and Leela will guide you with one practical step." + CTA "Start a game" → `SELECT_PLAYERS_SCREEN`.
- **IntentionOfGame:** when empty, show a compass icon + "Set your intention" + "An intention gives the game a personal direction; you can change it anytime." + CTA "Add intention" → `CHANGE_INTENTION_SCREEN`.
- **AiPersonaScene:** keep existing selector; no empty state because there is always a default persona.
- **SessionHealthScene:** already has content; no change.

### 3. Add profile-completion nudge on `ProfileScreen` header
- Read profile fields (avatar, firstName, lastName, intention, history length).
- Compute a lightweight completion percentage (avatar + name + intention + first report = 4 steps).
- If completion < 100%, show a subtle card under the header with the next missing step and a CTA.
- Card is dismissible per session; persist dismissal only in memory, not storage.
- Add haptic feedback when the card appears and on CTA tap.

### 4. First-win reinforcement in `OfflineProfileScreen`
- When a game is finished and history transitions from empty to non-empty, show a one-time inline banner: "✦ First step complete — your journey is saved."
- Banner auto-dismisses after 4 seconds or on tap; only shown once per app launch.
- Add accessibility label and polite live region.

### 5. Improve error-state copy in `SceneStates`
- Add `message` to error state explaining that data could not be loaded and the user can retry.
- Keep retry button but add a secondary "Go back" action when navigation is available.

### 6. Localization
- Add English keys for all new copy; add Russian translations.
- Keep other locales falling back to English.

### 7. Tests
- Add/extend `SceneStates.test.tsx` to cover empty state with icon/message/action and error-state copy.
- Add a test for `ProfileScreen` completion nudge rendering when a field is missing.
- Add a test for `OfflineProfileScreen` first-win banner.
- Ensure total test count grows and stays green.

## Acceptance criteria
- Every profile scene empty state has a clear headline, explanatory copy, and an action or educational guidance.
- `ProfileScreen` shows a completion nudge until all four profile steps are done.
- `OfflineProfileScreen` shows a one-time first-win banner after the first game is recorded.
- Haptic feedback is present on all new CTAs.
- All new copy is localized in en/ru.
- Full test suite passes; no regressions.
