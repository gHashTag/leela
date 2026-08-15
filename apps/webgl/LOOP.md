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
| A die with no throw to show shows no face | `tests/screen.test.ts`, and looking |
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
| Every seat's token stands on that seat's square | `placeSeats`, and looking |
| A seat that has not entered has no token on the board | `placeSeats` |
| Two players on one square are two visible tokens | `tests/layout.test.ts` |
| A fanned token's anchor stays in its own cell | `tests/layout.test.ts` |
| A token standing alone is not nudged off centre | `tests/layout.test.ts` |
| A crowded square's tokens stay centred on it | `tests/layout.test.ts` |
| A throw is reported about the seat that threw, not the next one | `tests/play.test.ts` |
| `throwFor` carries the mover as it stands after the move | `tests/play.test.ts` |
| A report is filed under the square it was asked about | the companion's `rests` |
| What the companion just said is on screen without scrolling | `tests/sheet.test.ts`, and looking |
| A line too tall for the panel is shown from its top | `tests/sheet.test.ts` |
| A scroll that would change nothing is not issued | `tests/sheet.test.ts` |
| A saved history is replayed under the rules it was played under | `tests/kept.test.ts` |
| The path opens on the newest throw, not on step one | `tests/sheet.test.ts`, and looking |
| A list the player scrolled up to read is not yanked back | `atEnd`, `tests/sheet.test.ts` |
| A turn that changed hands says so in words | `tests/screen.test.ts` |
| The die shows the seat that threw, never the seat that is next | `tests/kept.test.ts` |
| An unusable last-thrower is nobody, never seat one | `tests/kept.test.ts` |
| A reading never describes a table the engine cannot seat | `tests/kept.test.ts` |
| A reading's turn always belongs to a seat it reports | `tests/kept.test.ts` |
| One seat winning does not end anybody else's game | `tests/play.test.ts` |

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
- [x] **The path opens where you are.** Done, and it needed three things, not
      one: the list capped to the panel over it (its box was 42dvh against a
      143px panel, so an aimed row landed off screen), the panel scrolled to the
      list on `toggle`, and only then the newest row aimed inside the list.
      `atEnd` keeps a player who scrolled up to read from being yanked back.
- [ ] **The intention is not asked for.** `packages/journal` has `asIntention`,
      `isIntention` and its bounds, and `apps/miniapp/src/state.ts` records why
      it is not a profile field but *the question the game answers*. This
      surface never asks it.
- [x] **Multi-seat play is wired.** Done: the model is the engine's `Session`,
      `kept.ts` stores a seat list and migrates records written before it,
      `index.html` has the seat-count control, and `placeSeats` puts every seat
      on its own square. `apps/miniapp/src/seats.ts` still holds `SavedSeats`,
      `sessionFrom`, `seatsFrom` and `resize`; this surface derives its seats in
      `deities.ts` instead, and the two have never been reconciled.
- [ ] **Online is the only part that needs a server.** Shared presence and a
      group feed of reports cannot be done from a static page; `apps/bot` is
      where the corpus already puts a shared table.
- [ ] **The companion's own half of the thread is not remembered.** What the
      *player* writes now is, under `@leela/journal`'s key; what the companion
      said back is not, and on resume it re-announces the square instead.
- [ ] **The sheet's drag is not keyboard-reachable** beyond the handle's step.
- [ ] **No haptics, no sound.**
- [ ] **One message key still promises what this surface has not got.**
      `app.gameNotRead` ends with *your accounts are untouched* on a surface
      with no accounts. `app.pathExported` was the other one and is now true:
      `pathText` moved into `@leela/journal`, `apps/miniapp`'s `toText` became
      an adapter over it, and the export here copies the readable path to the
      clipboard before it makes the claim — and only when the copy succeeded.
