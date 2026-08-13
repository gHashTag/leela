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
| A turn always finishes, even with `rAF` paused | the backstop in `walk` |
| A saved game the engine refuses is never played | `tests/kept.test.ts` |
| A refused game does not cost you your deity | `tests/kept.test.ts` |
| No square is filled with a jump's colour | the published painting, `board-light.webp` |

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
- [ ] **No haptics, no sound.**
- [ ] **`app.gameNotRead` promises accounts this surface does not have.** Its
      first half is exactly right for a refused save; the trailing clause is
      about the mini app's journals. Wants a key of its own in
      `packages/content`, not a string invented here.
- [ ] **The snakes have no skin.** Naturalistic colours now, but no scale
      pattern — the published painting has markings, and a procedural normal or
      colour map is the difference between a coloured tube and a snake.
- [ ] **The 72 texts are not searchable** from this surface; the mini app has
      `app.plans` for exactly that.
- [ ] **`apps/mobile` cannot use any of this yet.** The scene is DOM-free apart
      from the renderer's canvas and `domSurface`; `expo-gl` is the route.

## Log

### 2026-08-13 — second pass: the game remembers, and the board stops being a toy

**Persistence.** A journey that restarts every time a phone locks is not one.
`src/kept.ts` saves the engine's `GameState` beside the deity and restores it,
with `whyNotPlayable` — the engine's own validator — deciding what a game is, so
nothing here re-checks a square number. A record that cannot be read is reported
through `app.gameNotRead` rather than silently becoming a new game.

Found by seeding a corrupt board and reloading: the deity went with it. The
player was put back on Vishnu while the screen said nothing else had been
touched. `read` now returns the deity even when it refuses the game.

**The look.** The board was called primitive and childish, and it was. The cause
was one imported convention: roughly a third of the squares were filled solid
red or solid green, because this board had copied the mini app's *fallback*
palette — the one its stylesheet only applies under `.board:not(.painted)`, when
the artwork has failed to load. Opening `apps/miniapp/src/board-light.webp`, the
painting the phone app actually ships, settles it: **no square is tinted at
all.** It is snakes and arrows on bare ground. The strongest colour on screen was
carrying the least meaning.

So: painted ground for all seventy-two, and a thin inlay where a jump *starts*.
Naturalistic snake skins assigned by position instead of two theme swatches
repainting thirty creatures into two. Arrows given a wooden shaft, a steel head
and a feather, and thinned from a snake's girth to an arrow's. `RoomEnvironment`
through `PMREMGenerator` for image-based lighting, and ACES tone mapping — a
`MeshStandardMaterial` with nothing to reflect has nothing to be made of, which
is why every surface read as flat plastic.

Dark mode was rebuilt on the way: dyeing the board brown made it cardboard. A
painted cloth does not change colour when the lights go down, so the ground
stays paper and the *room* goes dark.

Cost: 99 tests where there were 87. Two of my own claims corrected — `planAt`
was listed as open work on a guess, and tapping the digits of square 36 opens
square 36, so the item was correct behaviour filed as a defect; and the die was
briefly suspected of never rolling sixes, which measured 999 in 6000, the
dropped throws being my own harness clicking faster than a throttled `setTimeout`
would let a turn finish.

Left undone: `app.gameNotRead` ends with *your accounts are untouched*, and this
surface has no accounts. The sentence is the catalogue's own for this event and
is right in its first half; the clause wants a key of its own rather than a new
string invented here.

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

And one from a measurement that looked like a result: twenty-three throws in a
row produced nothing, which is a 1.5% event and so was treated as an instrument
problem before a luck problem. It was neither — `requestAnimationFrame` does not
fire in a hidden tab, `walk` never settled, and the turn hung with the die
disabled. It recovers the moment the tab is visible, which is what makes it
invisible. `walk` now carries a `setTimeout` backstop.

One process mistake worth not repeating: `git add <paths>` does not clear what is
already in the index. A commit meant to carry one file also carried another
session's staged deletion of `scripts/audit-awaited.mjs`. Check
`git diff --cached --name-only` **after** staging and **before** committing, every
time — this tree always has someone else's work in it.
