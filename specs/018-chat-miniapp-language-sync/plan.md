# Plan: repair the production chat bridge

1. Add RED route tests for a signed no-origin `GET /api/game`, continued
   rejection of unsafe no-origin/foreign requests, and room language output.
2. Add RED WebGL tests for closed failure reason codes and canonical chat-game
   language selection.
3. Permit only no-origin GET game reads, after which the existing Telegram
   signature guard remains the authority.
4. Carry the room language in `Standing`; align the adopted board before game
   state is installed, with a one-time deterministic reload guard.
5. Render all transport failures through catalogue keys and keep raw status or
   provider prose out of player-visible text.
6. Run focused, package, repository, audit, independent-review, PR, deploy, and
   live runtime gates in that order.

