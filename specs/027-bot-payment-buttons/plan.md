# Plan

Reuse the existing private delivery and consent-bound invoice sender. Add one
localized tier button factory and a selection callback before the generic action
handler. Refactor the existing Terms prompt into one helper for typed and tapped
selection. Preserve the acceptance and financial validation code.

RED/GREEN tests exercise every priced subset, language, button and consent step,
plus chat paywall/Mini App handoff and stale buttons. Run the full repository
gate and root audits; independent review; PR checks/merge; inspect deployment;
non-charging probes and deployed routing canary. No real charge, no synthetic
successful_payment on production, no public/group messages or price changes.
