# Plan: make the live purchase path reviewable before it charges

1. Add a pure purchase-care module for the published Terms URL, existing
   support destination, confirmation callback encoding, and strict decoding.
2. Extend the priced-only command catalogue with `/terms` and `/paysupport` and
   localized player-facing copy.
3. Replace direct invoice creation from `/pro <tier>` with a private acceptance
   prompt; reuse one invoice sender after a validated callback.
4. Keep commands and new checkout dark in an unpriced deployment. Bind new
   invoices and pre-checkout to v2 consent, reject unpaid v1, and fulfil a
   completed v1/v2 payment from the static tier catalogue independently of the
   current offer.
5. Run RED/GREEN, focused and repository gates, independent review, PR/CI,
   merge, deployment, live sync, logs, and a non-charging Telegram invoice
   probe.
