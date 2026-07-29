# Migration

What the 25 repositories held, what has been merged, and what is left.

## The inventory

25 repositories: 23 in `gHashTag`, one in `dharmaapp`, one in
`fullstackserverless`. No local checkout of any of them existed — only
marketing assets on the Desktop and one keystore in Dropbox.

### Game clients — six generations of the same code

| Repository | Last push | Commits | What only it has |
|---|---|---|---|
| `fullstackserverless/leelachakra` | 2020-12 | — | the original, React Native on JS |
| `gHashTag/leela-game` | 2023-04 | 9 | a `translations/` directory |
| `gHashTag/leela` | 2024-01 | **211** | **the published app**, `com.leelagame`, versionCode 77: Firebase, RevenueCat, Sentry, notifee, MobX, 10 locales |
| `gHashTag/LeelaChakraAiMobile` | 2025-01 | 6 | same `src/`, bare RN with Yarn Berry |
| `gHashTag/LeelaAiWeb3` | 2024-08 | — | same base plus web3 codegen, `LEELA-PITCH.md` |
| `gHashTag/NeuroLeelaExpo` | 2025-07 | **114** | Expo Router, NativeWind, Supabase + Neon + Drizzle, Apollo, Inngest, Vitest, 23 locale files |
| `gHashTag/NeuroLeelaAgent` | 2025-10 | 3 (squashed) | AI SDK + OpenRouter, `docs/plans` (72 plans in English), `docs/rules` |

### Services

`NeuroLeelaMobile` (despite the name: a Node/Docker/nginx server with
swagger.yaml), `neuro-leela-telegraf-bot`, `leela-chakra-bot` (grammY on
Vercel), `leela-server-graphql`, `LeelaChakraAi` (a Supabase project).

`leela-ai-backand` is **not part of this game** — it is a fork of Rhubarb Lip
Sync, a C++ lip-sync tool for a talking avatar. 86 MB that only shows up
because of the repository name.

### Web3

`smart-contract-leela` (`LeelaGame.sol`, `LeelaToken`, hardhat,
`address.json`), `leela-ai-web3` (an earlier cut of the same contracts), and
four iterations of one subgraph: `the-graph-leela` → `leela-ai-2` →
`leela-ai-3` → `leela-ai-4`. `leelaWeb3` was already an attempt at a monorepo
(`mobile/ server-graphql/ site/`).

### Content and web

`leela-chakra-nextjs` (Next.js landing), `leela-ai-site` (Docusaurus, 23 MB),
`leela-ai-frontend` (Vite, the front end for the lip-sync avatar),
`translate-leela` (19 languages), `dharmaapp/leelabook` (the Russian book of
rules, 78 markdown chapters).

## What the merge found

### The two apps play different games

This is the finding that matters most, and neither codebase documents it.

Traditional Leela has one rule about sixes with two halves: a six lets you
throw again, and three sixes in a row burn the run and send you back to where
it started.

- `leela` v6.5.1 — the app that is **live on Google Play** — implements the
  first half. `src/store/helper.ts:99` shows the extra throw; there is no
  three-sixes rule anywhere in the repository.
- NeuroLeela implements the second half. `handleConsecutiveSixes` resets on the
  third six; nothing grants an extra throw.

Neither shipped the complete rule. A player moving between the two versions is
playing a different game and would have no way of knowing.

The engine keeps all three variants and records the one in force on every
player and every move (`players.ruleset`, `game_steps.ruleset`), so adopting
the engine changes nothing until a surface deliberately migrates.

### The board itself never drifted

Every snake and every arrow is identical between the 2024 production app and
the 2025 rewrite — all twenty jumps, plus `54 → 68` and the refusal to move
past 72. Verified by reading `leela/src/store/helper.ts:137-217` against
`NeuroLeelaAgent/services/GameService.ts:231-283`. The board is safe to treat
as settled.

### The production die is not fair

`leela/src/store/DiceStore.ts:50` re-rolls whenever the die repeats the
previous value. That is not a traditional rule and it skews the distribution —
notably, it makes a run of three sixes nearly impossible, which may be why the
three-sixes rule was never missed in that version. Recorded as
`rerollOnRepeat` on the `legacy-mobile` variant, and off everywhere else.

### The content was more complete than expected

The plan texts survive in four places and, taken together, cover 22 languages
with all 72 plans and full body text in each. The English filenames in
`NeuroLeelaAgent/docs/plans` are the only complete numbering scheme, so they
act as the key that ties the other three sources together.