- [x] **A table says whose throw is next, in words.** Done, with `roll.next`
      rather than the `roll.notYourTurn` this entry used to recommend: both are
      true, but the sentence is said in the instant after a throw, where
      *{name} is next* reads as a continuation and *It is {name}'s turn* reads
      as a label — and `roll.next` is what `apps/bot` already sends in exactly
      this position. It names the seat, not the deity: two seats can wear the
      same deity, and a transliterated name inside a Russian sentence is two
      scripts in one line.
      Still open underneath it: the clause is transient. `showStanding` rewrites
      `el.say` on every render, so a resumed multi-seat game opens with only the
      coloured mark. A standing label would need a different condition — *more
      than one seat still unfinished* — because at load there is no mover.
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

### 2026-08-15 — a table outlives its winner

**Changed.** `Thrown` carries `tableOver`, and the winning arm of `takeTurn`
reseats on that rather than on `won`.

The sharpest thing left, named at the end of this file by the pass that found
it. `won` and *the table is over* are one fact at a table of one and two facts
at a table of three, and the board had only ever known the first: the winning
arm called `seatTable(session.players.length)` with no seats to keep, which is
`createSession`. So the first player to reach 68 handed the other two a fresh
table — back on 68 waiting for a six, their throws gone. Nobody had to touch
anything. Somebody else's win ended your game, and nothing on screen said why.

**The engine never agreed with it.** `nextSeat` skips a seat that has finished
and goes on rotating; `isSessionOver` is true only once nobody can move. The
question the board meant to ask has been exported all along. It is asked in
`play.ts` and not in `main.ts`, because that file's own first paragraph says no
rule lives in the wiring.

The `else` arm's *whose throw is next* moved into `sayNext` and the winning arm
calls it too. Its old comment gave the reason it could not: *a seat announced out
of a session that has been thrown away is a seat nobody is sitting in.* That
reason is gone with the reseat, and without the sentence a winner's device shows
`app.won` and stops, which reads as the end of the game rather than as the end of
one seat's game.

**Cost.** 252 tests where there were 248 — measured in a tree that then read 257,
because another session added five to `kept.test.ts` while this pass was running.
Four new in `tests/play.test.ts`.

**The test was checked against the unfixed code, both ways.** Written first, it
failed on `tableOver` being `undefined`. Then, with the fix in, `tableOver` was
set back to `hasWon(after)` — the rule `main.ts` actually used — and the
three-seat test went red on `true` where `false` is required, which is the
assertion that discriminates the two rules rather than merely noticing a new
field. Restored, green. The driver plays a real table with no hand-made states,
and it scores a throw by `entered` rather than by `loka`: a seat waiting to enter
sits on 68, the highest number there is, so a greedy driver built on position
alone prefers never to enter and the game never starts.

**Looked at it**, which is the half a headless test cannot reach. Seeded three
seats — p1 on 53, one step from the arrow at 54 — pinned the die, and threw:

```
p1 → 54 → 68 · "You reach Cosmic Consciousness. 🕉 · Player 2 is next."
stored: p1@68 finished, p2@23, p3@51 · turn 1 · die live · seats 3
```

Then Player 2 threw, took the snake at 24 down to 7, and the turn went on to
Player 3. Zoomed in: two lotuses, on 7 and on 51, and no ghost at the origin.
Reloaded: the table came back with its winner in it, on Player 3, die live.

**Found by looking and not fixed.** After a win the header reads `—` and *Throw a
six to enter the game* — `screenFor` is told `entered`, which is `!is_finished`,
and a winner and a player waiting to enter are both finished on 68. That sentence
was accidentally true before this pass, because the table it described was
reseated a line later. It is false now, and it is the exact confusion the
invariant table already names as held. The hud is not wrong; its caller passes a
boolean that cannot tell the two apart.

**Another session was writing this same app while this ran**, and it is worth
knowing before the next one starts. `src/kept.ts`, `tests/kept.test.ts` and two
hunks of `src/main.ts` — a `finishedTable` restore path for a *saved* table
nobody can move in — appeared on disk mid-pass, uncommitted, ten minutes after
this pass had read the file. An import of `isSessionOver` also appeared in
`main.ts` unasked and was removed, having been caught by `noUnusedLocals`. Only
this pass's hunks of `main.ts` were staged, as a blob built from `HEAD` plus
them, which is exactly the content the gates were run against at 18:07. Rule 5
says stage named paths; when two sessions are inside one file, named paths are
not enough and the hunks have to be named too.

