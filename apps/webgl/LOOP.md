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
3. **Look at it, and zoom in on what you changed.** `bun run --cwd apps/webgl dev`,
   open it, take a screenshot. Four defects in this app were found this way that
   no test would have caught — a blank page, an arrow that flew off the board, a
   token that resolved into confetti, and a scale texture that was applied at a
   strength of nothing. That last one survived a full-board screenshot, because
   at board distance a smooth snake and a scaled one are the same few pixels.
   Dispatch wheel events at the canvas to zoom:
   ```
   c.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }))
   ```
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
| The board has no grid drawn on it | the published board, `gameboard.png` |
| A point on the board resolves to its own plan | `tests/layout.test.ts` |
| Scale rows interlock rather than stacking | `tests/skin.test.ts` |
| The scale tile has no bald seam | `tests/skin.test.ts` |
| A marking tile starts white, so it tints no skin | `tests/skin.test.ts` |
| The same snake is marked the same way every load | `tests/skin.test.ts` |
| Every border edge carries a whole number of motifs | `tests/border.test.ts` |
| The framing fits the slab, margin and all | looking at it |

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
- [ ] **The conversation is not remembered**, only the game. `src/kept.ts` saves
      the engine's state and the deity; the companion's thread starts empty on
      every resume and it re-announces the square instead. `packages/journal` is
      the shape a real path would take.
- [ ] **The sheet's drag is not keyboard-reachable** beyond the handle's step.
- [ ] **No haptics, no sound.**
- [ ] **`app.gameNotRead` promises accounts this surface does not have.** Its
      first half is exactly right for a refused save; the trailing clause is
      about the mini app's journals. Wants a key of its own in
      `packages/content`, not a string invented here.
- [ ] **A marking is a shade, not a second colour.** The tile is a `map` and a
      `map` multiplies `color`, so one tile per pattern serves all six skins —
      the cost is that a band is a darker version of the same hue. The painting
      has red-on-black coral snakes, which this cannot draw. A second colour
      would mean a tile per skin, or a shader that mixes two.
- [ ] **The snake heads are spheres.** At the zoom where the scales read, the
      head is plainly a squashed ball with two beads on it. A jaw and a brow
      would cost a few more primitives.
- [ ] **The border is geometry, not iconography.** Diamonds and rules, where the
      rules illustration carries feathers and crystals. A motif with a subject
      needs either art or a much better procedural draw; diamonds were chosen
      because they survive being thirty pixels wide on a phone, which anything
      more detailed does not.
- [ ] **The board may sit a little left of centre.** Eyeballing corners off a
      screenshot put the mobile board about 2% left of the band's middle. That
      is not a measurement — antialiased edges in a downscaled capture cannot
      support a 2% claim — and it was left alone rather than "fixed" on a
      reading that weak. Measuring it properly means projecting the board's
      corners with the real camera, which needs a hook the app does not have.
- [ ] **The 72 texts are not searchable** from this surface; the mini app has
      `app.plans` for exactly that.
- [ ] **`apps/mobile` cannot use any of this yet.** The scene is DOM-free apart
      from the renderer's canvas and `domSurface`; `expo-gl` is the route.

## Log

### 2026-08-13 — seventh pass: an edge

The board has been a bare slab through six passes, and with the perspective
straightened the cut edge was the loudest thing left saying unfinished. It now
carries a painted face: paper ground, two rules, and a run of diamonds with one
on each corner.

`src/border.ts` holds the fitting, and it is tested for one property — **a whole
number of motifs on every edge**. A border whose last repeat is clipped by the
corner is the clearest tell of a pattern applied rather than drawn, the
arithmetic reads correctly either way, and the seam only shows in a corner
nobody zoomed into. The texture is sized to the slab's own proportions rather
than square, because a square texture on a 9-by-8 slab draws diamonds that are a
different shape on the long edges than on the short ones.

Cost: 131 tests where there were 119. Two defects, both found by looking and
both mine:

- The slab grew to carry the margin while the framing still fitted only the
  **play field**, so the board's new right edge went off the side of the screen
  and took the last column of numbers with it. `CORNERS` are now scaled by the
  slab.
- In light mode the border was nearly invisible, because I drew it in
  `palette.edge` — a value picked to separate two cells at one pixel, used to
  draw a motif. **This is the second time this exact mistake has been made
  here**, after filling the winning square with a colour measured for text. A
  line and a mark and a fill want different contrast against the same ground,
  and a palette entry carries the measurement it was made for. The border has
  its own ink now, and `edge` is gone rather than left to be misused a third
  time.

### 2026-08-13 — sixth pass: a longer lens

One number. `camera.fov` 42° → 24°, and the far plane out to match the distance
the framing loop now solves for.

