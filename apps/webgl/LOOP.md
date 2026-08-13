# The improvement loop for `apps/webgl`

A cron fires every fifteen minutes and starts a session that has none of the
context this one had. This file is that context. **Read it first, and write to
it last** — an iteration that improves the board and does not record what it did
is an iteration the next one repeats or undoes.

## The standing contract

Every iteration, in this order:

1. **Read this file, then `git status --short`.** Other sessions work in this
   tree. Uncommitted files you did not write are not yours.
2. **Green before, green after.** From `apps/webgl`:
   ```
   npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p tsconfig.src.json
   ```
   and from the root, `node scripts/audit-unread.mjs` and
   `node scripts/audit-configs.mjs`. If any of them is red *before* you change
   anything, that is the iteration's work: fix it, record it, stop.
3. **Look at it.** `bun run --cwd apps/webgl dev`, open it, take a screenshot.
   Three defects in this app were found this way that no test would have caught —
   a blank page, an arrow that flew off the board, and a token that resolved into
   confetti. A change to the board that has not been looked at is not done.
4. **One change per iteration.** Fifteen minutes is not a refactor.
5. **Never** `git add -A` — this tree carries other sessions' uncommitted work.
   Stage named paths under `apps/webgl` only. Never push. Never `main`.
6. **Append to the log below** with the date, what changed, and what it cost.

## What must not regress

Each of these was a defect that shipped. A test now holds it; if you find
yourself deleting one of these tests, you are re-introducing the defect.

| Invariant | Held by |
| --- | --- |
| Drawing a frame from inside a frame does not recurse | `tests/frames.test.ts` |
| The board renders at all on first paint | looking at it |
| Tile *n* of the atlas carries plan *n*'s number | `tests/atlas.test.ts` |
| Waiting to enter is not confused with having won | `tests/screen.test.ts` |
| Progress is measured against 68, not 72 | `tests/screen.test.ts` |
| A snake is thickest at the head it is entered by | `tests/screen.test.ts` |
| Every deity offered is named in the 72 texts | `tests/screen.test.ts` |
| A model's words are never rendered as the canon's | `tests/screen.test.ts` |
| An unthrown die shows no face | `tests/screen.test.ts` |
| A six says so | `audit-unread`, via `rollsAgain` |

## Known open work, roughly in value order

- [ ] **The companion has no model.** `src/companion.ts` takes an `Ask` and is
      given none, so every answer is the fallback. Wiring one needs an endpoint
      that holds the key — the browser must never hold it. Until then the
      offline path is the product, and it is honest about it.
- [ ] **The deity row sits between the throw and the conversation**, which is
      prime space for a choice most players make once. Collapsing it into the
      header after the first throw is the obvious move; it has not been made
      because the row is also the feature, and hiding a feature to save
      forty pixels is how features stop being used.
- [ ] **Nothing is remembered but the deity.** Reload and the game restarts. The
      mini app persists a whole session; `packages/journal` is the shape.
- [ ] **The sheet's drag is not keyboard-reachable** beyond the handle's step.
- [ ] **`planAt` ignores the labels mesh**, so a tap that lands exactly on a
      digit still hits the cell underneath. Verify this is true rather than
      assuming it.
- [ ] **No haptics, no sound.**
- [ ] **The 72 texts are not searchable** from this surface; the mini app has
      `app.plans` for exactly that.
- [ ] **`apps/mobile` cannot use any of this yet.** The scene is DOM-free apart
      from the renderer's canvas and `domSurface`; `expo-gl` is the route.

## Log

### 2026-08-13 — the first pass

The app existed, was untracked, and had never run: `OrbitControls.update()`
dispatches `change`, the `change` listener called `update()`, and the first
`resize()` on boot overflowed the stack before a frame reached the canvas. Both
test files passed the whole time because neither touches WebGL.

Done: the recursion (`src/frames.ts`, with the test); a broken `@media` in the
page; plan numbers on every square (`src/atlas.ts`); snakes that taper from head
to tail and arrows with heads and fletching (`src/tube.ts`); eight deity tokens
grounded in the texts (`src/deities.ts`); the one-screen layout with a
three-detent sheet (`src/sheet.ts`, `src/style.css`); the companion
(`src/companion.ts`); `describeMove` instead of nine hand-written English
sentences; camera framing by projection instead of trigonometry; the app wired
into CI and the Dockerfile; `tsconfig.src.json`.

Cost: 87 tests where there were 34. Two defects found only by looking — a
highlighted arrow scaled about the world origin and flew off the board, and the
first token design resolved into confetti at board scale.

Three more found by the gates rather than by looking, all of them mine:

- `audit-unread` reported `rollsAgain` as a field written and never read.
  Rewriting `main.ts` for the one-screen layout had dropped the sentence that
  tells a player a six earns another throw. Restored from `roll.again`, which
  the catalogue already carried in English and Russian.
- `runnable.test.ts` reported this very file as a document naming commands
  nobody audits. Adding it to `DOCS` in `audit-scripts.mjs` took **three**
  attempts: the test parses that list back out of the source rather than keeping
  a copy, and the comment explaining the addition broke the parse twice — first
  an apostrophe in *board's*, which paired with the next real quote and swallowed
  the entry after it, then the `]` inside a regex the replacement comment quoted,
  which truncated the list before reaching it. The explanation is now above the
  brackets, where it parses as nothing.
- The full-repo run showed eleven failures across `miniapp`, `content` and
  `engine`. Every one of them passed in isolation: they are timeouts from twelve
  workspaces competing for the same cores. Only the `runnable` failure was real.
  **A red suite under load is not a red suite.** Re-run the named file before
  believing it.

Then, from looking at the two viewports that had never been looked at: the
winning square was filled with the mini app's `--win`, which is measured as a
*text* colour and made the end of the game the darkest thing on a light board;
and on a desktop the sheet becomes a side panel while `resize` still framed the
board against a *bottom* inset, leaving it in a strip across the top with half
the window empty beside it. `resize` now takes both edges.