**Next.** The header after a win, above. And `apps/miniapp/src/seats.ts` still
holds `SavedSeats`, `sessionFrom`, `seatsFrom` and `resize` while this surface
derives its seats in `deities.ts`; two accounts of seating, never reconciled.

### 2026-08-13 — eighteenth pass: the engine's session, not this app's wrapper

`Play` is gone. It held one `GameState` and rolled it; the engine's `Session`
has held several seats, a turn index and the rotation between them since before
this app existed. `throwFor` is what is left in `play.ts`: `advance` decides the
move and the rotation, and this adds only the hops — splitting a move into the
steps an animation walks is the one part of a turn the engine has no opinion
about, and the only part that was ever this surface's to get wrong.

The board plays one seat still. Seating more is `createSession` with more
players now, which is the whole point of doing this before the seating control
rather than after.

**The eleven tests moved rather than went.** Read closely, four of them were
never about `Play` at all — *shows a snake as two hops, so the fall is legible*
is about `hopsFor`, tested through a wrapper that happened to be in the way.
They drive the session directly now and check the same thing. One did go with
its subject: `Play.reset()` no longer exists, so *starts over cleanly* was
re-expressed against what replaced it — a fresh `createSession` is a table
nobody has entered, which is the loop this game is made of.

Cost: 187 tests, the same number, and one of them is now about `createSession`
rather than about a method that no longer exists.

Verified by playing it: entered, walked to 62 through an arrow, and then ran on
to Cosmic Consciousness and started a fresh table — which is the restart path
through `createSession`, seen rather than asserted.

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

## Pass — the table on the board, and the defect that hid behind one seat

Three things that were left open, and one that was not known about.

**A. Seating, finished.** `kept.ts` wrote the state of one seat and now writes a
list, with a migration: a record in the old shape becomes a one-seat table
rather than nothing. Verified against a hand-written pre-seating record in the
browser — plan 23 and Durga both survived the read. `index.html` gained a
seat-count radiogroup, one to `MAX_SEATS`.

**B. A test for what the board is asked to draw.** `setSeats`/`token` had
changed twice in two passes with nothing checking them, because `createBoard`
needs WebGL and so nothing about the board can be held by a test. What *can* be
held is the part that decides what it is asked to draw, and that is also the
part that can be silently wrong. `deityForSeat` and `seatsOf` moved into
`deities.ts` and `tests/seating.test.ts` holds them: distinct deities at a full
table, ids in the order the session rotates them, the same table twice, a choice
honoured and a default only where there is none, and a roster that no longer has
the saved deity in it costing a preference rather than a token.

**C. `toText` was half a promise.** `app.pathExported` says the path was
exported; what left was a JSON file. `pathText` now lives in `@leela/journal`,
`apps/miniapp`'s `toText` is an adapter over it, and this surface copies the
readable path to the clipboard before it makes the claim — and only when the
copy actually succeeded.

**The one that was not known about.** With four seats made, the board showed two
tokens: one on its square and one blob a square from the middle. Every placement
in `main.ts` named the constant `SEAT`, because this surface used to play one
seat — so `p2`, `p3` and `p4` were created by `setSeats` and never moved, and sat
stacked on the origin. It does not read as three unplaced pieces. It reads as a
piece on the wrong plan, which is a defect this repository has already shipped
once. `placeSeats` now puts every seat on its own square and hides the seats that
have not entered — `entered` is `!is_finished`, so it covers both the player
waiting for a six and the winner who has left the board. `walk` takes whose
piece, captured before the throw resolves rather than read back off the session
afterwards.

Verified by looking, three states: one seat in play (one token), two in play plus
one waiting (two tokens on 23 and 51, nothing for the third), and the picker mark
and the header both following the turn to seat two.

What this cost: 199 tests where there were 192.

**The lesson, and it is the same one.** The tests were green across both passes
in which the board's seating surface changed, and green about nothing — there
were no tests of it, only of things near it. A green suite is a claim about what
is asserted, never about what is drawn. The seat count control existed, the
model was right, storage was right, and the screen was still wrong.

