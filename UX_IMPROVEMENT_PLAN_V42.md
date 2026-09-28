# UX Improvement Plan V42 — wave 088

## Goal
Polish the end-to-end first-session journey: **onboarding → first game → profile**, removing drop-off points from the moment the app opens until the player reaches their profile after the first win.

## Weak points found

1. **Onboarding is a passive slideshow.** 9 static steps, no visible progress beyond tiny dots, no swipe, no haptic feedback, no clear skip affordance.
2. **WelcomeScreen has no value proposition.** Only an "online" button is visible; offline mode is hidden and the screen feels empty.
3. **Hello screen overloads equal-looking CTAs.** Sign-in and sign-up are two identical primary buttons; offline mode is a raw `Button` with `color="transparent"` and looks accidental.
4. **Resume-last-game card exists but is never shown.** `<ResumeLastGame />` is exported but not mounted on any of the three entry screens (WelcomeScreen, Hello, SelectPlayersScreen), so returning users cannot continue quickly.
5. **SelectPlayersScreen lacks context.** The title says "Select the number of players" but there is no hint about what happens next or that this is an offline, same-device setup.
6. **First roll lacks guidance.** A new player lands on GameScreen, sees a board, a dice and a tooltip, but nothing visually invites the first tap or explains the win condition in the first session.
7. **Empty public/offline profiles lack a next step.** After the first offline win the profile shows an empty history message but no CTA to play again or share the win.

## Competitor patterns applied

- **Duolingo / Headspace / Calm:** lead with the core value action; show clear progress; keep the first session short and personalized.
- **Fabulous:** use smart defaults and a clear primary/secondary CTA hierarchy.
- **Apple App Store onboarding guide:** teach the core loop one step at a time, allow skip, let the player act rather than read.
- **Lost Cities board-game UX:** offer flexible, contextual rule help instead of a front-loaded manual.

## Decomposed plan

### 1. OnboardingScreen: progress + interaction
- Add an accessible step counter: `"Step 1 of 9"`.
- Add left/right tap zones (or pan gesture) to move between steps in addition to the Next button.
- Trigger light haptic feedback on every step change.
- Promote the skip action to a visible `ButtonLink` under the main CTA.
- Keep dots but make them accessible with `accessibilityRole="tablist"`.

### 2. WelcomeScreen: value prop + quick resume + offline entry
- Add a subtitle explaining Leela in one sentence.
- Add `<ResumeLastGame onResume={…} />` above the primary CTA when a saved game exists.
- Restore the offline button as a **secondary** action.
- Add haptic feedback on both CTAs.

### 3. Hello screen: hierarchy + quick resume
- Add a subtitle: "Sign in to save progress, or play offline".
- Add `<ResumeLastGame onResume={…} />` for returning players.
- Make offline mode a `ButtonLink`/outlined secondary action instead of a raw `Button`.
- Add haptic feedback.

### 4. SelectPlayersScreen: context + resume
- Add a subtitle/hint: "Choose how many human players share this device".
- Add `<ResumeLastGame onResume={…} />` at the top.
- Add haptic feedback when a player count is selected.
- Keep the Start button primary.

### 5. GameScreen: first-roll coach mark
- Track whether the coach mark was shown using `AsyncStorage` key `@leela:firstRollCoachShown`.
- On the first offline or online game, show a non-blocking coach mark pointing at the dice area: "Tap the dice to roll. A six places your piece on the board."
- Provide a "Got it" button that dismisses the coach mark and sets the flag.
- Auto-dismiss after the first successful roll.
- Add haptic feedback when the coach mark appears.

### 6. OfflineProfileScreen: empty-state next step
- In the empty history state, add a secondary "Play your first game" button that navigates to `SELECT_PLAYERS_SCREEN`.
- Add haptic feedback on the empty-state CTA.

### 7. Localization
- Add new English keys for all new copy; add Russian translations where missing.
- Keep other locales falling back to English by not introducing required new keys without fallback.

### 8. Tests
- Update `OnboardingScreen` tests to assert the step counter and skip affordance.
- Add tests for `WelcomeScreen`, `Hello`, and `SelectPlayersScreen` mounting `ResumeLastGame` correctly.
- Add a test for the `GameScreen` coach mark rendering on first launch and dismissing after interaction.
- Ensure existing test count grows and stays green.

## Acceptance criteria
- Onboarding shows clear progress and can be swiped/tapped through.
- Resume card appears on WelcomeScreen/Hello/SelectPlayersScreen when a game is in progress.
- Offline mode is a consistent secondary CTA on WelcomeScreen and Hello.
- GameScreen shows a coach mark for brand-new users and hides it after the first roll.
- All new screens have accessible labels and haptic feedback.
- Full test suite passes; no regressions.
