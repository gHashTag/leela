# A reachable bot checkout

The owner reports that no invoice appears. Production has a priced Stars offer
and Telegram accepts non-charging invoice-link probes for every current tier.
The offer and paywall only print `/pro <tier>` text, with no selection buttons.
The supported interaction must not require typing a command argument manually.

## Contract

- Every offer entry (bare/unknown `/pro`, exhausted chat move, Mini App subscribe
  handoff and stale purchase action) includes a button for each currently sold
  tier, showing localized duration and the configured Stars price.
- A tier-selection button acknowledges immediately and displays the existing
  explicit Terms acceptance step. Selection alone creates no invoice.
- Only the existing acceptance action issues an invoice. Old typed tier commands
  still work. Invalid/removed tier buttons return the current actionable offer.
- Group purchase details stay private, dark/unpriced behavior unchanged.
- Prices, free moves, financial settlement and entitlements do not change.
- Invoice failures must not be hidden behind a claim of successful checkout.

## Evidence / limits

Production 76865342 on main915da655 is SUCCESS. A safe API probe returned HTTP200
for all three configured tiers (150/700/1200 XTR), no messages or charges.
Fresh logs contain priced startup and no sampled payment/update error entries.
BrowserOS Telegram currently requires QR login; actual user-interface checkout
must not be claimed verified from unit tests or invoice-link acceptance alone.
