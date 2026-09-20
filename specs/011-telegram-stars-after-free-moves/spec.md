# Specification: Telegram Stars after the free moves

## Problem

The linked Telegram board and `/roll` currently remain free even when the Stars
rail is configured. The WebGL toll recognises only the native mobile host, and
the server never asks the entitlement store before accepting a Telegram roll.
That makes the bot, the Mini App, and the mobile experience disagree.

## User stories

1. A seated Telegram player receives three **actual movements** at a table for
   free. A refused entry throw, an overshoot, or another throw that leaves the
   piece where it was does not spend the allowance.
2. The allowance is per Telegram player, not per table and not per browser
   installation. Reopening the Mini App or changing between `/roll` and the
   Mini App cannot reset or bypass it.
3. After the allowance is spent, both `/roll` and the Mini App refuse an
   otherwise-valid roll unless the player has a live Stars entitlement.
4. Existing game requirements keep priority: a missing intention, a required
   report, another player's turn, a cooldown, and completed play are reported
   before a payment request. The payment gate changes no engine rule.
5. Intention, reports, path/history, plan reading, and the companion remain
   available. Only further valid rolls are gated.
6. When at least one Stars tier is configured, the Mini App shows every priced
   tier and opens Telegram's native invoice. A recorded `successful_payment`
   unlocks play; closing an invoice without payment does not.
7. A refunded payment no longer grants access, under the entitlement store's
   existing refund semantics.
8. When no valid Stars tier is configured, no payment gate is armed. The game
   stays playable rather than stopping at a screen nobody can pay through.
9. The Telegram paywall follows the mobile purchase flow: it opens as a
   dedicated dismissible screen, preselects the shortest available commitment,
   presents plans as one radio group, and has one primary purchase action plus
   a plain explanation of why it appeared.
10. Mobile and Telegram use the same product language where it is true on both
    surfaces: the free allowance, continued play, and no advertising. Telegram
    states its own material difference plainly — Stars access is a one-off
    number of days, not an auto-renewing App Store subscription.
11. The shipped Telegram service has a complete default catalogue: 150 Stars
    for 30 days, 700 Stars for 182 days, and 1200 Stars for 365 days. These
    defaults are public product configuration, not secrets, and a deployment
    may deliberately override any of them through the existing variables.

## Security and trust

- The server validates Telegram `initData`, table membership, tier id, price,
  and entitlement. Browser state is never proof of payment.
- Invoice payloads and prices use the existing single-source Stars offering.
- The room remains the authoritative game record. Free usage is derived by
  deterministic replay of that record rather than a client counter.
- A payment callback is only a prompt to refresh. Access comes from the
  entitlement written after Telegram's `successful_payment` update.

## Non-goals

- No conversion of Stars into a displayed fiat promise. Storefront exchange
  rates and proceeds vary; the Telegram invoice names the exact Stars amount.
- No Apple, Google, card, or cryptocurrency checkout inside Telegram; digital
  access in Telegram uses Stars (`XTR`).
- No recurring charge, engine `RuleSet` change, deployment, secret edit,
  commit, push, or production publication.

## Source evidence

- Telegram requires Stars for digital goods and services sold inside Telegram:
  <https://core.telegram.org/bots/payments-stars>
- Telegram Mini Apps open an invoice with `WebApp.openInvoice`, whose callback
  reports `paid`, `cancelled`, `failed`, or `pending`:
  <https://core.telegram.org/bots/webapps#initializing-mini-apps>
- `createInvoiceLink` creates the URL; Stars use currency `XTR` and an empty
  provider token:
  <https://core.telegram.org/bots/api#createinvoicelink>
- The mobile donor was read from `/Users/playra/leela-src/leela`: it supplies
  entitlement to WebGL through `window.__leelaPro` and opens its native paywall.
  Store prices are supplied dynamically, so it contains no authoritative Stars
  price to copy. The owner therefore delegated the Telegram catalogue choice;
  its three terms mirror the donor while its discounts are explicit.

## Acceptance criteria

- Tests exhaustively replay room history to count actual movements per seat.
- The fourth valid movement is refused for an unpaid player when prices exist.
- An entitled player can continue; another seat's use does not consume theirs.
- Failed/non-moving throws do not consume a free move.
- `/roll` and `/api/game` enforce the same pure access decision.
- The Mini App parses access state, presents configured tiers, requests an
  invoice, opens it through Telegram, and refreshes after payment.
- With a null offering, both transports remain free and expose no dead checkout.
- The Railway image supplies all three default prices and a test proves that
  they parse into the complete 150/700/1200 Stars catalogue.
- Full repository verification, audits, strict typechecks, and a production
  WebGL build pass.
