# UX Improvement Plan V28

**Cycle:** 23  
**Date:** 2026-08-08  
**Theme:** Contextual game-rule tooltips for new players

## 1. Weak spots

- `FirstRollHelper` only tells new players to "tap the dice"; it does not explain that a **six** is required to enter the game, how **arrows** and **snakes** work, or that the goal is **plane 68**.
- New players who dismiss the helper have no way to see rule hints again without restarting the app or leaving the game screen.
- The onboarding screen already explains rules, but it is not visible during the first game; users forget the rules while playing.
- There is no contextual prompt explaining why the piece did not move after a non-six first roll.
- There is no tooltip guiding the user to write a **report** after landing on a plane.
- Rule-related strings are only in the long `rulesOfPlay.content` paragraph, not reusable as short tooltips.

## 2. Competitors / patterns

- **Chess.com / Lichess**: move the piece first, then show a short "Why" tooltip; first games use coach marks on specific squares.
- **Monopoly GO**: contextual floating tips appear when the user lands on a special tile the first time, not as a wall of text.
- **Apple Arcade onboarding**: tips are shown in small bottom cards with a "Don't show again" and "Tell me more" action.
- **Streaks / Fabulous**: habit apps use a progressive disclosure pattern — one rule per turn, not all at once.

## 3. Decomposed plan

1. Create a reusable `GameTooltip` component (`src/components/GameTooltip/index.tsx`) for small bottom cards with title, body, dismiss, and optional "Tell me more" link.
2. Create `src/utils/gameTooltipState.ts` to track which tips the user has seen using AsyncStorage keys (`@gameTipNeedSix`, `@gameTipArrows`, `@gameTipSnakes`, `@gameTipReport`).
3. Add short rule tooltip strings to all 10 locales:
   - `gameTooltip.needSixTitle/Body`;
   - `gameTooltip.arrowTitle/Body`;
   - `gameTooltip.snakeTitle/Body`;
   - `gameTooltip.reportTitle/Body`;
   - `gameTooltip.gotIt`, `gameTooltip.learnMore`.
4. Extend `GameScreen` to observe game state and trigger tooltips:
   - Need-six tip after the first non-six roll before entering the game;
   - Arrow tip after landing on a plane at the foot of an arrow;
   - Snake tip after landing on the head of a snake;
   - Report tip after landing on a new plane and not having opened the report modal.
5. Ensure tooltips do not stack: only one visible at a time; use a queue or priority.
6. Add a "Don't show tips again" option that marks all as seen.
7. Add tests:
   - `src/utils/gameTooltipState.test.ts`;
   - `src/components/GameTooltip/GameTooltip.test.tsx`;
   - extend `GameScreen` tests where feasible by checking tooltip visibility based on mocked store state.
8. Run full Jest suite.

## 4. Success metrics

- Jest suite stays green.
- Each of the four rule tooltips appears exactly once for a new player under the right condition.
- Tooltips are dismissible and link to `RULES_SCREEN` when the user taps "Learn more".
