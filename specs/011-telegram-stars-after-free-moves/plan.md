# Plan

## Architecture

1. Put the three-move allowance in the dependency-free journal package already
   shared by the bot and WebGL.
2. Extract deterministic room replay into one bot module. Use it for the public
   snapshot and per-seat actual-movement counts.
3. Add a pure access decision joining room history, the configured Stars
   offering, and `EntitlementStore.subscribed`.
4. Enforce that decision at both server doors. Run the pure roll command first
   so game-rule refusals retain priority; discard only an otherwise-valid move
   when payment is due.
5. Extend `/api/game` with authenticated access state and an invoice action
   backed by Telegram `createInvoiceLink` and the existing invoice assembler.
6. Extend the WebGL shared protocol and Telegram bridge, render tier buttons,
   call `openInvoice`, then refresh access with bounded retries.
7. Rewrite payment copy and operator documentation to describe the product that
   is actually enforced.
8. Mirror the donor mobile paywall's interaction model: a dedicated screen,
   shortest tier preselected, radio choices, one purchase CTA, benefits, a
   why-this-appeared explanation, and a visible way back to the board.
9. Put the owner-approved 150/700/1200 Stars catalogue in the Railway image as
   overridable public configuration, and test the actual container source.

## Failure policy

- No valid price: access is open and no invoice is offered.
- Invoice creation failure: keep the board locked, show a recoverable error,
  and change no entitlement.
- Paid callback before payment persistence: bounded refresh; the next ordinary
  read remains recoverable.
- Store or room write failure: keep the existing loud, non-partial behaviour.

## Verification

- Pure access/replay tests, bot transport tests, route/invoice tests, shared
  protocol tests, and Telegram invoice bridge tests.
- The repository's complete verification gate.
- The unread-export and strict-configuration audits.
- A production WebGL build and local HTTP smoke check.
