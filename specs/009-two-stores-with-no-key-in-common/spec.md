# Two stores with no key in common

## What was asked

> «почему в боте не синхронизированны данные в боте и в мини приложении
> @leela_chakra_ai_bot»

Measured 2026-08-28. The answer is that nothing synchronises them, and it is
not a defect anybody introduced — no line was ever written to carry a game
between the two. This spec establishes that, prices the three ways out, and
names the one decision that is the owner's.

## What is true today

| | where the game lives | knows who the player is | can answer the bot |
|---|---|---|---|
| the bot | SQLite on a Railway volume, keyed by user | yes, from the update | — |
| `apps/webgl` — the 3D board the button opens | `localStorage`, `leela.webgl.game` | **no** | **no** |
| `apps/miniapp` — the 2D board at `/leela/classic/` | `localStorage` | only the language | yes, one way |

Read out of the tree, with lines:

- The button opens `https://t27.ai/leela/` — `apps/bot/src/bot.ts:165`. That URL
  serves `apps/webgl`, the 3D board.
- `apps/webgl` keeps the game at `KEPT_KEY = 'leela.webgl.game'` in
  `window.localStorage` — `apps/webgl/src/kept.ts:37`.
- `apps/webgl/src/telegram.ts` is the whole of that app's Telegram half, and it
  says so in its own opening: `ready()`, `expand()`, and the host's theme. Its
  interface declares four members and no more, deliberately.
- `grep -rn initData apps/webgl/src` returns **nothing**. The 3D board never
  asks who is holding the phone.
- `apps/miniapp` does read `initData`, twice and for two small things: whether
  it is inside Telegram at all (`main.ts:156`) and the player's
  `language_code` (`main.ts:184`). Never an id, and it is never sent anywhere.
- The bot's whole HTTP surface is one route. `apps/bot/src/serve.ts:186`:
  every path that is not `/api/ask` is refused 404. Nothing in that file reads
  a user id or an HMAC.

**And the same, measured against the deployed artefact rather than the source,**
because a source tree is not what a player runs. The page names one entry,
which is a loader; the board is in `assets/main-DHaLAJb4.js`, 140,217 bytes:

| needle | count |
|---|---|
| `Telegram` | 3 |
| `leela.webgl.game` | 1 |
| `themeParams` | 1 |
| `initData` | **0** |
| `sendData` | **0** |

The first three rows are the calibration and they are the point: a grep that
finds nothing has to be shown capable of finding something first. A run
against the entry chunk alone returned zero for *every* needle including
`Telegram`, which indicted the query, not the deployment.

So: two stores, no key in common. A player who rolls in the chat and then
opens the board is looking at a different game, and neither surface has ever
been able to tell.

## The one bridge that exists, and what it is worth

`bot.on('message:web_app_data')` — `apps/bot/src/bot.ts:1441` — files a square
handed over from a Web App, and the reply-keyboard launch that makes such an
update possible is now sent (`offerTheBoard`). That bridge is real. It is also
not a synchronisation, for three reasons the repository has already measured:

1. **It is one-way.** `sendData` carries app → bot. There is no bot → app.
2. **It is 4096 bytes, and the app that has it says so at length** —
   `apps/miniapp/src/view.ts:321`: `sendData` throws `WebAppDataInvalid` above
   4096 **bytes**, which in Cyrillic is about 2038 characters.
3. **It is implemented in the other app.** `sendData` appears in
   `apps/miniapp`; it appears nowhere in `apps/webgl`, and `apps/webgl` is what
   the button opens.

It can hand over a move. It cannot make one game out of two.

## The prior art, which solved this and is on the disk

The constitution's seventh principle says to read the sources rather than infer
them. Two donors under `/Users/playra/leela-src` did exactly this job:

- `leela-chakra-bot` and `leela-chakra-nextjs` **shared one Supabase database**
  — `leela-chakra-bot/src/core/supabase/index.ts:1` and
  `leela-chakra-nextjs/src/_shared/supabase/index.ts:11`.
