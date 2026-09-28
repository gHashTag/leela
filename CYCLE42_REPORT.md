# Cycle 42 / wave 088 — UX-autonomy report

**Date:** 2026-08-08  
**Focus:** end-to-end first-session journey: **onboarding → first game → profile**

## 1. Research

### Weak points found
- **OnboardingScreen** showed 9 static slides with only tiny dots for progress, no swipe/tap navigation, and a plain-text skip affordance.
- **WelcomeScreen** had no value proposition and hid offline mode behind a commented-out button.
- **Hello** presented sign-in and sign-up as two identical primary buttons, making the hierarchy unclear; offline entry used a raw `Button color="transparent"` that looked broken.
- **ResumeLastGame** was already implemented but was never mounted on any entry screen, so returning players could not continue quickly.
- **SelectPlayersScreen** had no context or hint about what the player was choosing.
- **GameScreen** dropped a new user directly onto the board with only a small tooltip; there was no visual invitation to roll for the first time.
- **OfflineProfileScreen** empty state had no CTA to start the first game.

### Competitor patterns applied
- **Duolingo / Headspace / Calm:** lead with value, show clear progress, and keep the first session short.
- **Fabulous:** clear primary/secondary CTA hierarchy.
- **Apple App Store onboarding guide:** teach the core loop one step at a time, allow skip, let the player act rather than read.
- **Lost Cities board-game UX:** contextual rule help instead of a front-loaded manual.

## 2. Plan

Full plan is in `UX_IMPROVEMENT_PLAN_V42.md`. Highlights:
1. Add step counter, tap-to-advance, and haptics to OnboardingScreen.
2. Add value subtitles, a resumed-game card, and a secondary offline CTA to WelcomeScreen and Hello.
3. Mount `ResumeLastGame` on WelcomeScreen, Hello, and SelectPlayersScreen.
4. Add a subtitle/hint and haptics to SelectPlayersScreen.
5. Introduce a `FirstRollCoachMark` on GameScreen for brand-new players.
6. Add a "Play your first game" CTA to the OfflineProfileScreen empty state.
7. Cover changes with new unit tests.

## 3. Implemented

### Screens
- `src/screens/OnboardingScreen/index.tsx`
  - Step counter (`Step X of 9`), accessible dots, tap left/right to navigate, haptic feedback on step change, skip via `ButtonLink`.
- `src/screens/WelcomeScreen/index.tsx`
  - Subtitle, `ResumeLastGame`, restored offline secondary CTA, haptics.
- `src/screens/Authenticator/Hello/index.tsx`
  - Subtitle, `ResumeLastGame`, offline as `ButtonSimple`, haptics, legal/version moved to the bottom.
- `src/screens/SelectPlayersScreen/index.tsx`
  - Subtitle/hint, `ResumeLastGame`, haptic on selection.
- `src/screens/Tabs/OfflineProfileScreen/index.tsx`
  - Empty-state "Play your first game" button with haptic.

### Components
- `src/components/FirstRollCoachMark/index.tsx` (new)
  - AsyncStorage-backed, non-blocking overlay pointing to the dice area with a "Got it" button.
- `src/components/Buttons/ButtonsSelector/index.tsx`
  - Removed duplicated title (now supplied by the screen), added accessibility roles, testIDs.
- `src/components/Buttons/Button/index.tsx`
  - Added `testID` prop forwarding.
- `src/components/Buttons/ButtonSimple/index.tsx`
  - Added `testID` prop forwarding.
- `src/components/Buttons/ButtonLink/index.tsx`
  - Added `testID` prop forwarding.

### Localization
- Added new keys in `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `onboarding.stepCounter`, `progressLabel`, `stepLabel`, `tapToAdvance`, `tapLeftRightHint`
  - `welcome.subtitle`, `welcome.offlineButton`
  - `hello.subtitle`, `hello.offlineButton`
  - `selectPlayersSubtitle`, `selectPlayers.playerCount`
  - `gameCoach.title`, `gameCoach.message`, `gameCoach.gotIt`
  - `offlineProfile.playFirstGame`

### Tests
- `src/screens/OnboardingScreen/OnboardingScreen.test.tsx` (new)
- `src/components/FirstRollCoachMark/FirstRollCoachMark.test.tsx` (new)
- `src/components/Buttons/ButtonsSelector/ButtonsSelector.test.tsx` (new)

## 4. Verification

```text
Test Suites: 72 passed, 72 total
Tests:       284 passed, 284 total
Snapshots:   0 total
Time:        ~27-30 s
```

All new and existing tests pass. ESLint config is currently broken in this environment (`@react-native` shareable config not resolvable), and `tsc --noEmit` reports 403 pre-existing `TS2786` JSX-type errors across the repo. No new non-TS2786 errors were introduced by the changed files.

## 5. Known limitations / next-loop candidates
- Coach mark currently dismisses via "Got it" or app restart; auto-dismiss on first successful roll would require observable roll state, which is not exposed today.
- Onboarding personalization (intent/goals quiz) was researched but out of scope for one loop.
- GameScreen tooltip and coach mark copy is static; future loop could make it conditional on the current rule step.
- No analytics events were added for onboarding/coach-mark funnel tracking.

## 6. Three cooperation options for the next loop

### Option A — Deepen FTUE analytics & personalization
Run an autonomous loop that instruments onboarding and first-game events, then adds a 2-question personalization quiz at the end of onboarding and routes the player to a recommended first intention/AI persona. I will research event taxonomy, implement tracking, build the quiz UI, and update tests.

### Option B — First-session retention nudges
Focus on the 24-hour return window: add a post-win "See you tomorrow" reminder, a streak preview on the empty profile, and a contextual push-permission request after the first completed game. I will research retention patterns, design the nudges, implement them across GameScreen/OfflineProfileScreen, and add tests.

### Option C — Interactive tutorial instead of slideshow
Replace the 9-step static onboarding with a short, interactive "learn by playing" flow: highlight the dice, animate the first six, walk through one snake and one arrow, then drop the player into a real offline game. I will research game-tutorial best practices, create a storyboard/plan, implement the interactive overlay, and cover it with tests.