Still open, found this pass and not fixed:

- Two seats on the same plan occupy the same point exactly. Nothing fans them.
- The die restores its rolls but its face comes back blank — the last throw is
  in storage and is not shown.

## 2026-08-13 — two players on one square are two tokens

**Changed.** `fanOffset(at, sharing)` in `layout.ts`, and `placeSeats` counts who
is standing where before it places anybody.

Left over from last pass's own list, and it was the one state in which the board
told a lie rather than merely looked plain: two seats on one plan stood at the
same point, exactly, so a square with two players on it drew one token. In Leela
that is not an edge case. The path is sixty-eight squares long, the arrows and
the snakes keep returning players to the same few plans, and the whole social
half of the game is who else is on your square.

The tokens cannot be separated: a lotus is about eight tenths of a cell across
and the pitch is 1.08, so any arrangement overlaps. Separation was never what was
missing — *two* was. They fan on a ring of a quarter of a pitch, starting at +x
so the common case of two sits left-and-right: the camera looks down at seventy
degrees, and a pair fanned along z reads as one token with a shadow. Caught
while writing it — the first version put the ring's start at the top, with a
comment claiming it did the opposite of what the arithmetic did.

The bound is not a taste: `planAtPoint` decides which cell a point belongs to,
and an anchor pushed past half a pitch answers with the neighbouring plan. A
token that reports the wrong square when tapped would be worse than the defect
being fixed. The test checks that against the real board — every plan, every
table size from two to six — rather than against the constant.

**Cost.** 206 tests where there were 199. Seven new, all in `tests/layout.test.ts`.

**Looked at it**, zoomed with the wheel trick above: two on 23 read as two, each
with its own colour and halo; three on 51 overlap into a cluster but stay three.
A single token is untouched, which the test also states, because the common case
must not pay for the rare one.

**Also corrected: this file.** Three entries in the open-work list had gone false
and were still being read as true by every session that starts here — multi-seat
play described as unused, `app.pathExported` described as a lie, and the seating
work described as unstarted. All three were finished last pass. A ledger that
lies is worse than no ledger: it is the one document a fresh session trusts
without checking.

## 2026-08-13 — a throw is about the seat that threw

**Changed.** `throwFor` carries the seat that moved; `takeTurn`, `showStanding`,
`showPath` and the compose box read that instead of `currentPlayer`.

I went looking for the turn-order sentence and found a defect underneath it.
`advance` rotates the turn, so after a throw the session's current player is
whoever throws **next** — and `play.ts` even says so, in the comment on
`currentPlayerById`. `main.ts` did not. Every readout after a throw went through
`seat()`.

Measured, at a table of two, p1 riding an arrow from 28 to 50:

```
header 10 · "You threw 5. An arrow at 28 takes you to 50." · mark: Durga
```

The number was the *other* player's square, the sentence was the mover's, and
the mark still showed the player who had just gone. Three readings of the same
moment, no two of them agreeing. The progress bar, the camera's focus and the
text the companion announced were all the next player's too.

Then the same trap one layer over: a reflection typed after the turn had passed
was filed under `seat().state.loka` — one player's writing against another
player's square, in the journal, permanently. It now files under the plan the
companion asked about, which is the thing the writing is actually about and is
only set once somebody has landed.

After:

```
header 50 · "You threw 5. An arrow at 28 takes you to 50." · mark: Krishna
path: p1's three throws · report filed under 50, turn-holder on 10
```

**Cost.** 211 tests where there were 206. Five new in `tests/play.test.ts`, and
what they assert is the trap itself: after a handover `currentPlayer` is *not*
the mover, and `moved` is. That is the durable half. The wiring in `main.ts` is
still held only by looking, because there is no DOM here to hold it.

**Why it survived every gate.** At a table of one the mover and the next player
are the same seat, so all of this was true until the moment seating landed —
two passes ago. The tests went green through both. They were green about a
table that could not yet exist, which is the third time this file has recorded
that shape.

