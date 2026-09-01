# Plan: repaint the adopted game atomically

1. Add source-contract and behavioral tests over the successful adoption block
   and companion lifecycle that require every existing renderer responsible
   for player-visible state and invalidate late work from a replaced game.
2. Run it against the production source and record the expected RED omissions.
3. After replacing the in-memory session, clear transient local move state,
   reset and re-seed the companion from the adopted plan, and invoke the
   existing standing, die, thread, path, plan, gate, and board renderers.
4. Preserve the previous adoption guards, language convergence, local storage,
   and server-authoritative access state; import access only when adoption is
   accepted and repaint progress for both visible and assistive UI.
5. Run focused, package, repository, audit, independent-review, PR, deployment,
   and signed production gates in that order.
