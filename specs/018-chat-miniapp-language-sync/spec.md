# One chat game, one reachable board, one language

The production report on 2026-09-01 is exact: a Russian Mini App says
`Чат недоступен (the bot answered 403)` while the Telegram bot and board are
supposed to be one game. The companion then appears silent because the board
has fallen back to its own state instead of adopting the signed chat game.

## Root cause

- `GET /api/game` rejects every request without an `Origin` header. Browsers
  normally omit `Origin` on same-origin GET/HEAD requests, so the production
  Mini App is refused before Telegram signature verification.
- The client turns HTTP/network failures into English prose and interpolates
  that implementation detail into an otherwise localized sentence.
- The signed game response carries the state but not the room's language, so
  the board cannot make the Telegram game's language authoritative after it
  adopts that game.

## Observable contract

- A same-origin browser GET for `/api/game` may omit `Origin`. The route reaches
  Telegram signature verification and returns that verified player's game.
- An explicit foreign or opaque origin remains 403. `/api/ask`, `/api/roll`,
  and `/api/reports` continue to require an allowed origin; no-origin POSTs
  remain refused.
- `/api/game` returns the room language with the same player-minimal standing.
- When a signed Telegram game is adopted, its supported interface language is
  used by the Mini App. A different saved browser preference cannot leave chat
  and board speaking different supported languages.
- Failure state crosses the client boundary as a closed reason code, never
  English diagnostic prose. Every player-visible failure sentence comes from
  the message catalogue in the board language.
- The companion `/api/ask` remains reachable from production, streams a
  non-empty answer, and does not expose provider details to the player.

## Security and privacy boundaries

- The no-origin exception is GET `/api/game` only and still requires fresh,
  valid Telegram `initData` signed by the configured bot token. It grants no
  state change and no unauthenticated model access.
- An explicit disallowed `Origin`, including `null`, never receives the game or
  CORS permission headers.
- No bot token, signed launch, Telegram id, message, intention, report, or model
  output is added to logs or fixtures.
- The response remains player-minimal: no room id, other seat, name, or report.

## Acceptance

- Deterministic tests first reproduce the no-origin 403, the missing room
  language, and the English diagnostic inside a Russian sentence.
- Focused tests prove the narrow GET exception, unchanged POST/origin guards,
  typed failures, and deterministic language alignment without a reload loop.
- Bot and WebGL typechecks and suites pass, followed by `bun run verify`, the
  explicit unread/config audits, independent diff review, PR checks, merge,
  Railway deploy, public route/companion probes, and deployment-log evidence.

