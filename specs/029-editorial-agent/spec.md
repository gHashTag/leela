# Leela editorial agent

## User request

Configure @leela_chakra_ai_bot for @playom as administrator, connect an agent,
write a detailed game-grounded SOUL.md, prepare a content plan, investigate
999 integration and create reusable skills. Content goes to private drafts,
never automatic public posts. The latest request excludes direct database
lookup to discover identity.

## Authority and privacy

An intended username is not an administrator ID. Accept a claim only from a
Telegram private message whose actual sender is the intended username; save
the numeric sender ID and require a separate trusted owner's explicit approval.
No username-only grant, no caller-supplied subject ID, no financial permissions.
Persist grants and pending claims on the existing durable volume. Missing
durability or trusted owners disables privilege changes, not the existing game.

Editorial administrators can read the Leela editorial kit, obtain content plans,
ask the existing configured model for private drafts and inspect integration
status. They cannot refund, alter pricing, read player journals, publish,
change bot ownership or acquire global 999 administration.

## Agent and sources

The existing engine is authoritative for game rules; the existing content
catalogue supplies plan titles and teachings. SOUL.md and skills are actually
read by the editorial runtime, not merely committed as unused documentation.
The existing game companion and payment/state paths remain unchanged.

The default 30-slot plan is an unscheduled editorial proposal. Sending a draft
is a response to the administrator's private command. No cron or unsolicited
messages are enabled in this change.

## 999 boundary

The shared Trinity SOUL and another person's personal SOUL must not be replaced.
Any bridge must prove the 999 key's bound identity matches the approved Leela
administrator. An absent or mismatched credential is an explicit unavailable
integration, never a fallback to an owner's account.
Expose only a bounded allowlist of non-publishing operations required for the
Leela editorial workflow. No arbitrary tool execution or incoming user URL.
Credentials stay in protected server configuration; do not request them in chat.

## Acceptance

- A username claim alone cannot grant access; owner approval binds the actual ID.
- Non-private requests, unauthorized users, stale claims and revoked grants fail.
- Drafts use the actual kit and public canon, with no player data or payment tools.
- Runtime assets are present in the deployed image.
- Retries, timeouts and malformed provider replies are recoverable.
- Test with network doubles only; report separate code, deployment, identity
  binding and cross-service activation states.