**One measurement thrown away.** The first attempt to reproduce the handover
clicked nothing: the stored turn was already `1`, so the loop's guard returned
before its first throw, and I read an at-rest render as a post-throw one. It
looked like a fix that worked. Seed the state, reload, *then* assert the
starting condition — a run whose log has no rows is not a run.

Found and not fixed: the thread does not scroll to what the companion just said.

## 2026-08-13 — what the companion just said is on the screen

**Changed.** `bringIntoView` in `sheet.ts`, and `showThread` uses it instead of
`scrollIntoView`.

The ask for this surface was the game *and the agent's answer* on one screen.
Measured on a fresh load, one throw put the companion's line at 685-856 against
a panel whose visible box ends at 745 - sixty pixels below the fold at its
nearest point, with the scroller still at zero. The proactive half of the game
was being written where nobody would read it.

It was not missing a scroll. `showThread` already called
`scrollIntoView({ block: 'nearest' })`, and on the live page, measured both ways
from the same state: `behavior: 'smooth'` leaves the scroller at zero, `'auto'`
moves it at once. I did not chase why. Swapping one browser behaviour for
another is a fix that cannot be tested here; the position is arithmetic now, and
the arithmetic is in a module a test can hold.

Two rules in it are judgement, so they are written down rather than assumed. A
line taller than the panel is shown from its **top** - scrolling to the end of a
long answer shows the player its last sentence first. And when the box is
already in view the answer is `null`, not the number it is already at: assigning
a scroll position cancels a scroll the *player* started, and being yanked while
reading is worse than reaching for the scrollbar.

**Cost.** 222 tests where there were 211. Eleven new in `tests/sheet.test.ts`,
which did not exist - `nearest`, `stepped` and `dragged` had no test either, so
they have one now.

**A test that failed and was wrong.** The property check generated a box at
980-1040 inside a thousand pixels of content and demanded it end up inside the
window. No such box can exist in a scroller. The failure said nothing about the
code; the generator now stays inside the content, and the clamping behaviour it
was groping at is asserted on its own.

**A result that looked like a failure and was not.** After the fix the check
`fullyVisible` came back false: the line is 148 pixels tall and the panel at the
half detent is 143. That is the taller-than-the-window rule doing exactly what
it says. Before, the line began sixty pixels below the panel; after, its top is
eight pixels inside it. The right assertion was never *fully visible* - it was
*visible from the top*.

**One process mistake.** The first attempt to write this entry ran with the
shell sitting in `/Users/playra`, not in `apps/webgl`. The `python3` half failed
loudly on a missing `LOOP.md`; the `cat >>` half did not, and created a stray
44-line `LOOP.md` in the home directory. Removed. `cd` does not persist between
commands here - use absolute paths for writes, the way the gates already do.

Still open: the path list has the same problem and now has the function for it.

## 2026-08-13 — three asked for, four shipped

Four commits, gates between each. The contract says one change per iteration;
the ask was for three, so it is one change per commit instead.

**The one nobody asked for, and it was the biggest.** Going to restore the die's
face meant reading how a saved history is validated, and `kept.ts` was replaying
it under `DEFAULT_RULESET`. Every other replay in this app passes
`LEGACY_MOBILE` explicitly; this was the one call site that let the default
stand. The two differ in **nine** fields — `extraTurnOnSix` and `rerollOnRepeat`
among them. It is not a near-miss between neighbouring variants; it is a replay
of a different game.

Measured, five thousand random forty-throw games: **46.9%** land on a different
square under the two. Every one of those came back from a reload standing on its
square with an empty path and nothing said, because a refused history is dropped
while the seat is kept — indistinguishable from never having played. An
adversarial agent found the mismatch and estimated 3.5%; the number was wrong by
more than a decimal place, which is why it was measured here rather than quoted.
`read` now takes the ruleset. The old fixture could not see it: four throws that
land in the same place under both. The new test sweeps the rulesets, and the
diverging script is found by search rather than chosen — `[6,6,6,6]` is 32 under
`LEGACY_MOBILE` and 6 under `NEUROLEELA`.