At 42° the near edge of the board rendered about 1.36 times the width of the far
edge; measured off the screenshot again afterwards it is about 1.12. A rectangle
that much wider at one end than the other does not read as a board on a table,
it reads as a ramp — the same distortion that makes a room shot on a phone look
like a corridor. Every product photograph of a board game avoids it the same
way, by standing further back with a longer lens, and the framing loop absorbs
the change without another number moving because it solves for distance by
projecting the board rather than by trigonometry about it.

No test. This is a visual constant, and the honest check for it is the one the
contract already prescribes: look at it, in both viewports.

Cost: nothing but the constant. 119 tests, unchanged.

Two things worth not repeating. The gates were first run from the repository
root instead of `apps/webgl`, which quietly ran the *whole repo* — 3777 tests,
all green, and a `tsc` that could not find `tsconfig.src.json` and printed its
own help instead of an error anyone would notice. A gate run in the wrong
directory is not the gate. And a ~2% horizontal offset I thought I saw was left
alone rather than corrected: corners eyeballed off an antialiased, downscaled
capture cannot support a 2% claim, and acting on it would have been adjusting
the board to fit a measurement error.

### 2026-08-13 — fifth pass: markings

Bands and blotches, and unlike the scales these read **at the distance the board
is played at** — which is what makes them worth more than the pass before them.
Three tiles serve all thirty snakes, because a marking here is a value and the
hue comes from the material.

The two patterns cycle at rates an order apart — a scale every few centimetres,
a band every couple of squares — so one UV attribute cannot carry both.
`taperedTube` now writes `uv1` as well, counted in markings rather than in
scales, and the marking texture reads it through `Texture.channel`, which this
version of three honours via the `MAP_UV` define. Checked in
`node_modules/three` before relying on it rather than after.

Blotch placement is deterministic on purpose: a board whose snakes are marked
differently on every load is a board a player cannot learn, and a pattern that
changes under you reads as a rendering fault rather than as variety.

Cost: 119 tests where there were 111. Zoomed in on the change before believing
it, per the contract amended last pass — and this time the map really was
reaching the material.

### 2026-08-13 — fourth pass: scales

`taperedTube` gained UVs — u around the body, v down its length, with the repeat
baked in rather than set on the texture, because thirty snakes of different
lengths cannot share one `texture.repeat` and still have scales the same size.
`src/skin.ts` paints one height-field tile that every snake shares, so the six
skins stay six colours and one texture. Girth 0.1 → 0.15.

The lattice is tested because it has a wrong answer that hides: scales
interlock, and rows that line up are a brick wall — which, wrapped round a tube
at phone size, just looks like a slightly odd tube. That is the exact failure
the texture exists to fix, so it would have passed every glance it ever got.
Same for the seam: each scale is painted at three offsets, and without that
every tile join shows as a bald ring around the body, thirty of them, evenly
spaced, reading as a fault in the model rather than in the texture.

Cost: 111 tests where there were 103.

**And the tests were green while the feature did nothing.** `bumpScale` in
three.js is a multiplier on the height gradient, not a distance; it was set to
0.035 as though it were world units, which is a bump of nothing. The snakes
rendered perfectly smooth and every assertion in `skin.test.ts` still passed,
because those assertions are about the lattice and the painting calls and say
nothing about whether the material ever received the map. Found by zooming the
camera in and looking — at board distance a smooth snake and a scaled one are
the same handful of pixels, so the normal screenshot could not have shown it
either. **Zoom in on the thing you just changed.**

### 2026-08-13 — third pass: there is no grid

Called kindergarten again, and the previous pass had treated it as a colour
problem when it was a *shape* problem.

`LeelaAiWeb3/assets/about/images/gameboard.png` is the board the rules screen
shows — the file `apps/miniapp`'s own stylesheet names as the one it wrongly
used first — and opening it settles it: **the board has no grid.** No cell
borders, no squares, no separations, no frame. Seventy-two numbers on bare
ground with the snakes and the arrows over them.

Every version of this app had drawn a tray of seventy-two raised tiles with dark
gaps between them. The grout was doing more visual work than the snakes were, and
no amount of material or lighting work was going to rescue a shape that wrong.
Two more things the same file settles: the numbers are small and violet, not
large and dark — the mini app writes them at nine pixels in the corner of each
circle — and 68 carries no number at all, because the Flower of Life is there.

Done: one board surface instead of seventy-two tiles; `planAtPoint` in `layout`
to turn a hit back into a square, since there is no longer a mesh per cell;
numerals at 0.55 of a cell in the published violet; the Flower of Life drawn on
68 and its number dropped.

Cost: 103 tests where there were 99, four of them on the new inverse — checked
over every square and over the ground around them, because an inverse off by one
row is off by one row everywhere and the board still looks like a board.

A claim of mine from the previous pass was re-checked rather than assumed:
`.board.painted .cell { background: transparent }` does hold, so "no square is
tinted" was right. It was right for the wrong reason — I had read it off an
overlay image, and the overlay could not have shown me the grid either way.

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
