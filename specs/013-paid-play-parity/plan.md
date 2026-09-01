# Plan

1. Put the free-move count and subscription request protocol in shared content.
2. Count successful moves in memory and SQLite, and define one access decision.
3. Gate both Telegram `/roll` and mini-app `/api/roll` with that decision.
4. Carry server-authoritative access into the board and return subscription
   requests to the bot's Stars offers.
5. Align copy, documentation, and Pages deployment with the implemented sale.
6. Test, merge through a PR, configure all three prices, deploy, and verify the
   live listener and payment rail.