## Done

| Package | Contents | Tests |
|---|---|---|
| `@leela/engine` | board, rules, three variants, replay | 52, 100% branch coverage |
| `@leela/content` | 22 languages × 72 plans, rules chapters | 101 |
| `@leela/db` | schema, row ↔ state mapping, move log | 12 |

The engine's behaviour is locked to the last shipped implementation, including
two quirks kept deliberately and marked in the code:

1. A third six sends the player to the fallback square, and that square is then
   run through the board rules — so a fallback onto a snake or an arrow moves
   them again.
2. A player waiting on 68 keeps their old `previous_loka` rather than having it
   reset.

Both have tests that will fail loudly if someone changes them by accident.

## Second pass: what the first extraction lost

Reviewing the extraction against the production app turned up two rules that
had been left behind, both of them central rather than incidental.

**The report gate.** Leela is not a race. Landing on a plan is an invitation to
sit with it, and the published app enforced that: a player could not roll again
until they had filed a report, and online games put a full day between moves
(`OnlinePlayer.store`: `isReported`, `canGo: Date.now() - lastStepTime >=
86400000`). That rule lived beside the Firebase calls and vanished in the
rewrite — the NeuroLeela schema kept a `needs_report` column that nothing ever
checked. It is now `canRoll()` in `turn.ts`, with a fourth variant, `online`,
carrying the day-long cooldown.

**Group play.** The published app seated six players around one device
(`SelectPlayersScreen`, `OfflinePlayers`, `changePlayer()`); the rewrite became
single-player. `session.ts` restores it as pure functions: turn order, skipping
players who have finished, the report gate per seat, standings.

That gap is also the commercial one. Surveying the field — Uinside's
secularised app, Leela Chakra Ai, leela.love, Lila Game, com.vtm.lila — every
competitor is single-player. Several now lead with an AI guide, so conversational
interpretation is table stakes rather than an edge. Nobody offers synchronous
group play or facilitator tooling, which is how the game is actually played.

**Two smaller gaps closed alongside.** The die is now reproducible
(`seededRoller`), so a session can store a seed and replay or verify its whole
history; and `session_players.direction` was added after a round-trip test
caught the column silently dropping how a player reached their square.

## Third pass: the content was quietly broken

The first build reported 22 languages × 72 plans with full text, and 101 tests
agreed. Both were wrong in a way the tests were built not to see: the check for
leftover numbering only knew the words `plan` and `план`.

- **744 titles across 15 languages** kept their numbering, because every
  language writes "plan" in its own script — योजना 1. जन्म, 计划 1. 出生,
  플랜 1. 탄생, Kế hoạch 1., திட்டம் 1.
- **25 plans in 5 languages** lost their title entirely and fell back to the
  bare number, because Japanese and Chinese sources write `#計画1.誕生` with no
  space after the hash — and one file uses the fullwidth number sign `＃`
  (U+FF03) that a CJK keyboard produces.

Both are fixed in the generator, and the tests now assert on the *shape* of the
defect rather than on a list of words: no plan number followed by a separator
in any script, no title that is only digits, no markdown heading left at the
start of a body.

Worth noting where this mattered: the published `Leela Chakra Ai` sits at
2.8/5 with 19K downloads. Titles reading "योजना 1. जन्म" on 15 of 22 locales
are not the whole story, but they are the kind of thing that shows on every
screen a non-English player sees.

## Fifth pass: the copy that was a different game

The rules were copied five times across the 25 repositories. Four of the copies
agree — the published app, the Expo rewrite, the deployed contract and the
engine. The fifth does not.

`NeuroLeelaAgent/inngest/functions/processDiceRoll.ts` declares its own
`TOTAL_PLANS`, `WIN_LOKA`, `handleConsecutiveSixes` and `getDirectionAndPosition`,
and its board is **a 100-square Snakes and Ladders set**:

```
snakes: 16→6, 47→26, 49→11, 56→53, 62→19, 64→60, 87→24, 93→73, 95→75, 98→78
arrows: 4→14, 9→31, 17→7, 20→38, 28→84, 40→59, 51→67, 54→34, 62→19, 63→81, 64→60, 71→91
```

Squares 87, 93, 95, 98, 84 and 91 do not exist on a 72-square board. Arrows 17
and 54 run *downwards* — in Leela 17 climbs to 69 and 54 is one of the two ways
to win. Squares 62 and 64 are listed as both a snake and an arrow. Not one of
the twenty real jumps survives.