- The web board read `initData` in the browser, took `initData.user.id` as
  `telegram_id`, and looked the player up directly:
  `leela-chakra-nextjs/src/app/gameboard/page.tsx:81` and `:86`.
- A move went through a server function rather than the page —
  `functions/v1/game-step`, `_shared/supabase/game.ts:27`.

**And one thing in it must not be copied.** `grep -rn 'createHmac|
validateInitData|checkSignature'` over both donors returns **nothing**. The
identity was whatever the client said it was: the page parsed `initData` in the
browser, sent the id with the public anon key, and the server took it. The roll
travelled from the client too (`game.ts:33`). Anyone who could open the page
could claim any `telegram_id`. That is the half of the prior art this
repository's fourth principle — *trust nothing that has been outside the
process* — already forbids.

So the shape is proven to work and the authentication is the part that has to
be built rather than transferred.

## Three ways, and what each costs

**1. The board reads `initData`; the bot serves the game.** The only option
that makes them one game.

- New: HMAC-SHA256 validation of `initData` against the bot token. It exists
  **nowhere** in this repository — no `createHmac` in `apps/bot/src/serve.ts`,
  which is the only file that answers HTTP.
- New: a second route. Today the server is a single-route server that 404s
  everything else (`serve.ts:186`), so this is a real addition to a surface
  that is currently one narrow door.
- New: a transport shape for a game, and the engine already knows what a valid
  game is — Principle IV's *a saved game must be one the engine could have
  produced* is the acceptance test, and `@leela/engine` holds it.
- Unanswered, and it is a product question: **what happens to the game already
  in `localStorage`** when a player who has been playing in the browser opens
  the same board from the chat. Adopt, ignore, or ask.

**2. Point the button at `/leela/classic/`.** One line — `bot.ts:165`. The 2D
app already reads `initData` and already has the `sendData` bridge, so a
Telegram player would land on the surface that can at least answer. It is also
the lesser board: the 3D one is what two specs and thirteen NOTES invariants
were written for. This buys a connection by giving up the thing being
connected.

**3. Leave them separate and say so.** Cheapest, and not nothing: the current
failure is silent. A player is shown a board that quietly disagrees with the
chat and is given no reason. A sentence in the app — *this board keeps its own
game; the one in the chat is separate* — costs one string in 22 languages and
removes the surprise without pretending to fix it.

The recommendation, if the owner wants one: **(3) now, (1) next**, and never
(2). Option 3 is honest today and takes an hour; option 1 is the real answer
and is a route, an HMAC and a migration question, which is a spec's worth of
work and not an afternoon's.

## The decision this needed — ANSWERED 2026-08-28

> **Should a Telegram player's board be the same game as the chat's?**

The owner, verbatim: **«да 3D поле везде!»** — *yes, the 3D board everywhere.*

So **option 1**, and option 2 is refused by the same sentence: the board that
plays everywhere is `apps/webgl`, not the 2D one. Both halves of his answer
matter, and the second closes a question this spec had left open in its
recommendation.

What that commits to, in order, each piece complete on its own:

1. **`initData` verified, in the bot.** HMAC-SHA256 against the bot token, per
   Telegram's scheme. This is the piece the prior art on this disk did not have
   at all, and the fourth principle refuses to accept an identity the client
   asserts. *Done — see below.*
2. **A route that serves the caller their own game.** Needs (1), because
   without it "their own" is whatever they typed. *Done — see below.*
3. **The board asking for it**, and rendering what comes back.
4. **What happens to a game already in `localStorage`** when a player who has
   been playing in a browser opens the same board from the chat. Adopt, ignore
   or ask — a product question, and the one piece his sentence does not settle.
   **ANSWERED 2026-08-29 — ADOPT.** See below.

Steps 1 and 2 shipped together on 2026-08-28 because a verifier with no caller
is code nobody has disagreed with. Step 3 shipped after them.

## Step 4, answered 2026-08-29 — ADOPT