**The path opens where you are.** Three things, and the obvious one alone does
nothing. Aiming the newest row into view of `#path-list` is worth zero while the
list's own box is 42dvh — 341px inside a 143px panel — because the row lands at
the bottom of a box whose bottom nobody can see. Measured after aiming and
before capping: **no rows on screen at all**. Capped to the panel, panel scrolled
to the list on `toggle`, row aimed inside the list: rows 37–40 of a forty-throw
game, at the detent the app actually opens in. Moving the panel is confined to
`toggle` — the one moment the player has asked for the path rather than the
conversation — so the thread-following of the previous pass is untouched.

**A table says whose throw is next.** `roll.next`, not the `roll.notYourTurn`
this file recommended a pass ago. Both are true; the first reads as the
continuation it is. Ids rather than seat numbers decide when to say it, because
the comparison *is* the condition — `nextSeat` returns the same seat at a table
of one, so a solo game never says it without being asked how many are playing.

**The die comes back showing the throw that was made.** The rule this file
proposed — the holder's last throw — is false five throws in six, because
`advance` rotates on anything but a six. Two independent agents refused it, for
the same reason: it is the one-rotation-off defect of the pass before last,
re-introduced in the one widget with no sentence beside it. So the missing fact
is stored. `lastThrower` is refused to **null**, never clamped to zero — the
opposite of what `turnIndex` does one line above, because a turn must belong to
somebody while a throw need not have happened at all. And `data-thrown` came
apart from "there is a face": it drives the pulse that says the die is a control,
and a returning player has a number to look at and still has to throw.

**Cost.** 243 tests where there were 222. Twenty-one new, across `kept`, `sheet`
and `screen`.

**Three of my own instruments were wrong this pass**, all the same shape —
reading a measurement taken in the same tick as the change that invalidates it:

- The path measured as *zero rows visible* after the fix. It was read in the
  same tick as the `toggle`, before layout and scroll had settled. Read again a
  moment later: rows 37–40. I nearly rebuilt a working fix.
- A probe of the ruleset divergence returned `NaN` for every game, because
  `MIN_ROLL`/`MAX_ROLL` are not exported from the engine's index and undefined
  arithmetic is quiet. A run whose every sample is `NaN` is not a measurement.
- A test name containing an apostrophe inside single quotes broke the parse —
  the exact mistake this file recorded against `audit-scripts.mjs` months ago,
  made again in a different file.

And one of my own tests asserted nothing: a conditional expression that always
evaluated to the same operand. It passed. It was rewritten to say the thing it
was pretending to check.

**Also true and worth stating:** the disk filled to 117MB free mid-pass and a
command died on `ENOSPC` *between* a file write and its verification, so an edit
silently did not land. The next command failed on the unedited file, which is
the only reason it was noticed.

## 2026-08-13 — a reading that could not be seated

**Changed.** `read` caps the table it reports at `MAX_SEATS`, and says so.

Found in the previous pass and left as an open item. `read` clamped `turnIndex`
against the seats it had *read*, while `seatTable` caps the table it builds at
`MAX_SEATS`. So a record carrying more seats than the engine allows produced a
turn belonging to a seat nobody would be sitting in — and `currentPlayer`
throws rather than returning undefined. Not a wrong readout. A blank page,
before the first frame.

Nothing this app writes can reach it: `seatTable` caps before saving. Another
version of another surface, or a hand-edited record, can — and the mini app and
the bot write to keys of their own, so a shared device is not far-fetched.

**The test says why it is a crash rather than asserting that it is.** It builds
a full table, shows that the engine throws on a turn one past its end, and then
shows that no reading produces such a turn. That chain is the defect; asserting
only the clamped number would pass just as well against a `read` that clamps to
zero for the wrong reason.

Verified by looking, with an eight-seat record and a stored turn of 7: the page
opens on plan 23 with six lotuses fanned on the square, the mark reads
*Durga — Player 1*, and the seat control shows six. Before, this record was a
session the boot handed straight to `currentPlayer`.

**Cost.** 248 tests where there were 243. Five new.

**One thing I did wrong again**, and it is in the contract in bold: I ran the
root audits from `apps/webgl` and got two Node stack traces. They are root
scripts. The contract's rule 2 says `cd apps/webgl` for the gates *and the root
for the audits*, and I have now read past that twice in three passes.

