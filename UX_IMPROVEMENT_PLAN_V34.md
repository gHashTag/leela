# UX Improvement Plan V34

**Cycle:** 29  
**Date:** 2026-08-08  
**Theme:** Apply the icon/value/haptics pattern to game setup and offline resume cards

## 1. Weak spots

- The offline resume card (`SelectPlayersScreen`, `WelcomeScreen`, `Hello`) already shows a die emoji and a few lines of text, but it does not surface the most important state at a glance:
  - whose turn it is,
  - how many players remain active,
  - the current plane number.
- The card buttons (`Resume`, `New game`) give no tactile feedback and no toast confirmation when the user abandons the saved game.
- `WelcomeScreen` and `Hello` duplicate the resume-card layout inline; there is no shared component, so the same UX improvements must be applied in three places.
- `SelectPlayersScreen` uses `ButtonSimple` for both primary and secondary actions, making the primary "Resume" button visually weaker than it should be.
- There is no empty-state cue for users who have no saved offline game; the screen just jumps straight to player selection without context.

## 2. Competitors / patterns

- **Chess.com / Lichess**: the "Continue playing" tile shows the board thumbnail, opponent name, and whose turn it is — the most relevant facts first.
- **Headspace / Calm**: resume tiles use a clear icon, a one-line status label, and a large primary CTA.
- **Apple HIG (Pick up where you left off)**: put the resume action above the "start new" action; use a secondary style for destructive/abandon actions.
- **Duolingo**: lesson resume cards show progress ("Level 3 · 45%") as a value label, matching the pattern we introduced in `SettingsScene`.

## 3. Decomposed plan

1. **Create a shared `OfflineResumeCard` component** (`src/components/OfflineResumeCard/index.tsx`):
   - Accept `players`, `currentPlayer`, `currentPlan`, and callbacks `onResume` / `onNewGame`.
   - Render a leading die icon, the title, and a compact status row with:
     - "Player N of M" value label,
     - "Plane N" value label,
     - "Saved" / "In progress" badge.
   - Use `Button` for the primary "Resume" action and a text link for "Start new game".
   - Call `haptics.impactLight` on card button press, `haptics.confirm` on resume, and `haptics.error` (or a softer impact) on abandon.
   - Emit `notify.toast` confirmations after resume/new-game actions.

2. **Extract and reuse in `SelectPlayersScreen`**:
   - Replace the inline resume card with `<OfflineResumeCard ... />`.
   - Keep the player selector below the card.

3. **Extract and reuse in `WelcomeScreen` and `Hello`**:
   - Replace both inline resume blocks with the shared component.
   - Keep onboarding resume card separate (different icon/content).

4. **Add `onChange`/`onChangePlayers` callbacks to `ButtonsSelector`** (or wrap it):
   - When a player count is selected, `clearOfflineGame` is already called; add a toast and haptic to confirm "New game started".
   - If a saved game exists, show a small hint above the selector explaining that choosing a count will start a fresh game.

5. **Add locale keys to all 10 locales** (translate en/ru/fr, fall back to en for others):
   - `offlineResume.statusLabel` — "Player {{current}} of {{players}}"
   - `offlineResume.savedLabel` — "Saved game"
   - `offlineResume.resumed` — "Game resumed"
   - `offlineResume.abandoned` — "Saved game cleared"
   - `offlineResume.newGameHint` — "Choosing a player count below will start a fresh offline game."

6. **Add tests**:
   - `src/components/OfflineResumeCard/index.test.tsx` for icon, value labels, haptics, and toasts.
   - Extend existing `SelectPlayersScreen`, `WelcomeScreen`, and `Hello` tests to assert the shared component renders and its callbacks propagate.

7. **Run the full Jest suite and ensure it stays green**.

## 4. Success metrics

- A single `OfflineResumeCard` component is used on all three screens.
- The card shows player turn and plane number as value labels.
- Resume / new-game actions trigger haptics and confirmation toasts.
- Player-count selection in `SelectPlayersScreen` gives haptic + toast feedback.
- Jest suite stays green and coverage is added for the new component.
