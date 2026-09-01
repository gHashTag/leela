# Plan

Three areas, no shared files, one worktree (`tma-3d-board` off `unified`).

## A. The route (apps/bot)

`src/serve.ts` — `Bun.serve` on `$PORT` (Railway injects it), started from
`index.ts` beside the supervisor. One POST route, `/api/ask`:

- Body `{system, question}` — the exact shape `apps/webgl/src/ask.ts` sends.
- Streams SSE frames in the exact shape its parser reads (read the parser
  first; mirror it, then pin it with a test that feeds the frames to a fake
  reader).
- The model call goes through `packages/ai` (the bot already configures
  zai:glm-4.6 from env) — no second provider stack.
- CORS: allow `https://t27.ai` and localhost dev origins; answer OPTIONS.
- Refusals are JSON `{error}` with a non-2xx status — the client reads
  `error` from the body.
- Bounds: cap `system` + `question` sizes; one in-flight answer per IP at a
  time is not attempted (no auth surface today, rate limit crudely by IP,
  documented as crude).

## B. The board as a guest (apps/webgl)

- `src/telegram.ts`: if `window.Telegram?.WebApp` exists — `ready()`,
  `expand()`, map theme; else do nothing. No SDK dependency; the object is
  injected by Telegram's webview.
- Ask origin: `index.html` (or entry) sets `window.__leelaAsk` from
  `import.meta.env.VITE_ASK_ORIGIN` when defined — the mechanism `askUrl()`
  documents for hosts.
- Tests for both: theme mapping pure-function; `__leelaAsk` set/unset.

## C. Shipping (.github/workflows/pages.yml, smoke)

- Build `apps/webgl` with `VITE_ASK_ORIGIN=https://leela-production-e9a0.up.railway.app`
  into the artifact root; build the 2D app into `classic/`; docs keep their
  path under the artifact.
- `paths:` gains `apps/webgl/**`.
- smoke-run checks gain: the 3D page HTML, its entry script, `classic/`
  reachable.

## Order

A, B, C in parallel (no file overlap) → gates in each package → root audits →
local look → commit (named paths) → push `unified` (Pages deploys) →
`railway up` (route goes live) → live smoke + a played move + an answered
question in the deployed page.