Nothing caught it because nothing checked. `auditBoard` and
`compareToReference` in `@leela/engine` are that check, exported so any
implementation carrying its own board can be held to this one — the contract
now is, and the Inngest board is kept in the tests as the worked example of
what they catch.

**`services/inngest` is therefore not ported.** Its only original content was
this board, and what remains — event fan-out — is what the bot already does
directly. Porting it would mean rewriting it against the engine, at which point
there is nothing left of the original.

**`packages/ui` is not built either.** The design system it would hold belongs
to React Native, and the two surfaces that exist are a chat and a page of plain
HTML with no components in common. It is worth building when `apps/mobile` is,
and not before.

## Sixth pass: all thirteen copies, checked

The fifth pass found one wrong board by accident. This one looked
systematically: `scripts/audit-copies.mjs` walks the source repositories,
extracts every board it can read, and runs `auditBoard` and
`compareToReference` over each.

**Thirteen copies of the board across the 25 repositories. Seven agree.**

| Copy | Verdict |
|---|---|
| `leela/src/store/helper.ts` | agrees |
| `leela-game/src/store/helper.ts` | agrees |
| `NeuroLeelaExpo/services/GameService.ts` | agrees |
| `NeuroLeelaAgent/services/GameService.ts` | agrees |
| `NeuroLeelaAgent/components/chat/ChatBot.tsx` | agrees |
| `smart-contract-leela/contracts/LeelaGame.sol` | agrees |
| `leela-ai-web3/contracts/LeelaGame.sol` | agrees |
| `NeuroLeelaAgent/inngest/functions/processDiceRoll.ts` | **wrong game** |
| `NeuroLeelaAgent/inngest/server-config/game-logic.ts` | **wrong game** |
| `NeuroLeelaExpo/inngest/functions/processDiceRoll.ts` | **wrong game** |
| `NeuroLeelaExpo/inngest/server-config/game-logic.ts` | **wrong game** |
| `LeelaAiWeb3/.../handlePlayerMovement.ts` | **wins on the wrong square** |
| `leelaWeb3/mobile/.../handlePlayerMovement.ts` | **wins on the wrong square** |

The Snakes-and-Ladders board was not one file: it is **four**, duplicated
across both Expo repositories, in `inngest/functions` and again in
`inngest/server-config`.

**A second, quieter defect** in the two web3 hooks:

```ts
} else if (newPlan === 54 || newPlan === WIN_PLAN) {
  // ...
  return { ...updatedPlayer, plan: newPlan, previousPlan: newPlan, ... }
```

A player landing on 54 is declared finished **while standing on 54**. In every
other implementation 54 is an arrow to 68, and 68 is where the game is won.
On-chain and in the apps a winner is on Cosmic Consciousness; in these two they
are on the plan of spiritual devotion, holding a win.

The scanner reports what it could not read rather than staying silent about it.
That list started at five files and is now empty: the four decorative SVG
components turned out to hold correct boards in a fifth shape, and the Expo
test a sixth.

**Eighteen copies, twelve correct, nothing unread.** The six that disagree are
the four Inngest files and the two web3 hooks, as before — the extra copies
found since were all correct, which is itself the point: a scanner is only
worth having if its silence means something.

`extractBoards` and `declaresBoard` now live in `@leela/engine`, tested rather
than trusted, because a scanner that knows five of six shapes under-reports
exactly the way the code it audits does. Writing those tests found two defects
in the scanner itself: quoted keys (`"12": 8`) were not read, and
`:leftwards_arrow_with_hook:` — an emoji name — was taken for an arrow
collection and reported a profile screen as an unreadable board.

### The boards mostly agree. The rules do not.

`detectRules` reads which rules an implementation carries, and across the
thirteen copies there are **five different games**:

| Copies | entry on 6 | 3 sixes | no overshoot | win on 68 | report gate |
|---|---|---|---|---|---|
| `leela`, `leela-game` | yes | — | yes | yes | — |
| both web3 hooks | — | — | yes | yes | — |
| `ChatBot.tsx` | yes | — | **—** | yes | yes |
| both `GameService.ts`, all four Inngest files | yes | yes | yes | yes | — |
| `LeelaGame.sol` (both) | yes | yes | yes | yes | yes |

Two things worth naming:

`ChatBot.tsx` has all twenty jumps right and **no refusal to overshoot**. A
player near the end can roll past 72 and off the board. It is the only copy
missing that check, and its board being correct is exactly what would stop
anyone from looking.