He asked, with a screenshot of both surfaces open at once: **«почему бот в боте
не синхронизирован с планом игры в мини аппе»**. The screenshot is the
measurement, and it is unambiguous — the chat reads *«Вы стоите на плане 6.
Заблуждение (моха)»* and the board, in the same session, reads **41. The human
plane (jana-loka)**. Two positions, one player, one moment.

So: **adopt**, not ignore and not ask. The board a player opens from the chat
must be the game the chat holds.

**What that costs, stated before it is built, because the code already names
the obstacle.** `main.ts` says it today: *the route serves a position, not a
table, so writing it into storage would make a board that claims to be the
chat's game and diverges from it the moment anybody rolls here.* That is still
true. Adopting a position into a board that keeps a whole journal gives one
correct frame and a lie immediately after it.

Adoption therefore means all three of these, and any two without the third is
worse than what exists now:

1. `GET /api/game` serves the **game**, not only `{plan, waiting, won}` — the
   path the player has walked, which is what a board draws and what
   `@leela/engine` needs to accept or refuse it.
2. The board **writes its rolls back**, so the two surfaces do not diverge one
   move after adoption. Without this, adoption is a prettier desynchronisation.
3. A local game that is NOT the chat's is not silently destroyed. A player who
   has been playing in a browser has a path in there, and the acceptance rule
   at the top of this section — the engine must be able to have produced it —
   is what decides whether the two can be reconciled or one must be kept.

The screenshot carries a second finding, unrelated to step 4 and recorded here
because it was seen in the same frame: **the chat was speaking Russian and the
board English, for one player in one session.** The board resolves its language
from the Telegram launch and the chat from the room; nothing makes them agree.
That is its own item.

## Acceptance

- Whatever is built, the guard is not "a game arrives" but **the engine's**:
  a game accepted from the other surface must be one `@leela/engine` could
  have produced, and one it could not is refused rather than half-read.
- If option 1: the refusal is proved by feeding the route a game with a
  square the engine cannot reach, and it must be refused — not by argument.
- If option 1: an `initData` with a wrong hash is refused, proved with a
  forged one. The prior art's defect is the test case.
- If option 3: the sentence exists in all 22 languages, which
  `@leela/content`'s catalogue already gates.

## How to re-derive every number above

The constitution's Gates block is emphatic that a document should carry the
command and not its answer, because a command is re-derived each time it is
read and a figure rots in place. Every count in this spec comes from one of
these, and all of them are read-only:

```bash
# the source claims
grep -rn initData apps/webgl/src ; grep -rn "sendData(" apps/webgl/src
grep -rn "initData" apps/miniapp/src
grep -n "KEPT_KEY" apps/webgl/src/kept.ts
grep -n "pathname !== '/api/ask'" apps/bot/src/serve.ts

# the deployed board — note the entry is a LOADER; the board is the chunk it names
ENTRY=$(curl -s https://t27.ai/leela/ | grep -o 'assets/index-[A-Za-z0-9._-]*\.js' | head -1)
curl -s "https://t27.ai/leela/$ENTRY" | grep -o '\./[A-Za-z0-9._-]*\.js'   # -> main-*.js
curl -s https://t27.ai/leela/assets/main-DHaLAJb4.js > /tmp/board.js
grep -c Telegram /tmp/board.js          # calibration: must be non-zero
grep -c initData /tmp/board.js          # the question

# the prior art
grep -rn "createHmac\|validateInitData\|checkSignature" \
  /Users/playra/leela-src/leela-chakra-bot/src \
  /Users/playra/leela-src/leela-chakra-nextjs/src
```

The chunk name carries a content hash and will change with the next deploy;
the two-step above is why it is written as a step rather than a URL.

## What this is not

Not a plan to merge the two boards. `apps/miniapp` and `apps/webgl` are two
apps for two purposes and this spec proposes nothing about that. And not a
claim that the current behaviour is a regression: nothing broke. There was
never a wire.
