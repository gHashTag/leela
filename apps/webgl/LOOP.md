# The improvement loop for `apps/webgl`

A cron fires every fifteen minutes and starts a session that has none of the
context this one had. This file is that context. **Read it first, and write to
it last** — an iteration that improves the board and does not record what it did
is an iteration the next one repeats or undoes.

## The standing contract

Every iteration, in this order:

1. **Read this file, then `git status --short`.** Other sessions work in this
   tree. Uncommitted files you did not write are not yours.
2. **Green before, green after — and `cd apps/webgl` first, every time.** Run
   from the repository root and `vitest` quietly runs the *whole monorepo*
   (3,845 tests, all green, none of them this app's) while `tsc -p
   tsconfig.src.json` cannot find the file and prints its own help instead of an
   error anybody notices. This has now happened three times. From `apps/webgl`:
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
| `pipsFor` and `isFace` agree on what a face is | `tests/screen.test.ts` |
| A six says so | `audit-unread`, via `rollsAgain` |
| A turn always finishes, even with `rAF` paused | the backstop in `walk` |
| A saved game the engine refuses is never played | `tests/kept.test.ts` |
| A refused game does not cost you your deity | `tests/kept.test.ts` |
| A history that does not lead to the saved square is refused | `tests/kept.test.ts` |
| Every throw is a step, refusals included | `tests/kept.test.ts` |
| No surface writes its own move sentence | `describeMove`, in `@leela/content` |
| One bad stored report costs that report, not the path | `tests/written.test.ts` |
| The oldest report is dropped at the bound, never the newest | `tests/written.test.ts` |
| Your own earlier writing is never rendered as something you just said | `source: 'written'` |
| A question the game cannot hold is never stored | `tests/written.test.ts` |
| A file never overwrites a question already asked | `tests/written.test.ts` |
| An import says what is *there*, and what the bound cost | `merged`, in `@leela/journal` |
| No square is filled with a jump's colour | the published painting, `board-light.webp` |
| The board has no grid drawn on it | the published board, `gameboard.png` |
| A point on the board resolves to its own plan | `tests/layout.test.ts` |
| Scale rows interlock rather than stacking | `tests/skin.test.ts` |
| The scale tile has no bald seam | `tests/skin.test.ts` |
| A marking tile starts white, so it tints no skin | `tests/skin.test.ts` |
| The same snake is marked the same way every load | `tests/skin.test.ts` |
| Every border edge carries a whole number of motifs | `tests/border.test.ts` |
| The whole board lands inside the band | `tests/framing.test.ts` |
| The board is centred in the band, not merely inside it | `tests/framing.test.ts` |
| The board fills the band it was given | `tests/framing.test.ts` |
| The framing fits the slab, margin and all | `tests/framing.test.ts` |
| The stars cover the sphere evenly, pole to pole | `tests/stars.test.ts` |
| Every thread of the web is drawn exactly once | `tests/web.test.ts` |
| The web reaches every crossing, with no open side | `tests/web.test.ts` |
| A number sits in an opening, never on a crossing | `cornerPosition`, offset half a pitch |
| The sky is the same sky on every load | `tests/stars.test.ts` |

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
- [ ] **The path does not scroll to where you are.** It opens at step one, and
      a game forty throws long opens forty rows from the present.
- [ ] **The intention is not asked for.** `packages/journal` has `asIntention`,
      `isIntention` and its bounds, and `apps/miniapp/src/state.ts` records why
      it is not a profile field but *the question the game answers*. This
      surface never asks it.
- [ ] **Multi-seat play exists and is unused.** `apps/miniapp/src/seats.ts` has
      `SavedSeats`, `sessionFrom`, `seatsFrom` and `resize` — several players on
      one device, tested. Several tokens on this board is a rendering job, not a
      protocol one.
- [ ] **Online is the only part that needs a server.** Shared presence and a
      group feed of reports cannot be done from a static page; `apps/bot` is
      where the corpus already puts a shared table.
- [ ] **The companion's own half of the thread is not remembered.** What the
      *player* writes now is, under `@leela/journal`'s key; what the companion
      said back is not, and on resume it re-announces the square instead.
- [ ] **The sheet's drag is not keyboard-reachable** beyond the handle's step.
- [ ] **No haptics, no sound.**
- [ ] **Two message keys promise things this surface does not do.**
      `app.gameNotRead` ends with *your accounts are untouched* on a surface
      with no accounts. `app.pathExported` says *a readable copy is on the
      clipboard*, which is true on the mini app because it copies `toText(...)`
      a line earlier — and `toText` lives in `apps/miniapp/src/journal-file.ts`,
      not in `@leela/journal`. Moving it into the package, where `REPORTS_KEY`
      and `isIntention` already are for exactly this reason, makes the sentence
      true here and deletes a copy. It is another app's file to move.
- [ ] **Several tokens on the board: the model half.** The board holds a token
      per seat now and plays one. What remains is not rendering — it is
      `createSession`/`advance` replacing `Play`, which reaches `play.ts` and
      its eleven tests, `kept.ts` and its seat record, and a control for how
      many are playing. The engine already rotates turns correctly for the bot;
      nothing about the rotation needs writing.
- [ ] **A marking is a shade, not a second colour.** The tile is a `map` and a
      `map` multiplies `color`, so one tile per pattern serves all six skins —
      the cost is that a band is a darker version of the same hue. The painting
      has red-on-black coral snakes, which this cannot draw. A second colour
      would mean a tile per skin, or a shader that mixes two.
- [ ] **The font is named, not shipped.** t27.ai self-hosts `outfit-latin.woff2`
      and `jetbrains-mono-*.woff2`. The stack here names both and falls through
      to the system font, so the identity is right and the typeface is not.
      Copying those files in is one download, and one that wants asking first.
- [ ] **The snake heads are spheres.** At the zoom where the scales read, the
      head is plainly a squashed ball with two beads on it. A jaw and a brow
      would cost a few more primitives.
- [ ] **The border is gone with the slab.** The diamonds and rules were painted
      on the board's face, and the field is a web now. The rim threads are drawn
      brighter, which is all the edge there currently is.
- [ ] **The border is geometry, not iconography.** Diamonds and rules, where the
      rules illustration carries feathers and crystals. A motif with a subject
      needs either art or a much better procedural draw; diamonds were chosen
      because they survive being thirty pixels wide on a phone, which anything
      more detailed does not.
- [ ] **The 72 texts are not searchable** from this surface; the mini app has
      `app.plans` for exactly that.
- [ ] **`apps/mobile` cannot use any of this yet.** The scene is DOM-free apart
      from the renderer's canvas and `domSurface`; `expo-gl` is the route.

## Log

### 2026-08-13 — seventeenth pass: the board holds a table

The third of the three asked for, cut where it actually separates.

`Board` no longer has a `piece`. It has `setSeats` and `token(seatId)`, and it
builds one figure per seat: the materials that were shared singletons mutated in
place are now owned per token, because two seats wearing one material is two
seats the same colour. The app plays a single seat, `p1` — the id
`seatId(0)` produces in `apps/miniapp/src/seats.ts`, so a journal kept per seat
finds the same name on both surfaces when the rest lands.

**Nothing a player can see has changed, and that is the point.** This is the
rendering half of several-players-on-one-device, landed on its own so that the
next pass is purely a model change.

**Why it was cut there, found by trying the whole thing first.** The engine has
had all of this since before this app existed: `createSession`, `advance`,
`MAX_SEATS`, and turn rotation as `nextSeat` — `seats.ts` says so in as many
words, that it ports the *seating* and lets the engine rotate. So the remaining
work is not multiplayer logic, which is written and tested. It is `Session`
replacing `Play`, and that reaches `play.ts`, its eleven tests, `kept.ts`'s
record and a seating control. Pushing that through in the same pass as the
scene surgery would have meant shipping a half-built core loop; the contract's
own rule 4 is the reason it did not.

Cost: 187 tests, unchanged. The scene's public surface changed and no test
touches it — which is exactly the gap `frames.ts` exists to remember, and the
reason this pass ends with a screenshot of a throw and a deity change rather
than a green tick.

### 2026-08-13 — sixteenth pass: the question, and the path as a file

Two of the three asked for. The third — several tokens on the board — changes
the board's model from one player to many and gets its own pass rather than a
corner of this one.

**The intention.** `@leela/journal` has had `asIntention` and its two bounds all
along, and this surface never asked. It sits above the conversation now, because
that is what it is: the frame every report below it is written inside, and a
path exported without it is a year of answers with the question missing. Asked
rather than demanded — the published app blocks the board until there is one,
with `blockGoBack: true`, and that is a gate in front of a game somebody opened
to play. Here it is answerable at any point, including after forty squares,
which is when most people know what they were actually asking.

**The path as a file.** `toDocument`, `parseDocument` and `merged` were all
there. An import says what is *there* and what the bound cost, which is
`merged`'s own hard-won distinction: the two surfaces before this told the
player how many entries arrived while the cut had just thrown that many of their
oldest away. A file does not overwrite a question already asked — the player
asked something here, and a file is not a reason to change what they are playing
for — but it fills an empty one, which is the case that helps.

Cost: 187 tests where there were 177.

**A false sentence was caught one line before it shipped.** The export was about
to announce `app.pathExported` — *saved, and a readable copy is on the
clipboard* — and this surface copies nothing. That sentence is true on the mini
app because it writes `toText(...)` to the clipboard immediately before saying
it. The key was dropped rather than half-used: it is exactly how
`app.gameNotRead` came to promise this app's players that accounts it does not
have were untouched. The file name is shown instead, which is language-neutral
and a fact.

### 2026-08-13 — fifteenth pass: what the player writes is kept

The compose box fed the companion and nothing else, so a reflection written on
plan 34 was gone when the tab was. In this particular game that is the wrong
thing to lose: the reports *are* the game, and the reason to come back to a
square is to find out what you said the last time you stood on it.

`src/written.ts` keeps them — in `@leela/journal`'s format, under
`@leela/journal`'s key. `leela.reports.v1` is the same string the mini app and
the phone write, so a player who opens two of these on one device has one path
rather than two. That is the whole reason the key lives in a package none of
them owns. Nothing here re-checks what a report is: `isReport` already refuses a
blank one, a plan off the board and a timestamp no clock produced.

On arrival, `writingsOn` puts your earlier writing about *this* square into the
thread, dated, before the canonical text. `Source` gained `written` for it —
the same voice at a different time, and a thread that renders the two
identically is one where a player reads something from March as something they
just said.

Cost: 177 tests where there were 168.

**And the screenshot lied, twice in one pass.** First the earlier writing
appeared to be missing — it was above the fold, because `showThread` scrolls to
the newest line. Querying the DOM found all of it present and correct, with the
entry belonging to another square properly excluded. Then a `python .replace`
that silently matches nothing was suspected and checked rather than assumed;
that one *had* applied. Both times the answer came from asking the page, not
from reading the picture. A screenshot shows what is on screen, which is not the
same as what exists.

### 2026-08-13 — fourteenth pass: the path has a screen

The rolls have been recorded since last pass and nothing read them back. Now
`pathOf` replays them and *My path* lists every throw: its number, what it did,
and the square it left you on, tappable to open that plan. `revisited` from
`packages/journal` marks the squares this game has come back to — coming back is
what Leela is about, and the corpus already had the function that finds it.

`@leela/journal` is a dependency of this app for the first time. That is the
point: the intention, the reports and the returns are all defined there and
tested, and none of them should be written again here.

**The screen found a defect in itself, and it is one the corpus had already
made once.** The first version of a row picked `app.noRoom` for every throw that
moved nobody — so a player still waiting for their six was told there was *not
enough room*, a rule they were not under yet. `describeMove` exists precisely to
stop that, and its own comment in `@leela/content` records the same mistake
being made before. Every row is `describeMove` now, and the roll column went
with it, because the sentence already says what was thrown.

Two things this pass did not invent, and one it deleted last pass and got back:
`pathOf` returned with the shape the screen actually asked for — a `moved` flag
rather than the `squaresOf` guessed at a pass earlier — which is the argument
for deleting an export with no caller rather than keeping it warm.

Cost: 168 tests where there were 163.

**The push was refused, and left refused.** `unified` has diverged: 16 commits
here, 2 on the remote. They do not overlap in code — mine are all `apps/webgl`,
theirs are `README.md`, `MIGRATION.md` and `packages/ai` — but `README.md` and
`MIGRATION.md` are *locally modified by another session*, so any merge or rebase
would mean resolving conflicts inside uncommitted work that is not mine. Stopped
there. This is the tree's standing hazard, and it is the reason rule 5 exists.

### 2026-08-13 — thirteenth pass: the play line, and a history that is stored

Asked for: the deity picker on the die's line, the roster behind a lotus, and
the beginning of a move history.

**The play line is one line.** Die at the left, where you are in the middle, a
lotus at the right that opens the roster and shuts again on a choice. The strip
that stood under it cost about a hundred and thirty pixels of sheet for a choice
most players make once. The lotus is drawn in CSS from two crossed octagons — a
second three.js canvas for a thirty-four-pixel button is not a trade worth
making — and takes the deity's own colour.

**The history is stored as the throws, not the squares.** `replay` turns a list
of rolls back into every move it produced, so the path is derived and cannot
disagree with the rules; a stored list of squares would be a second account of
the game, and a second account goes wrong the first time a `RuleSet` changes.

With two accounts available, they are checked against each other: replaying the
rolls has to land on the stored square. When it does not, one of them is from a
different game — a ruleset changed under a saved file, a record edited by hand —
and the history is dropped while the game is kept, because the state is what you
are standing on and the history is the part that is provably wrong.

Cost: 163 tests where there were 160.

**And a piece of this pass was deleted before it shipped.** `pathOf` and
`squaresOf` were written in the same breath — the readable history the rolls are
*for* — and `audit-unread` named `squaresOf` as an export with no caller. There
is no screen for it yet, so it was a guess about what a screen would want. Both
are gone until the screen exists. What survives is the record, which is the part
that had to be right first: a history not written today cannot be recovered
tomorrow, and a function not written today can.

### 2026-08-13 — twelfth pass: glass chrome, a lotus, and a die that went away and came back

All directed, so several changes rather than one.

- **The sheet is frosted**, like the cells: `backdrop-filter` over a
  `color-mix` of `--surface`, so the stars and the board show through it. The
  strip for a tapped square gets the same treatment.
- **The token is a lotus.** A chakra *is* a lotus — the texts describe each
  level as one with a fixed number of petals, and the deities are shown seated
  on it. The tapering pawn it replaced was a chess piece that happened to be
  here. Two whorls around a seed cup, held to a silhouette, because the first
  attempt at detail on this token resolved into confetti at board distance.
- **The deity strip is one line.** Bead and Devanagari inline, the
  transliteration moved to the `aria-label` where a reader of another script
  still gets it. Stacked it stood about a hundred and thirty pixels — a third of
  the sheet at its usual detent, for a choice most players make once. Now forty.
- **The die became a numeral and then went back to pips**, asked for both ways.
  The numeral had an argument — a moulded plastic die was the last skeuomorphic
  object on a screen made of thread and glass — and the pips have a better one,
  which is the mini app's: the published game makes you *watch the throw*, and a
  digit in a box is the sentence about it, shorter. White pips, white rim.

**The round trip paid for itself.** Restoring the pips came with a test one line
longer than the one that shipped with them, and it failed: `pipsFor(1.5)` drew a
one, because the original truncated, while `isFace(1.5)` said false — two
functions in the same file disagreeing about what a face is. No roller produces
a fraction, which is why it sat there unnoticed through every pass. `pipsFor`
asks `isFace` now.

Cost: 160 tests, unchanged in number and one stronger. Also renamed the `#pips`
element to `#face`, which had been holding a numeral under a name that said
otherwise.

### 2026-08-13 — eleventh pass: one scheme, and glass

**Two ledger entries of my own turned out to be stale, and checking them was
most of the value.**

*Nothing casts a shadow onto the board* was written while the field was a
painted slab. The field is a web now and the slab is transparent, so there is
nothing for a shadow to fall on: the entry described a defect that had been
deleted by a later pass. Removed rather than fixed.

*Light mode is untested* was true, and looking at it found the defect: the
arrows are pale wood, the light ground is pale beige, and at the same value they
simply vanished. That is the **fourth** time a colour measured against one
ground has been carried onto another — after the winning square, the border ink
and the numbers.

So the fix is not a fifth patch. The board hangs in the vacuum and **a light
vacuum is a contradiction**: the light scheme was a second design nobody had
ever looked at, and it was a generator of that one defect. It is gone — one
palette, in `theme.ts` and in the stylesheet both. If a light variant is ever
wanted it is a design, not a second column of hex.

Then, asked for directly: the cells are frosted glass.
`MeshPhysicalMaterial.transmission` is real refraction — three renders the scene
again into a buffer the glass samples, and `roughness` turns that sample into a
blur — so the snakes and arrows lying under the web arrive through the panes as
shape and colour rather than as detail, and the numbers stay crisp on top. The
panes are inset from the pitch so the silk still shows between them; a pane that
reaches its neighbour turns the web back into a single sheet.

Cost: 160 tests, unchanged — this pass deleted a scheme and added a material,
and neither is the kind of thing a headless test holds. What held it was looking.

One process mistake, and a bad one: the stylesheet was edited by slicing it at
string indices, and the slice cut a declaration in half. That left `:root`
unterminated, so **every custom property failed** and the whole page collapsed —
no header, no sheet, the board a thumbnail in the corner. Caught immediately by
the screenshot the contract demands. A stylesheet is not a string; if it is
going to be cut by index, count the braces afterwards.

### 2026-08-13 — tenth pass: the field is a web

Directed step by step, so this is several changes rather than one.

The painted slab is gone and the field is a lattice of white silk hung in the
vacuum: seventy-two openings, threads between them, and a small knot at each
crossing. `src/web.ts` holds the lattice, tested for the failure a lattice hides
— an edge emitted twice renders identically at twice the cost forever, and a
missing last row reads as a design choice. The slab stays, transparent, purely
so a tap has something to hit: `planAt` raycasts one surface, and the raycaster
skips an object whose `visible` is false.

The snakes and arrows moved **under** the web. With an open field a layer
beneath shows through, and thirty arcs stopped crossing out the numbers. The
framing box had to grow downward to match — it ran from the board's plane
upward, which was right only while everything flew over the top.

Three corrections, each caught by looking:

- **The numbers went near-invisible** the moment the paper went away: they were
  a violet measured against paper, now on a void. **Third time** a palette entry
  has been carried onto a ground it was not measured for, after the winning
  square and the border ink. They are white and light-weight now, which is also
  what was asked for.
- **The token looked like it was on the wrong plan.** It was not — it floated
  0.3 above the plane, and at a seventy-degree camera the eye reads the base
  against the knot, so a third of a cell of height projects visibly off the
  square. Anchored so the plinth sits on the thread, and made smaller.
- **The numbers sat on the crossings.** The first web put its knots on the plan
  centres, which is the tidier-sounding arrangement and the wrong one: two
  threads then run through every digit. The lattice is offset half a pitch, so a
  plan falls in the middle of an opening.

Cost: 160 tests where there were 150.

### 2026-08-13 — ninth pass: space, and t27.ai's own system

Two changes rather than one, both asked for directly.

**The board hangs in space.** Leela is a cosmology before it is a game, so a
board floating in a dark room was a weaker idea than a board floating in the
vacuum. `src/stars.ts` places them. Two things there have a plausible wrong
answer, so both are tested: sampling a sphere the obvious way bunches the stars
at the poles — several times the equatorial density, and on screen it reads as a
nebula rather than as a bug — and the sky is deterministic, for the same reason
the snakes' markings are. The test does not only check the good sampling; it
also builds the naive one and requires the measurement to *fail* it, because a
check that has only ever seen a passing input has not been shown to detect
anything.

They do not drift. This app draws a frame when something changes and not
otherwise, and a moving sky means rendering forever for a phone in a pocket.
Orbiting parallaxes them, which is motion the player asked for.

**The chrome is t27.ai's**, read off the running site rather than eyeballed:
`--bg #000`, `--accent #00FF88`, `--muted #888`, `--golden #FFD700`, a type
scale in powers of phi, Outfit with a system fallback, JetBrains Mono for the
small uppercase labels. The black is also exactly what the vacuum wanted.

Cost: 150 tests where there were 141.

**The count was arithmetic, not taste, and it took a measurement to see it.**
The first sky put 1,400 stars up and showed four. Enlarging them to fourteen
pixels each still showed five — which is what ruled out size and pointed at the
real cause: a 24-degree lens on a phone sees a cone of about 24 by 11 degrees,
which is 0.64% of a sphere. 1,400 x 0.0064 is nine. Forty thousand shows a few
hundred, and `Points` does not notice.

Two smaller ones. The tests caught my own first fix for the dim sky — lifting
the brightness floor — flattening the cubic falloff until a third of the sky was
"bright"; additive blending was the right tool and the distribution stayed.
And `audit-unread` reported `vertexColors` as written-never-read, which is the
same multi-line-literal false positive as `roughness` two months of passes ago,
fixed the same way.

Also recorded rather than fixed: **nothing casts a shadow onto the board.**
`castShadow` is on the heads only, never the bodies or shafts, and the light
still has three's default +/-5 shadow camera against a board spanning +/-5.3.

### 2026-08-13 — eighth pass: an instrument for the framing

The framing had shipped three defects — a pan signed the wrong way, an inset
read from the bottom only, a fit that measured the play field after the board
had grown a margin — and **every one was caught by eye**. Three of a kind is a
pattern, and the answer to a pattern is an instrument.

`src/framing.ts` is the same code with no WebGL in it. That is the whole trick:
a `PerspectiveCamera` and `Vector3.project` are arithmetic, and only
`WebGLRenderer` wants a context, so a headless test can build a real camera,
frame a real board over six viewports and four panel positions, and ask where
the corners landed.

**It found two defects in the hour it was born, both in shipped behaviour:**

- **The elevation stopped depending on the viewport.** My own extraction did it:
  the original read `visibleW / visible` in *pixels*, and I fed the new one the
  clip-space band instead. A full band is 2 by 2 whatever the screen, so the
  camera stood at the same angle on a phone as on a widescreen. Written and
  caught inside the same change, by the test that did not exist an hour before.
- **The pan overshot, systematically.** Distance is solved with the camera on
  the board's axis; the pan then moves it off-axis, and a perspective projection
  is not the same off-axis as on it. Measured across all twenty-four
  combinations: every case with a tall bottom sheet under-filled its band —
  0.873 where 0.94 was intended, worst on exactly the everyday phone layout. The
  two steps now alternate until both settle, and the worst case is 0.938.

That second one **answers the question left open two passes ago**, where a
possible 2% offset was noticed by eye and deliberately not acted on because
corners eyeballed off an antialiased capture cannot support a 2% claim. The
offset was real, it was larger than 2%, and it took an instrument to say so.

Cost: 141 tests where there were 131. `audit-configs` and the strict typecheck
also earned their keep — the extraction left `CORNERS`, both elevation bounds
and `clamp01` behind as dead code, and `noUnusedLocals` named all four.

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