Only the contract enforces the report gate — already known, now confirmed
mechanically rather than by reading.

The detector reads one file at a time, so a rule split across files reads as
absent: the published app's re-rolling die lives in `DiceStore.ts`, not in
`helper.ts`, and shows as "—" for both. A prompt to look, not a verdict.

## Seventh pass: a deployment that verifies itself

`actions/deploy-pages` reports success when the upload succeeded. Nothing
checked that the site then worked, which meant a broken asset path or a book
whose pages missed the artifact would deploy green and stay that way until
somebody happened to open it — as I had been doing, by hand, with `curl`.

`apps/miniapp/src/smoke.ts` is five checks, chosen so each fails for a
different reason: the app's HTML, the book's index, a page deep inside it, the
stylesheet, and the privacy policy. Every one asserts something beyond a 200,
because a 200 proves a file exists and not that it is the file we meant to
ship — the Russian plan page must actually contain "Рождение", not merely
respond.

They are pure functions over a fetcher, so the same code runs against a fake
site in tests and against the live one in CI, as a `verify` job after `deploy`.

## Eighth pass: a board nobody could play with a keyboard

The mini app shipped 72 squares as `<div role="button" tabindex="0">` with a
click handler and nothing else. Every square was reachable by Tab and announced
to a screen reader as a button; neither Enter nor Space did anything. Confirmed
against the live site by focusing a cell and dispatching the key presses, not
by reading the source.

Focusable and inoperable is worse than not focusable at all — it promises
something and withholds it.

They are `<button>` elements now, with `aria-label` carrying the plan's name
(the visible text is a bare number) and the snake and arrow glyphs marked
`aria-hidden`. A native element brings its keyboard behaviour with it and
cannot drift from it, which is the argument against the `role` version in
general and not only here. `createCell` moved out of `main.ts` so the claim is
tested rather than asserted.

A visible focus ring came with it: cells that are reachable by keyboard and
give no sign of where the focus is are the same problem wearing a different
disguise.

The book was checked the same way and came out clean — 104 links on the
contents page, none without an accessible name, one `<h1>` per page, `<main>`
throughout. Guards added so it stays that way.

## Ninth pass: two defects a player would have met

**A path that could not be sent.** Telegram refuses a message over 4096
characters outright, so a player twenty plans into a game would have asked for
`/path` and received nothing — a rejected API call, not a truncated message.
`renderPlan` had accounted for this; `/path` had not. It paginates now, packing
entries into as few messages as fit and never splitting a report across two: a
report cut in half reads as two half-thoughts, which is worse than an extra
message.

**A palette that failed its own threshold.** The snake, arrow and win colours
were picked by eye. Measured against the surface they are drawn on they came
out at 4.50, 3.64 and 3.05 in the light theme and 3.46, 4.27 and 5.11 in the
dark — not one clearing 4.5:1 in both, which is what a single palette for two
backgrounds produces. The red that displays as 4.50 is a hair under it, which
is its own lesson about eyeballing a number that has a threshold.

Two palettes now, with `contrast.ts` measuring them, and a test that confirms
the check would have failed on the colours that shipped — a check incapable of
failing proves nothing. Dark is selected two ways, because neither alone is
enough: a media query for a plain browser, and `data-theme` from Telegram's own
`colorScheme`, which is authoritative in the app and can differ from the system.

## Tenth pass: a path that belonged to the table instead of the player

`/path` required a room. Clearing a table with `/end`, or asking in a different
chat, answered "No table here yet" — and everything the player had ever written
became unreachable, though it was sitting in the database under their own id
the whole time.

Reports belong to the player. `pathFor(language, entries)` takes a language
rather than a room, and the transport falls back to the asker's Telegram locale
when there is no table to take one from. The seating check went with it: a
player's own reports are theirs whether or not they are at this table.

This was in the bot's README as a known gap, written there by the same pass
that introduced it. Worth noting how it arose — `/path` was built as a command
at a table because every other command is, and the shape of the neighbours
decided the shape of the thing rather than what it was for.

## Eleventh pass: a companion that could not see the path

The guide received the current plan and the current report, and nothing else. A
reflection on plan 40 was read as though it were the first thing the player had
ever said — in a game that is a path, and where the point of keeping reports is
that they accumulate.

`PlanContext.journey` carries where the player has been and what they wrote
there. It is **summarised, not quoted**: the most recent squares, one line each,
inside a character budget. The plan's own text is what the answer must be
faithful to, and forty reports at full length would push it out of a small
context window, leaving the model nothing to rest on.

