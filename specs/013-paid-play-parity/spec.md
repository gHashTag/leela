# Specification: Paid-play parity

## Problem

The mobile board already stopped after its free allowance, while Telegram chat
rolls and the Telegram-hosted board could continue without one shared access
decision. Stars payments were implemented but explicitly unlocked nothing, so
the bot sold a date instead of the continuation a player expected.

## Contract

- Each player receives three successful moves for free.
- A rejected throw, including a failed entry or an overshoot, consumes no free
  move.
- After three successful moves, a live Telegram Stars entitlement opens both
  `/roll` and `/api/roll` until its expiry.
- The allowance is durable and keyed by player, not chat, browser, or table.
- The mini app reads access from the bot and asks the bot for the same priced
  tiers; it never invents a second balance.
- With no valid configured price, the payment surface is absent and play stays
  open, so an unpayable deployment cannot strand a player.
- Month, half-year, and year prices come only from the owner's environment.

## Acceptance

- Shared access tests cover free, exhausted, entitled, dark, and per-player
  states.
- Bot and HTTP roll paths both use the shared decision and persistent move
  history.
- Telegram Web App subscription handoff is versioned and tested.
- Pages publishes from `main`, the same reviewed line Railway deploys.
- The full repository gate passes before the PR is merged and production logs
  show all three configured tiers and the bot listener.