Still open and now the sharpest thing left: the winning arm of `takeTurn`
reseats the whole table, so at a table of three one player winning ends two
other people's games. — Fixed 2026-08-15; see the entry at the top of the log.

## 2026-08-15 — a win ends the winner's game, not the table

Two halves, and only one of them is mine.

**The won arm is the entry above this one.** Found already fixed — by a
concurrent session, in this working tree, *while this iteration was reading the
same files*: this pass had read the same open item off this file, planned the
same change, and was one import in when the file changed underneath it. The
first draft of this entry then claimed the other session had ended without
logging or committing its work. It had not ended: it committed code and log
both, seconds before this entry's own commit, and its account of the won arm
is the one to read. The false claim is corrected here rather than deleted,
because it is this pass's clearest specimen of its own lesson — a conclusion
about concurrent work was drawn from one stale `git status` and written into
the one document the next session trusts without checking.

**The restore half, which is this iteration's change.** The won arm made
winners-in-storage a normal state for the first time, and the boot had no
answer for the record nothing live can produce: a table where *every* seat has
finished. `read` hands it back without a word — every state is playable, a
finished game is not a corrupt one — and the engine then refuses to roll at
it, so the first tap of the die took `advance`'s throw inside `takeTurn` with
`busy` held and the die disabled. Not a wrong readout: a dead die with the
lights on, permanently, on a page that booted clean. `finishedTable` in
`kept.ts` is the question — every seat `hasWon` — and the boot reseats a fresh
table of the same count, which is the same answer the winning arm gives when
the last seat finishes live.

Two traps in the predicate, each with a test that fails without it: a seat
still waiting to enter also sits on 68 with `is_finished` set, so a check on
the flag alone calls a fresh multi-seat table finished and quietly reseats
every one at boot — `hasWon` is the discriminator, the same 68-ambiguity this
repository has now paid for three times. And `every` over an empty list is
true, while a table with nobody at it is a fresh boot, not an ended game.

**Verified by seeding the record the engine itself built** — a greedy driver
walked a real state to 68, two copies seated, written to `leela.webgl.game`,
reload. The boot kept the seat count (two, which is the tell that the record
was read rather than refused) and the tap that used to be lethal played a
turn: *You threw 4. It takes a six to enter the game. · Player 2 is next.*

Cost: 257 tests where there were 248 — four the concurrent session's, five
mine.

**The collision is worth more than the fix.** Two sessions picked the same
sharpest open item from this file and edited the same three files at the same
time. It was caught only because an edit of mine landed on a file that had
changed since it was read; the diff then showed my planned change already
written, better, by somebody else. What survived scrutiny: their half and mine
never touch the same lines, and every gate is green over the union. What this
file should say to the next session: **re-read `git status` immediately before
every edit, not once at the start** — this tree now demonstrably carries
*concurrent* work, not just leftover work.

Also measured rather than assumed, from a competitor sweep this pass: the
dominant hotseat convention (Ludo King, Ludo Life) is exactly what the engine
does — play continues for the rest, the finisher keeps a visible seat with a
rank and is skipped. No 3D Leela exists in the EN or RU market, and no
competitor ships multiplayer, an AI companion and a journal together; this
surface is alone in all three. The gap the sweep names: our winner simply
vanishes (`entered` hides the token), where the convention shows a finished
seat with its placing — `standings` has existed in the engine all along and no
surface reads it.

Two process notes, both this file already carries in bold and both hit anyway:
parallel shell calls share one working directory, so the root audits ran from
`apps/webgl` and `tsc` ran from the root in the same minute — the fourth and
fifth occurrences of the two traps rule 2 exists for. Absolute paths, one
command per call, every time.

Found and not fixed: a reseated table forgets its chosen deities (`seatTable`
with no seats to keep falls back to the defaults — true of the winning arm
before this pass and true of it now), and a foreign record whose `turnIndex`
names a seat that has already won is seated as read, which under a ruleset
that lets a winner re-enter may be a game and under any other is one throw
from a refusal nobody has looked at.