A test found a real defect in that budgeting. Entries were filled oldest-first
and the loop stopped when the budget ran out — so the squares dropped were the
newest, exactly the ones a player has just written and is most likely to be
carrying. It fills newest-first now and restores walking order for the prompt.

The bot passes the path it already reads for `/path`, minus the report being
answered. What cannot be checked here is whether the answers are better: that
needs an `OPENROUTER_API_KEY`, and only the prompt is testable without one.

## Remaining, in order

**1. Secrets — do this first, it is the only irreversible risk.**
`~/Dropbox/KeyForMobileApp/leela/leela-my-release-key.keystore` is the single
copy of the signing key for `com.leelagame`. Without it the published app can
never be updated — a new listing would be the only option, losing every
install and every RevenueCat subscription. Put it in a password manager
alongside the keystore password and the `applicationId`. This has deliberately
not been automated: the key should not be copied around by a script.

**2. Migrations — done.** `packages/db/migrations` holds two files: `0000`
creates the schema from nothing, `0001` adopts a database the Expo app already
created. Both are re-runnable, neither drops anything, and 24 tests check that
the SQL and `schema.ts` describe the same columns — the pair that would
otherwise drift apart on the first change.

Importing from the published app is `playerFromLegacy`, covered by 22 tests.
The gaps in the legacy shape are handled explicitly rather than guessed at:
`previous_plan` was never stored and is recovered from the move history (or set
equal to the current plan, which reads as "has not moved"); the sixes counters
are zero because that app has no three-sixes rule to have tracked; and
`needs_report` carries across so migration does not hand an unreported player a
free roll.

What is still needed here is the export itself — a Firebase dump and a Supabase
dump — and a decision on how ids are assigned. The conversion is ready.

**3. `apps/mobile`.** Port `NeuroLeelaAgent`, switch it to `@leela/engine` and
`@leela/content`, then bring across RevenueCat, notifee and Sentry from
`leela`. Keep the `applicationId` and the bundle id.

**4a. `apps/bot` — done.** Group play in a Telegram chat, 41 tests, no token
needed to run them: `commands.ts` is pure functions from `(room, input)` to
`(room, replies)`, so a whole game plays out in a test. Each room's die comes
from a seed derived from its chat id, and every roll is the *n*-th value from
it, so a game replays from `(seed, rollsTaken)` — both stored — and nobody has
to take another player's word for a throw.

Persistence followed: `DatabaseRoomStore` splits a room into a `sessions` row
and its `session_players` rows, with `roomToRows`/`roomFromRows` pure and tested
to round-trip a game exactly. The failure mode here is silent — a game that
reloads with the wrong turn holder still looks like a game — so the test's fake
returns seats in reverse to prove turn order comes from the `seat` column and
not from the query. Migration `0002` adds `sessions.language`, without which a
restarted table dropped every player into English.

Reports are now kept. Commands stay pure by returning an `Effect` describing the
write instead of performing it, and the transport applies effects after the room
is saved, so a failed write cannot leave the board ahead of the writing.

`SqliteRoomQueries` closed that gap: SQLite is built into both runtimes, so a
durable bot needs no dependency and no server. Set `LEELA_DB` to a file path and
games survive a restart; leave it unset and they do not, and the process says
which on startup.

Two things the runtimes disagree about, both handled: Bun has no `node:sqlite`
at all, only `bun:sqlite`, so both are tried; and Vite's list of Node builtins
predates `node:sqlite`, so it is loaded through `createRequire` or the test
suite fails to load entirely.

A test caught a real ordering defect on the way: reports were sorted by
`created_at` alone, so two written in the same millisecond came back in
whatever order SQLite chose. `id` now breaks the tie.

**`/path` closed the last gap in that loop.** Reports were being written and
never read back — the gate made a player reflect, the store kept it, and
nothing ever returned it to them. A player's own account of the squares they
have stood on is the record the game is played to produce, so it is now a
command.

The distinction that needed care: a store that keeps nothing must say so,
rather than returning an empty list. "You have not written anything" and "this
bot is not keeping reports" are different statements, and only one of them is
true when `ReportSink.history` is absent. That absence is the signal — hence an
optional method rather than one that returns `[]`.

**4c. `packages/ai` — done.** The service it replaces asked the model to
*invent* a description of the plan a player had landed on, while the traditional
text for that plan sat unused in the repository in 22 languages. It also carried
spiritual commentary for 5 of the 72 plans, hardcoded in Russian — and most of
those 5 were unreachable, because move-type messages were checked first
(`GameMessageService.generateMessage`).

