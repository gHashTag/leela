# 030 — `/start` says the price; the menu stops offering chat play

## Why

The owner asked (2026-10-01) why the app and the bot quote different prices.
Leela quotes one set of prices everywhere: 150 ⭐ / 30 days, 700 ⭐ / 182 days,
1200 ⭐ / 365 days. The bot's `/pro`, the paywall and the mini-app sheet all
read them from `offering(process.env)`. The other numbers players have seen
(282 / 1978 / 19782 ⭐) come from the 2024 donor bot's `/buy`
(`leela-src/leela-chakra-bot/src/commands/buy`). They do not come from this
deployment.

Two real defects remained:

1. **A player found out about the price last.** Play moved to the mini app, so
   a private `/start` is how most players meet the bot. Nothing it said
   mentioned a subscription. The first time a player heard of one was the
   paywall on their fourth move.
2. **The menu sent players to the chat game.** Seventeen entries behind `/`,
   sixteen of them ways to play in the chat. The mini app is where play now
   happens.

And one more found on the way: the invoice said "на 182 дней" because
`pro.description` was a flat `{days} days` and not plural by count.

## What

- In a priced deployment, a private `/start` sends the offer
  (`offerFor`) **first**. It includes the date of a live subscription if the
  player has one. Then comes the usual reply, which still opens the private
  room, because the mini app's `/api/game` needs one.
- A dark deployment says no price. A group `/start` says no price either: a
  price is between the bot and one player.
- `BOT_COMMANDS` is `/start` and `/help`. `PAID_COMMANDS` (`/pro`, `/terms`,
  `/paysupport`) are added where a price is named. Every chat command is
  still answered and still named in `/help`, so group tables keep working.
- The menu descriptions for the dropped commands are deleted. `menu.board`
  stays: it is the line above the mini-app button.
- `pro.description` is plural by count, like `pro.tier`.

## Not in scope

- Prices themselves. They are unchanged.
- The bot's BotFather description text. It lives outside this repository and
  is a deployment step (see `progress.md`).

## Checks

- `apps/bot/tests/start-says-the-price.test.ts`: a priced private `/start` must
  open with the offer in every translated language, for a new player and for a
  subscriber. Dark and group `/start` must say no price. Shown to fail with the
  `bot.ts` change reverted.
- `apps/bot/tests/menu.test.ts`: the standing menu is `start` and `help`. Every
  answered command must be reachable through the menu or `/help`.
- `apps/bot/tests/what-a-payment-buys.test.ts`: for every count from 1 to 400
  and every translated language, the word after the count is the same in the
  invoice description and in the price list.
