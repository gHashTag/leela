# Stars checkout that names its terms and support

The live Telegram Stars rail can render and complete an invoice, but a player
cannot ask the bot for the terms that govern the purchase or for payment
support. A tier command also opens the invoice immediately, without the player
explicitly confirming that they read and accept those terms.

Telegram's live checklist requires an easy `/terms` path, a clear support path,
an explicit pre-purchase acceptance of the terms, and `/paysupport` for payment
disputes. It also says that Telegram support cannot resolve purchases made
through a merchant bot.

Primary source: <https://core.telegram.org/bots/payments-stars>.

## Existing sources, not new policy

- The repository's published Terms of Use are generated at
  `https://t27.ai/leela/docs/{language}/legal/eula.html`.
- Russian has its own document; every other bot language receives the English
  legal text, matching the docs application's declared fallback.
- The existing Terms and Privacy Policy name `raoffonom@icloud.com` as the
  contact address. This wave exposes that recorded destination; it does not
  invent a new legal promise, refund SLA, or support channel.

## Observable contract

- A priced deployment publishes and answers `/terms` and `/paysupport` beside
  `/pro`; an unpriced deployment exposes none of the three.
- `/terms` answers privately with the published Terms URL in the player's
  supported language and tells the player to continue only if they agree.
- `/paysupport` answers privately with the existing contact address, asks for
  the purchase date and tier, and states that Telegram support cannot resolve a
  purchase made through this bot.
- The bare `/pro` offer makes both commands discoverable.
- `/pro <tier>` sends no invoice. It sends a private, localized confirmation
  carrying the Terms URL and one inline action that explicitly says the player
  has read and accepts the Terms.
- Only that action may call `sendInvoice`. It resolves the tier against the
  currently configured offer again, so an old or forged action cannot buy a
  missing tier.
- The callback query is answered before invoice work, so Telegram does not
  leave a spinner while a network call runs.
- An invoice accepted by Telegram still records the existing `invoice`
  milestone exactly once. New invoices carry a consent-bound `v2` payload;
  pre-checkout refuses unpaid `v1` invoices. A `successful_payment` already
  completed by Telegram for either v1 or v2 is fulfilled from the static tier
  catalogue even if the current offer removed that tier or all prices. Prices,
  entitlement storage, refund behavior, and the three-free-move rule do not
  otherwise change.
- Group requests keep purchase details private: the confirmation and invoice go
  to the player, never to the table.

## Acceptance

- A deterministic test first fails because `/pro <tier>` sends an invoice
  without acceptance and `/terms` and `/paysupport` are unknown.
- Tests cover every configured tier, English and Russian responses, the priced
  and unpriced command surfaces, direct and group purchase requests, invalid
  confirmation actions, invoice attribution, and callback ordering.
- Focused bot tests, normal and strict typechecks, the full repository gate,
  explicit audits, independent review, PR checks, merge, Railway deployment,
  and live probes pass.
- Production is driven through the agreement action until Telegram renders the
  invoice. No final Stars confirmation is performed by the agent.

## Non-goals

- No new price, duration, free-move count, refund authority, legal text, support
  SLA, game rule, language strategy, or public announcement.
- No production charge or synthetic `successful_payment`.