So the rule here is that the model never supplies the teaching. `systemPrompt`
puts the canonical text into the prompt and says plainly that it is the source
and the model is not. 28 tests hold that line, including one that asserts the
prompt never *asks* for the text to be produced — matched on the shape of the
request, since matching the word "invent" would catch this prompt's own
instruction not to.

`LanguageModel` is one method, so no provider SDK enters the dependency tree and
every test runs with no network and no key. `openRouter` refuses to be
configured without a key rather than throwing on a player's first message, which
is where the old service failed. Anything unreliable — the network, the model, a
timeout — falls back to a usable sentence that still names the plan: a game must
not stop working because a companion is unavailable.

Wired into the bot at the report gate, and optional there: without
`OPENROUTER_API_KEY` the gate still works and reports are still kept, there is
simply no reply.

**4b. `apps/docs` — done.** The book, generated from `@leela/content`: 1785
pages, 72 plans and the rules chapters in each of 22 languages, served from
`t27.ai/leela/docs/` in the same Pages artifact as the game.

Deliberately not Docusaurus. The archived `leela-ai-site` was one, and it kept
its own copy of the 72 plans per language — the duplication that let 744 titles
rot across 15 languages until someone looked. Here the book cannot drift from
the game because there is nothing to drift from.

**Rescued in the process:** `docs/policy.md` and `docs/eula.md`, in English and
Russian, which existed nowhere else in the monorepo. A missing privacy policy is
a store rejection and a blocker for listing a Telegram mini app; these were
sitting in an archived repository. Languages without a translation are served
the English rather than an empty page.

Two defects the tests caught rather than a reader: the root page marked English
as "current" and so offered no link to it, and every plan printed its
description above a body that began with the same words — the Russian source
puts the first paragraph in the frontmatter.

`apps/site` is not built. The landing page in `leela-chakra-nextjs` is a Next.js
app whose only real content is a board and a dice roll, both of which the mini
app now does better; what remains of a landing page is the docs root. Skipped
deliberately rather than ported.

**Translation audit — done, and it found nothing.** The 19 machine-translated
languages hold up at term level: parenthesised transliterations survive in all
22 locales, no two plans share a body, and body lengths sit where each script's
density predicts (CJK at 0.3–0.5× English is dense, not truncated). The 19
titles where the term matches the name are almost all plan 37, *Jnana (jnana)*,
which reads that way in the English source too — and on Hindi, `जन्म` genuinely
is *janma*. Four guards now hold that line against a future rebuild. The real
translation damage was the numbering, fixed in the third pass above.

**5. `packages/contracts` — done.** `LeelaGame.sol`, deployed at
`0x2741CE9C9fA1c9B78b20cab7F07998d77846b7Af`, is a fourth copy of the board:
twenty `else if` branches. All twenty land on the same squares as the engine,
and `WIN_PLAN`/`TOTAL_PLANS` match. `verify.ts` reads the Solidity and asserts
it, so an edit to either side fails a test instead of quietly making an
on-chain game a different game.

**The contract is where the report gate came from.** `require(...,
'You must create a report before rolling the dice.')` is the only enforcement
of that rule anywhere in the 25 repositories — the published app gated online
play, and the Expo rewrite kept a `needs_report` column it never checked. That
it survives in deployed bytecode is the evidence the gate belongs to the game.

**Two divergences, permanent because deployed.** The entering six is counted as
the first of a run, so the reset comes a throw sooner; and
`positionBeforeThreeSixes` is overwritten on every six rather than only the
first, so a third six returns the player to where the third six began instead
of the first. Neither is a flag on a `RuleSet`, so they are described by a fifth
variant, `onchain`, rather than treated as bugs to fix.

The subgraph is not ported. `leela-ai-4` is the newest of four iterations, and
running it needs a deployed indexer — a deployment decision rather than a code
one.

**6. Archive the source repositories.** Twenty of the twenty-five have been
superseded. Archiving on GitHub is reversible and keeps every commit, which
matters for `leela` (211 commits) and `NeuroLeelaExpo` (114) — `NeuroLeelaAgent`
is a squashed import and does not carry that history.

## Repository sizes

`leela` is 400 MB, `LeelaAiWeb3` and `LeelaChakraAiMobile` 62 MB each. Assets
should go to git-lfs in the monorepo. History is not worth rewriting: the
archived repositories preserve it.
