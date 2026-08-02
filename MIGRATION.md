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
needs an `OPENAI_API_KEY` or an `OPENROUTER_API_KEY`, and only the prompt is
testable without one.

## Twelfth pass: what happens after the game ends

Two things nobody had looked at, because a finished game is the part you stop
testing.

**Nothing deleted a finished table.** `/end` was the only route out, and it is
manual, so every table ever opened stayed in the database — thousands of dead
rooms after a year. `pruneFinished` forgets tables whose game ended over a week
ago, at startup rather than on a timer: a bot that is never restarted is not
accumulating tables either. Reports are untouched — a table is scaffolding, a
report is the player's, and `/path` must find it years later.

The condition needed care. A game is over when every seat has finished *after*
being on the board; a seat that never entered has `previous_plan = 0` and is
waiting, not done. Treating those as finished would delete a game before it
started, which is why there is a test for exactly that.

**The end was a dead end.** `/roll` on a finished game answered "This game is
over." and stopped. A player was left with no hint that another table is one
command away, or that the path they had just walked was still readable. Both the
winning message and the refusal now point somewhere.

## Thirteenth pass: a flag the transport never read

`Reply.broadcast` was set on every reply from the moment the command layer
existed — nineteen of them marked private — and `deliver` never looked at it.
Everything went to the chat the command came from.

In a private chat that is harmless, which is why it survived every test: the
bot has only ever been played one-to-one. In a group it means a player's
`/path` — their own reflections on themselves — is read out to everyone at the
table, along with the gate telling them to write one, and the companion's answer
to it. The companion's reply was worse still: it bypassed `deliver` entirely and
went straight to `ctx.reply`.

Private replies now go to the player. Telegram refuses a message to anyone who
has not started a chat with the bot and gives no way to ask in advance, so
`DirectChannels` assumes it can write, remembers a refusal, and forgets that
refusal once a message succeeds — a player who opens a chat later must not stay
locked out.

When there is nowhere private to send it, the group gets a nudge naming the
command and **carrying none of the content**. `destinationFor` returns
`chat-fallback` rather than silently choosing to expose it, so the caller is
told which situation it is in.

Worth naming the shape of this one: a flag that is set correctly everywhere and
read nowhere. It cost nothing to add, looked complete in review, and would have
been discovered by the first group that played.

## Fourteenth pass: the same shape, found on purpose

The previous pass found a flag that was set everywhere and read nowhere. Rather
than wait for the next one to surface, every field of `RuleSet` was checked the
same way — written, then searched for outside its own declaration.

`rerollOnRepeat` had eight mentions and **zero readers**. It is declared on all
five variants, documented in two places, asserted in `detectRules`, and no code
had ever consulted it: the bot rolled `seededRoller` and the mini app rolled
`rollDie`, both fair. So `legacy-mobile` and `online` claimed to reproduce the
published app — which re-rolls a repeated value — and did not. That claim is the
entire reason those variants exist.

`rollerFor(rules, base)` is where the flag is read now, once, rather than at
each call site — reading it per call site is how it came to be read at none of
them. Both apps go through it.

The other four fields — `extraTurnOnSix`, `threeSixesReset`,
`requireReportBeforeRoll`, `turnCooldownMs` — were already honoured. All five
have readers now, and the audit is a one-line command worth repeating whenever a
field is added:

```bash
grep -rn "<field>" --include="*.ts" packages/*/src apps/*/src | grep -v "readonly <field>"
```

## Fifteenth pass: the audit found a migration that could not be re-run

The grep from the previous pass was applied to every interface, not only
`RuleSet`. One field came back with a single mention: `legacy_id` — written by
`playerFromLegacy`, guarded by a unique index, and read by nothing.

That absence had a consequence. `migrateBatch` had no way to know who had
already come across, so a second pass returned rows that already existed. The
unique index would reject them and take the whole transaction with them —
including the accounts that had *not* been migrated yet. A live migration is
never one attempt, and this one could only ever be attempted once.

It takes `alreadyMigrated` now and reports in three categories, with a skip
distinguished from a failure: an operator reading "3 failed" would go looking
for a problem that is not there. It also catches an account listed twice within
one export, which the index would reject for the same reason.

The old call signature still works, because the fix should not be a reason to
touch call sites that were correct.

Worth noting what the audit actually bought: not the unread field itself, which
was harmless, but the thing its absence implied. A field nobody reads is often a
question nobody asked.

## Sixteenth pass: the defect this project was named after, reproduced here

The audit turned up `needs_report`: written by `playerUpdateFromState`, written
by `playerFromLegacy`, present in the schema and in both migrations — and read
by nothing.

That is precisely the defect found in NeuroLeela on the second pass, quoted in
`rulesets.ts` as *"The schema carried `needs_report`, but nothing ever enforced
it."* The comment was written here, in this repository, above a flag that this
repository was also failing to enforce.

The gate does work for a seated player, because a session carries
`reportSubmitted` — which is why it survived every test. A lone row in `players`
had the flag and no way to reach `canRoll` with it, and `players` is the table a
mobile client or a server-side handler would use.

`turnContextFromPlayer` and `canPlayerRoll` in `@leela/db` are where the column
is read. The loop is closed in a test: what `playerUpdateFromState` writes,
`canPlayerRoll` acts on.

Three passes, three flags written and never read — `broadcast`,
`rerollOnRepeat`, `needs_report`. The pattern is not carelessness about any one
of them; it is that writing a field feels like finishing the work, and nothing
in a type system disagrees.

## Seventeenth pass: stop finding these by hand

Three passes in a row found a field written everywhere and read nowhere. The
fourth was not going to be found by remembering to look.

`scripts/audit-unread.mjs` reports them. It is in CI, and it **does not fail the
build**: a field can be legitimately write-only, and a check that blocks on a
judgement call gets switched off rather than heeded. There are 34 such fields
here, each with a written reason, so the list cannot quietly become where unread
fields go to be forgotten.

Tests are not searched, deliberately. `broadcast` was read in its own tests and
nowhere else, which is precisely the state worth catching: a field the suite
confirms and the program ignores.

**It found one immediately.** `Reflection.fromModel` distinguishes a real answer
from the sentence shown when the companion is unreachable — and nothing read it,
so an outage looked exactly like a reply. The bot logs it now: the player sees a
plausible message either way, so silence there made the failure invisible.

Building it cost three defects of its own, all caught by its tests:

- A stylesheet held in a `.ts` template literal is full of `gap: 3px` lines that
  parse as field declarations. Reporting them taught nothing except to distrust
  the report.
- `temperature: options.temperature ?? 0.7` was counted as a pure write, because
  the line looked like a declaration. Three separate rules for declarations,
  columns and literals became one: remove every `name:`, and read whatever
  survives.
- The regex was escaped one level too deep, so `[\w$]` matched a literal
  backslash. The test that failed was the one asserting it would have caught all
  three original flags.

## Eighteenth pass: an export nobody called was wrong

The field audit is automated, so the same question was asked of exported
functions: which are declared and never called. `hasWon` came back with none.

It was wrong. `hasWon(initialState())` returned **true** — a player who had not
yet rolled once counted as a winner, because `is_finished` is also set while
waiting on 68 for the six that lets you in. The condition needs
`previous_loka !== 0` as well, which `session.ts` had and said so in a comment;
`game.ts` did not.

Three copies of one rule, and the copy nobody used was the broken one. There is
one now: `isPlayerDone` and the bot's `renderStandings` both call `hasWon`.

What the audit is actually good for: not finding dead code to delete, but
finding the code that no caller has ever disagreed with. `hasWon` had a test —
asserting it was true after a win, which it was. Nothing asked what it said
before one.

## Nineteenth pass: the export audit, automated, and what it found

`hasWon` was found by hand. The same question now runs in CI for exports as
well as fields, with the same rule: report, do not fail. Re-exports and import
lists are stripped before counting, or a barrel file would make everything look
consumed.

Two findings, one of each kind the audit can produce.

**A promise the schema made and nothing kept.** `gameStepRow` had no caller and
`game_steps` had no rows. The table, the mapper and the migration all existed;
no move was ever recorded. A path is recoverable from `(seed, rollsTaken)`, but
only by someone who knows to look — a move log is the version a person can read.
The bot writes one now, through the same `Effect` mechanism as a report, and a
failure to write it cannot stop the game: the move has already happened.

**The second unused export that turned out to be the weaker of two copies.**
`validatePosition` accepted `1.5`, and the string `'5'`, because a range check
without an integer check is not a check that a square exists. `isOnBoard` had it
right. Both are one function now, with a test asserting they agree on every
input — the same shape as `hasWon` the pass before, and the same cause: nothing
called it, so nothing disagreed with it.

The two lists of justified exceptions — 34 write-only fields, 45 exports without
local callers — each carry a reason. That is the point of them: a list without
reasons is where things go to be forgotten, which is how these got here.

## Twentieth pass: not "never called" but "never executed"

`hasWon` and `validatePosition` both had tests. The tests passed. Neither
exercised the input that was wrong. So the next question is not which code has
no caller but which **branch** never runs — and `session.ts` had branch coverage
of 89.7%.

The uncovered branch was in `standings`, and it was wrong. A player waiting to
enter sits on WIN_LOKA, the highest square on the board, so sorting by position
put someone who had never rolled **at the top of the table** — as though they
were one square from winning. The same trap as `hasWon`: 68 means two different
things depending on how you got there.

Three groups now: finished, on the board by how far along, and waiting to enter.
Branch coverage of `session.ts` went from 89.7% to 97.8%, and the engine's from
98.0% to 99.5%.

Also verified rather than assumed: the move log added last pass really does
record. `CREATE TABLE IF NOT EXISTS` added `game_steps` to the live database on
restart, and a game played through `roll` → `Effect` → `sqliteStepSink` leaves
rows behind. Three passes ago that would have been a claim; the table existed
then too, and nothing wrote to it.

## Twenty-first pass: branch coverage in the rest of the packages

The engine's uncovered branch was a real defect, so the same measurement was
taken everywhere. `@leela/db` was at 97.4%, and the two uncovered branches were
the guards against a malformed record.

They worked — nothing threw — but the report they produced was useless.
A Firebase export can contain a hole where a document was deleted, and three
such records gave three identical lines reading `(no owner)` with reasons like
*"null is not an object (evaluating 'user.plan')"*. An operator running a dump of
five thousand accounts and getting twelve of those has no way to find any of the
twelve.

Failures now carry the record's **index** in the export, and a hole is
distinguished from a record with no uid: `(not a record)` against `(no owner)`,
each with a reason written for a person rather than leaked from a property
access. `legacy.ts` is at 100% of branches.

**One uncovered branch turned out to be unreachable rather than wrong.**
`summariseJourney` returned `''` when nothing fit the budget, and nothing ever
could: the longest possible entry is about 175 characters against a budget of
1200. Rather than delete a guard that is correct or leave a branch that cannot
run, the budget became a parameter — so the guard is exercised at a smaller one,
and stays true at the default.

Coverage where it is low is honest about why: `apps/miniapp` sits at 49% of
statements because `main.ts` is a DOM entry point, and the logic worth testing
was moved out of it into `cell.ts`, `describe.ts`, `contrast.ts` and `smoke.ts`.

## Twenty-second pass: checks that had never failed

Branch coverage in `docs` and `contracts` turned up no wrong code. It turned up
something else: **checks that had only ever been asked about the case that
passes.**

`compareConstants` compares the contract's `WIN_PLAN` and `TOTAL_PLANS` against
the engine's. Every test asked it about the real contract, which agrees, so it
had never once returned a divergence. A check that has never detected anything
has not been shown to be able to — the same argument made three passes ago about
the contrast palette, applied to something written before that argument existed.
It now has four cases: a missing constant of each kind, and a wrong value of
each. `verify.ts` is at 100% of branches.

`describeDivergences` prints `nowhere` for a jump one side lacks. Only one side
of that sentence had ever been printed.

In `docs`, the uncovered branches were fallbacks the content does not currently
need: a rules chapter with no title, and a language with no chapters at all.
`RuleChapter.title` is typed `string | null` and all 22 languages have one for
every chapter, so neither runs against real data. They are exercised directly —
a page showing a slug where a heading belongs is worse than one showing nothing,
and worse still is not knowing which it would do.

That is the whole finding of this pass: three of the four places had correct code
and untested guarantees, which is a different problem from a bug and not a
smaller one.

## Twenty-third pass: the game spoke English at a Russian table

`room.language` reached exactly one function. `planFor`.

A table opened by a Russian speaker served all 72 plans in Russian, and said
everything else in English: whose turn it is, that you owe a report on the plan
you are standing on, what the commands are, what the buttons do. The mini app
did the same — it resolved the player's language, drew a Russian board, and
described every move in English. So did the companion's fallback, which is the
sentence a player reads at the moment the game can least explain itself.

Nothing was broken in the sense of being wrong. The sentences were simply
written where they were used, and a string literal in `commands.ts` has no
language.

**The catalogue.** `packages/content/src/messages.ts`, next to the plans,
because both are things the game says. Three properties, in order of how much
they matter:

  - English is complete *by construction* — `MessageKey` is derived from the
    English catalogue, so a key without English text is not a key.
  - A missing translation falls back per key, not per language, so a
    half-finished catalogue is useful the day it is started.
  - Plurals belong to the language. Russian distinguishes one/few/many; a
    catalogue offering `{one, other}` prints "5 плана". `Intl.PluralRules`
    decides which form to ask for, and a test asserts that every language is
    given every form it declares it needs — which is an assertion about the
    shape, not a list of the languages translated so far.

**Two languages, not twenty-two.** English and Russian are complete. The other
twenty fall back. Machine-translating forty sentences into twenty languages
would have taken an afternoon and would have been the same mistake as the 744
machine-translated titles that rotted here unnoticed until the third pass went
looking. The gap is instead *reported*: `messageCoverage` is printed by the bot
on startup, so an operator reads it before a player does.

**How it is held.** Not by a list of the sentences that were wrong. `apps/bot`
plays a whole game at a Russian table — openings, refusals, the report gate,
snakes, arrows, three sixes, the path, the help — and asserts that no Latin
prose comes out of any of it. Commands, HTML tags and `{placeholders}` are
stripped first, because those are syntax. A sentence added in English tomorrow
fails that test rather than shipping. `apps/miniapp` does the same across every
reachable move from every square.

**Found on the way.** `describeStandings` carried a fourth copy of the win
check — `is_finished && previous_loka !== 0` — which had already lost the
condition that the player is standing on the win square. Behaviourally
identical today, because the engine only sets `is_finished` on square 68. It
now calls `hasWon`, which is the function that exists to stop exactly this.

**Still English on purpose:** `formatWait`'s "3h 5m". It is a duration, not
prose, and it belongs to the engine, which has no language.

## Twenty-fourth pass: two of the twenty-two languages read the other way

`apps/docs` has set `dir` per language since it was written. The mini app —
the surface most people actually play on — set `lang` and stopped there. An
Arabic or Urdu player got Arabic prose in a left-to-right layout, because
`directionOf` lived in `apps/docs`, which was the first place that had needed
it. The same shape as the message catalogue one pass ago: knowledge kept next
to its first caller rather than next to its subject, so the second surface goes
without.

`directionOf` and the endonyms are in `@leela/content` now, with `Language`.

**The harder half is the opposite rule.** The board must *not* follow the
reader. Under `dir="rtl"` the grid mirrors: plan 1 moves to the bottom right
and every snake descends the other way — a different board drawn from the same
data. So the mini app sets `dir` on the document and pins `dir="ltr"` on the
board.

**The same defect in the bot, where it is invisible.** The board is sent as a
monospace block of two-digit numbers, and digits are *weak* in the Unicode
bidirectional algorithm: inside a right-to-left paragraph, which is what an
Arabic or Urdu Telegram client provides, a row reading `01 02 03` is displayed
as `03 02 01`. Nothing in the string is wrong. The board is mirrored anyway,
and no test that reads the string would ever notice. `asLeftToRight` wraps it
in U+2066…U+2069 — unconditionally, because a board that mirrors for some
readers and not others is two boards.

**A stylesheet written in left and right is written for half the readers.**
`ol.plans .n { text-align: right }` put the plan numbers against the far edge
of an Arabic page with the gap in the middle: `dir` reorders the layout and a
physical direction does not follow it. Logical values now, and the assertion is
the rule rather than the two places that broke it — no physical direction in
either stylesheet outside a rule that names one, with a single documented
exception inside the board, which is pinned and therefore physical by design.
A companion test checks the audit can fail, on each of the five properties.

**Also checked against the content rather than the table:** the direction of a
language is asserted by looking at the script its plans are actually written
in, so the table cannot claim `ltr` for a language whose text is Arabic.

**Deleted rather than waived:** `allLanguages` and `isRightToLeft`, written in
this pass with no caller. `audit-unread.mjs` named them and the honest answer
was to remove them, not to add a reason to `PUBLIC_API`.

## Twenty-fifth pass: a failure that cannot fix itself was treated like weather

The bot is running with a DeepSeek key whose account has no balance. Every
report made a round trip, waited for it, got `402 Insufficient Balance`, and
answered with the fallback — a sentence that had been decided before the call
was made. The log line was the same one a single dropped connection produces,
so nothing in it said this deployment had never worked. It was found by reading
a balance page, which is not where a bot's problems should be discovered.

`Guide` now separates the two. **401, 402, 403, 404** mean a person has to do
something: the key is wrong, the balance is empty, the key may not use this
model, there is no such model. None will be different on the next report, so
the companion goes quiet for half an hour, says why once, and answers from the
fallback without calling anything. **429 and 5xx** are the weather and are
retried exactly as before.

**400 is deliberately on the weather side.** One over-long prompt should not
silence the companion for everyone for half an hour.

**The silence expires.** A balance is topped up and a key is replaced without
anyone restarting a bot, and a companion that needs a restart to notice is one
more thing to remember at the worst moment. After the cool-down it tries once;
a success clears the silence entirely.

**Two consequences beyond the log.** A silenced companion no longer reads the
player's whole report history out of SQLite to assemble a journey for a call
that will not be made. And `guide.status()` gives the bot the reason to print
beside the fallback, so "hiccup" and "never configured" stop looking alike.

The tests are about the two classes rather than about 402: every status that
needs a human must stop the calls, every status that does not must keep them,
and a failure with no status at all — a dropped connection, an abort — is not
evidence that anyone needs to do anything.

**Not covered:** the journey being skipped. `bot.ts` is the one file with no
test harness — driving it needs a fake Telegram API, which is its own piece of
work. The `Guide` behaviour it rests on is covered; the wiring is not.

## Twenty-sixth pass: what the bot said about a throw that moved nobody

From a live game, in a private chat, seven throws in a row:

> Dmitrii бросает 2. Не хватает места — бросок не проходит.
> Следующий ход — Dmitrii.

Both sentences are wrong, in different ways.

**The first describes a rule the player is not under.** They are waiting to
enter and are not short of room; they need a six. `apps/miniapp` worked this
out when it was written and left a comment saying so — *"the first version told
a player waiting to enter that there was 'not enough room' — describing a rule
they were not under yet"* — and the bot never got the fix, because each surface
wrote its own sentences and neither knew what the other could say. Entering is
now its own sentence too: a six no longer reads as a step from 68, a square
nobody has stood on.

**The second is half of everything a solo table hears.** "X is next", to X,
after every throw. It is now said only when the turn actually changes hands.

**The pairing is what stops the next one.** `@leela/content` holds both
catalogues, so a test asserts that every outcome a move can have — entering,
needing a six, no room, a third six, a snake, an arrow, a step — has words on
both surfaces, and that no `move.*` key is missing from that pairing. One
surface can still phrase it better than the other; neither can be silent about
something the other can say.

The bot-side tests walk every die value from the waiting square rather than
the one that was reported: all five failing values must name the six, none may
claim a move from 68, and a solo table must never be told who is next.

`join.already` now points at `/start` instead of stopping at "you are already
seated" — the reply the host got for tapping the Join button under their own
new table.

## Twenty-seventh pass: the file nobody could test, and what it was hiding

`bot.ts` was the one file with no harness. The pass before last said so in
writing, as a gap left open. Everything in it — who a reply is addressed to,
whether a button appears, whether a callback is answered, whether plain text is
taken as a report — existed only as code that had been read.

grammY calls `getMe` before handling anything unless it is told who it is, so
`botInfo` is now an option. From there `handleUpdate` drives the whole surface
and `api.config.use` catches every call that would have left the process. No
network, no token, 54 tests.

**It found a defect on its first run.** `/new` silently threw away a table
where nobody had entered yet. The guard read

```ts
existing.session.players.every((p) => p.state.is_finished)
```

as "the game is over" — and a player waiting to enter sits on 68 with
`is_finished` set, so a table opened seconds ago counted as finished. Seats,
language, seed, all replaced without a word. It is `isSessionOver` now, which
is the engine's own answer and knows the difference.

That is the **third** time 68 meaning two things has cost something: `hasWon`
was the first, the leaderboard the second. Each time the fix was to ask the
function that knows rather than to re-derive the condition.

A table that is filling up now says so, rather than claiming a game is running
that the host has not started.

**Closed the gap it was named for:** the journey is no longer assembled for a
silenced companion, and that is now asserted by counting reads of the report
history rather than by reading the code.

**What the harness asserts is the surface, not a list.** Every command answers
something, on an empty chat and at a running table — *"silence is
indistinguishable from a broken bot, and that is how this one first looked"* was
a comment in the file and is now a test over all thirteen. Every callback
action answers the query, including the ones that do nothing, because Telegram
leaves a spinner otherwise.

**One thing the harness documents rather than fixes:** `bot.catch` covers the
polling loop, which is how this bot runs. It does not cover `handleUpdate`, so
a webhook deployment would have to catch for itself. Asserted as it is, so
whoever changes it finds out from a test.

## Twenty-eighth pass: the win was erased at the moment it happened

Same move as the last pass, on the other surface. `main.ts` was the mini app's
untested file — the state it saves, the state it trusts on the way back, and
everything the screen shows. Two defects were in it, and one of them could only
have been seen by playing a game to the end.

**Reaching Cosmic Consciousness undid itself.** `draw()` asked
`state.is_finished` to mean "waiting to enter". A player who has *won* is also
finished, so at the moment of arriving on 68 the header reset to `—`, the
progress bar dropped to zero, the token came off the board and the Read button
went dead — while the sentence underneath said they had arrived. That is the
**fourth** place where 68 meaning two things has cost something: `hasWon`,
the leaderboard, `/new`, and now the one screen where it is the whole point of
playing.

The decision is `view.ts` now — `headline(state, language, titleOf)`, a pure
function from a game to what the screen should say — so it can be asserted
across every state a real game reaches rather than by playing to the end by
hand. The invariant it holds is the one that broke: *waiting* is
`is_finished && !hasWon`, and nothing else.

**The saved game was trusted on one field.** The check read that `loka` was a
square and handed the rest to the engine. `localStorage` is writable from the
console, by an older version of this app, and by a write that was interrupted —
and `consecutive_sixes: "2"` makes the three-sixes rule quietly stop working,
because `"2" + 1` is `"21"` and never equals 3.

`state.ts` replaces it with a rule rather than a list: **a saved game must be
one the engine could have produced.** Every state from forty deterministic
games is accepted; a state finished on plan 41, a run of three sixes that would
have reset, a direction the engine never writes, and each field removed in turn
are not. The consistency check is the one a field-by-field pass misses —
`is_finished` is only ever set on the win square.

Storage that throws on access — a private window with cookies blocked — is a
game that plays and forgets, not an error.

## Twenty-ninth pass: the board players know

Asked where the design went, and the answer was that it had never been brought
across. `leela/assets/about/images/gameboard.png` — the painted field from the
published app, snakes and arrows and feathers — sat in four of the source
repositories, byte for byte identical, while the mini app drew a grid of grey
squares. A diagram of the game rather than the game.

It is the board now: 147 kB of WebP instead of 750 kB of PNG, with the squares
laid over the paint as transparent hit targets. The grid is inset to the
image's *numbered area* rather than to its edges — the painting has a margin,
and a grid stretched across the whole file puts every square a little to the
left of the number it belongs to. Verified on an iPhone simulator rather than
by arithmetic: a six, and the ring landed on the painted 6.

The numbering matches without adjustment. Both come from the same board.

**A fifth instance of 68 meaning two things, found by looking at the screen.**
Entering the game is recorded as a move *from* 68, because that is where a
waiting player sits — so the trail marker lit up Cosmic Consciousness and told
a player who had just thrown their first six that they had come down from the
top of the board. Nobody moves out of 68 in play, so a trail starting there is
always the wrong story, and `headline` no longer draws one.

**Z.AI is a fourth provider** on the same client — a base URL and a default
model. The trap it carries is worth the comment it got: Z.AI sells two kinds of
key against two paths, and a Coding Plan key sent to the pay-as-you-go host
comes back as error 1113, which reads as an expired key. `ZAI_PLAN=coding`
picks the other path.

## Thirtieth pass: what the board is without the painting

The painting carries the numbers, so putting it in meant hiding the squares'
own text — `color: transparent`. Right while the image is there. A blank white
rectangle with 72 invisible buttons when it is not, and a 147 kB image on a
phone on a train is not a certainty. That is a defect introduced by the pass
before this one, on the same day.

The plain board is the default now and the painting is an upgrade: `paint.ts`
loads the image and only then sets the background and the `painted` class the
stylesheet keys off. The background is set from there rather than from the
stylesheet, so the load that decides the class is the load the board displays —
a CSS `background-image` gives no way to find out that it failed.

Checked the way it should be: the built app served from a server that answers
404 for the art, opened on an iPhone simulator. The board is the numbered grid
it was until this week, snakes and arrows and all, and the game plays.

**Two of the tests are about the stylesheet, not the module.** A class is only
worth setting if the CSS reads it, so they assert that `color: transparent` is
scoped to `.board.painted` and that the stylesheet contains no `url(...)` at
all. Without those the module could be perfect and the board still blank.

**The direction audit could not see `inset`.** Written two passes ago against
`text-align`, the margins, the paddings and the four offsets by name — and the
mini app then used the shorthand, whose four-value form is exactly those four
offsets. It is caught now, with the board's own rules excepted for the reason
the board is pinned `dir="ltr"`: it is a diagram, and mirroring it moves plan 1
to the other corner.

## Thirty-first pass: two functions that lied about their type

The mini app's loader now demands a state the engine could have produced. The
bot reads its games out of SQLite through `sessionFromRows`, which cast each
column into engine state and handed the result over. Same defect, on a surface
read by everyone at the table rather than by one player.

**What a single bad row did.** `ruleSetById` was typed to return a `RuleSet`
and returned `undefined` for an id no longer known — so the chat that row
belonged to threw on `rules.reports` for *every command anyone sent, forever*,
three files away from the value that was wrong. A stale `turn_index` did the
same through `currentPlayer`. The player saw silence, which is the failure this
bot has already been through once.

Both are total now: `ruleSetById` throws a `RangeError` naming the id and
listing the variants, `currentPlayer` a `SessionError` naming the turn and the
table size. Neither falls back to `classic` — that would change the rules of a
game in progress without telling anybody.

**A hole the test found while being written.** `RULESETS['toString']` is a
function inherited from `Object.prototype`, so the truthiness check let it
through and returned a function typed as a `RuleSet` — worse than the
`undefined` the guard was written to catch. `ruleSetById` goes through
`isRuleSetId`, which asks `hasOwnProperty`.

**At the boundary,** `sessionFromRows` now checks every column it copies and
throws `StoredRowsError` naming the seat, and `DatabaseRoomStore` reads that as
"no table here" and writes down why. `/new` opens another; a throw on every
update is not something a player can recover from. A database being down is
still an error — swallowing that would turn an outage into "no table" for
everyone at once.

**The round trip is asserted both ways.** Twelve played-out tables, every
state, written through the real `seatUpdate` and read back identical. A check
that only rejects can be satisfied by rejecting everything; this is the half
that says it is not. Building the rows by hand for that test lost `direction`
and the assertion caught it — which is exactly the drift it exists for.

## Thirty-second pass: the flag that would have said so

Two functions were typed to return a value and returned `undefined`. Both were
found by hand, one per pass. `noUncheckedIndexedAccess` is the compiler flag
that describes what an index into an array or a record actually means, and it
was switched off in every package — explicitly, `"noUncheckedIndexedAccess":
false`.

Turning it on across the monorepo: **308 errors, 27 of them in shipped code.**
None of the 27 was a live bug — every one was provably safe and the type did
not know it. That is the point: the flag is not for the bugs already found, it
is for the next `ruleSetById`.

Each of the 27 is fixed so the safety is visible rather than asserted. No `!`
anywhere: a loop over `entries()` instead of an index, a destructured default
instead of `split()[0]`, a named channel instead of one destructured out of a
mapped array, an explicit `?? user.plan` where the fallback is meaningful. Three
copied blocks in `extract.ts` became one function taking two patterns — they
differed only in the inner regex, and a copy is where a fix goes missing.

**Tests are out of scope, deliberately.** `rows[0]` in a test is a value the
test built two lines earlier; a guard there adds noise rather than truth. So
each package has a `tsconfig.src.json` and a `typecheck:strict` script, and CI
runs both typechecks.

**A flag turned on in eight files is a flag that will be missing from the
ninth,** so `scripts/audit-configs.mjs` checks that every workspace shipping
code has the strict config, that it says what it should, and that
`package.json` can run it. On its first run it reported a ninth workspace —
`packages/ui`, an empty untracked placeholder like `apps/mobile` and
`apps/site`. That was the audit being wrong rather than the repository: a
workspace is a `package.json`, not a directory, and a check reading the
filesystem would otherwise say different things here and in CI.

**One real thing fell out.** `apps/miniapp/src/smoke-run.ts` is a Node program
— it reads `process.argv` — sitting in the source tree of a browser bundle, and
it only typechecked because a test file imported `vitest`, whose types drag
Node's globals in behind them. It lives in `scripts/` now, and `src` is
typechecked without Node's globals so the next one cannot hide the same way.

## Thirty-third pass: the right file

The board went in two passes ago and it was the wrong image.

`assets/about/images/gameboard.png` is the illustration from the rules screen:
the same field, with the numbers and a border of feathers and crystals baked
in. The board the game is played on is
`src/components/GameBoard/images/{light,dark}.png` — the snakes, the arrows and
the Flower of Life on 68, and nothing else. It looked close, which is why it
survived a pass.

`GameBoard/index.tsx` is unambiguous about the rest, and it is transferred as
written:

- the numbers are **not** in the painting. The app lays a nine-by-eight grid of
  circles over it and writes each number itself — and writes a space in box 68,
  because the flower is already there;
- the squares are circles: `borderRadius: s(31) / 2`;
- the player is a **gem** on their square, `Gem/images/one.png`, not a ring
  drawn around a number;
- there are **two** boards. The snakes on white, and the same snakes on black
  behind Leela herself, chosen by colour scheme.

The corner arrows the first attempt drew on every snake and arrow square are
gone: the snakes and the arrows *are* the painting, and a second copy in the
corner of a square is a caption on a photograph. They stay on the plain board,
where they are all there is — the fallback from the last pass still works, and
still gets its 404 test.

**Alignment is the published app's, not a guess.** `GameBoard` gives the
painting the grid's width and lifts it above the circles; without that lift the
Flower of Life lands under 68 rather than on it. Checked on a simulator, which
is also where the gem turned out to be invisible: `.board.painted .cell` clears
every square's background and outranked `.cell.here`, so the token lost to a
rule about the squares underneath it.

**The direction audit earned its keep again.** The new paint layer used `left`
and `right`; rather than widen the board exception a second time, the layer is
`inset-inline`.

145 kB of feathers replaced by 120 kB of board and 40 kB of its dark twin.

## Thirty-fourth pass: the die

The board came across last pass and the thing you throw at it did not.

`components/Dice/index.tsx` is a pressable image: you tap the die itself, it
spins, and it settles on the face you threw. The mini app had a button reading
**Roll** — the player was told what they threw in a sentence and never saw it.
Six faces, `Dice/assets/{1..6}.png`, 17 kB for all of them.

**The spin is a function of the value, and that is the point.**
`handleSpin` runs `(value / 2) * 500` milliseconds through one turn per unit,
so a six turns six times and takes three times as long to settle as a two. The
wait is part of the throw. Transferred as written, with the value decided
before the spin so the animation can be cut to fit it rather than the other way
round.

`die.ts` keeps the two decisions out of the DOM: which face, and how long. The
tests assert the property rather than the six numbers — a larger throw takes
longer and turns further — plus the two things a live die must never do: show
nothing, or spin for `NaN` milliseconds and leave the game waiting behind a
disabled control.

**One thing the simulator showed immediately.** `applyChrome` wrote the word
"Roll" into the button, which now had a die in it — so the pips read through
the letters. A control's name and its appearance are not the same thing: the
name is an `aria-label` and a tooltip now, and a test asserts the die is named
without being written on.

Reduced motion turns the spin off. The value is decided before it starts, so
that changes how the throw feels and nothing else.

## Thirty-fifth pass: the snakes did not land on their squares

Reported by the person playing it, and true. The grid was laid across the whole
painting, and the painting is *larger than the grid* — so every snake and every
arrow was about a square from where it belongs. It was not obvious to look at,
because the arrows cross, which is why it shipped.

The numbers were guessed and are now derived. `GameBoard/index.tsx` composes
the same two things, and at the design scale it says:

```
art    343 x 307      grid 297 x 280, at (23, 28) inside it
```

so the grid covers 86.6% of the painting's width and starts 9.1% down it. The
first attempt used 100% and 0%.

**Checked against the picture, not against the eye.** Cropping exactly the cell
those numbers give for square 68 — x 323..391, y 58..131 of the 714×639
original — contains the Flower of Life, centred, and nothing else. That is the
one landmark in the art whose square is not in doubt.

`scripts/board-overlay.mjs` draws the engine's tables over the image so the two
can be compared at once: a ring where a jump starts, a dot where it lands. It
is a tool for a person rather than a check for CI — twenty jumps crossing each
other is a thing to look at, not to assert about.

**What is asserted** is that the stylesheet still matches the derivation. The
test recomputes the offsets from `GameBoard`'s layout and compares, so a nudge
to make it "look better" fails rather than quietly moving every snake again.

**The die is under the board now, centred** — the published app puts it above,
which on a phone this tall is out of reach of a thumb.

## Thirty-sixth pass: the rule the game is played for

Two things this pass, one of them my own mistake.

**The painting's height was never read from the painting.** `714 × 639` came
from looking at a rendering of it; the file says `630`. A 1.4% stretch, which
took the lower rows with it. The test reads the `VP8X` chunk of the shipped
WebP now — fifteen lines against a number that was wrong for two passes because
it was copied off a screenshot.

**The mini app had no report gate.** `require(..., 'You must create a report
before rolling the dice.')` is in the deployed contract; the published app
carried it as `isReported` on every player; the bot has had it since it was
written. The mini app let anyone throw for ever without once saying what a plan
brought up, which is the game with its point removed.

So: a throw is refused until the plan has been written about, the die dims and
says why, and `My path` gives back everything written, oldest first. The
journal lives under its own storage key — adding a field to the saved game
would have made every game in progress fail the validator that guards it.

The tests assert the rule rather than the situations: over a played-out game
the gate agrees with `owesReport` and the journal at *every* step, and it shuts
at least five times, so passing means something. A report is *something
written* — an empty one does not open it. And the journal is held to the same
standard as the saved game: one this app could have written, or it is replaced.

**A boolean, not a plan number.** Landing on a plan a second time owes a second
report. That is why `isReported` was a boolean in the published app, and it is
why it is one here.

### What could not be brought across, and why

Profiles, a feed, comments, likes, moderation — the published app's `Posts`
collection in Firebase, with `ownerId`, `liked[]`, `accept` and the rest.
**These need a server.** The mini app is static files on Pages with
`localStorage`; there is nowhere to put another player's report and no one to
moderate it. Skipped under the standing rule about work that needs a deployment
decision rather than code.

The multiplayer surface already exists and is the bot: a table in a group chat,
reports kept in SQLite, `/path` reading them back. What is missing between the
two is a shared identity, which is the same server question.

## Thirty-seventh pass: a year of writing, in one browser

The gate went in last pass and the reports it produces had nowhere to go.
Clear the site data, change phone, and everything anyone had written was gone.
The published app kept reports in Firebase and the bot keeps them in SQLite;
the mini app has neither, so the answer is a file.

**Save a copy** writes a JSON document with a `schemaVersion`, and puts a
readable version — plan, title, what was written, in order — on the clipboard
at the same time. One action, because a second button for the same path is a
choice nobody wants to make. **Bring one back** reads a file in.

**The assertions are about what a file must never do.** Bringing one back is a
union, so nothing already written is lost; doing it twice changes nothing the
second time, because people do import the same file twice and a path that
doubles is a path nobody trusts; and it never opens the report gate — a report
written on another device, about another plan, is not a reason to let this
player throw.

**A file is the least trustworthy thing in the app.** It has been out of the
app, through a chat, and possibly through an editor. Ten shapes are refused
rather than half-read, including a `schemaVersion` from a newer build: older is
readable, newer may mean something different by the same field.

**The direction audit caught the new CSS again** — a file input stretched over
its label with `inset: 0`. Third time; each time the fix has been a logical
property rather than a wider exception.

This is also the only bridge to the network that needs no server: the file is
something a player can carry into a chat, and the bot is where reports are
shared.

## Thirty-eighth pass: writing the rules down

Thirty-seven passes of principles lived in this file and in the passes'
reasoning, which is a poor place for them: to know why something is the way it
is you had to read the whole history.

[spec-kit](https://github.com/github/spec-kit) is installed —
`/speckit.specify → plan → tasks → implement`, with specs in `specs/<nnn>-<slug>/`.
Its scripts do not create branches, which suits a repository that pushes only to
`unified`.

**The constitution is the real work here.** Seven principles, and every one of
them is a thing that cost something: one description of the rules (68 has meant
two things six times now), a test asserts the shape of the defect, a check that
has never failed has not been shown to work, trust nothing that has been outside
the process, say what happened, the player's language and the player's board,
and read the sources rather than inferring them.

`CLAUDE.md` and `AGENTS.md` did not exist. They do now, and they say the two
things that matter most: read `leela-src` before writing anything, and assert
the shape rather than the case.

**The first spec is the one that has been blocked all along.**
`specs/001-shared-reports/` writes down what "reports and profiles and a
network" actually requires — a shared identity and somewhere to put a report
that is not one device — with the two open questions marked rather than
answered, because both are a deployment decision. A refusal in a chat message is
lost; a spec with `[NEEDS CLARIFICATION]` in it is a thing to come back to.

## Thirty-ninth pass: the build description that had never been built

A Dockerfile was committed last turn and no Docker daemon exists on this
machine, so it had never run. Simulating it — copying exactly what `COPY`
copies into a temporary directory, with an isolated Bun cache so nothing was
warm — found three things, in rising order of seriousness.

**One: the install fails.** `--frozen-lockfile` refuses an install whose
workspace set does not match the lockfile, and six of the eight manifests were
copied. `lockfile had changes, but lockfile is frozen`.

**Two: the sources would clobber the install.** Bun 1.3's isolated linker puts
the workspace links inside each package's own `node_modules`, and `COPY
packages packages` over the top replaces links made for the image with links
made for a Mac. There was no `.dockerignore`, so the host's `node_modules` were
in the build context in the first place. There is one now.

**Three: a store that cannot be opened kills the process.** Pointed at a path
whose directory cannot be made, the bot exited with `SQLITE_CANTOPEN` before
printing a word — while `apps/bot/README` promised it would run and say it was
holding games in memory.

*Corrected in the fortieth pass:* this entry first said the bot dies **when the
volume is not mounted**, which is wrong. The `VOLUME /data` instruction creates
that directory in the image, so the missing-volume case was never the crash. The
crash is real for any path that cannot be made — the claim was too strong, and
it was made from a local simulation rather than from a container.

`openStorage` knows three cases where `index.ts` knew two: kept, held in memory
on purpose, and held in memory *because the path could not be opened*. A store
now makes the directory it lives in, and a store that still cannot be opened is
named, once, with the path in the message — because the answer is almost always
a mount point that is not there.

The assertion is the shape: **`openStorage` has no failure mode that reaches
the caller.** A bot that will not start is worse at keeping a game than one that
forgets it.

## Fortieth pass: the image, built by something other than me

Three defects were found in the Dockerfile by hand last pass, and nothing would
have stopped the fourth. `docker build` runs in CI now, and the container is
started twice — once plainly, once pointed at a path that cannot be made.

**Every assertion was rehearsed before it was committed, and two were wrong.**

The first draft required the container to still be running when a `timeout`
stopped it, and read exit code 124 as the pass. It is 0: `timeout` signals the
`docker run` client, which exits cleanly. That check would have failed a
working bot on the first push.

The second is a correction to what I wrote last pass. I claimed the bot dies
when the volume is not mounted. Built and run, it does not — the `VOLUME /data`
instruction creates that directory in the image, so the directory is always
there. The crash I found was in a local simulation that had no such
instruction. The claim was too strong and is corrected above; `ensureDirectory`
is still right for any path whose directory does not exist, and is covered by
`storage.test.ts` rather than by the container.

**What the job does catch, proven by breaking it on purpose.** With the
fallback removed from `openStorage`, the image pointed at `/proc/leela.db`
exits 1 and prints nothing but a stack trace, so that assertion discriminates.
The build step catches both install defects by construction.

Colima was started to do this and stopped afterwards. A check that has never
run is a check nobody has seen fail — and two of these had never run.

## Forty-first pass: asking the chain

`packages/contracts/README.md` said "Deployed at 0x2741CE…" as a plain fact and
rested an argument on it — two divergences from the engine were called
permanent *because deployed*. Nobody had ever asked a chain.

Four were asked. Three answered that the address holds no code; the fourth did
not answer. And `hardhat.config.ts` in `smart-contract-leela` has exactly one
network entry — **Mumbai**, which Polygon shut down in April 2024.

The contract is a historical artefact. That does not weaken the check against
the engine: the Solidity is a fifth independent description of the board,
written by people who had to get it right. It does weaken the *argument*, and
the README now says so.

**The test is about the shape of the overclaim, not about this address.**
`scripts/lib/deployment.mjs` separates three findings — present, absent,
unreachable — and the assertions are that silence never becomes absence,
however many chains are silent, and that the three findings read as three
different sentences so a reader cannot mistake one for another. A probe that
reports a timeout as "no contract" is how a confident sentence gets written
that is not true.

**Not in CI**, deliberately: it needs public RPCs, and a gate that goes red
because somebody's node was busy teaches people to ignore red. It is a tool for
when the answer matters, and the answer it gave is written down with its date.

## Forty-second pass: the numbers this repository says about itself

Two passes in a row were about a confident sentence that had never been checked
— a bot that "dies without a volume" and does not, a contract "permanent
because deployed" on a network shut down in 2024. Both were written from
inference. The obvious next question is what else here is asserted and unasked,
and the answer with the shortest fuse is the table in `README.md`: eight
per-package test counts and a total, **maintained by hand for forty passes**.

`scripts/audit-claims.mjs` runs every suite and compares. It caught a stale
number on its first real use — its own tests had just moved the engine from 202
to 212 — which is the demonstration that matters more than the ten assertions
below it.

**The rules, not the numbers.** The tests assert what the check does, because
the numbers change every pass and a test repeating them would be a second
hand-kept copy of the thing under suspicion:

- a count that differs is named with **both** values, so a reader knows which
  to trust;
- a package that runs tests and is **not in the table** is a problem — a table
  correct about everything it lists can still leave something out, and that is
  the one nobody notices;
- a package in the table that ran nothing is a problem;
- the total is checked against **the sum of the column**, not against the
  suites. A total that agrees with reality but not with the table above it is
  still two numbers in one document disagreeing, and a reader adds the column.

In CI, beside the other audits.

## Forty-third pass: a path can now be sent to the bot

The mini app can save what a player has written. The bot could not read one
back, so somebody who used both surfaces had half a path in each and a whole
one in neither. Sharing them properly needs a server and a shared identity —
`specs/001-shared-reports`, which is a deployment decision. **A file needs
neither.**

Send the JSON the mini app saves to the bot, and whatever is new is kept.
One-way and manual, and the only bridge between the two surfaces that exists
today.

**The format is its own package,** `@leela/journal`, with no dependencies at
all. It is imported by a browser bundle and by a Bun process, and two surfaces
that describe a format separately describe it differently — which is the
mistake this whole repository was assembled to undo. The mini app's
`journal-file.ts` keeps only what is its own: turning a path into something to
*read*.

**What the tests hold.** Taking a file in is a union, so nothing already
written is lost; the same file twice adds nothing the second time; a file that
repeats itself adds each report once. A file is refused whole or taken whole —
half a path is worse than none, because the player would not know which half.
And `decide` is **total**: a file is a thing a stranger can send, so every
input produces an outcome that can be said out loud and nothing throws.

**Two reports that differ only in when are two reports.** A player who returns
to a plan writes about it again, and the key includes the moment for that
reason.

The size is checked against what Telegram reports *before* the file is
downloaded: there is no reason to fetch a hundred megabytes to find out it is
not a path.

### The image job earned itself back

The push above failed `bot-image`: `@leela/journal` was a ninth workspace and
the Dockerfile's hand-written list of manifests had eight lines.
`error: Workspace dependency "@leela/journal" not found`.

That is the job doing exactly what it was added for, one pass after it was
added. It is also the third hand-kept list in this repository to go wrong, so
`audit-configs.mjs` now checks it: every workspace that ships code has a `COPY`
line, and every `COPY` line points at a workspace that exists. Both directions,
because a package removed leaves a line that fails the build with a message
about a missing *file* rather than a missing package.

## Forty-fourth pass: the other half of the bridge

Last pass the mini app could save a path and the bot could take one in, and
that was called done. It was one-way: a player who plays mostly in a chat could
not get what they had written **out** — not to another device, not into the
mini app, not into a notes app. Half a bridge is worse than none, because it
looks finished.

`/save` sends the path as a document. `@leela/journal` is the format on both
sides, so what the bot writes is what the mini app reads by construction — and
the assertion that matters says exactly that: **a path taken out and sent
straight back adds nothing.** If the two sides ever describe the format
differently, that is what fails.

Three answers, not two, as `/path` has had since it was written: a file, or
"you have written nothing", or "this bot does not keep what you write". Only
one of those is about the player.

The file is written oldest first, because the store hands back newest first and
a path is read in the order it was walked. It is indented, because a file sent
into a chat gets opened. And it is named `leela-path-bot-<date>.json`, because a
player with both files in one folder wants to know which is which.

**Two things the audits took back out.** `entriesOf` was a convenience invented
for a contorted line in a test — the line went, and `audit-unread` named the
function the same minute. And the first version of those tests reached past a
union with `{} as never`, which typechecks nowhere and says nothing; the
narrowing belongs at the call site, where the transport does it too.

## Forty-fifth pass: the help was not the whole surface

`/help` calls itself "the whole surface, in one message" and named nine of the
eleven commands the bot answers. **`/end` was not among them** — while another
message tells the player to "send /end", so the bot referred to a command it
never introduced.

The harness's own list of commands was hand-written too, and was missing
`/save` the day it was added. That is the fourth hand-kept list in this
repository to go wrong, so it is derived now: the tests read the commands out
of the help message, and out of `bot.ts`, and check **both directions**.

- Every command the bot registers is named in the help, `/help` itself
  excepted — a line telling a reader how to read the message they are reading
  is noise, and the exception is written down rather than assumed.
- Every command the help names is registered. A help that promises something
  which does nothing is worse than one that leaves it out.
- Both lists have to be non-empty, so a regex that matched nothing cannot pass
  the first two.

**And the two new handlers were driven for the first time.** `/save` and
`message:document` went in with only their pure halves tested — which is how
the last defect in `bot.ts` was found, and how a fourth would have been missed.
Five transport tests: nothing written sends no file, a path sends exactly one,
a store that keeps nothing says so, a file too large is refused *without being
fetched*, and a file that cannot be read still gets an answer.

## Forty-sixth pass: what the published app actually does

Asked to read the shipped app's logic rather than remember it. `store/helper.ts`
and `screens/helper.ts` are the two files that decide a move in
`com.leelagame`, and three of their rules had never been carried across. All
three are now **variants**, not corrections: the boundary here is that a change
in behaviour goes through a `RuleSet`, and a live player must not be handed a
different game overnight. `classic` is untouched.

**A six owes no report and starts no day.** `createHistory` gates on
`values.count !== 6`: a six writes its history and nothing else, so the player
throws again with no reflection and no day's wait. That is what the extra turn
is *for* — a run of sixes is one move, reported once, at the end of it. The
engine asked for a report on every arrival, including the six that enters the
game. Now `reportAfterSix` says which, and `arrivedOnSix` reads it out of the
state, because the state is what the next throw has.

**A throw that could not be made starts no day either.** `entities` returns
nothing when the throw would overshoot 72, so `createHistory` never runs. A
player who cannot move was being made to wait a day for the privilege.

**A player who has won may not throw their way back in.** `stepCount === 6 &&
!isFinished`. The game is over; starting another is what the app's "Start over"
button is for.

### The correction that correction needed

The first version of the re-entry rule read "has won" as `previous_loka !== 0`,
which is what `hasWon` had always said. A player migrated out of the published
app who *never started* has `previous_plan` equal to their plan — the export
carried no history, and `stateFromLegacy` sets the two the same on purpose,
because that reads as "has not moved yet". Under the new rule they would have
been barred from ever entering, by a migration that was supposed to bring them
across.

`hasWon` says `previous_loka !== state.loka` as well now, and an existing test
in `packages/db` that asserted the old behaviour asserted the app's instead.
That test is the reason this was caught in the same pass rather than by a
player.

**`DEFAULT_RULESET` is `neuroleela`**, and the mini app was calling
`owesReport(state)` without saying which rules it plays. It plays `classic`, and
now says so: a default is a poor place to learn which game you are in.

## Forty-seventh pass: when the day starts, and what counts as a report

The other half of the same reading. `store/helper.ts` decides the move; the two
files that decide what a *report* is are `constants.ts` and
`components/CreatePost/index.tsx`, and neither had been carried across. Both are
variants again — `classic` is untouched, and a live player does not wake up in a
different game.

**The day starts when the report is written, not when the die was thrown.**
`startStepTimer` is called from `CreatePost` and from nowhere else. The engine
measured the wait from the roll, so a player who threw and reflected for six
hours got a six-hour discount on the next throw, and a player who wrote at once
paid full price. `cooldownFrom` is `'report'` for `legacy-mobile` and `online`.

**A report is a hundred characters.** `yup.string().trim().min(100)` in the
published form. The bot accepted anything non-empty, which is a different game
from the one people played for years: the length is the mechanism, not a
validation detail. `minReportChars` is 100 for the same two variants, and the
bot now says how many are missing rather than silently taking the line.

### What this made visible

Recording the moment needs somewhere to keep it, and `lastReportAt` had to go
through `SeatedPlayer`, `TurnContext`, both tables (`0003_last_report_at.sql`),
and the bot's own SQLite store. Two defects fell out of that, and both are the
shape this repository keeps finding rather than anything about reports:

- **`StoredSeat` was a hand-written copy** of what `seatUpdate` returns. The new
  field was spread in at runtime, dropped from the type, and never written — a
  game that reloaded having forgotten when its last report was. It is now
  `ReturnType<typeof seatUpdate> & {…}`, which caught a second hand-written copy
  in the tests on the first compile.
- **`CREATE TABLE IF NOT EXISTS` does nothing to a table that exists.** The
  bot's volume outlives every release, so a column added to `SCHEMA` would never
  have reached the deployed database, and the first write to it throws inside the
  transaction — the chat is told there is no table. `addMissingColumns` derives
  the additions from `SCHEMA` itself rather than keeping a list of past
  migrations, because a list of past migrations is a hand-kept list and this
  repository has now been wrong about four of those.

**The AI was read and deliberately not changed.** The published app sends the
plan's text as an `assistant` message with a translated persona at temperature
0.1, so the model interprets a teaching it has been given rather than inventing
one. `packages/ai` already forbids the model to invent the teaching, by a
different mechanism and with 126 tests on it. Two designs, one rule; churning
one into the other would be a change with no behaviour behind it.

### The push that failed, and what it changed

This pass went to CI red. The local check was `tsc --noEmit`; what ships is
`tsc --noEmit -p tsconfig.src.json`, which turns on `noUncheckedIndexedAccess` —
two different commands, one of them run by a person and the other by the build.
The error was a destructured regex group, and fixing it took a line; the reason
it was not caught locally is worth more than the line.

- `bun run verify` now runs both typechecks as well as the tests, so the local
  command and the CI command are the same command.
- **CI's package list is checked against the repository.** Three shell loops
  each name every workspace by hand, because a `for pkg in …` cannot ask what
  the workspaces are. A tenth package added without touching those lines is not
  a red build — it is an absent one, which reads exactly like a passing one.
  `checkCiPackages` is in `audit-configs`, with six tests on the rule.

## Forty-eighth pass: the checks that were not running

Nothing left in the list below is code — what remains is secrets, an external
dump, a keystore and an archive operation. So this pass went looking at the
checks themselves, and found two that had stopped working without saying so.

**`audit-copies.mjs` had not run under `node` for some time.** That is the check
that walks the donor repositories and reads all eighteen copies of the board —
the one that found a hundred-square Snakes and Ladders set pretending to be
Leela. It imports the engine's TypeScript, the engine imports `./board` with no
extension, and Node has no extension search. README told a reader to run it
under `node`, and that command dies in the loader.

(The command is not spelled out here on purpose. The new check reads the docs
for invocations, and a broken one written down as an example is still a line a
reader can copy — it caught this paragraph on the first run.)

Nothing caught it because the script needs the donor clones, so it cannot be a
CI job — and a check nobody can run reads exactly like a check that passes.

`scripts/audit-scripts.mjs` closes that class. Every script declares its runtime
in its shebang; the docs must name the same one; and the import graph is walked
statically to prove Node could follow it. Static rather than a smoke test
because running these has side effects — which is not a hypothetical, see below.
Every `audit-*` script must also either run in CI or carry a `Needs:` line
saying what stops it, so an exemption is a sentence with a reason rather than an
absence that reads as an oversight.

Two findings, in opposite directions: `audit-copies.mjs` documented as `node`
and unable to run under it, and `board-overlay.mjs` documented as `bun` when it
runs perfectly well under Node. A list of commands kept by hand goes stale both
ways at once.

### The accident, which was the more useful half

While proving the scripts could not be smoke-tested safely, one was run with a
source directory that did not exist. `build-content.mjs` found nothing, wrote an
empty `rules.json` and an empty manifest, exited 0, and printed "Content built".
Twenty-four tests in `@leela/content` went red for a reason none of them named.

Restored from git in a second — and then treated as the finding it is, because
two separate silences had to line up for it:

- **The generator did not know what it was replacing.** It keeps the best copy
  of each language it finds across the donor repositories, so an incomplete
  source produces a *smaller* dataset rather than an error. It now reads the
  committed manifest first and refuses to write a build that loses a language or
  loses plans, naming each loss; `--force` is there for the day that is genuinely
  wanted. Gaining is never refused — a guard that fires on good news is a guard
  people pass `--force` to by habit.
- **CI's dataset check could not fail on an absence.** It iterated *the languages
  the manifest listed*, so an empty manifest was zero iterations and a green job.
  It would have accepted the damage. `audit-dataset.mjs` holds the data to
  `LANGUAGES` in `packages/content/src` instead — a promise declared in code —
  and reads the plan files rather than trusting the summary the same generator
  wrote.

A third thing fell out: the manifest recorded `generatedFrom` exactly as typed,
so the committed file carried one machine's home directory, and rebuilding from
`../leela-src` and from `/Users/…/leela-src` produced two different datasets. It
is stored relative to the repository now. The job called
`content-is-reproducible` cannot actually check reproducibility — that needs the
donor clones — and its comment now says so rather than implying otherwise.

## Forty-ninth pass: reading what the repaired audit said

Last pass fixed `audit-copies.mjs` and never read its output. Run in full, it
reported eighteen copies, twelve agreeing — and two lines that turned out to be
the interesting ones:

```
DIFF  LeelaAiWeb3/src/hooks/useLeelaGame/handlePlayerMovement.ts  (19 jumps)
      1 differences from the engine
```

Which difference? The audit knew. `compareToReference` returns a finding per
square, with the square, the target and the reference's target in it, and the
script printed the array's **length**. Opening the file by hand gave the answer
in ten seconds: the arrow from 54 to 68 is not there, because both web3 hooks
treat 54 as a win and stop the player on it. A summary that hides what it
summarised is this repository's oldest defect wearing another hat, and
`1 differences` is the tell that nobody had read the output.

Findings are named now, and `compareToReference` says what is missing rather
than only where: `no jump from 54, reference says 54 → 68`.

### The dash that meant two different things

The rules table printed `—` for anything `detectRules` did not find in the file
it was reading, and `detectRules` reads one file at a time. So the published
app's row said it has no re-rolling die and no report gate — when the die is in
`DiceStore.ts` and the gate is in `OnlinePlayer.store`, neither anywhere near a
board. The caveat was written down, as a paragraph here that a reader of the
*table* never sees. The table says `elsewhere` now: same knowledge, in the place
where it changes a conclusion.

That mark immediately said something new — `LeelaAiWeb3` carries a three-sixes
rule somewhere, though its movement hook does not. Reading it: the rule is
there and it is inert.

```ts
if (state.consecutiveSixes === 3) {
  dispatch({ type: 'MESSAGE', message: i18next.t('treeSix', …) })
  dispatch({ type: 'INCREMENT_CONSECUTIVE_SIXES', count: 0 })
}
```

A message and a counter reset. Nobody moves. `positionBeforeThreeSixes` in that
repository is initialised to 0, listed in a GraphQL mutation, and **never read**
— and because the entering six is counted as the first, the branch fires on the
fourth six anyway.

**So `detectRules` was over-reporting.** It matched the field's *name*, which
made a type declaration, a fixture and a mutation body all read as the rule.
The rule is not a counter and not a field: it is that the third six sends the
player back, so the check and the move now have to be found together. Where they
send them differs by implementation — a dedicated saved square in most,
`previousPlan` in `leela-ai-web3`'s contract — and a scanner that knew only the
first would under-report exactly like the code it audits.

The table changed in exactly two places, and each was verified by opening the
file: both web3 hooks lose a rule they never played, and NeuroLeelaExpo's
`GameService.test.ts` moves from `yes` to `elsewhere`, which is what a test
asserting about a rule implemented next door should say. Four tests that
asserted the old behaviour — including one that read *writing* the field as the
rule — asserted the defect, and now assert the rule.

## Fiftieth pass: the die that forgot

Asked why nothing had changed in the simulator. Nothing had: the three passes
before this one touched rules, audits and scripts, and not one file under
`apps/miniapp` or `apps/docs`. That is correct and it is also the answer to a
different question than the one being asked, so this pass went to the screen.

The screenshot showed the gem on 11 and a circle on 5 — a six, plainly — and a
die showing **one**. `main.ts` called `showFace(1)` on load, hard-coded, and the
throw was never stored. Close the app after a six, come back, and the app
contradicts itself about the only event in the game.

The published app persists `DiceStore.count` and initialises it to **6** — both
the throw a player needs to begin and the face the die rests on. So the last
throw is kept now, under a key of its own: put inside the saved game it would
make `isSavedGame` reject every existing save, which is a player's whole path
dropped to remember a die. It is written with the throw rather than after the
spin, because a player who closes the app mid-animation threw that value all the
same.

Six tests, on the rule rather than on the values: anything that is not a face
this die has is not restored — a half-written string, a `0` from an older shape,
a `7` from another game, a float, a negative — and storage that throws is a
worse face rather than a broken app.

The die's dimming was checked at the same time and was already right: `opacity:
0.4` while a report is owed, which is `opacityCube` in the original. The faint
single dot in the screenshot was face one at forty per cent.

## Fifty-first pass: a throw that never landed

Kept playing the mini app rather than reading it, and the game died in my hands:
the die dimmed, the board stopped moving, and nothing on screen said why. The
saved state was a throw behind, and the die's inline style read
`animation: 1250ms linear running spin` — a spin that had never finished.

`roll()` applied the throw after `await new Promise(r => setTimeout(r, duration))`.
A browser throttles and then freezes the timers of a page nobody is looking at,
so a mini app switched away from mid-spin — a notification, a lock screen, a
glance at another chat, which on a phone is every few seconds — came back with
the die disabled, the throw never applied and the board never moved. Dead until
reloaded. It was found in a hidden browser pane, which is the same thing
happening to a robot instead of a person.

Two things, one rule: **a spin is decoration and the throw is the game.**

- `settle(duration, host)` ends the wait when the spin can no longer be seen —
  at once if the page is already hidden, and on the visibility change if it is
  hidden partway. Seven tests against a fake clock and a fake curtain: it
  settles once whichever comes first, leaves no timer and no listener behind
  either way, and a visibility event that leaves the page *visible* does not cut
  the spin short.
- The body of `roll()` is in a `try`/`finally`, so the die comes back whatever
  happened. It is the control the whole game runs through, and a dimmed one with
  no explanation is the app ending the game without saying so.

Also corrected from the pass before: the die's face is saved **after** the board,
not before. Written first, it could outlive a throw that never landed — the
inconsistency I had just made durable.

## Fifty-second pass: a free throw hiding in one square

Still playing rather than reading. Six turns in, the saved game read

```json
{"loka": 8, "previous_loka": 8, "direction": "snake 🐍", "is_finished": false}
```

— and the die was enabled. The player had thrown a four from 8, gone to 12, been
bitten by the snake there and landed back on 8. The most eventful turn the game
has, and the report gate opened as if nothing had happened.

`owesReport` began `if (state.loka === state.previous_loka …) return false`. It
was asking whether the **square changed** when the question is whether the
player **arrived**, and those come apart in exactly one place on this board:
standing on 8, throwing a four. Every arrow climbs, so no arrow can return a
player to where they started; of the ten snakes only 12 → 8 lands on a square a
single throw could have left.

Both surviving sources of truth disagree with the old behaviour, and neither
compares squares at all:

- **The published app.** `entities` returns `undefined` only for `plan > 72`. A
  snake returns `{ plan: 8, history: { status: 'snake' } }`, so `upFunc` writes
  the history and navigates to `PLANS_DETAIL_SCREEN` with `report: true`.
- **The deployed contract.** `if (player.isStart) require(reports[reportIdCounter].reporter == msg.sender, 'You must create a report before rolling the dice.')` — every roll in play needs a fresh report.

**Treated as a defect rather than a variant, deliberately.** The repository's law
is that a change in behaviour goes through a `RuleSet`, and that is right when
the surfaces genuinely disagree — three flags were added that way two passes
ago. Here they agree, and a flag that is true in all five variants is not an
axis, it is a comment. The correction is written down instead, with both
citations, and `arrivedByJump` is exported so the distinction has a name: a
refused throw leaves `'stop 🛑'` and owes nothing, a jump home leaves
`'snake 🐍'` and owes a report.

The test that matters is not that one square. It plays sixty seeded games to
completion and asserts that on **every** state reached, the gate agrees with the
event that produced it — plus a check that the jump-home case actually occurs in
those games, so the assertion is not passing for want of an example. Reverting
the fix fails it, and fails the worked case beside it.

## Fifty-third pass: the iOS app read again, for the AI and the book

Asked to study the published app's logic, documentation, rules, reports and AI
answer, and fix what diverges. The rules and reports were read two passes ago
and produced five variant flags. This pass went at the two halves that had only
been described: **the companion** and **the book**.

### The companion was running warm

`ChatScreen/index.tsx` posts to `api.openai.com` with `temperature: 0.1` and
`max_tokens: 800`. `LeelaAiWeb3`'s `generateComment` posts `0.5` and `1000`.
This package — whose whole stated rule is that *the model never supplies the
teaching*, the canonical text being in the prompt — was asking for **0.7**, the
highest of the three, because nobody had ever set it and that is the library's
own default for writing prose. Nothing overrode it: `completion` defaults to
`{}` in `guide.ts`, and neither the bot nor the mini app passes one.

Now 0.1, the stricter of the two published values, since the stricter one
belongs to the app this replaces. Held by two tests: one pins every provider to
the same value — a companion that invents on DeepSeek and interprets on OpenAI
is two companions — and one pins that value to the outside world (`<= 0.1`), so
the pair cannot drift together into agreement about the wrong number.

**And a reply cut off by the ceiling was handed over as a whole one.**
`finish_reason` was never read, so an answer that stopped mid-word looked
exactly like one that finished. It is trimmed back to the last sentence that
ended, or kept as it stands if none did — half a sentence is poor, nothing at
all is worse. The ceiling is 800 now, the app's own: brevity is asked for in the
prompt, where it can be judged, and a ceiling does not make an answer short, it
makes it stop.

### The English book had a chapter in Russian

Nothing had ever looked at the rules book. `NeuroLeelaAgent/docs/rules/` holds
six numbered English chapters and one file that is not numbered:
`game-logic.md`, titled «Логика игры НейроЛила» — developer notes on the
NeuroLeela rewrite, in Russian. The generator's hand-written map carried
`'game-logic': 'mechanics'`, so it was published as the seventh chapter of the
**English** book and served on the docs site for as long as the book has
existed. A test asserted its presence, on the strength of its slug.

English is also the fallback every language reads when its own is missing, so
that chapter was the one non-English text a reader of any language could be
handed.

The map no longer carries it, and `@leela/content` now knows what a language
looks like: `scriptOf`, `dominantScript` and `couldBe`. The rule is deliberately
coarse — it catches a text from the wrong *family*, which is the mistake that
actually happens when files are filed by hand, and does not pretend to tell
German from Turkish or Russian from Ukrainian. It weighs the text rather than
stopping at the first letter it recognises, so a Russian chapter with an English
word in it is still Russian, and it has no opinion about a heading like "72".

`audit-dataset.mjs` runs it over all 134 chapters in CI. It reported exactly the
two lines it should — the title and the body of that one chapter — and nothing
else across 22 languages.

**Left alone, deliberately:** four different chapter *sets* ship across the 22
languages. `ar` carries `online` and `foreword` from the published app's own
list; `ms` and `uk` carry those and lack `meaning`. Those are missing
translations, and filling them by machine is what put 744 rotted titles in this
dataset in the first place. The test asserts only that English — the fallback —
matches the common set.

## Fifty-fourth pass: the three things the game screen had and this one did not

Asked to study the published app's game logic and add every function the mini
app is missing, keeping the board as it is. So `Tabs/GameScreen/index.tsx` was
read rather than remembered, and it is short. Top to bottom it is a `Header`,
a `Dice`, and a `GameBoard` — and the header carries two buttons this app never
had:

```tsx
<Header
  iconLeft=":information_source:"  onPress={() => navigation.navigate('RULES_SCREEN')}
  iconRight=":books:"              onPressRight={() => navigation.navigate('PLANS_SCREEN')}
>
  {endGame && <ButtonWithIcon title={t('actions.startOver')} onPress={OfflinePlayers.resetGame} />}
</Header>
```

Three functions, all now here:

**The rules book.** `RULES_SCREEN` is a list of chapter titles that open a text.
`@leela/content` has carried that book in 22 languages since the third pass and
the mini app had no way to open it — a book nobody can open is a book nobody
has. It falls back as a whole book rather than chapter by chapter: half in one
language and half in another is worse than one a reader can at least read.

**All 72 plans.** `PLANS_SCREEN` is the same list over the board, so a player
can read a square they have not landed on. All 72 whatever the dataset holds —
a language missing a title still has a square, and the number is the fallback
because the number is what the board shows. The square the player is standing
on is marked, as the app marks it.

**Start over.** Shown only when the game has ended, from `resetGame`. It keeps
the journal on purpose: `AsyncStorage.clear()` in the original throws away
everything, and what somebody wrote about the squares they stood on is theirs.
Starting again releases the report gate and nothing else.

Two details worth the words. The visibility test is `hasWon`, not
`is_finished` — a player who has not entered carries `is_finished` too, which is
the 68 ambiguity this repository has now tripped over five times. And the icons
are 44px touch targets rather than 20px glyphs: they sit above a board, and a
glyph is not something a thumb can aim at.

The board and the die are untouched, as asked. The die stays under the board,
where it was put for the thumb.

### Two more, found by tapping rather than reading

The three functions above were verified in an iOS simulator, and the tapping
found two things the tests had not.

**"Bring one back" sat under every plan's text.** The journal's export and
import live in the same dialog as the plan texts, and only the export was ever
hidden — so reading a plan offered to import a journal, and the rules book
inherited that the day it existed. `showsPathTools` gives the pair one owner and
one rule: they belong to the journal and to nothing else, over every kind of
thing the reader can show, so a kind added later has to decide rather than
inherit.

**And hiding it did not hide it.** `.file` sets `display: inline-flex`, and a
`display` on an element beats the `hidden` attribute, which is only a UA
`display: none`. The label was hidden in script and stayed on screen — visible
in a simulator, invisible to the code that set it. `[hidden] { display: none
!important }` now means what it says.

## Fifty-fifth pass: the one square the gate skipped

Kept playing on the device, and walked a game to its end — the least-exercised
path in the app, and the one "Start over" had just made reachable. The winning
screen is right in every particular: the message, the gem on 68, the progress
full, the restart offered. And the report gate was silent.

`owesReport` began `if (state.is_finished) return false`. That is two different
statements wearing one flag. A player who has **not entered** carries
`is_finished` — the 68 ambiguity, now met for the sixth time — and owes nothing.
A player who has just **won** carries it too, and the published app asks that
player for a report every time:

```js
if (stepCount !== 6 || plan === 68) {
  navigate('PLANS_DETAIL_SCREEN', { plan, report: true })
}
```

`|| plan === 68` is the app's one exception to its own six rule: a six normally
owes nothing, and the winning square owes something anyway. Cosmic
Consciousness is the square a whole game is played to reach, and it was the
single arrival nobody was ever asked to write about.

`hasWon` tells the two meanings apart — it already had to, for exactly this
reason, since a player migrated from the published app with no history carries
`previous_loka` equal to their plan. So the gate now reads: nothing owed by a
player who has not started; everything else is an arrival; a six owes nothing
where the variant says so, **except on 68**.

Same reasoning as the pass before: not a variant. Both sources agree, and a flag
true everywhere is a comment. Three tests encoded the old behaviour, including
the property test written two passes ago — its definition of "arrived" excluded
the win, which is precisely the blind spot.

Verified on the device: reaching 68 now disables the die and offers "Write a
report", the writer is titled *68. Cosmic Consciousness (Vaikuntha Loka)*, and
writing it releases the die so a player can throw a six and begin again — which
is what `classic` means by `mayReenterAfterWinning`.

## Fifty-sixth pass: the bot announced every throw as a six

Played a whole game through the bot's command layer rather than reading it —
the same method that has now found four defects in the mini app — and the first
line back was this:

```
Ann throws 1. It takes a six to enter the game. | A six — throw again.
```

Two sentences about one throw, disagreeing about what it was.

`roll.again` was pushed whenever the next holder of the turn was the player who
had just thrown. **At a table of one that is always true**, so a solo player —
the commonest table the bot has — was told they had thrown a six after every
single throw. It had been that way since the branch immediately above it was
fixed for the same table shape: the comment there says a solo table used to say
"X is next" after every throw, "which is half of everything the bot said", and
the fix moved the noise one branch along instead of removing it.

The extra turn is the engine's answer — `keepsTurn`, from `grantsExtraTurn` —
and not something to infer from who holds the turn next. The chain now reads:
an extra turn says so; a turn that moved to someone else names them; a turn
that came back without a six says nothing, because a player alone at a table
can see whose turn it is.

**315 tests did not notice**, because none of them read what the bot says about
a throw that is not interesting. The four new ones assert the relation rather
than the sentence: over a solo game, "throw again" appears exactly when the
engine granted the extra turn; the bot never says "it takes a six" and "throw
again" in one breath; a table of two still names the next player; and a turn
that comes back without a six adds nothing. Reverting the fix fails the first
two.

## Fifty-seventh pass: the book lost your place

Built the book and read it in a browser, which nobody had done — it had only
ever been tested. It is well made: 1784 pages, a pager to the neighbouring
plans, contents, a language switcher on every page. And the switcher pointed at
the language's **contents**, not at the page you were on. A reader on plan 41
who switched to Russian landed on a list of 72 titles and had to find it again,
in a book whose whole reason for having 22 languages is that somebody wants to
read *this* plan in theirs.

`languagePicker` has taken a `path` argument since the day it was written, and
its own doc comment says "Every language, linking to the same place in each".
Nothing ever passed one.

**The check that would have caught it was skipping exactly those links.**

```js
if (href.startsWith('http') || href.includes('../../')) continue;
```

Every switcher link is `../../xx/`. So `resolves every internal link to a file
that exists` resolved about a tenth of them and passed. The exclusion is gone;
the test now checks **47,678** links across the 1784 pages and asserts the count
is over forty thousand, because an exclusion that quietly drops nine tenths of
the work reads exactly like a check that passed.

**And the obvious fix would have been wrong.** Written the naive way — always
link to the same path — the book gains 211 dead links, because the books are
not the same shape: `ar`, `ms` and `uk` carry `online` and `foreword` from the
published app's own list and lack `chakras`, which the other nineteen have.
That is the divergence recorded four passes ago and deliberately left alone.
So the switcher asks: the same page where that language has one, its contents
where it does not. Verified both ways — the naive version fails the crawl, and
the guarded one leaves nothing broken.

## Fifty-eighth pass: an audit that looked at eight of nine packages

Last pass ended on a check that skipped nine tenths of its own subject. That is
a shape, so this pass went looking for the rest of it — and the first place to
look was the audits themselves.

**`audit-unread.mjs` walked a hand-written array of directories**, and
`packages/journal/src` was not in it. The shared file format between the bot and
the mini app had never been checked for a field nobody reads or an export nobody
calls, while the audit reported *"Every export has at least one caller"*. The
fourth hand-kept list here to be wrong, and the second wrong by **omission**,
which is the kind that reads as a pass. It is found now — `workspaceSources`,
the same rule `audit-configs` uses — and coverage went from 62 files to 69, 465
fields to 481, 256 exports to 267. All of it clean, which is the good version of
this story and not a reason to have been guessing.

### Then the bridge, tested for the first time

With the journal under watch, the bot's side of it was worth exercising for
real. Two things came out.

**The receiving path had never run in a test.** `bot.ts` called the global
`fetch` to download a document, so the only way to reach that code was to let a
real request to `api.telegram.org` fail. One test did exactly that: it waited
three seconds for DNS, was the slowest thing in the package by two orders of
magnitude, and asserted that the network is absent rather than that the bot
answers. It flaked once during this pass, which is how it was noticed. Reading a
file is injected now, so the *successful* path can be driven — and the bytes it
is driven with are the mini app's own, captured from its download at
`URL.createObjectURL` and kept in `tests/fixtures/miniapp-export.json`. A
fixture rather than a document the test built, because a round trip through
`toDocument` on both sides is true by construction and proves nothing about the
other surface.

**And the first run of it found this:** `keep` recorded a plan and a text and
nothing else, so the store stamped the moment of the *import*.

- A player who brought in a year of writing got a journal where every entry
  happened today — and exporting again wrote those wrong dates back into the
  file, carrying the damage to the mini app.
- The same file arrived as **new** every time, because what tells one report
  from another includes when it was written. Sending a path twice duplicated it.
  Three times, tripled it.

`ReportSink.record` takes the moment now, in memory and in SQLite, defaulting to
the clock for a report typed into a chat — which genuinely has no earlier
moment. Four tests fail when the argument is dropped again.

## Fifty-ninth pass: the rule, copied into the database

The pass before this one taught the engine two things about the report gate: a
snake that carries a player back to the square they left is an arrival, and so
is the winning square. Both were corrections to `owesReport`. This pass asked
the obvious follow-up — *who else decides that?* — and found this in
`packages/db/src/mapping.ts`:

```ts
// A player owes a report whenever they actually moved and are still playing.
needsReport: state.loka !== state.previous_loka && !state.is_finished,
```

That is `owesReport` as it stood a week ago, written out by hand, and wrong
three ways since. It misses the jump home, it dismisses the win, and it never
asks the variant, so `reportAfterSix` had no effect on what the database
believed. **A player persisted through this mapping got a free throw where the
same game held in memory asked for a report** — two surfaces playing different
games, which is the thing this repository exists to have fixed once.

It calls the engine now. Computed at *write* time on purpose: `players` has no
direction column, so a state read back out of a row cannot tell a jump home
from a refused throw — the column is the memory of what the engine decided
while it still knew. The test is no longer a list of cases but the relation, over
every state four variants reach in a played game; four of the new tests fail
when the hand-written condition is put back.

### And the circle closed

With the moment a report was written now kept — yesterday's fix — the bridge can
be asserted end to end for the first time. `tests/fixtures/miniapp-export.json`
goes into the bot through `decide` and `keep`, comes back out through `offer`
and `serialise`, and parses **identical** to what went in. Before yesterday it
could not have: the store stamped the import, so a file that went in came out
dated today and arrived as new the next time it was sent.

## Sixtieth pass: the same question, asked in SQL

Last pass found the report rule copied by hand into the database mapping. The
follow-up is the same question one level wider — *who else decides something the
engine owns?* — and the answer was in a `WHERE` clause:

```sql
AND (p.is_finished = 0 OR p.previous_plan = 0)
```

`pruneFinished` deletes tables whose game ended a while ago, and it decided
"ended" in SQL, under a comment saying that was "the same condition the engine
uses". It was not. The engine also asks whether the player is standing on the
**winning square**. Asked against every seat shape a row can hold — four plans ×
three `previous_plan` values × finished or not — the two disagreed **seven times
out of eight**, and every disagreement was a `DELETE` of a table the engine
still considered live.

The reachable one is a migration. `stateFromLegacy` sets `previous_plan` equal
to the plan when the published app's export carried no moves, and the engine
reads that as "has not moved" — deliberately, so a migrated player can still
enter. The clause read it as "done" and threw the table away.

SQL narrows by age now, which is SQL's question, and the engine answers its own.
Pruning is periodic and the age filter bounds the set, so loading those rows
costs nothing next to deleting somebody's game. The test asserts the relation
over the shapes rather than a list of remembered cases, and both new tests fail
when the clause is put back.

That is three copies of engine rules found in three passes — the mini app's die
face, the database's report flag, and now this. Each was written as an
optimisation of one line, and each drifted the moment the engine learned
something.

## Sixty-first pass: an audit not written, and the copy it found anyway

Three passes running found a rule of the engine's written out by hand somewhere
else, so the obvious move was an audit for it — something that flags a decision
about the game made where the engine is not.

**It was prototyped and deliberately not shipped.** Run over the repository it
marks fifteen places, and twelve are legitimate: a mapping reading a column into
state, a validator asserting the engine's own invariant, a stylesheet class for
the winning square, a prompt mentioning the end of a game. An audit that is
four-fifths noise teaches people to skip it, and this repository already knows
what a check nobody reads is worth. The measurement is the finding: "reasoning
about game state" is not, on its own, a defect.

**The prototype earned its keep anyway.** Among the fifteen were two lines, one
in each surface, that are the same sentence:

```ts
if (event.isBlocked && event.from === WIN_LOKA && event.to === WIN_LOKA) {
```

`isBlocked` covers two different refusals — a throw that would overshoot 72, and
a throw by somebody who has not entered the game — and a surface that shows one
message for both tells a player waiting to enter that they are short of room on
a board they have never stood on. Both surfaces worked that out separately, and
the bot's own comment records that it spent a while with the wrong message
before copying the mini app's fix.

It is `needsSixToEnter` in the engine now, and both call it. The test states the
rule a different way from the implementation — over every throw a real game
makes, a refusal is an entry refusal exactly when the thrower was off the board
when they threw — so the two would have to be wrong together to pass. Weakening
the predicate fails it.

A player who has already won and is throwing to begin again is in the same
position, on 68 needing a six, and is told the same thing. That is right, and it
is now written down where the rule lives rather than inferred twice.

## Sixty-second pass: the one thing the game asks for, and did not keep

The game will not let a player throw until they have written about the square
they are on. That writing lived in a `<textarea>` and nowhere else.

A phone discards a backgrounded tab. That is not a hypothesis here: two passes
ago a *throw* was lost to exactly that, found by watching it happen in a hidden
browser pane. So a notification arriving mid-sentence took the sentence with it,
and the one thing this game asks a player to produce was the one thing it did
not keep. Checked rather than assumed — typed a hundred characters into the
writer, reloaded, and the box came back empty.

A draft is kept now, as it is typed, and cleared when the report is filed or the
game is started again. Per plan, because a draft belongs to the square it is
about: offering one written about the human plane to somebody standing on
Delusion would be worse than offering nothing. Its own storage key, like the
die's — inside the saved game it would make `isSavedGame` reject every existing
save, which is a player's whole path dropped to remember half a sentence.

**The published app does not keep a draft either**, which was checked before
this was written: `CreatePost` holds the text in `useState` and nothing more. So
this is not a port. It is a loss neither of them should have.

Eight tests on the rule rather than on a sentence: whatever was typed comes back
— prose has quotes, newlines, emoji and the odd brace — a draft about one plan
is not offered under another, blank clears it, anything that is not a draft this
app wrote restores as nothing, and storage that throws still lets somebody
write. They simply have to finish in one sitting.

## Sixty-third pass: a flag filled in by copying, and the reading behind it

`onchain` was written by reading the deployed contract. Five flags were added to
`RuleSet` after that, and `onchain` carried `classic`'s value for every one of
them — which is what filling a field in by copying looks like. So the contract
was opened again, and each of the five checked against the Solidity.

Four were right by luck or by vacuity: no cooldown exists on chain, so
`cooldownFrom` and `refusedThrowStartsCooldown` are unobservable;
`createReport` has no length check anywhere in it, so `minReportChars: 0`;
`if (!player.isStart && rollResult == 6)` is the entry branch and `isStart` is
cleared on winning, so `mayReenterAfterWinning: true`.

**The fifth was wrong, and it was wrong because of this repository.** Two passes
ago the winning square was made to owe a report *everywhere*, and the argument
given was that both sources agree — the published app's
`if (stepCount !== 6 || plan === 68)` and "the deployed contract requires a
fresh report before every roll in play". The second half is true and does not
apply. `movePlayer` sets `isStart = false` the moment a player lands on 68,
which removes the gate — and `createReport` opens with

```solidity
require(players[msg.sender].isStart, 'You must start the game before creating a report.');
```

so an on-chain winner **cannot file a report at all**. A variant demanding one
would have locked them out of beginning again, which is the one thing the
contract does still let them do.

That is a genuine axis, so it is a flag: `reportOnWinningSquare`, true for the
four variants where a person can answer and false for `onchain`. The engine
asserts the relation over every shipped variant — what the gate says on 68 is
exactly the flag — and `packages/contracts` asserts the Solidity that justifies
it, against the source rather than against a memory of it. Setting the flag the
other way fails a test in each package.

The lesson is narrower than "read the sources": the reading *was* done, and the
sentence taken from it was one step broader than what it said.

## Sixty-fourth pass: the citations, re-read

Last pass found a flag on `onchain` filled in by copying, and the reason it went
unnoticed for so long is worth more than the fix: `packages/contracts` holds
that variant to the Solidity because the contract is *vendored here* and a test
can read it. `legacy-mobile` and `online` reproduce the published mobile app,
which is not vendored — so their rules were written by reading `leela-src`, and
after that the reading was a memory. They were written the same way `onchain`
was, and never checked again.

Every rule those two claim now carries the line it came from, and
`audit-variants.mjs` checks **both halves**: the flag still holds the value its
evidence supports, and the evidence is still in the app. Twenty claims across
eleven flags, each with its citation —

| flag | where it comes from |
|---|---|
| `extraTurnOnSix` | `if (count === 6)` in `store/helper.ts` |
| `threeSixesReset: false` | neither `consecutiveSixes` nor `positionBeforeThreeSixes` appears there at all |
| `rerollOnRepeat` | `if (get === DiceStore.count)` |
| `reportAfterSix: false` | `if (values.count !== 6)` gating `createHistory` |
| `refusedThrowStartsCooldown: false` | `case plan > 72: return undefined` |
| `mayReenterAfterWinning: false` | `stepCount === 6 && !isFinished` |
| `cooldownFrom: 'report'` | `startStepTimer()` called from `CreatePost` and nowhere else |
| `minReportChars: 100` | `.min(100, t('fewChars'))` |
| `reportOnWinningSquare` | `stepCount !== 6 \|\| plan === 68` |
| `requireReportBeforeRoll` (online) | `DiceStore.online && !OnlinePlayer.store.isReported` |
| `turnCooldownMs` (online) | `86400000` in `useLeftTimeForStep` |

An absence is a claim too, which is why `threeSixesReset: false` is checked with
a pattern that must *not* be there.

It passes today, and a check that has only ever passed is not yet a check — so
it was broken deliberately in both directions: a flag flipped is named with both
values, and a donor file rewritten is named with what it stopped showing. A file
that cannot be read is reported rather than skipped, because an audit that
passes for want of looking is the failure this repository keeps meeting.

It needs the donor clones, so it says so in its header and stays out of CI —
the same arrangement `audit-copies` has.

## Sixty-fifth pass: where the stone waits

Asked where the walking stone is. It was drawn — on whatever square the player
stands on — and before the first six it was drawn nowhere, because the player
stands nowhere.

The published app disagrees, and says so in one line: `initStore` is
`plans: [68, 68, 68, 68, 68, 68]`, and `Gem` renders wherever `data === plan`.
So the stone is on the board from the first screen, waiting on **68** — the
square the game ends on is the square it waits to begin on. A player opening the
app sees their piece; a player opening this one saw an empty board and a
sentence.

`headline` already knew. Four lines below the branch that returned `here: null`
is a comment reading *"Entering the game is recorded as a move from 68 — that is
where a waiting player sits"*. The knowledge was in the file and not on the
board.

The stone waits on 68 now. The header still says `—` and the reader stays shut:
the piece is there, and the plan is not theirs to read yet — which is the
distinction the app makes too, since a waiting player has `isStart: false` and
no plan screen. Three tests: where it waits, that waiting is not playing, and
that it leaves for 6 the moment a six lands.

## Sixty-sixth pass: a cleanup that only ran when nobody needed it

`pruneFinished` was written because "nothing deleted a finished game, so every
table ever opened stayed in the database — thousands of dead rooms after a year
of use". It is called once, at startup, under this justification:

> Done at startup rather than on a timer: a bot that is never restarted is not
> accumulating tables either.

That sentence is false, and it is the kind this repository has been wrong about
before — a confident line nobody measured. Tables come from **play**, not from
restarts. Measured rather than argued: twelve games played and finished over
twelve weeks in one process leave twelve tables. The deployment this was written
for is one that stays up for months, and it is exactly the one that never looked.

A running bot sweeps once a day now. The age filter is a week, so looking more
often deletes nothing sooner — asserted, because a cleanup that runs more often
and a cleanup that keeps less are different things and it would be easy to make
the second by accident. The timer is injected, `unref`'d so it cannot hold the
process open, absent entirely when games are held in memory — a process ending
is the only cleanup those need — and stoppable, so a test leaves nothing behind.

The same twelve-game scenario now ends with one table: the one that finished
less than a week ago, which is what the filter says to keep.

## Sixty-seventh pass: the book, and the page that was never there

The mini app opens the rules book; the docs site serves it in 22 languages; the
bot — which is where people actually play — had eleven commands and none of
them was this one. A player in Telegram could not read how the game works.

`/rules` lists the chapters, `/rules 3` opens one. It falls back as a whole book
rather than chapter by chapter, for the reason the mini app does: half in one
language and half in another is worse than one a reader can at least read.

**And writing it found the other half.** A chat cuts at 4096 characters, so
`renderPlan` trimmed a long plan at a paragraph and added a marker:

> …continues. /plan 2 again for the rest.

Asking again returned the identical message. `renderPlan` took a body and gave
back its first page — there was no second one. **One plan text in eight is over
the limit**: 188 of the 1584 this repository ships, the longest 6090
characters. So the rest of them was unreachable in the bot, under an
instruction saying how to reach it. For plan 2 in English that is 1,643
characters nobody could get to.

The pages are numbered now — `/plan 2 2`, `/rules 3 2` — and the marker says
which one to ask for and how many there are. The tests assert what a paging
scheme has to be rather than today's page counts: the pages **cover the whole
text in order and lose none of it**, every rendered page fits inside the limit
with its head and marker, a page begins at a paragraph, asking past the end
gives the last page rather than nothing, and a text that fits is one page with
nothing said about continuing.

The help-surface test caught `/rules` before this was committed — registered and
undocumented, which is the thing that check exists for.

## Sixty-eighth pass: five copies of a rule, four of them a day old

Started by checking whether any message names a command the bot does not
register — the class the last pass's defect belonged to. Nothing: every command
promised in the catalogue exists. A guard worth having and not a finding, so it
was measured and left alone.

The finding was next to it, and it was mine. *"The language's chapters, or
English when it has none"* was written out **five times**: twice in the bot,
twice in the mini app, and its absence once in the docs. Four of those five were
written in a single afternoon, by one author — this one, last pass. That is how
quickly a rule spreads once it lives nowhere, and it is the same shape as the
report rule copied into the database and the finished-game condition copied into
SQL.

`bookFor` in `@leela/content` is the one home. The bot and the mini app call it.

**The docs deliberately do not**, and that distinction is the reason this was
worth doing rather than just tidying. `apps/docs` writes a page per language per
chapter, and `audit-dataset.mjs` refuses a chapter written in a script its
language does not use — a published `/de/rules/notes.html` holding English would
be exactly that, and it is the defect that was found in the English book two
weeks ago. A reader *shown* English has been helped; a reader handed a German
URL serving English has been misled. Falling back and filing wrongly are not the
same act, and now the code says so where somebody would otherwise "fix" the
inconsistency.

Honest about what the guard covers: an unknown locale never reaches it —
`resolveLanguage` turns `zz` into English first — so what it protects is a
*declared* language whose book is empty, which no rebuild has produced yet. All
five copies were covering the same unreachable case; the point is that there is
now one of them.

## Sixty-ninth pass: a table of three states with two

Played a game at a table of three, which had never been played. The rolling and
the turn order read cleanly. The standings did not:

```
Cy: 8 — owes a report
Ann: 68
Bo: 68
```

Ann and Bo have never thrown a six. They are listed as standing on **68** — the
winning square — because that is where a waiting player sits in this shape, and
`describeStandings` had two states where there are three: `hasWon` gave
"finished" and everything else printed its raw square.

`render.ts`, which is what the bot actually sends for `/board`, has all three.
Two implementations of one table, and the older one was right. The sixth time
the 68 ambiguity has cost something, so it is `isWaitingToEnter` in the engine
now, called by all three places that were computing it by hand.

### The audit that could not see it

`audit-unread.mjs` should have noticed that nothing calls `commands.board`. It
did not, and the reason is worth more than the export: **a name inside a string
counted as a call.** `bot.command('board', …)` registers a Telegram command that
happens to share a name with an export, and that was enough.

Strings are stripped before matching now — and the first version of that stripped
`${…}` inside template literals too, which made three real callers vanish:
`faceFor(value, FACES)` lives inside `url("${…}")`, a string containing a call.
Text and code look alike from outside; the difference is which exports get
reported as dead. With it right, one export surfaced: `migrateBatch`, the half of
the Firebase migration that cannot run until somebody produces a dump. Waived
with that reason rather than deleted, because deleting it means writing it again
from the same reading.

`commands.board` is still invisible to the audit — `board` is a variable in the
mini app, and matching is by name across the repository. Recorded rather than
papered over: the check is a heuristic, and a heuristic that claims to be a
proof is the thing this repository keeps finding.

## Seventieth pass: five sentences nobody had read

Played the bot with the companion attached, which had never been played — only
asserted. `Guide.reflect` takes `direction` and `previousPlan`, `systemPrompt`
turns them into *"They were brought down here by a snake."* and *"They came from
plan 12."*, and the bot's only call site passed the plan and not the move that
produced it.

So a reflection on plan 8 read the same whether the player had climbed to it or
been bitten down to it — in a game whose entire subject is what an arrival
means. The seat was one lookup away and nothing looked.

**And the dead code was wrong.** With the direction finally reaching a prompt,
three of the five sentences did not agree with the "They" they follow:

> They **was** brought down here by a snake.

Nobody had noticed because nobody had read them: there was nothing to read.
Written, wired at one end, and never rendered. Code that never runs is code
nobody has read — which is the same lesson as a check nobody runs, arriving from
the other direction.

The five agree now, and the test is the rule rather than the three that were
wrong: no arrival sentence may begin with a singular verb after "They", each is
a whole sentence, every direction the engine can produce has one, and a prompt
with no arrival to report simply says less rather than falling silent. The bot's
end asserts only that it passed the direction along — which of the five exists
belongs to `packages/ai`.

## Seventy-first pass: the other half of the companion

Last pass found two parameters the bot accepted and never passed. The same
question asked one level up: **what else is written and unreachable?**

`Guide.answer` — "answer a question about a plan" — had no caller anywhere, and
neither did the `history` every prompt builder takes. So half the companion
existed: a player could write a report and be answered, and could not ask
anything. `MAX_HISTORY = 6` had never carried a message.

The published app has that half. `ChatScreen` is a conversation with the
companion, and it keeps the last five messages from each side. **It replays
them wrongly:** two lists, all the questions and then all the answers, so the
model sees five questions in a row followed by five answers with nothing saying
which answered which. That is not a detail — the pairing is the only reason to
send a history at all.

`/ask <question>` is the missing end of the wire. The conversation is kept in
memory and per player, as it is in the app, and **in the order it happened**.
Six messages, which is what `recentHistory` keeps: sending more is paying for
tokens dropped on arrival.

Two decisions worth their lines. A question is stored only with the answer it
produced, so the history can never contain an unanswered question — asserted
over twelve exchanges rather than at one length. And the fallback sentence is
never remembered: it is what a player sees when the companion is down, and
replaying it as the companion's own words would teach the model that this is
how it talks.

## Seventy-second pass: asking from where a player would ask

Two passes have now found something written and unreachable by hand, so the
first move was to make the question mechanical: `audit-unread` reports fields
written and never read — the dual, **read and never written**, is exactly the
`direction` case and is not checked.

**Prototyped, measured, and not shipped.** It marks 26 of 237 fields and most
are wrong, for one reason: JavaScript's shorthand. `harness({ guide, reports })`
writes `guide` without a colon, and telling that apart from a read needs a
parser rather than a line-matcher. The second negative result of this kind, and
the same conclusion: an audit that is mostly noise teaches people to skip it.

Then `/ask` was taken into a group, which is where it was going to be used.

It answers privately — a question about your own square is as private as the
report gate that prompted it — and `deliver` handles that correctly, which two
tests now hold it to. **But the natural place to ask is the private chat**, and
there is no table there:

> — /ask what does this plan ask of me?
> — Take a seat first — /join.

Said to somebody holding a seat, in a game they are in the middle of.

A room is keyed by the chat it lives in, which is right for every command sent
*at* the table. `/ask` is not one of those. `RoomStore.roomOf` finds the table a
player sits at, wherever it is — optional, in the idiom `ReportSink.history`
already set here: a store that cannot answer says so by not having the method,
and the caller falls back to the chat it is in rather than pretending. SQLite
answers it with `ORDER BY sessions.updated_at DESC`, because a player can sit at
a group table and a private one, and the one they mean is the one they last
played.

## Seventy-third pass: two limits nobody was told about

`record` in the mini app has cut a report at 4,000 characters and dropped the
oldest entry past 500 since it was written, and the player was told neither. A
thousand words could go without a word about it — and now that a draft survives
a reload, they could be typed across two sittings and cut on save.

The published app has **no maximum at all**: `CreatePost` validates
`min(100)` and nothing else, storing in Firebase. Ours exists because
`localStorage` is bounded, which is a good reason for a limit and no reason at
all for a silent one.

`#writer-hint` has been in the dialog since it was written, empty. That is where
this goes:

- `maxlength` on the box, so the boundary is met while typing rather than
  discovered afterwards — the way every text field a person has used behaves;
- the room left, but only in the last two hundred characters: a counter always
  on screen is furniture, and somebody counting characters is not reflecting;
- at 500 entries, that saving costs the oldest one, and to save a copy first —
  which the app can do, and which is the only thing that makes the cap
  survivable.

The tests assert when something is said rather than the sentences: silence while
there is room for both, **never** silence at a boundary where something is about
to be lost, the nearer limit first — a full path is a standing fact and a full
box is happening now — and the warning at the cap rather than one entry past it.

## Seventy-fourth pass: the question the game answers

Asked again for the app's functions, board untouched. Three went in earlier —
the rules book, all 72 plans, "start over". The list was read again, and the
one that matters most was still missing.

**The intention.** `screens/helper.ts` will not let a player near the board
without one:

```ts
} else if (!prof.intention) {
  navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true, … })
}
```

`ChangeIntention` validates `min(2).max(800)`, and the profile can change it
later. **This repository's own schema has carried `players.intention` from the
first migration**, and no surface had ever asked for one.

It is not a profile field. In Leela the intention is the question the game is
being played to answer, and the reports are the answer accumulating — which is
why it is asked before the first throw and shown at the head of *My path*, above
the writing it frames, rather than filed on a profile page where nobody rereads
it. The app's own bounds, not invented ones; the die stays shut until it is
answered, as the app blocks the board.

Nine tests on the rule: held as written and trimmed so the bounds mean what they
say, refused at both ends and for blank space dressed as an answer, **nothing
kept when it is refused** — the dialog stays open on a `false`, so a refusal
that quietly returned true would leave a player looking at their own unsaved
words — and a window that cannot store still plays, it simply asks again.

**Left for a later pass, with reasons:** playing several people from one device
(`SelectPlayersScreen`, `DiceStore.multi`, `OfflinePlayers.store.plans[]`) is a
real function and a large one — the engine already seats up to `MAX_SEATS`, so
it is a UI problem rather than a rules problem. The companion in the mini app
needs a key in a static page, which the boundaries forbid; the bot has `/ask`
instead. Posts, likes and comments need a server.

## Seventy-fifth pass: six people and one phone

The function named at the end of the last pass. `SelectPlayersScreen` offers one
to six, `OfflinePlayers.store` keeps a plan and a history per seat, and this app
had one player and one saved game.

**The rotation was deliberately not ported.** `changePlayer` there is five
hard-coded branches over an array of who is still playing —
`newArr.indexOf(true) === 2 → DiceStore.players = DiceStore.multi - lengthArray + 3`
— which is "the next seat still in play, wrapping" written longhand. The engine
has had that as `nextSeat` since the bot needed it. So what is ported is the
seating; `advance` does the rest.

The old save becomes seat one, which is the point: this app has been played for
weeks, and a table that started empty would have thrown those games away to add
a feature. Journals are per player — two people on one phone are two paths, and
merging them would make the record the game exists to produce meaningless — and
the first seat keeps the original key for the same reason.

### And the entering six was passing the turn

Found in the first three-player game, and invisible before it, because a table
of one never notices whose turn it is:

```ts
// Entering the game consumes the six; the turn passes either way.
grantsExtraTurn: false,
```

The published app has no such exception. `upStepOffline` passes the turn in the
**else** of `if (count === 6)`, and the player who threw one is told
`oneMoreThrow`. Traditional Leela has no exception either. The flag
`extraTurnOnSix` already said what should happen and that branch was not reading
it — so this is a correction to code that disobeyed its own ruleset rather than
a change of rules, which is why it is not a new flag.

Two tests had encoded the old behaviour, and one of them was mine from three
passes ago: it derived "an extra turn was granted" from the sixes counter, which
the entering six does not touch. It reads the turn holder now, at a table of
two — because at a table of one the turn always comes back, and that was the
confusion the original defect was made of.

## Seventy-sixth pass: what a phone does to a small field

A screenshot arrived asking what this was: the intention dialog, cut off down
the right-hand side, over a board drawn much too large.

Two things, and the second is the one that matters.

**The dialogs added in the last two passes were unstyled.** `#list` and
`#intention` were marked up with `div.reader-body` and `div.reader-actions` —
class names invented at the time and never written into the stylesheet. The
dialogs that work use `<article>` and `<footer class="sheet-controls">`, which
have had padding and a scroll boundary since the reader was built. Both now use
the markup the stylesheet knows, rather than gaining a second set of rules that
say the same thing.

**And the page was zooming itself.** The board in that screenshot is magnified
because iOS Safari zooms the whole page in when a field is focused whose text is
under sixteen pixels — and `style.css` had **no `textarea` rule at all**, so both
writers took the browser's default. The intention dialog focuses its box as it
opens, so the app zoomed the moment it started; the report writer has done the
same on every iPhone since the day it was written.

It does not happen in a desktop browser. Weeks of looking at this app in one
never showed it, and a simulator showed it in a second.

The test is the rule rather than the number: every field a person types into
asks for at least the threshold, and no later rule takes it back — a rule
further down wins, and a smaller size on an `input` added next month would zoom
the page again with nothing to notice. It also asserts that fields still exist,
so the check cannot pass by having no subject.

## Seventy-seventh pass: the screens, read as a map

Asked to study how the app moves between screens and add what is left.
`Navigation.tsx` answers it in one file. Offline — which is what the mini app
is — the tab bar holds three:

| tab | screen | here |
|---|---|---|
| `TAB_BOTTOM_0` | `GameScreen` | the board |
| `TAB_BOTTOM_2` | `OfflineProfileScreen` | **was missing** |
| `TAB_BOTTOM_4` | `PosterScreen`, Russian only | a promo, not a function |

The online-only tabs — `PostScreen`, `ChatScreen` — need a server and a key.

**`OfflineProfileScreen` is a sectioned history**: `useHistoryData` builds
"Player 1", "Player 2", … from `OfflinePlayers.store.histories[]`, sliced to the
number seated. *My path* here showed only whoever held the turn, so at a table
of three the other two could not read what they had written on a device they
share — the same shape as the board that drew one gem of six, fixed two passes
ago. It is sectioned by seat now, and journals are kept per player with the
first seat on the original key.

**And the launch path had one more instruction in it.** After the intention,
`screens/helper.ts` reads:

```ts
if (!prof.isReported) {
  OpenPlanReportModal(prof.plan)
}
```

The app opens the writing box for you. This one dimmed the die and printed a
sentence, leaving a player who came back mid-thought to find the button that
says the same thing. It opens the writer now — after the intention, because a
game cannot be reported on before it has a reason.

## Seventy-eighth pass: the sentence that named the wrong player

The screen map is finished for what an offline app can have. `WelcomeScreen` is
a mode chooser whose **offline button is commented out** in the shipped app;
`HELLO` is the sign-in flow; `PostScreen` and `ChatScreen` need a server and a
key. There is nothing left there to port.

So this pass played the new flow end to end on a device — intention, seats,
throw, report, path — which is the method that has found something every time.
It found this.

At a table of two, throwing a four produced:

```
Player 2 · Throw a six to enter the game
You threw 4. An arrow at 10 takes you to 23.
```

Both true, and together a lie. The header has moved on to whoever throws next by
the time the sentence is read, so a second-person message reads as the *new*
player's throw. It was exact for as long as one person played, which is every
day this app existed until two passes ago.

The thrower is named now — `Player 1 — You threw 4…` — and only when there is
more than one seat: "Player 1 —" to somebody playing alone is a form filled in
by a machine. Naming is the smaller change and the clearer one; the published
app reaches for the same shape, keeping `playerTurn # N` as its own line rather
than rewording every message.

The seat that threw is remembered rather than read off the turn, because after a
throw that passes the turn those are two different players — which is the whole
defect in one sentence.

## Seventy-ninth pass: what was still one player's

Seats arrived four passes ago and the app was made to seat six. This pass asked
the narrow follow-up: **what else in it still assumes one?** Two things, and the
first is serious.

**The report gate was recorded twice.** `Journal.reported` here and
`SeatedPlayer.reportSubmitted` in the engine — one player with one journal
cannot tell them apart, and seats could. A second player owed a report the
engine knew about, their journal did not exist yet, and a journal that does not
exist reads as *nothing owed*:

```
seat says:      reportSubmitted: false
die:            open
report button:  disabled
```

They could neither be stopped nor write. The engine owns the gate now;
`Journal.reported` stays in the stored shape because saves carry it, and is
asked about nothing. The test is the agreement over every state a played game
reaches, rather than the shape it was caught in.

**And a draft was offered to whoever opened the box.** It was keyed by plan
alone, which was exact while one person played — but two people sharing a device
stand on the same square all the time, and finding somebody else's unfinished
sentence in your writing box is the worst thing this app could do with writing.
A draft carries whose it is now, and one written before there were seats belongs
to the first player.

Both are the same shape as the board that drew one gem of six and the path that
listed one player of three: state that was per-device because there was only
ever one player to be per.

## Eightieth pass: what the competitors lead with

Asked to look outward — weak points, competitors, a plan, and the work.

**The field, as of today.** Four apps play this game. `com.vtm.lila` (Android,
listing updated October 2025) is the plain board. *Leela Chakra Ai* (iOS) is
this project's own earlier app — the AI guide, ~$4k on the MVP. *Leela: The Game
of Knowledge* is the secular one: it strips the Sanskrit and the Hindu names and
sells a mental practice. And `com.gmapp.lillagame` — **updated May 2026, the
freshest of them** — pitches recurring life patterns, a recorded history of your
journey, square descriptions, and **sharing results**.

Three of those four things this repository already does better: the history is a
file in a shared format, the descriptions are 72 plans in 22 languages, and the
patterns are what the companion is for. The fourth it could not do at all.

**A path left this app as a file — a year of it, for coming back to — and a
single square could not leave it.** What people pass on is one square: *this is
where I landed and this is what it asked of me*. That is the unit of the game as
a conversation, and it had no button.

`shareTextFor` builds it and the writer offers it once there is something to
share: `navigator.share` where a phone has one — the sheet Telegram and Safari
both put up — and the clipboard where it does not, which is what the path export
has always used. The button appears rather than sitting disabled, because a
control that is never usable is furniture.

The tests are about what a share may **contain**: one square, the player's own
words, the intention last and only as a frame, and nothing else they have
written. A person handing a friend a sentence has not handed them a year.

## Eighty-first pass: whose question is it

Found by playing a two-seat game rather than reading one. The published app
keeps a profile per account — `Profiles/{uid}` — and `plan`, `history`,
`isReported` and `intention` are all fields on it; `updateIntention` writes the
last one there beside the rest. When this app grew seats, three of those four
moved to the seat. **The intention stayed with the device.**

So three people sharing a phone played for one question. Seats two and three
were never asked what they were playing for — they inherited the first player's,
silently, and the die opened for them on the strength of an answer somebody else
gave. A square shared from seat three was signed with seat one's intention. In a
game whose whole point is that the reports accumulate into an answer, that is
the wrong question written under every one of them.

The draft had the same fault from the other side. It named its owner *inside*
the value and kept them all on one key, so the reader refused another player's
words correctly and the shelf held one sentence: a second player starting to
type destroyed the first player's unfinished one, and what the first player then
saw was an empty box — indistinguishable from never having written.

Both now key by seat, and the first seat keeps the original key, as the journal
already did: weeks of play happened before there were seats and none of it is
worth losing to a feature. Each seat is asked its own question the first time
the turn reaches it, because a die shut behind an unasked question is a dead
end.

The test is the rule rather than the two that were wrong: whatever a player
writes is that player's own — no other seat reads it, and no other seat destroys
it by writing their own — asserted over every store and all six seats. Plus the
guard against the next one: `leela.intention.v1` was not wrong when it was
written, it became wrong when seats arrived and nobody re-read the list of keys.
So the list is a test, and a new `*_KEY` fails until it is declared the device's
or a player's.

## Eighty-second pass: the sentence that outlived its state

Weak points, competitors, a plan, and the work. The competitor worth reading
this time is *Leela Game of Self-knowledge* (Uinside, iOS): its recent notes are
about the **note input area**, enlarged for comfort while playing. Everyone
selling this game is selling the writing. Which made it worth opening this app
the way a returning player does — and it greeted a player standing on square 30,
six squares of history behind them, with *"a six puts you on the board."*

`app.opening` was written into the page once, at build time, by `applyChrome`.
`draw()` replaced it only when a move had just happened or a report was owed. So
the opening instruction was what every returning player saw, forever.

**At the other end it was worse.** A player who reached Cosmic Consciousness —
the point of the whole game — reopened the app to the same sentence, with a live
die under it. Throwing it printed *"It takes a six to enter the game."* The win
was announced as an event and then forgotten: the app remembered where the
player stood and not that they had arrived.

Three separate faults, each found by playing rather than reading:

**1. The line now describes the state.** `standing()` is a pure function of the
state and the gate: the report first because it is the only one that blocks the
die, then finished, then waiting to enter, then — new — the square the player is
actually on, by number and title.

**2. The die follows the engine.** `advance` refuses a session in which everyone
has finished, and it refuses by *throwing*. So the live die on a completed game
was not merely useless: the click raised a `SessionError` out of the roll
handler, which is why nothing happened at all. `canRoll(session)` asks
`isSessionOver` rather than inventing an answer, so a table where somebody else
is still playing keeps its die.

**3. `needsSixToEnter` could not do the one thing it exists for.** A player
waiting to enter and a player who has won sit on the same square with the same
flag, and their refused throws are the *same event*: blocked, 68 to 68. The
helper written to tell refusals apart could not tell those two apart, and the
engine's own test said so out loud — *"same position, same sentence: on 68,
needing a six"* — the defect written down as intent. The event now carries
`wasComplete`, because nothing else in it can carry the difference. Being a
required field, the compiler found the bot's hand-narrowed copy of the event
type immediately.

The general invariant that had been reading as a pass is fixed too: it said a
refusal is an entry refusal exactly when the thrower was `is_finished`, which a
winner also is — and the loop broke at the win, so it never met one.

**Not changed:** `CLASSIC.mayReenterAfterWinning` is `true`, and it is
unreachable in any seated game — `advance` refuses the session and `nextSeat`
skips the winner, so the six that would begin another round can only be thrown
by calling `applyRoll` directly. Left alone deliberately: flipping it would be
changing the rules silently, and the app's answer is "Start over", which is what
the published app does too.

## Eighty-third pass: the squares that keep coming back

Leela's teaching is that you return. The same state arrives again — 41 in
February and 41 again in September — and what you wrote the first time is the
measure of what has changed. This app recorded every one of those returns:
`record` appends, so a second report about a square never overwrote the first.
And it could only ever show them as a *path* — everything, oldest first, one
flat run of text — so two accounts of the same square could sit a year and forty
entries apart with nothing to put them together.

Every competitor sells exactly this. `com.gmapp.lillagame` leads its listing
with recurring life patterns; the freshest iOS one is busy enlarging its note
input area. None of them builds it, and the published app cannot: its
`UserProfileScreen` renders `history.map` — one flat chronological list — and
its `HistoryT` carries `{ plan, count, status, createDate }` and no report text
at all. The material exists here and nowhere else.

So reading a square now shows what this player has already said about it, oldest
first, dated — **above** the traditional text rather than below it. That
placement was decided by looking at a phone: plan 41's text is three long
paragraphs, so anything under it is below the fold, and somebody opening a
square they have stood on three times wants what they said last time, not to
scroll past the teaching to find it. On a first visit there is nothing there and
the plan text is still the first thing on screen.

The list of all 72 carries the count, because that list is the only place a
whole game is visible at once: three against 41 is the game saying something no
single report can. A count rather than a dot — "some" would make a player open
all 72 to find out which.

The tests state the rule rather than the cases: everything written about a
square is what reading that square shows, and nothing written about another —
checked over the whole board, with a second test proving nothing is shown twice
or lost between squares. Plus determinism: reversing the entries must not
reorder the answer, because a list that shuffles between two identical journals
is a list nobody can read twice.

## Eighty-fourth pass: the same answer on both surfaces

The returns landed in the mini app last pass and stayed there. The bot has the
same material — reports in SQLite, read back by `/path` — and the same gap:
`/path` answers *what have I written*, oldest first, one flat run, and cannot
answer the question the game is about. Two accounts of plan 41 sit a year apart
in one long scroll.

Writing that a second time in the bot would have been two implementations of one
fact, which is the defect this repository keeps finding in its own donors — a
rule copied outside the thing that owns it. So `revisited` and `writingsOn` moved
into `@leela/journal`, the package that exists for exactly this: "two surfaces
that describe a format separately describe it differently".

`revisited` is stated over `{ plan }` alone, because the bot's rows carry
`createdAt` where the file format carries `at`, and the answer must not depend on
which of the two is asking. A test hands it both shapes and requires the same
list.

**`/returns`** is the bot's half: the squares that came back, most-returned
first, each with everything written about it, oldest first — the first account
being what the later ones are measured against. It keeps `/path`'s three
answers distinct, because "this bot is not keeping reports", "you have not
written anything" and "nothing has come back yet" are three different facts and
one message for two of them is the bot lying about one.

Two suites, two jobs. The package's states the rule — a square is returned to
exactly when more than one thing was written about it, nothing is shown twice,
nothing is lost between squares, and reversing the entries does not reorder the
answer. The bot's asserts delegation: the reply names a square exactly when the
shared function counted it. Checked by breaking each side in turn — the package
break fails five of its own tests, the bot break fails three of the bot's.

## Eighty-fifth pass: the returns, where a player already looks

The bot got `/returns` last pass and the mini app had the answer scattered:
marks in the list of all 72, and the writings inside a square you thought to
open. Nowhere to see *what keeps coming back* as a thing in itself.

It needed no new button. "My path" is where a player already goes to look at
their own writing, and the path is everything in the order it happened — which
is the wrong shape for the question and the right place for the answer. Each
seat's section now opens with the squares that came back, as chips that open
the square: the point of knowing 41 came back four times is reading the four,
and the reader already puts them one under the other.

**And the frame was one player's.** The intention was drawn once at the top of
this view, under the words "You are playing for:", above everybody's writing —
so at a shared table it belonged to whoever happened to hold the turn, and the
other players read somebody else's question as their own. That is the same
defect the intention key had two passes ago, surviving in the one view that
shows every seat at once. It moved into the sections; the "Change it" button
stays with the seat holding the turn, because that is the only seat
`askIntention` can write to.

`pathSections` exists so this can be asked rather than eyeballed: it takes the
journals and returns what the view draws. The tests are about whose — every seat
gets its own returns and nobody else's, no seat is handed a square only another
seat returned to, no seat is handed another's question, and a seat that has
written nothing gets an *empty* section rather than none (a missing section is a
player missing from their own path view). Breaking `pathSections` to read seat
one's journal for everybody fails three of them.

## Eighty-sixth pass: the app could write a sentence it could not hear

A path leaves as a file and comes back as a file — `toDocument` and
`parseDocument`, both `@leela/journal`'s. A **square** left as words, which is
what people actually pass on, and there was nothing to read one with. So the
half of sharing that makes it a conversation was missing: somebody sends you
where they landed and what it asked of them, and the app has no idea what you
are holding.

`squareText` moved into the package beside the file's format, and `parseSquare`
sits next to it. That is the point of the move: a format written on one surface
and parsed on another is exactly what that package exists to prevent, and the
bot will want to read these too.

**Two things make a square different from a file, and both are in the tests.**

A shared square carries **no time**, and none is invented in the parser — it is
stamped when it arrives, which is the only true thing available, and the
confirmation says so out loud. Which breaks the file's sameness rule:
`newEntries` tells one import from a second of the same file by the moment each
report was written, and two pastes of one square are an hour apart. Left alone,
the same square pasted twice would be two entries — and the squares that "came
back" would include one nobody returned to. The record the game exists to
produce would be saying something that did not happen. So `takeSquare` compares
the square and the words, which is what a person pasting twice means by "the
same one".

The sender's intention never comes with it. Reading somebody's frame is not
adopting it — the same rule that keeps `reported` out of an imported file.

**And a regression of my own, found by using the thing I had just built.** The
confirmation never appeared. The eighty-second pass made the line under the
board describe the player's state whenever nothing had just happened — and four
existing confirmations were written straight to the element *before* a redraw,
so the redraw ate them: seats set, game restarted, intention held, path
imported. Before that pass nothing overwrote them and they survived by accident.

Reordering four call sites would have left the fifth for somebody else. The line
has two sources — what the app has just been told to say, and where the player
stands — so the first is a variable now, an announcement outlives its redraw and
nothing else, and a throw clears it because a throw is the next thing happening.

## Eighty-seventh pass: `/take`, and the class the last pass exposed

Two things, both continuations of what the last pass found by using it.

**`/take` — the bot can hear a square too.** The format is `@leela/journal`'s
since the pass before, which is what made this a small change rather than a
second parser: `decideSquare` sits beside `decide`, answers in the same
`Outcome` terms, and the difference is the whole of the care. A file carries the
moment each report was written and this carries none, so it is stamped on
arrival and the reply says so — and the file's sameness rule cannot apply.
`newEntries` tells one import from a second by those timestamps, and two
`/take`s of one square are an hour apart. A doubled square is worse than
untidy: it invents a return to a square nobody returned to, and the returns are
what `/returns` reads.

A command rather than any pasted message. A message that happens to begin with a
number is not somebody asking this bot to file it.

**And the class, not the four bugs.** The last pass found that the eighty-second
had silently eaten four confirmations — seats set, game restarted, intention
held, path imported — because each was written straight to the element just
before a redraw, and the redraw now had something of its own to say. That was
fixed by an announcement variable, which was right and untested: the rule still
lived in the order of statements inside `draw`.

`lineFor` states it instead. Three sources for one line — a throw that just
happened, something the app was told to say, where the player stands — and the
rule is that an announcement outlives *any number* of redraws and nothing else,
and a throw ends it. The test that matters is the fifty-redraw one: a rule that
only held once would be the same bug one call later.

## Eighty-eighth pass: the companion could not see the returns

The four passes before this built the returns — `revisited` and `writingsOn` in
`@leela/journal`, the square's earlier accounts in the reader, `/returns` in the
bot. The companion, which is the one part of this system whose whole job is to
notice what recurs, could not see them.

Not because nobody passed them. The bot passes the player's entire history, and
`summariseJourney` keeps the **eight most recent squares**. That is recency, and
recency is structurally blind to the thing Leela is about. A player standing on
41 for the fourth time wrote about it in February and in June; if forty squares
have passed since, neither is inside the window. The companion met the most
loaded square in their game as though it were new — while the app beside it laid
all three accounts one under the other.

So the rule is not "include more". It is: **whatever else is dropped, what the
player wrote on this square is not.** `summariseReturns` chooses those first and
separately, oldest first, because the first account is what the later ones are
measured against. The recent squares then fill what is left of the same total
budget, minus anything about this square — a square counted twice is budget
spent saying one thing, at the expense of the plan's own text, which is what the
answer has to rest on.

The instruction that comes with it says what the section is for and what it is
not: returning is the subject, what changed between the tellings is the thing
worth noticing, do not read it back, and do not claim progress the player has
not claimed. The package's founding rule is unchanged and retested here — the
model never supplies the teaching.

Two tests are the ones that matter. The first two entries of forty-two reach the
prompt, which is the defect stated as a shape. And the plan's own text is still
in there afterwards, which is the cost the shape is not allowed to have.

## Eighty-ninth pass: the numbers inside the teaching

The translation audit checked terms — parenthesised transliterations survive,
no two plans share a body, body lengths sit where each script's density
predicts. It found nothing, and it was looking one layer above the damage.

The plans talk about the board. *"The player can get here only by passing
through the field of correct knowledge (45)."* *"A snake leading from the
tamoguna square (field 72)."* *"See also comments on boxes 38, prana, 39,
apana, and 40, vyana."* *"Until he reaches field 68."* And plan 9 argues from
arithmetic: `9x5=45=9; 9x6=54=9; …`.

**Forty-two of those references are gone.** Ukrainian, Malay and Arabic have
lost a dozen each; German, Spanish, Hindi, Marathi and Chinese one apiece. A
cross-reference whose number is missing points nowhere, and an argument whose
premises are deleted is not an argument — and the companion now puts this text
in its prompt and is told *it is the source; you are not*.

**Three false alarms had to be closed before any of it could be believed**, and
they are most of what the tests assert:

- **Numerals are not ASCII everywhere.** Arabic, Urdu, Hindi and Marathi write
  their own digits. A `\d` scan calls every number in those languages missing —
  a check failing loudest exactly where it understands least.
- **Thousands group differently.** `72,000`, `72 000` and `72000` are one
  number written three ways, and a naive comparison made *every* language,
  English included, look damaged in plan 9.
- **Not every language was translated from the same edition.** Ukrainian, Malay
  and Arabic follow the *English* text and the rest follow the Russian. So a
  number is only expected of a translation when **both** editions state it —
  which is also why those three show the most loss: they came through a
  different chain.

The damage is in the donor translations themselves, not in this repository's
generator: `leela-src`'s own Ukrainian plan 60 has no 68 in it either. So it is
**recorded rather than repaired** — repairing means translating, and translating
means calling a service this repository deliberately does not call. The audit
names all 42 on every run and fails only on the forty-third, which is what a
rebuild from a different source would produce. Checked by deleting a number from
German plan 60: exit 1, `de/60: 68`.

## Ninetieth pass: the rules book is not the same book

The pass before this found that Ukrainian, Malay and Arabic were translated from
the *English* edition while the rest came from the Russian. That explained the
numbers. It also turned out to explain something larger, one directory over.

The rules book has six chapters. `audit-dataset` checks that each is written in
the script it is filed under — it caught an English book carrying a Russian
seventh chapter. Nothing ever asked whether the book has the same *chapters*
everywhere.

**Ukrainian, Malay and Arabic have no chapter on the chakras.** Two of the three
have no chapter on the meaning of the game either. What they carry instead is
`online` — a chat-moderation policy, *"the following topics are strictly
forbidden: racism, nazism, drugs"* — and `foreword`. A different donor, a
different contents page, and nothing looking at it: a reader in those languages
opened the rules and the chakras were simply not there, while every other book
had them.

`bookFor` already fell back to English, but only for a language with *nothing* —
and it did so as a whole book on purpose, because half in one language and half
in another is worse than one a reader can at least read. That reasoning was
about a different failure. Here the choice was never "one language or two"; it
was **the chapter in English or no chapter at all**, and nobody can read what is
not there. So a missing chapter is borrowed, appended after the reader's own so
nothing of theirs is displaced, and marked `borrowed` — carried all the way to
the list, which says *"in English — this chapter is missing from your book"*.
"Written for you" and "the only copy there is" are not the same offer.

`apps/docs` still uses `rulesFor`, deliberately: a *shown* fallback has helped
somebody, and a published `/uk/rules/chakras.html` holding English has misled
them.

The audit states the floor rather than the three languages that fell through it:
English and Russian are the editions every other language came through one of,
so a chapter **both** teach is a chapter every reader is owed. A chapter only
one has is that edition's own choice and lacking it is not a loss — and extra
chapters are not a fault, because `online` and `foreword` are real text somebody
wrote. Checked by deleting `chakras` from the German book: exit 1, `de: chakras`.

## Ninety-first pass: the third layer, and what to do at the moment of writing

**The third layer of the translation audit is clean, and that is the finding.**
Two passes checked plan bodies (board references) and the rules book's contents
page. What was left was titles and descriptions, and they were checked properly
rather than assumed:

- **Titles are structurally sound in all 22 languages.** No leading `41.`
  numbering left in, none over sixty characters, none ending in a full stop, no
  two plans sharing a title inside a language.
- **`description` exists in exactly two languages, `en` and `ru`, and is empty
  in the other twenty.** Not damage: the twenty come from `translation.json`
  files whose plan entries are `{title, content, url}` — checked in `leela-src`
  — so there is no description to lose. Only `apps/docs` reads the field, and
  only to print a subtitle it already suppresses when redundant.
- **Titles that match the English exactly are mostly Sanskrit** — *Maya*,
  *Prana Loka*, *Tamas*, *Sattvaguna* — which stay as they are in any language.
  Javanese and Vietnamese also carry a few English words untranslated
  (*Vanity*, *Insignificance*, *Purgatory*). **No audit was written for this**,
  deliberately: nothing mechanical distinguishes an untranslated *Vanity* from
  a French *Compassion* that is simply the same word, and a check that cannot
  tell those apart is noise. The two audits already written were worth writing
  because their false alarms could be closed.
- The donor also carries a per-plan **audio URL**, and every language points at
  the *English* recording except Russian, whose set has one wrong number. Not
  wired up: it is a third-party dependency this repository would be adding
  blind.

**And what the pass actually built.** The returns were in the reader, the list
of all 72, the path view and the bot — everywhere except the one moment they
mean the most. A player who owes a report on 41 for the third time was handed an
empty box. Now the box opens with what they wrote the last times, above it.

The risk that invites is specific, so it is the test: a draft is saved on every
keystroke, and if an unfiled one ever counted as an account a player would
reopen the box and be shown their own half-sentence quoted back as something
they had already said. What you are saying is not what you have said.

## Ninety-second pass: playing the bot, which needed no token after all

The last three passes said the bot could only be played with a `BOT_TOKEN` and
a deployment. That was wrong, and it was written down in this repository's own
notes four months ago: `commands.ts` is pure functions from `(room, input)` to
`(room, replies)`, **so a whole game plays out in a test**. The surface nobody
had played was reachable the entire time.

Played to the end, three seats, four seeds. The bot handles the ending well —
*"That is the game"*, *"This game is over"*, the board showing `finished 🕉`.
And then, one line after announcing the game was over:

> **Bo has reported. You may throw.**

`report.filed` was a single sentence said whatever the state was. To a player
who had just reached Cosmic Consciousness it is an invitation to keep playing a
game that has ended. At a table of two it was wrong far more often than that,
because a player reports when they *owe* a report, and by then the turn has
usually moved on: **"you may throw" said to somebody who cannot**.

`afterReport` decides it now, in the order a player experiences it — their own
game ending outranks whose turn it is, and whose turn it is outranks a cooldown.
The last one is the engine's answer, not this file's: `canCurrentPlayerRoll`
knows that `online` makes a player wait a day, counted from the report, and a
player told "you may throw" and then refused for a day would be the same defect
wearing a different sentence.

The test is the rule over a whole game rather than the two situations that were
wrong: **"may throw" appears exactly when the engine would take the throw**,
checked at every report of four games. Plus a guard against the assertions
passing for want of a case — three of the four outcomes have to occur in
ordinary play, and the fourth is constructed, because a cooldown cannot arise in
a game played straight through.

## Ninety-third pass: what a report is about

The pass before this discovered the bot could be played in a test. This one kept
playing it — the commands nobody had touched — and the first probe found
something worse than a wrong sentence.

Before `/start`, before anybody had thrown anything, `/report` was **accepted**.
It answered *"Ada has reported. You may throw."* while `/roll`, at the same
table in the same moment, correctly said *"the table has not started yet"*. And
it filed the report against **plan 68 — Cosmic Consciousness** — because the
engine parks a player who has not entered on `WIN_LOKA` until a six moves them.

That is the 68 ambiguity, met for the seventh time in this repository, and this
is the worst place it has turned up. A player who had never begun could put an
account of the *winning square* into the record the game exists to produce. It
would appear in their `/path`, it would be exported into their journal file,
and `/returns` would count it as a square that came back to them.

A report is an account of the square you are standing on, and a player waiting
to enter is not standing on one. The engine says so already and nothing was
asking: `owesReport` is false for them, because there is no plan to reflect on
until they are on the board.

The test states that rather than the two moments that were wrong: **every report
the bot files is about the square its author was standing on, and none is filed
by somebody who has not entered** — checked over every report of four whole
games, with everybody writing every turn whether or not they owe one, because a
player sends what they send and the bot decides what to do with it.

## Ninety-fourth pass: one account per arrival

Kept playing the bot. `/save`, `/take`, the seeds, the sinks and the table
lifecycle all hold up — a seventh player is refused, a game that has ended
refuses the die and says why, a file round-trips through `/save` and `/take` and
brings nothing new the second time. The hole was next to the one the last pass
closed.

**`/report` took a second account of the same visit, and a third, and any
number, and filed every one.** `/returns` counts a square as returned to when
more than one thing was written about it — so `/report` twice without moving was
enough to make the game claim a return that never happened, in the one record it
exists to produce and in the file a player exports to keep.

The condition is the engine's, and the mini app has used it since seats arrived:
`owesReport` knows about the winning square, about a six that keeps the turn,
and about the snake at 12 that puts a player back where they started. The bot
was the surface that never asked.

**A repeat is not always wrong, and the test says exactly when it is not.**
Standing on 71, a throw moves the player and a snake at the far end puts them
back on 71 — they left, they were bitten, they returned, which the engine calls
`arrivedByJump` and treats as a genuine second arrival. My first attempt at this
test forbade consecutive repeats outright and failed on that case, which was the
test being wrong and the code being right. It now asserts the real rule: a
square written about twice running means the player left and came back.

Three existing tests had to be fixed too, all of which filed a report at a
moment when none was owed — which is the hole, appearing in the fixtures.

## Ninety-fifth pass: a disabled button is a drawing

The bot gave up four real defects in three passes because its decisions are pure
functions anybody can call. The mini app's are tangled with the DOM, so I have
been clicking through it by hand — and the previous pass's finding pointed
straight at where to look.

**In the mini app, a double tap on Save filed the same account twice.** Verified
in a browser, not reasoned about: three taps, three identical entries about plan
41. `revisited` then counted 41 as a square the player had returned to, when
they had stood there once. A slip on a phone, not an exploit.

The cause is the same shape the bot was caught in twice. `draw` disabled the die
and disabled the report button; `roll` took the throw and `saveReport` filed the
report; **only the drawing asked any questions.** A disabled button is a
drawing, and a drawing refuses nothing.

So the question moved out of the drawing. `mayThrow` answers it once — a spin
already under way, then the intention the game is played to answer, then the
account it has asked for, then the end of the game — and `draw` and `roll` both
ask it. `saveReport` asks `seatOwesReport`, which is what the bot now asks and
what the report button was already drawn from.

The tests play whole games through the same pieces the app uses, with the player
fumbling every tap on Save, and hold the rule the returns rest on: **the squares
the journal says came back are exactly the squares the player arrived at more
than once.** Restated once, after the first version failed: fumbling the *die*
is not the same thing, because a second tap on a die that is still live is a
second throw and always was — a six grants another.

## Ninety-sixth pass: a month of play, one tap

The pass before this named three acts in the mini app still guarded only by the
drawing of a control. The first one tapped gave up the worst defect of the run.

**Changing how many are playing threw the game away.** A game thirty days old, a
player on plan 41 — one tap on the players button, pick a number, and every seat
was back on the waiting square. Nothing asked, nothing said, no way back. The
journal survived, because journals are keyed per seat, but the path through the
board did not.

`seatsFor` built a *fresh* table, and the count is a live control offered at any
moment. The published app asks the same question once, before play, on a screen
of its own.

Somebody joining is not a reason for everybody to start again. `resize` keeps
the seats that stay exactly as they are and makes only the ones that are new;
shrinking is the player saying those seats are not playing, and their journals
are still under their own keys if they sit down again. The turn stays with
whoever held it, unless their seat has gone.

It returns the seats it *made*, and the caller clears drafts for those alone — a
draft under `p2` from a table before this one would surface as somebody else's
half-sentence, and a draft under a seat that stayed belongs to somebody still
playing.

The test is the rule and not the counts: **no seat that stays loses its game** —
checked over every size a table can be, in both directions, comparing each kept
seat against exactly what it was. `seatsFor` is gone; it had no callers left,
which is what `audit-unread` is for.

## Ninety-seventh pass: the last report of a game

Played the mini app to its end rather than through its middle, which is where
the remaining acts were.

**A player who has just reached Cosmic Consciousness writes their last report
and is told "Written. You may throw." — over a dimmed die.** `CLASSIC` asks for
that report: `reportOnWinningSquare`, because 68 is the square a whole game was
played to reach. So the most meaningful moment in the game ended with the app
describing a game the player is no longer in.

It is the bot's `report.filed` defect, in the other surface, two passes later.
The fix is the same in shape and cheaper here, because the decision was already
extracted: the sentence is now chosen by the very question the die is drawn
from. Whatever `mayThrow` says, the line says — they cannot disagree.

**And `canRoll` asked about the table when it should have asked about the
seat.** `isSessionOver` is true only once *everybody* has finished, so at a
shared table the die stayed open to a player who had already finished. Not
reachable in a game this app produces — `nextSeat` skips a finished seat, so the
turn does not land on one — but the decision was wrong and a test of mine had
written the hole down as the rule: it seated the winner *at* the turn and
expected a live die. `CLASSIC.mayReenterAfterWinning` is untouched and remains
what the eighty-second pass found it to be: unreachable in a seated game.

Start over survives a double tap, keeps the journal, and hands back a new game —
checked by tapping it twice.

## Ninety-eighth pass: the one report the game asked for and would not take

Noticed while fixing the last pass and confirmed by playing it: at a shared
table, **the report a winner owes cannot be written.**

`CLASSIC` asks for it — `reportOnWinningSquare`, because 68 is the square a
whole game was played to reach — and the throw that wins is the throw that hands
the turn to somebody else. `nextSeat` never gives it back, and the writing box
belonged to whoever held the turn. So the last account of a game sat owed
forever, with the button greyed out and the winner's own game over: the one
piece of writing this game explicitly asks for, and no way to give it.

The box belongs to whoever owes a report now. The turn holder comes first,
because in every other moment they are the one being asked, and a table where
two seats owe at once should ask the player whose turn it is. The box says whose
report it is when there is more than one seat, files into that seat's journal,
reads that seat's earlier accounts of the square, and its confirmation describes
*them* — complete, or throwing next, or waiting while somebody else throws.

Two tests carry it. `owingSeat` always names a seat that really owes, at every
turn of a played game; and a table of two played to its end leaves **no arrival
unwritten**, the winning one included. That second test failed first because the
harness stopped at `isSessionOver` — the account that ends a game is owed after
the game is over, which is the shape of the thing rather than a defect in it.

## Ninety-ninth pass: the last command nobody had played

`/ask` was the one command left. It had two faults, and they are the two this
project keeps finding.

**It told the companion the player was on Cosmic Consciousness.** A player who
has not thrown a six stands on no square, and the engine parks them on
`WIN_LOKA` until one moves them — so every question asked before the first throw
was answered from the text of the *last square of the board*. The eighth
appearance of the 68 ambiguity and the third command caught by it. The whole
point of `packages/ai` is that the answer rests on the right square's text, so
`/ask` now says there is no square yet and points at `/rules`, which is
something a player can actually read while they wait.

**And a question could not see what a report could.** The report gate has passed
the player's whole path since it was written; `/ask` passed none. Since the
eighty-eighth pass that gap is wider than it looks — the prompt now puts what
the player wrote *the last times they stood on this very square* ahead of
everything else, and a question about that square was the one place it could not
reach. It passes the path now, on the same condition: only when the companion is
actually going to be called.

One existing test had to be corrected: it opened a table and asked immediately,
which is the state this pass makes illegal, so it now rolls onto the board
first — the defect appearing in the fixture, for the third pass running.

**Both surfaces have now been played end to end.** The bot through its pure
commands, the mini app in a browser; every command and every act has been
exercised at least once by something other than a unit test.

## Hundredth pass: eight identical defects are one shape

Square 68 means two things. A player who has not entered sits on it with
`is_finished` set, and so does a player who has just won. The board cannot tell
them apart; only the history can, which is what `hasWon` reads.

It has been found **eight times, in eight places**, and fixed eight times one at
a time: `hasWon` itself, `owesReport`, `needsSixToEnter`, the mini app's header,
the line under its board, the bot's `/report`, the bot's `/ask`, and the mini
app's die. Eight identical defects are one unclosed shape rather than eight
mistakes, so this pass closes the shape instead of waiting for the ninth.

Three tables, one rule. The engine's lists every function that takes a
`GameState`, and **fails when a new one is added without deciding** — proved by
adding a `looksFinished` and watching it go red. The mini app's and the bot's
list the decisions a player actually meets. Where two answers are legitimately
the same — `isSavedGame` must trust both, or a reload throws away either every
new game or every finished one — the reason is written down and checked for
being written down, because "these two get the same answer" is the sentence
eight defects were hiding behind.

**And the first version of the mini app's table was wrong in exactly the way it
was written to catch.** It asserted only that the two answers *differ*. Deleting
the winner's branch from `standing` leaves a winner told they are standing on
plan 68 — different from the waiting player's sentence, and still a lie — and
the table went green on it. It now writes down what each answer has to *be*. A
test that only compares two results passes when both are wrong.

## Hundred-and-first pass: the second shape

The pass before closed the 68 ambiguity as a class rather than waiting for its
ninth sighting. This closes the other shape, which had produced three defects in
three consecutive passes:

- a double tap on Save filed two accounts of one square;
- one tap on the players button threw away a month of play;
- the die took a throw the drawing had already refused.

Each time `draw` had disabled a control and the act behind it had asked nothing.
A disabled button is a drawing, and a drawing refuses nothing — a double tap, a
stale dialog, a keyboard, or a line written next year walks straight past it.

The rule: **a control's availability is decided by a named function, and the act
behind it asks the same one.** The name is what makes the second half possible.
A condition written inline is a decision nothing else can call, which is exactly
why the acts did not call it.

Four drawings were still deciding in place. `mayStartOver`, `mayShare`,
`mayExport` and `mayWrite` now hold those answers, and `startOver`, `shareSquare`
and `exportPath` ask them. `el.report.disabled = owing === null` was a smell even
though `owingSeat` was doing the work: the drawing and the act were two questions
that happened to agree.

`audit-drawings.mjs` is the rule as a check, and **two holes in it were found by
testing the checker rather than trusting it.** `= true` passed as a bare name
until literals were excluded, and `el.writerText.value.trim().length === 0` passed
as a call — the exact shape the audit exists to catch — until reading the DOM
stopped counting as deciding.

## Hundred-and-second pass: the same shape, read backwards

The pass before closed "an act guarded only by the drawing of a control" over
the mini app. A keyboard is the bot's drawing, and the shape is there too —
read the other way round.

The bot's acts all refuse correctly; several passes were spent making sure of
it. What they were not doing was **offering** correctly. `🎲 Roll` sat under a
table that was waiting for a report, so the tap was taken and answered with a
no. A button the game will refuse is a promise it does not keep.

Worse, a throw carried **no keyboard at all**, so whatever was last drawn stayed
on screen however far the game had moved on. The keyboard rides the last reply
now — which is the one the transport attaches it to — and `buttonsFor` decides
it: what this table would actually accept from the seat holding the turn. Where
a throw is refused, what is left is `📖 My plan`, which is the thing the player
has to read in order to say yes.

A keyboard belongs to a message and everybody in the chat sees the same one, so
it is drawn for the seat holding the turn — who is exactly who the message
announcing that turn is about.

**And the property test read as a pass at first.** It checked the keyboard at
the top of the loop, with every report already filed, so the interesting half
never occurred and the whole rule could be deleted without it going red. It
checks after the throw and before the reports now — the moment a player is
actually looking at it — and counts the owed cases to prove they happened. That
is the third time in three passes that a test of mine had to be corrected before
it was worth anything.

## Hundred-and-third pass: breaking things on purpose

Three passes running, a test of mine had to be corrected before it was worth
anything, and each time for the same reason: **the interesting case never
occurred.** A property test that plays four games and checks the keyboard when
nobody owes a report stays green with the whole rule deleted. A table that
asserts two answers *differ* passes when both are wrong. A loop that stops at
`isSessionOver` never reaches the account that ends a game.

None of those were caught by reading them. They were caught by breaking the code
on purpose and watching what went red — which is a thing a script can do.

`audit-mutants.mjs` breaks each decision in turn, runs the suites that own it,
and reports what nobody noticed. Eighteen decisions, the ones whose being wrong
has cost this project a defect before. Not a gate: it is minutes per decision,
so it says so in its own header and runs by hand.

**Its first two findings were bugs in itself**, which is the failure it exists to
catch, so they are written into it rather than quietly fixed. A generic
signature does not start with `(`, so `owingSeat<T extends …>` was reported as
missing from a file it is in. And a return type may contain a brace —
`): { plan: number } | null {` — so the first `{` after the parameters is not
the body; the body's is the one with nothing after it on its line.

**Then the real finding: three decisions with exactly one defender.**
`revisited` could return nothing at all and only one test of four noticed,
because "sorted", "stable" and "nothing for a game that never repeated" are all
true of an empty list. `resize` could hand its table straight back and fifteen
of sixteen assertions still held, because "every seat that stays is unchanged"
is trivially true when every seat stays. Both now name the interesting case
before comparing anything: 1 defender became 8 and 16.

And the counting itself was incomplete: a decision in `packages/` is asked by
the apps, not by its own package, so `also` names the suites that must run with
it. An incomplete count of who is defending something reads exactly like a weak
defence.

## Hundred-and-fourth pass: the sweep over the rest, and the tool lying

The sweep the pass before covered eighteen decisions — the ones I remembered as
having hurt. Two thirds of the code had never been broken on purpose:
`packages/db`, `packages/contracts`, `apps/docs`, and most of `packages/ai`.

Now thirty-four decisions, forty-two mutations, all nine packages. **Every one
is defended by something**, several of them heavily: `stateFromLegacy` by 30
tests, `parseContract` by 18, `sessionFromRows` by 15.

**Booleans are broken both ways now, and that is not a nicety.**
`stripFrontmatter` and `descriptionIsRedundant` each looked like they had a
single defender. Both are tested four ways — three of the four cases expect the
value the mutation happened to pick, so only one could ever notice. One
direction measures the tests' agreement with a guess rather than their coverage.

**And the third bug in the tool was the worst kind: it lied in the direction it
exists to prevent.** A parameter can be an inline object type written across
several lines —

    export function needsSixToEnter(event: {
      isBlocked: boolean;

— and that brace also has nothing after it on its line, so the injected `return`
went *inside the type*. Nothing checks types at test time, so it was stripped
and the function ran unchanged, and the report read **NOBODY NOTICED** for a
decision five tests defend. A tool built to find false confidence had produced
some. The parameter list is skipped by counting brackets now, before any brace
is considered.

Three bugs in three runs, all of them in the mutator rather than in the code it
measures. That is worth saying plainly: a check nobody has broken on purpose is
a check nobody has any reason to believe — including this one.

## Hundred-and-fifth pass: the missing half was a bridge

The mini app has the plans, the returns, the arrival and the whole path —
everything `packages/ai` is given except the model. A player writes into it and
nothing answers, and that has been at the top of "what to do next" for a dozen
passes with the same excuse each time: it is a static page, a model needs a key,
and a key in a browser bundle is a key given away.

All true, and beside the point. **The missing half was never the reflection. It
was the bridge.**

Telegram has one. A mini app opened from a keyboard button may `sendData`, and
the bot receives it as `message:web_app_data`. What crosses is the square format
both surfaces already read and write, so the bot does `/take`'s work — one
account per arrival, the same dedup, the same three refusals — and then answers
it, which is the part only the side holding a key can do.

Filed first, answered second, and that order is the point: a reflection is worth
having and the account is worth *keeping*, and the one that must not be lost to
a slow model is the account. Three tests hold it — with a model that throws, with
no companion configured at all, and with a store that keeps nothing.

**And the mini app's own button was a control that could not work.** Drawn from
`sendData !== undefined`, which is true in every browser on earth:
`telegram-web-app.js` is served from telegram.org and defines `WebApp` wherever
it is loaded. Found by opening the app in a plain tab and looking — the same
lesson as the three passes before, in the pass that had just written the rule
down. It asks `initData` now, which is signed and empty outside Telegram.

Whether the launch came from a *keyboard* button — which is what `sendData`
actually requires — is not visible from the page at all. That is setup rather
than code, and it is written down in `apps/bot/README.md` instead of guessed at.

## Hundred-and-sixth pass: the line the audit always printed

`audit-unread` has ended every run for twenty passes with the same finding:
`squareText`, in `@leela/journal`, has no caller. It is called on every share
and every hand-over to the bot — under another name. The mini app takes the
journal's word for the format with

    export { squareText as shareTextFor } from '@leela/journal';

and export lists are dropped as plumbing before uses are counted. Rightly: a
barrel file that lists everything would otherwise make every export look
consumed. The rename went with them.

**The reason to fix it is not the export. It is the report.** A check that ends
every run with one line it cannot back up is a check people stop reading — and I
had stopped: the finding appears in a dozen of my own summaries as "pre-existing,
leave it".

`aliasesOf` now reads the rename, and uses are counted under every name a thing
goes by. Two things had to be got right, and both are tests:

- **Across lines.** Every list of more than two names in this repository is
  written down the page, and the rename sits in the middle of it. A per-line
  reader found nothing at all — a result indistinguishable from there being
  nothing to find, which is how the first version passed its own test.
- **Not a cast.** `x as Y` is TypeScript's rename *and* its cast. Reading one as
  the other would invent callers, and a check that cannot say "nobody uses this"
  has nothing left to say. So the rename is only read inside an import or export
  list.

Every audit now ends clean, which is the first time that has been true.

## Hundred-and-seventh pass: the durable bot could not read its own writing

Played a whole game through SQLite, reloading the room from the database before
every act, as a restarted process would. The game itself is sound: the turn
holder, every square and every gate survived all thirty-eight round trips. Then
the path came back empty.

**`sqliteReportSink` had `record` and no `history`.** So the *durable*
configuration — the one the README tells an operator to run, with a volume
mounted so that nothing is lost — wrote every report into the database and could
not read one back. And `ReportSink.history` is optional on purpose: its absence
means *this bot keeps nothing*, which the bot then said out loud. `/path` and
`/returns` answered "this bot is not keeping reports", `/save` had nowhere to
write a file, and every square handed over by the mini app two passes ago was
refused because there was nothing to merge it into.

A bot saying the opposite of the truth about itself, on the configuration that
exists precisely so that nothing is lost.

`reportsFor` was written, tested and called by nobody. `audit-unread` cannot see
that: it is a method on a class rather than an export, and the check only looks
at exports. Nor could any unit test — every one of them holds a sink it built
itself, and the assembled bot is where the two halves meet.

The tests state it over **every sink the bot can be built with**, so a fourth
has to decide the same question: either you keep reports and can read them back,
or you keep none and say so. Plus the sentence a player actually meets — a bot
that keeps reports must never answer `/path` with "not keeping reports", and one
that keeps none must never answer with an empty list, because those are
different facts and only one of them is ever true.

## Hundred-and-eighth pass: a test of the thing as it is assembled

The defect the pass before found could not have been found by a unit test. Every
one of them holds a store it built itself; the two halves only meet where the
bot is *assembled* — `openStorage` deciding what to build, `createBot` deciding
what to ask. `audit-unread` could not see it either: `reportsFor` is a method on
a class rather than an export.

So this pass wrote the kind of test that was missing rather than more of the
kind there were plenty of. `assembled.test.ts` builds the bot the way `index.ts`
does, on a real database in a temporary directory, plays through it, throws the
process away, builds it again on the same volume and carries on.

It asserts both halves of the lie separately, because they are different lies: a
bot that kept the report must not answer "this bot is not keeping reports", and
must not answer with an empty list either. Removing `history` again fails two of
the three tests — which is what the whole pass is for.

Two more configurations, both of them things an operator meets:

- **`/save` reads the same store through a different door**, so a store that
  cannot be read has nothing to write. It offers a document now; it offered
  nothing before.
- **A path that cannot be opened** — a volume that is not mounted, the commonest
  deployment mistake — falls back to memory, says so, and still plays. The
  README has promised that for a long time and nothing checked it.

The mini app's equivalent — a private window whose `localStorage` refuses
everything — is covered at the unit level and cannot be reached at the assembled
level from a test: overriding `localStorage` and reloading gives the page a
fresh real one, so the override never reaches the module. Tried, and said here
rather than left as a gap somebody else has to rediscover.

## Hundred-and-ninth pass: the app could not be played in a private window

The bot got a test of the assembled thing two passes ago. The mini app had
nothing between its unit tests and my own hands in a browser — and a browser
cannot be made to refuse `localStorage`, because overriding it and reloading
gives the page a fresh real one. The pass before said so and left it as a gap.

Under `happy-dom` it can. `main.ts` loads whole, against the real `index.html`,
with whatever storage the test hands it. **The first run found the app
unplayable in a private window.**

The intention was accepted and written. The die stayed dead. Nothing could
begin — and the code has claimed the opposite for as long as it has existed:
*"A window that cannot store still plays; the question is simply asked again
next time."*

One line. `saveIntention` catches the refusal and returns true, exactly as
promised, and then the caller **read the value back out of the store that had
just refused it** — getting nothing, and leaving the die shut for want of an
intention that had in fact been given. The filed report had the same shape one
function along: `takeSeat` re-reads the seat's journal, so in a private window
the account somebody had just written vanished from the app's own view of it.

The rule is not about private windows: **what somebody has this moment written
is not re-read from a place that may answer "nothing".** Storage is where things
are put, not where it is discovered what just happened.

Every function involved was tested and every one behaved. The app did not. That
is the third defect in three passes that lived in the assembly rather than in
any part.

## Hundred-and-tenth pass: the rest of the assembled journeys, and nothing wrong

The pass before opened the door: `main.ts` loads whole under `happy-dom`, and
the first thing through it found the app unplayable in a private window. This
pass walked the rest of the journeys the same way — **and found nothing.**

Seating somebody else mid-game keeps the game (the ninety-sixth pass's fix,
holding through the layer the tap actually goes through). A report filed on a
square stood on before opens the box with what was written last time, files the
new account, and turns up as `×2` in the list of all 72 and as a chip in the
path. A file brings a path back. A won game shows the ending, shuts the die,
offers "Start over", and starting again keeps every word. The plans arrive in
Russian, in Arabic — right to left, with the board still left to right — and an
unknown locale falls back to English.

**That is a result, not an absence of one.** Five journeys I had only ever
checked by hand are now held by something that runs on every push, and the
finding is that they were right. Twenty of the twenty-two languages have
translated plans and an English interface — deliberate, and `messageCoverage`
reports it rather than implying otherwise — so what the language test asserts is
the part that is not a choice: the texts arrive, the direction is right, and
nothing throws.

The assembled layer has now produced three defects in four passes and one clean
sweep. Both surfaces have a test of the thing as it is actually put together,
which is where the last three defects lived.

## Hundred-and-eleventh pass: the file carried the answers and not the question

The plan I set myself last time was wrong, and it is worth saying so: `apps/docs`
was named as the surface with no assembled test, and it has the best one in the
repository — including *every internal link in every generated page resolves to
a file that exists*. Checked before writing anything.

So: a real gap in the product instead. **A path left the app as a year of
writing with the frame it was written inside missing.** The reports are the
answer accumulating; the intention is what they are answering. Somebody who
changed phone arrived with everything they had said and nothing they had asked.

`JournalDocument` carries it now. Three decisions, each of them a rule:

- **A field, not a new `schemaVersion`.** A version exists so a reader refuses a
  file whose *existing* fields may mean something else. This changes the meaning
  of none, and a reader that has never heard of it loses nothing it had.
- **Absent rather than empty.** A file carrying `""` says the player was asked
  and answered nothing, which is not what happened.
- **A question already given is never replaced.** The importing app takes the
  file's intention only where it has none of its own — the same rule that keeps
  `reported` out of an import, and for the same reason: what somebody is playing
  for is not a file's to set.

`parseDocument` returns the document rather than its entries, which is the
change that made this possible at all: there was nowhere in the return value to
put the question. The bot takes the entries and ignores the rest — a chat has no
profile to keep an intention in, and it says so where the code says it.

The oversized and the wrong-typed are dropped while the path survives: a file
has been out of the app and possibly through an editor, and a broken question is
not a reason to lose a year of answers.

## Hundred-and-twelfth pass: the companion never knew what the game was for

Three of the four things worth doing next need somebody awake, so: the one that
did not. Grepping for it first turned up something better than the errand.

**The word `intention` appeared nowhere in `packages/ai`, and nowhere in the
bot.** The companion — the one thing that reads every report a player writes —
had never been told what the player was playing for. It read a year of answers
without the question, and this repository's own words are that *the game is
being played to answer it, and the reports are the answer accumulating*.

Both surfaces at once, for opposite reasons: the mini app keeps an intention and
calls no model; the bot calls one and had nowhere to keep an intention.

So the prompt carries it — whole rather than summarised, because it is at most a
paragraph and it is the one piece of context everything else is relative to.
With the care this package exists for: *theirs and not yours — not to grant, not
to judge, and not to declare answered. A game of this is how somebody decides
that for themselves.* A companion that decides a player has answered their own
question has taken the game off them.

And the bot learned to hold one. `/intention` with words sets it, without them
shows it; an `intentions` table keyed by player rather than by table, because a
chat has no profile but the question follows the person between tables exactly
as their reports do. All three routes to the companion pass it: the report gate,
`/ask`, and the square handed over by the mini app.

**One of my own tests was wrong about the fallback.** It expected "there is
nowhere to hold a question" from a bot whose volume is missing — but that bot
falls back to memory, and memory holds a question exactly as long as it holds a
report. Saying otherwise would be the same lie the durable sink used to tell
about reports, five passes ago. The sentence belongs to a bot built with no
store at all, and the test says so now.

## Hundred-and-thirteenth pass: a format cannot tell whose square it is

`parseSquare` dropped the intention on the grounds that a sender's frame is not
the reader's to adopt. True of a square somebody pasted you — and wrong at the
one border it also guarded: **the mini app handing its own player's square to
the bot.** That question is theirs, and it was being thrown away because a format
cannot know which route it came by.

A route can. So the parser hands it up and stopped deciding, and the routes
decide instead:

- **The mini app's hand-over** is the one square the bot can be sure of:
  Telegram delivers it from *their* app. It may set a question.
- **A path brought back as a file** is the same gesture — "bring mine back" — and
  may set one too.
- **`/take`**, which is somebody pasting you a square they landed on, keeps the
  square and declines the frame. So does the mini app's paste dialog, which says
  as much on the button.

And the rule they all decide by, which is now stated in four places and holds in
all of them: **a question already given is never replaced.** What somebody is
playing for is not a file's to set, nor an app's, nor a stranger's.

The parser also had to learn what a question looks like: the last line, beginning
with a dash. A dash mid-sentence is a sentence, and there is a test that says so.

## Hundred-and-fourteenth pass: three questions, three different seats

Last pass ended by naming a risk: the intention now lives in two places that do
not know about each other, and two records of one fact have twice turned out to
be a defect here. Looking at it properly found something worse and nearer.

**Both controls inside the writing box took the square of whoever held the
turn.** The box belongs to whoever *owes a report* — and at the end of a game
those are different people, because winning hands the turn away and never gets
it back. So sharing a winner's account of Cosmic Consciousness sent a friend
**plan 30**, with the winner's words under it and the other player's question at
the bottom: a square nobody stood on, signed by somebody who did not write it.

Three values, three different seats, in one four-line function. The fix is
asking the same seat all three times.

**And the two stores turned out not to be one fact.** The mini app's intention
is per *seat* — three people on one phone are three questions — and the bot's is
per Telegram account, which is one human being. They are different scopes, and
syncing them would have been the defect rather than the cure.

What follows from that is a rule the hand-over now keeps: it carries the square
always and the question **only when the device is one person**. A phone three
people are playing on has no business telling the bot what any of them is
playing for. The square is still theirs to send; the frame is not the device's
to claim.

## Hundred-and-fifteenth pass: a chip under your name, somebody else's writing

Two candidates were named last pass, both from reasoning about the shape rather
than from a symptom. One of them turned out to be worse than the defect that
named it.

**The path view shows every seat at the table**, each with the squares that came
back to *them*. The chips opened the plan and showed whatever the seat holding
the turn had written about it. So a player tapped their own return, under their
own name, in a section headed with their own number — and read the other
player's private writing.

The pass before mislabelled a share. This one handed somebody else's journal to
whoever was holding the phone.

The chips carry whose row they are in now, and `openPlan` takes the seat rather
than assuming it: the turn holder almost always, because they are the one
looking at the board, and not when a chip in another section opened it.

The second candidate was real and small: the writer's hint counted what was left
in the *turn holder's* path while the box was open for somebody else. Same fix,
same reason.

Both were harmless yesterday only by accident — the first because two seats
rarely return to the same square, the second because five hundred entries is a
long way off. An accident is not a rule, and neither of them was one.

## Hundred-and-sixteenth pass: whose, closed as a class

Three passes running, one shape produced a defect. The mini app keeps three
module-level values for the seat holding the turn — `state`, `journal`,
`intention` — right for the board, the die and the line underneath, and wrong
everywhere the app talks about somebody else.

The last two of it were found by reasoning about the shape. This pass looked at
every function that reads them, and found two more:

- **"Save a copy" wrote whoever held the turn's path**, from a view showing every
  seat. A player could scroll to their own section, tap it, and carry away a
  file of somebody else's writing — worse than reading it on screen, because a
  file is kept and passed on. Each section has its own save now, named, and the
  footer's single button is the one-seat case: a button that cannot say whose is
  a button that saves the wrong one silently.
- **The heading counted one seat's path over everybody's entries** — "your path,
  2 plans" above forty of somebody else's.

And the paste box now says whose journal a square is going into, because the
footer's controls live in a view that shows every seat.

**Then the shape was closed rather than the instances.** `audit-whose.mjs` lists
every function that reads the turn holder's values and requires each to be
declared with a sentence saying why. Thirteen are, and the sentence is the point:
writing it is the moment somebody notices the function has a seat of its own.
Proved by adding a fourteenth reader, which fails it.

That is the third shape closed this way, after the 68 ambiguity and the drawings
that decided nothing.

## Hundred-and-seventeenth pass: the same measure, on the other surface

The mini app's "whose" question is which seat. The bot's is **which of your
tables** — a room is keyed by the chat it lives in, which is right for every
command sent at the table, and `/ask` is not one of those: the companion answers
privately, so the natural place to ask is a private chat, where there is no
table. `roomOf` answers it, and the answer is *the table you played last*.

Both stores said so in their own comments. **Only one of them did it.**

The in-memory store re-inserts on save, so its order is the order of play. The
database ordered by `updated_at`, and `Date.now()` has one millisecond to spend
on several saves — so two tables touched inside the same millisecond left the
answer to SQLite, which chose, and chose the other one. A player asking a
question in a private chat could be answered about the wrong game.

The same tie this repository met in `/path`: two reports written in one
millisecond came back in whatever order the database felt like, and `id` was
added to break it. There is no second column to break this one, so the clock
stops repeating itself instead — every save is stamped at least one past the
last, which makes "most recent" an order rather than a hope.

The rule is not about milliseconds: **two stores of one question give one
answer**, and the way to find out is to ask them both. Every test here runs
against both, which is what made a defect visible that each store's own tests
were happy with.

## Hundred-and-eighteenth pass: the other pairs, asked the same questions

The pass before found a defect that was only visible from a test asking two
implementations the same thing: both stores documented `roomOf` as "the table
you played last", and one of them did something else. Each store's own tests
were happy.

So the rest of the pairs were asked. A room saved forty turns in and read back —
the turn holder, every seat, the names, the seed, the count, the language, the
started flag. A table that shrinks. A table deleted, and the player's own table
after it. A chat that never had one. A chat that had one and has another now.
Three reports written in the same millisecond. A question set twice. A path
asked for by a stranger.

**Nothing disagreed.** That is the result, and it is worth having: three pairs,
asked the same questions, agreeing — and the agreement is now enforced instead
of incidental. A third implementation, a Postgres one or a Redis one, has a
suite waiting for it and cannot arrive with a subtly different idea of what a
room is.

Two checks in it are the ones that would have caught the last two defects of
this kind: a room read back *forty turns in*, because a fresh table round-trips
even through a store that loses half of it; and three reports written inside one
millisecond, which is the tie that has now bitten twice — `/path` once, and
`roomOf` the pass before.

## Hundred-and-nineteenth pass: a browser that keeps some of it

Every storage test until now handed the mini app one that worked or one that
refused everything. A browser does neither. It fills up, it is cleared by a
setting, a tab closes mid-write — and what is left is *some* of the six kinds of
key it keeps.

**The first partial state tried found the worst defect available.** A storage
that takes the table and refuses the journal — which is what a full quota looks
like, the table being small and the journal being the thing that grows —
answered *"Written. You may throw."*, opened the gate, and lost the account. On
the next load there was no record of it and no obligation to write it again.

The record the game exists to produce, dropped under a sentence saying it had
been kept.

`saveJournal` used to swallow the refusal, which is the bargain the board makes:
a window that cannot store still plays. The board can afford it — a lost
position is a game somebody restarts. A lost report is not that.

So the failure is reported, and the caller does the only two honest things at
once: **the game goes on**, because the account is in hand for this session
either way and a game stopped by a browser setting is a game lost to nothing;
and the player is told, while their words are still on the screen, that this
browser will not keep them and there is a copy to be saved from "My path".

Two more partial states, both fine and now held: a journal whose table was lost
still opens — a year of somebody's path is not thrown away because the position
it was written at has gone — and a table written halfway is not a game, is not
readable, and leaves the writing beside it untouched.

## Hundred-and-twentieth pass: the same failure, on the other surface

The mini app's storage refusal is a full quota. The bot's is a database locked
by the write before it, or a volume that has gone.

**When the store refused, the player was told nothing at all** and the exception
left the middleware — which for a webhook deployment is an unhandled rejection,
and for the player is silence. This repository has already named that failure:
*silence is indistinguishable from a broken bot, and that is how this one first
looked.*

There was a test asserting the throw propagated, deliberately, so that an
operator would not learn about it from a silence. The player learned from one
instead. Both, now: the player is told the turn was not kept, and the operator's
log carries the error that caused it.

**And nothing that was not kept is described.** The die is deterministic from
`(seed, rollsTaken)`, both of which live in the room that was not saved — so the
same command sent again makes the *same* throw. Describing one that did not
survive would be the bot telling a player about a game it does not have, and
"send it again in a moment" is true rather than hopeful.

The order was already right — keep first, then the effects, then the replies —
so the fix is one function and six call sites that stop instead of carrying on.

## Hundred-and-twenty-first pass: a promise about time that nothing kept

`Guide` exists so that a companion which cannot answer does not stop the game,
and it takes a `timeoutMs` documented as *a player staring at a chat needs an
answer or an apology, not a spinner*. It kept that promise by calling
`controller.abort()` — which is a **request**. It stops a model that wired
`options.signal` through, and does nothing whatever to one that did not.

`LanguageModel` is deliberately the whole surface, "a function from messages to
text", precisely so anyone can put an SDK behind it. An adapter that takes its
abort signal in a different place, or ignores it, is easy and silent to write —
and then the await never returns. Not a slow answer, not a fallback: **nothing,
forever**, which is the one outcome the class exists to prevent. Proven with a
model whose `complete` returns `new Promise(() => {})`.

The deadline is now raced rather than asked for, so it holds for every model.
The abort still fires, so a model that does listen stops working on an answer
nobody will read. A timeout is logged as a timeout — "model failed" sends an
operator looking for a status code that was never issued — and it does not
silence the companion, because a slow minute is weather and half an hour of
silence over one would cost the reports it protects.

The test that was there proved the signal was passed, which was never the
doubtful part. Four models now: one that never returns, one that answers too
late, one that fails too late, and one that listens as an adapter should.

**The same clock, downloading a path.** Node's `fetch` has no timeout of its
own, so a phone that lost its signal mid-upload left `message:document` awaiting
a promise that would not settle — and the sentence saying the file could not be
read sat there, written, unsent.

**And it was the wrong sentence.** Found while writing the test above: a failed
*download* answered `file.unreadable` — "That is not a path written by Leela" —
which judges a file that never arrived, and sends a player to save a perfectly
good one again for the same answer. A download that failed now says so.

## Hundred-and-twenty-second pass: what may be lost quietly, and what may not

Two kinds of effect went through one `catch` in the bot, with one sentence
attached: *a history that fails to write must not stop the game — the move has
already happened, and the board is the record that matters.*

True of a move, which is bookkeeping about a board already saved in the room.
Not true of a report, which **is** the record the game is played to produce —
and the gate saying one was written lives in that same saved room. So a sink
that threw left the player told **"Ada has reported. You may throw."**, the
gate open, and their words gone with nothing anywhere saying so. Probed, not
guessed: no exception, no notice, and the next throw went through.

This is the mini app's full-quota defect, one surface over, still standing after
the pass that hardened the room — that pass wrapped `store.save` and stopped
there. The rule is therefore about the kind of loss rather than about these two
effects: **what the player wrote is never lost quietly; what the game can
reconstruct may be.** A third kind of effect has to answer that question.

The throw stands. They did write it, a full database is not their doing, and
shutting a gate they have earned would charge them for it — the same decision
the mini app made. But they are told while their own words are still a scroll
above, which is the one moment copying them somewhere costs nothing.

**The same measure on the mini app's table.** `saveSeats` swallowed a refusal on
the stated grounds that *forgetting it is a lost game, not an error to show*.
Half right — a private window should still play. The wrong half was the silence:
the app went on saying "a snake at 44 takes you to 9" while the stored board
stayed at 41, so a player could build a month of play in a window keeping none
of it and be told at no point. Said once now, beside the throw it is failing to
keep, and not again: repeated under every throw it would become the wallpaper.

Not through `announce` — `lineFor` discards an announcement when a move is being
described, rightly, because an announcement is about the turn. This is not about
the turn. It is about the browser.

## Hundred-and-twenty-third pass: the floor, and the rule as a check

Four passes running found one defect each, and all four were the same defect: a
model that never returned, a download that never returned, a room that would not
save, an account that would not record. Every one is behaviour the *type*
permits and the code assumed away. Every one was found by going looking.

**The reads had never been looked at.** About thirty of them — `/path`,
`/returns`, `/save`, the journey handed to the companion — each assuming a store
that answers. A sink that throws on `history` took `/path` out of the middleware
and left the player looking at nothing at all.

Guarding thirty call sites would have guarded thirty of them. Instead there is
now a floor: an outermost middleware under which **whatever fails, the player is
told that something did.** The particular sentences stay where they are; they
say more and are worth more. This is what is underneath when there is nothing
particular to say. `bot.catch` is not this — it covers the polling runner, so a
webhook deployment had no floor at all, and it cannot answer the player.

The test is over the whole surface rather than the sites anyone thought of:
every command `bot.ts` registers, against a store and a sink that refuse
everything, still says something. `registered()` reads the source, so a command
added tomorrow is covered the day it is added.

**And the rule is a check now.** `audit-promises` reads the source for every
dependency a caller may supply and asks whether any test hands it an
implementation that throws — or, worse, one that never settles, the failure no
`catch` can see. It found four untried points on its first run and two more once
its own proximity rule was tightened; the loose version had called
`LanguageModel.complete` covered on the strength of a hostile `readFile` three
hundred lines away, which is how a tool comes to report that everything is fine.

Of the six, four already behaved correctly by accident and are now written down
— an SQLite driver that throws, a pruning schedule that refuses, a legacy `idFor`
lookup that is down, all of which fall back or fail one row and carry on. One
was real: **a supervisor whose own `sleep` rejected left the loop**, which ends
the process, so the bot stayed down because the *backoff* went wrong. The one
thing a supervisor may not do is give up for its own reasons. And one is
exempted with a reason rather than a test: an exception inside a DOM click
listener is the browser's to report, and the mini app already asserts no window
errors on load.

## Hundred-and-twenty-fourth pass: the second question

`audit-promises` asked whether every injected dependency is handed a broken one
somewhere. It did not ask what happens next — and a test that breaks a
dependency and then asserts `not.toThrow()` proves the code survived, which was
never the doubtful half. **Every defect of this family was caught somewhere and
told nobody.**

So the audit now asks both. A block that breaks a dependency has to assert
something about the answer: a sentence a person reads, a line an operator reads,
or a value handed back to the caller so it can decide.

**Getting the question right took three attempts, and the two wrong ones are the
point.** A window of four hundred characters called `LanguageModel.complete`
covered because a hostile `readFile` sat three hundred lines away; tightened, it
called `ReportSink.record` unanswered because the hostile sink is built in a
helper at the top of a block and the assertion is two tests below. Both measure
in bytes something organised in blocks — the unit is a `describe`, which is what
a person writes around one subject. Then the assertion check itself, written as
a regexp with a generous lookahead, ran past the end of one `expect` into the
next line and said yes to everything: with every spoken assertion in two files
deleted it still reported all clear. Reading brackets rather than counting
characters fixed it, and the deletion experiment is what found it.

**What the working version found.** `saveJournal`'s own unit test still asserted
only that it does not throw — the assertion the pass-119 defect hid behind, left
in place after that pass gave the function a boolean to return. Asserting the
boolean instead turned up a second door into the same defect: **a store that
refuses answers `false`, and no store at all answers `true`**, because
`storage?.setItem` on nothing is a no-op that falls through to the happy return.
Different reasons, identical outcome — the words are not there next time — and
the app puts "Written." under one of them.

Fixed in all three writers, and stated over the writers rather than about one of
them: nine tests, three conditions each. The third writer had already got it
wrong, so a fourth will be asked the same question.

## Hundred-and-twenty-fifth pass: one word, two questions

Every message key was swept for the shape found two passes ago — a sentence
serving more than one cause, so that for one of them it lies. Eighteen keys are
sent from more than one place and all eighteen are one cause reached two ways: a
button label drawn in two views, a square that arrives by paste or by file. No
message is unused, either, which is the other half of that sweep: a sentence
translated into nineteen languages and shown to nobody.

The defect was one layer down. **`saveIntention` answered a different question
from every other writer in the app.** Its boolean meant *"this is worth
keeping"*, while `saveJournal`, `saveJournalFor` and `saveSeats` mean *"it was
kept"* — one word, two questions, and a caller cannot tell which it asked.

So over a store that refuses, the intention dialog answered **"Two characters at
least — say something you mean."** about a sentence that was long enough. A
browser's failure, reported to the player as their own mistake, in the one
dialog the game will not start without and the one they cannot go around.

Two facts, two sentences. Validity is `isIntention`, which was exported all
along; the writer does storage, and a refusal now joins the notice this app
already shows once — *this browser will not keep the game*. The imported
question from a path file is held for the session too, rather than dropped
because a browser would not write it.

The pass before predicted a fourth writer would be asked the same question. It
was, and it was the one that had it wrong.

## Hundred-and-twenty-sixth pass: the last two writers

Four of the mini app's seven writers answered "was it kept". Two answered
nothing at all, each with a reason attached — and each reason was an argument
for the **caller** saying nothing, made inside the writer, where no caller could
hear it.

`saveLastRoll`: *forgetting it is a worse face, not a broken game.* True, and
still not the writer's decision to make.

`saveDraft`: *a window that cannot store still plays, and still lets somebody
write — they simply have to finish in one sitting.* That last clause is a thing
to tell a player **before** they walk away from half an account, not a note to
leave in the source.

And a draft is the earliest write of a session. Somebody typing in a private
window reaches it before they have thrown anything, so it is the first moment
the app can know that nothing is being kept — and it was the one write that
could not say so. It is redrawn there and nowhere else: every other writer has a
redraw behind it, and a keystroke has none, so the notice would have sat set and
unsaid until the player did something the app already answers.

**The table is derived now.** Seven writers × three conditions, and the list of
writers is read out of the source rather than kept beside it: an eighth fails on
the day it is added, which is the day the question is worth asking. Checked by
adding an eighth.

## Hundred-and-twenty-seventh pass: the last line of somebody's account

The bot's writers were checked first, since the mini app's had just been brought
to one contract. They hold: `store.delete` and `reports.setIntention` are
unguarded, both fall to the floor added two passes ago, and neither prints a
confirmation over a write that failed. Nothing to fix, which is worth saying.

The defect was in the format the two surfaces share. A square is written for a
person to read:

```
41. The human plane (jana-loka)

What it asked of me.

— to stop hurrying
```

The last line is the sender's intention, and *a line beginning with a dash* was
the whole of the mark. So an account that **ends** on a dash-led line — a
closing thought, a quoted line, a signature; ordinary writing — had that line
lifted out of it and installed as the reader's intention: the question the whole
game is played to answer, taken from words somebody wrote about a square. An
account that was *only* such a line came back as `null`, so a square shared in
good faith was answered with "that is not a square".

Reachable from the mini app's hand-over, which builds the square out of exactly
what the player typed.

**The mark is now the dash, the blank line above it, and a body above that** —
all three of which `squareText` has always written, so every square ever shared
still reads. That fixes what reading can fix. One case it cannot: an account of
`A paragraph.` then a blank line then `— a closing thought` is the same bytes as
`A paragraph.` with the question `a closing thought`. The writer disambiguates
it now with a bare `—` meaning "the question is not here"; a reader that has
never heard of that line leaves it in the body, which is a stray character
rather than a missing line and a question nobody asked.

**The property test had the shape and the wrong cases.** It ran the whole
product of plans, titles, writings and intentions — and its five writings
included a dash *inside* a sentence and a line that looks like a heading, the
two somebody thought of, and not the one that broke. Endings are generated now,
every body against every closing line. It also never asserted the intention that
came back, only the plan and the text, so the theft would have been invisible
even with the right input.

## Hundred-and-twenty-eighth pass: bounded on the way out only

The same measure taken to the other format. `@leela/journal` declares three
bounds — `MAX_REPORT_CHARS`, `MAX_REPORTS`, `MAX_INTENTION_CHARS` — and every
one of them is applied where a path is **written**. Only two were applied where
one is read.

The comment on the intention's bound states the whole argument: *a file has been
out of the app and through an editor, so the bound is applied on the way in as
well as out.* The report text sits eight lines above it, bounded on the way out
only. A hand-edited entry of any length passed `isReport`, went into the store,
and came back in every rendering of that path from then on.

Clamped rather than refused, which sits against this file's other rule — *all of
a file or none of it, because half a path is worse than no path.* The two are
about different things, and the difference is worth writing down: a plan of 900
is not a square anybody stood on, so a file containing one is not a path; a
report of five thousand characters is ordinary writing that is longer than the
store will hold. Refusing the whole path over that throws away a year of
somebody's writing to enforce a limit on one entry of it. The intention stays
refused rather than shortened, for the reason it always was: a question cut in
half is a different question.

**A moment, not merely a number.** `isReport` asked `Number.isFinite(at)`, so
`1.5` and `-1` were times something wrote. The list of what a file might contain
instead had `NaN` and `'yesterday'` and stopped there — the same failure the
pass before found in the square's property test, remembered cases where a shape
was meant. The wrong values are generated now, for the plan and the moment
together, since both are whole numbers in a range. A date in the *future* is
still accepted, and that is a decision rather than an oversight: a pure format
cannot know what now is, a player's clock is allowed to be wrong, and an entry
that sorts oddly is a smaller harm than writing thrown away.

**And one bound was two.** `apps/miniapp/src/reports.ts` declared its own
`MAX_REPORT_CHARS` and `MAX_REPORTS`, with the same two numbers as the format —
one copy for what the app writes, one for what a file may carry. They agree
until one of them is changed, and then a report the writer accepts is one the
file refuses, with nothing to say so. Re-exported from the format now.

## Hundred-and-twenty-ninth pass: one bound, declared once

The pass before found `MAX_REPORT_CHARS` and `MAX_REPORTS` declared in the
format and again in the mini app, and fixed those two by hand. This is the same
question asked mechanically, which found two more:

`MAX_INTENTION_CHARS = 800`, **three times** — `@leela/journal` bounding a file
on the way in, `apps/miniapp` validating what a player types, `@leela/ai`
clipping what goes into a prompt. Three jobs, one number, three copies of it.

`MAX_MESSAGE_CHARS = 3500`, twice inside the bot — and the second declaration
sits under a comment observing that the first one exists: *`renderPlan` already
accounted for this; `/path` did not.* That is how every one of these starts.
Somebody needs the number, finds it written down in a module they cannot easily
reach, and writes it down again.

They all agreed, which is the whole problem. Nothing goes wrong until one of
them is changed, and then the app accepts a question the file drops and neither
says a word.

`@leela/journal` owns the intention's bound because it is the one that cannot be
given it: the format has no dependencies at all, deliberately, so that a browser
bundle and a Bun process can both hold it. `@leela/ai` gained a dependency on
it — a package with no dependencies of its own, so nothing came with it.

**`audit-doubles` keeps it that way**, on names rather than values: two
constants that happen to both be 500 are not a duplicate, and two called
`MAX_REPORTS` are one idea whether or not they agree — if they *disagree* the
audit says so, because that is worse. Re-exports are not copies and are not
counted. Checked by planting a copy, twice: once agreeing, once not.

## Hundred-and-thirtieth pass: the copy that cannot be removed

Two ways of widening the last pass's question were tried, and one of them was
worth keeping.

**Same value, different names: no.** Six is the die's largest face, the seats at
a table, the messages a conversation keeps, the roll that enters the game, the
resting face, and the first square. Eight hundred is the longest intention and
the default token ceiling. These are different ideas that happen to be the same
number, and a check that reported them would be teaching people to ignore it.
Names are the signal; values are not. Written down here so the next pass does
not try it again.

**Private declarations: yes, and it found one.** `@leela/journal` held its own
`TOTAL_PLANS = 72` beside the engine's exported one — the board counted twice,
and invisible to a check that only read what a module lets out.

This copy cannot be removed. The format has no dependencies at all, on purpose,
so that a browser bundle and a Bun process can both hold it and nothing it
imports is imported into both. What it can be is **paid for honestly**: the
package now takes a *dev* dependency on the engine and `board-size.test.ts` asks
the engine what the board is and asks the format what it will accept. Tests may
depend on the engine; the shipped package may not.

Left alone, that copy is the same defect as the others waiting to happen. A
board grown to eighty in the engine would leave the format refusing every square
above seventy-two — reports thrown away as "not a plan" on squares a player had
genuinely stood on.

`audit-doubles` records it in a list that names, for each allowed copy, the test
that holds it in step; and it still fails if such a pair stops agreeing, saying
that the test which was to hold them has not. Checked by planting a private
copy, and by making the tied pair disagree.

## Hundred-and-thirty-first pass: the sums, in every language at once

`packages/contracts` was checked first, since the pass before had tied the
format's copy of the board to the engine's. It is already tied, and tied
properly: `compareBoards` reads the Solidity in both directions — every jump the
engine has, and every jump the contract has that the engine does not — and the
source is read at module load, so a missing or renamed file fails loudly rather
than leaving an empty parse to agree with everything. Nothing to fix.

So: the translation audit, whose structural half needs nothing external and had
been deferred for six passes.

Two widenings of the existing check were tried. **Numbers a translation has that
neither edition has** is mostly ordinals — Japanese writes *6th chakra* where
English spells the word out — and reporting them would be a check nobody reads.
**But the arithmetic is not a translation question at all.** Plan 9 argues that
nine keeps its identity under multiplication and lists the products; plan 8
argues the opposite and lists its own. Whether nine times two hundred and eighty
is two thousand five hundred and twenty is the same question in Ukrainian as it
is here.

**Three languages state `9х280=7,380`.** It is 2520. Ukrainian, Malay and
Arabic — the three translated from the English edition — and the English donor
in `leela-src` carries the same false line, so it is inherited rather than
introduced here. That was checked rather than assumed. The shipped English
follows the Russian edition and says 2520.

`audit-arithmetic` checks two claims per equation and no more, because every
further one was the tool misreading rather than the text being wrong: the
product, and the single digit a chain comes down to. The steps between are not
checked — Ukrainian writes plan 8's as `8х2=16= 1 +6 =7`, spaces and all, and a
first attempt at reading those steps reported six faults in three languages
before the raw text was looked at. Checked in both directions by planting a
false product and a false reduction.

**Recorded rather than repaired**, as the forty-two missing references are.
Correcting a number in three shipped translations is a decision about content,
and this audit's job is to make it impossible to miss rather than to make it
quietly.

## Hundred-and-thirty-second pass: six places it was not

The arithmetic layer found something last pass, so this one went looking for the
rest of it. Six probes, no defect, and the six are worth writing down — a place
already checked is worth as much as a place repaired, and rather more than
checking it again next month.

- **Numbers a translation has and neither edition has**: ordinals. Japanese
  writes *6th chakra* where English spells the word out. 127 plans reported, all
  of them typography.
- **Majority vote across the 22 languages** — a number sixteen languages carry
  and one does not. Thirty-six findings, and every one of them already in the
  forty-two `audit-numbers` records. A strict subset, so it adds nothing.
- **Placeholders in translated messages** — `messageIssues` already checks them
  in both directions, plus plural categories.
- **Rules chapters**: none empty, none duplicated, and the three languages that
  carry `online` and `foreword` are already handled by `bookFor`, whose comment
  names them.
- **`packages/contracts`**: already tied both ways, and its source is read at
  module load, so a missing file fails loudly rather than leaving an empty parse
  to agree with everything.
- **Orphan pages in the built book**: none.

Two guards came out of it, both of which find nothing today and would find
something after a rebuild.

**A total, then its factors.** `900 breaths (60 х 15)` is the other shape the
arithmetic is written in — the answer before the factors — so the equation
reader never saw it. Twenty languages carry it, all twenty right. The gap
between the number and the bracket is bounded and may not cross a sentence,
without which "9 planets … (60 x 15)" three sentences later reads as a claim
nobody made.

**Everywhere can be landed on.** The docs test that every link resolves; this is
the same property from the other side, and 1,784 files is enough to lose one in.
Written naively it reports twenty-two orphans and all are false — the root links
to `en/`, not `en/index.html` — and a check that cries wolf twenty-two times on
a sound site is one nobody keeps. Proved by planting a page nothing links to;
proved *not* by removing the index's chapter links, which leaves the pages
reachable through the language switcher, and that was the first mutation tried.

## Hundred-and-thirty-third pass: an order nobody chose

The Russian book put the chakras chapter before the numerology one. Every other
language puts numerology first. Nothing decided that.

`build-content.mjs` reads the rules from three different donors, and each reader
walks an object literal — so a book comes out in whatever sequence somebody
typed those keys. Two of the three literals happen to agree with each other. The
Russian one, written a few lines above them, does not.

**Which order is right is not a matter of taste, and the donor answers it.** The
English chapters are numbered in their filenames — `0-chortdescription`,
`1-introduction`, `2-meaningofthegame`, `3-numerologygames`, `4-chakras`,
`5-notes` — so that edition says numerology is the third chapter and the chakras
the fourth. The Russian sources are a flat folder of unnumbered names with the
plans and the rules mixed together; there is nothing in them to read an order
out of, and the order the Russian book had was not the Russian book's.

So every book is ordered by the English one, in the generator and in the data —
a reordering of six lines, no text touched. Chapters English does not have keep
their own sequence, after the ones it does: `online` and `foreword` come from a
different edition, and placing them inside a book on the strength of a slug
would be inventing an order rather than following one.

The test is a relation rather than a list of six slugs: **two readers of the
same book, in different languages, meet the same things in the same sequence.**
A seventh chapter would not have to be added to it to keep it true.

## Hundred-and-thirty-fourth pass: the same shape, one line lower

The pass before found a book ordered by the sequence somebody typed object keys
in. So this one went looking for the rest of that shape, and found it in the
function that decides what script a text is written in.

`kana`'s range contained the whole CJK ideograph block as well as the kana. So
every Japanese character counted twice — once as `kana`, once as `han` — and
**Chinese text, which has no kana at all, scored exactly the same for both.**
`dominantScript` takes the highest count with a strict `>`, so the tie went to
whichever was written first in the literal, which is `han`.

The answer is right. Nothing about it was decided. Swap those two lines and
every Chinese chapter becomes Japanese — including to `audit-dataset`, which
refuses a chapter written in a script its language does not use, so the 72
Chinese plans would start failing the build with nothing about them changed.

Two things, then. `kana` means kana, because Chinese never uses it and that is
what tells the two apart. And a tie, if one can still arise, is settled by the
script's name rather than by its line number — an answer that depends on where a
key was typed is an answer nobody chose, and this is the second time.

The test reads the ranges out of the source, the way `apps/bot` reads its own
registered commands, and asserts over every character the repository ships that
**no character is counted for two scripts**. Double counting is how an exact tie
arises in the first place; without it, the order of the literal cannot decide
anything. Put the old range back and it names the first offender out of 2,132.

## Hundred-and-thirty-fifth pass: a sentence true of nothing

The hunt for more order-decided-by-a-literal came up empty — the one remaining
loop over an object literal now settles its ties by name, and every other one is
counting or collecting where order cannot matter. A mechanical check for it
would flag `count > best`, which is how an argmax is written everywhere and
almost never a defect. Written down so the next pass does not build it.

So: the bot's in-memory stores, which nothing had looked at.

`Conversations.clear` carries the sentence *a new game is a new conversation*
and **had no caller anywhere in the repository**. So a player who ended a table
and opened another went on being answered in the light of the one before it. The
sentence was true of nothing.

`/end` clears it now, for the seats of the room being ended and no others — a
conversation belongs to a player, and one player ending their game is not a
reason to forget somebody else's.

**And neither store ever gave anything back.** Each conversation is bounded at
six messages; the number of conversations was not. Each refusal is a few bytes;
the number of refusals was not. This repository has already measured that
argument once and found it false — *a bot that is never restarted is not
accumulating tables either*, written above twelve weeks of finished games that
had piled up because nothing swept them. Both stores are bounded now, and both
evict the least recently used rather than the first ever seen, so the player in
a long game is the one they never drop.

Forgetting a refusal costs one direct message that fails, after which it is
learned again — which is what `allow` already does in the other direction.

## Hundred-and-thirty-sixth pass: the sum, corrected

Three shipped translations stated `9х280=7,380`, in the plan whose whole
argument is that nine keeps its identity under multiplication. They say `2,520`
now — Ukrainian, Malay and Arabic, one token each, in the grouping every one of
those files already used, with nothing else in the sentence touched.

This is the one repair in the translation damage that needed no translator. The
forty-two missing board references still do: putting a number back into a
sentence means writing the sentence. Here the sentence is right and the digits
were wrong, and which digits are right is settled by arithmetic in every
language at once. The English donor in `leela-src` carries the same false line,
so the error was inherited rather than introduced, and correcting it here does
not diverge from a translator's judgement — there was none to diverge from.

**Two records emptied, and one of them said so itself.** `audit-numbers` has a
branch for damage that is recorded and no longer there — *recorded as missing
and now present — take these out of RECORDED* — and it printed the three lines
to remove without being asked. `2520` had been listed as a number those three
languages had lost, which was true: they had it wrong rather than absent, and a
wrong number is a missing one to a check that looks for the right one.

`audit-arithmetic`'s own list is now empty, and stays in the file. A list that
empties is the point of keeping one.

## Hundred-and-thirty-seventh pass: the half `export` cannot see

`audit-unread` asks whether every export has a caller. A class is exported and
its members are not, so every method and getter in this repository was invisible
to it — and that blind spot has cost two defects already. `reportsFor` hid in it:
a durable sink that wrote every report into SQLite and answered anybody who
asked that it kept nothing, for as long as the durable configuration existed.
`refusedCount` sat in it, an observable nothing observes.

It reads members now, and found two — one of them new.

**`SqliteRoomQueries.stepsFor` has no caller.** `game_steps` is written on every
move by `sqliteStepSink`, and this method is the only thing that can read it
back. So a durable bot has been filling a table nobody has ever opened. That is
`reportsFor` again, one table over, and it is recorded rather than answered:
reports are the record the game exists to produce and had to be readable, while
moves are not, so the choice is between a command that reads a game's throws
back and not writing them at all. Both are decisions about what the bot is for.

**Three things had to be fixed in the tool before it could be believed.**

A member's own declaration reads exactly like a use of it, so `refusedCount` —
whose only mention anywhere is the line declaring it — came back as called once.
A member is always reached through something, so a bare name at one indent
level, followed by a bracket, is a declaration and never a call.

The other two were shapes already handled for exports and worth naming again:
private members are skipped, because a class talking to itself is the one case
where nobody else calling is the point; and constructors are skipped, because
`new X()` calls them.

The proof it works is last pass's defect: take the `/end` handler's call to
`Conversations.clear` away again, and this audit names it — *a new game is a new
conversation*, said by a method nothing called.

## Hundred-and-thirty-eighth pass: a reference is not a numeral

The audit that reports lost board references has said *42 plans across eight
languages* for a long time, and this repository has repeated the figure in three
places. **Six of those were never lost.**

The check counts digits. German plan 55 says `vier Hauptaspekte`; Spanish and
Hindi and Chinese plan 62 say `el octavo plano`, `आठवें तल`, `第八位面`; Marathi
plan 5 says `पाचव्या क्रमांकावर`. The references are all there, written the way
those languages write them.

The worst of the six is Ukrainian plan 60. The sentence reads *«поки не
досягнуть **шістдесят восьмий** квадрат»* — until they reach the sixty-eighth
square, the square the whole game is played to arrive at, spelled out in full —
and the audit reported it as dropped.

`lib/numbers.mjs` already carried the note that *three false alarms had to be
closed before any of this could be believed*: Arabic digits, grouped thousands,
two source editions. This is the fourth, and the only one that got past. Every
excused reference is now a quotation from the file it came from, read before it
was written down — not vocabulary, and not a translation.

**Thirty-six remain, and they are an upper bound.** Checking the rest means
reading twenty-two more sentences in Arabic, Malay and Ukrainian. What has been
read is what is excused.

The test asserts the shape rather than the six: a spelled-out reference counts
as present, a reference that is genuinely absent still counts as lost, and a
language nobody has read gets no benefit of the doubt.

## Hundred-and-thirty-ninth pass: two audits, two questions

Reading the rest of the records, as the pass before said it would. Five of them
turned out not to be about board references at all.

Plans 8 and 9 argue from arithmetic — *eight is a number that decreases when
multiplied*, and nine is one that does not — and each lists its own
multiplication table. This check was reading every term of those tables as a
cross-reference to a square. So Ukrainian, Malay and Arabic, whose donor edition
prints a **shorter table**, were recorded as having lost the board in two plans
each: thirty-three numbers between them, not one of which is a square.

Those tables belong to `audit-arithmetic`, which holds them to a stricter rule
than presence — every product checked, in every language, which is how the false
`9х280=7,380` was found and corrected two passes ago. Two checks, two questions.
This one asks whether a sentence still points at the square it points at.

**Narrowly, though.** `numbersIn` still reports the terms of a table, because
somebody asking what numbers a text states wants them; it is the *loss* question
that ignores them. The distinction is the whole of the change, and one of this
file's own tests had encoded the opposite: its fixture for "the audit names the
plan and the numbers" was `9x5=45`, so it tested the exclusion rather than the
audit. It asks about a cross-reference now, which is what the audit is for.

**And the exclusion uncovered a real one.** `ar/9: 72000` — the nadis of the
body, a reference Arabic genuinely dropped — had been buried inside a record of
table rows, invisible because the line it sat on was already known.

Thirty-one records left, still an upper bound: what has been read is what is
excused.

## Hundredth-and-fortieth pass: a numeral, or a sentence

Reading further into the thirty-one, and the useful finding is that they are not
one thing. **Malay keeps the sentence and drops the numeral. Ukrainian drops the
parenthetical whole.**

Plan 60 in Malay still names `buddhi` and `ahamkara`, plan 51 still names
`tamoguna`, plan 30 still names `prana` and `apana` — passages pointing at
squares they no longer number. Ukrainian plan 44 has no `джняна` in it anywhere,
and plan 30 no `прана`, `апана` or `вьяна`: the cross-reference is not damaged,
it is absent.

That difference is the whole of the repair. One is a numeral put back where a
sentence already points; the other is a sentence to write. The records say
which, for the ones somebody has read, and each claim is checked against the
data in `numbers.test.ts` rather than taken on trust — which is the difference
between a note and a record.

**A classifier was tried and is not being kept.** The term a reference names is
usually Sanskrit, and Sanskrit is transliterated rather than translated, so it
survives into scripts that share nothing with the source: `прана` is `прана` in
Ukrainian and `prana` in Malay. It decided thirteen of forty-three. The other
thirty name nothing that can be looked for — `24 hours a day`, a numbered list,
`the 8th plane` — and a check that answers a third of the time is worse than
none, because the two thirds it is silent about read as clean.

So what is written down is what was read. The same rule as the word forms two
passes ago, and for the same reason.

## Hundred-and-forty-first pass: the one part it was handed

`packages/ai` clips every piece it puts in a prompt. The plan's text at 2,400
characters, on a paragraph boundary so it never stops mid-sentence. Each journey
line at 160. The intention at 800. Each of those bounds has a paragraph above it
explaining what would be crowded out of a small context window without it.

The conversation history was clipped by **count**. Six messages, of any length
at all.

Measured rather than assumed: the system prompt cannot pass 6,080 characters,
and the report the player just wrote adds at most 4,000 — so everything this
package decides comes to about ten thousand. Six unclipped exchanges took the
same prompt to **34,080**, more than three times its own considered size, and
every character of that came from outside.

It fails in the quiet way. A request refused for length comes back through
`Guide` as the fallback sentence, so a companion that had stopped answering its
longest conversations would look, from inside the game, exactly like one having
a bad day — and the players it stopped answering are the ones who had been
playing longest.

An exchange is clipped now, not dropped: cutting it loose would lose the thread
the history exists to keep, and the beginning of a question is the part that
says what was asked.

The test is a ceiling on the whole prompt rather than a bound on the piece that
was missing one, and the ceiling is derived from the constants rather than
written down — so raising one of them moves it, and a seventh part added
tomorrow has to fit inside it.

## Hundred-and-forty-second pass: a character is not a character

The ceiling put on the prompt last pass is in characters, and every constant it
is built from is justified against English — *the longest plan runs past 6000
characters*, *forty reports at full length would push the plan out of a small
context window*. Measured across all twenty-two languages, with the player
writing in their own script:

| | characters | bytes |
|---|---|---|
| English, Malay, Javanese | ~17,200 | ~17,300 |
| Russian, Ukrainian, Arabic, Urdu | ~17,200 | ~31,000 |
| Bengali, Marathi, Tamil, Telugu | ~17,100 | ~43,000 |
| Japanese | 16,933 | **47,615** |

The same ceiling buys a third as much context in Japanese as it looks like it
does. A window counts tokens, and tokens track bytes far more closely than they
track characters.

**Nothing is clipped differently for it, and that is a decision rather than an
omission.** A denser script carries more of the plan in the same characters —
this repository measured that two dozen passes ago, when CJK bodies at 0.3–0.5×
the English length turned out to be dense rather than truncated. And the clip
does not even reach those languages: Japanese and Chinese plans are *shorter*
than `MAX_PLAN_CHARS` to begin with, so the bound whose reasoning is most
English-shaped is the one that never fires on the scripts it would matter to.

What is asserted is that the cost cannot grow quietly: a second ceiling, in
bytes, at three per character. No script here needs a fourth, and Japanese
reaches 2.8 — so a language whose writing needs more, or a character bound
raised without anyone weighing what it costs in Bengali, fails the test.

## Hundred-and-forty-ninth pass: a reason the engine never gave

Three passes running found one surface asking something the others did not, so
this one went after the shape rather than the instance — and found it in the
engine.

`TurnBlockedReason` declares `finished`, and `canRoll` returns it **nowhere**:
the only mention of that word in `turn.ts` was the type itself. So every surface
wrote the check by hand. The bot: `if (hasWon(player.state)) return { say:
'finished' }`. The mini app: its own `canRoll`, per seat. The phone: `isOver`,
which asked `isSessionOver` — *every* player — and at a shared table would have
left the die open to somebody who had already arrived.

A vocabulary with an unreachable word in it is worse than a shorter one. It
reads as though the question is answered here, and three answers get written
somewhere else.

`canRoll` returns `finished` now, for a player who has won under rules that do
not let them start again. `hasWon` rather than `is_finished`, because the flag
says two things and only one of them is this one — a player waiting to enter
carries it too, and for them the answer is still yes.

**And two surfaces stopped re-deciding.** The mini app and the phone each had a
`mayThrow` that named `report-required` and `finished` as `owes-report` and
`game-over` and worked them out again, while the bot asked
`canCurrentPlayerRoll`. Both ask the engine now and keep only what it cannot
know: whether a spin is under way, and whether a question has been answered —
the engine has never heard of either.

**One refusal stays where it was, and is not silent about it.**
`CLASSIC.mayReenterAfterWinning` is true, so the engine lets a winner start
again; the mini app refuses. At a table that difference is unreachable —
`nextSeat` skips a finished player — but in a game of one the turn stays put and
the die would reopen for somebody who has arrived. The eighty-second pass found
that flag and deliberately left it alone, and following the engine here would be
changing the game rather than the drawing.

## Hundred-and-fiftieth pass: every word a type declares

The pass before found `finished` declared in `TurnBlockedReason` and returned
from nowhere, which cost three surfaces a hand-written check and one of them got
it wrong. `audit-reachable` is that question asked of every string union in the
repository: **is each word one that something says?**

Fourteen unions, and it took two wrong versions to make it able to fail.

The first looked for a word in every package at once, and both attempts to
break it passed. `'finished'` is said by the bot's `{ say: 'finished' }`, about
something else entirely. `'path'` is a command, a message key and a filename. A
word common enough to appear *somewhere* is a word this check can never see
missing — which is exactly the blind spot `audit-unread` had two passes ago,
where one live caller of a name covered a dead export of the same name next
door. Scoped to the declaring package it catches both: a union's producer lives
where the union does.

The second version then reported `role` in `packages/ai`, and that one is
correct rather than defective — which is the distinction the check is really
about. `chatType` is Telegram's four values, received and compared against
`private`. `role`'s `assistant` turns are the model's own words, handed back by
whoever kept the conversation. **A package that never says a word it accepts is
not a package failing to produce one**, and the two of them are listed with that
reason. Everything else is something this repository claims to make.

Checked by putting the last pass's defect back: it names `TurnBlockedReason`
and the word.

## Hundred-and-fifty-third pass: what the game offers, on every surface

Four passes running found the phone missing something its neighbours had, and
every one was found by reading: it wrote accounts and showed none of them, it
let a player at the die without asking what they were playing for, it could hand
a path out and not take one back. Four different defects, one shape — **a
surface quietly offering less than the game does** — and this repository's whole
premise is that the surfaces differ in drawing, not in what the game asks or
gives.

`audit-offers` is nine things the game offers against three surfaces, and the
evidence is a call into a shared package rather than a phrase or a filename:
what a surface *does* is which of the game's own functions it reaches for. A
name of its own proves nothing — three surfaces wrote three `mayThrow`s.

**It reported two things that were not true, and both are worth keeping.** The
first version read comments, and said the phone offers a companion on the
strength of a sentence in `journal.ts` naming `@leela/ai`; a check fooled by
prose says a surface has what it has not. The second said the *mini app* has no
companion — and it does, by handing the square to the bot through Telegram's
`sendData`, because a browser bundle has no business holding an API key. Looking
only for the import was a check describing how a thing is built rather than
whether it is offered.

Recorded rather than enforced, like the missing board references: a gap is a
decision about what to build next, not a fault to block a build on. What is not
allowed is a new one.

**And the book is no longer one of them.** Every other surface has the rules —
the bot's `/rules`, the mini app's chapters — and the phone had a plan's text
with nothing around it, so a player on a square they did not understand had
nowhere to look. `bookFor` rather than `rulesFor`, so a language without
chapters of its own is served English ones whole rather than half a book.

**One of them closed the same day it was written down.** A whole path is a file
and an occasion; a square is a message — *this is where I am and this is what it
asked of me* — and it is the door people actually use. The bot has had `/take`
for it since it could read one; the phone could carry a path both ways and not a
square either way.

The two decisions that come with it are the bot's, asked of the same format
rather than answered again. **The frame is not adopted**: a shared square
carries the sender's question, and taking it would let a message set what
somebody is playing for — the mini app's hand-over is the only route that may,
because Telegram delivers it from the player's own app. **And it is stamped on
arrival**, because a square carries no time and inventing one puts it where
nothing happened, after which `revisited` reports a return that never was.

The sentence names the square that arrived rather than the one the reader is
standing on. Somebody on 6 can be sent 41, and `square.took` takes a `{plan}`;
filling it with the reader's would have been the fifth time a sentence in this
repository named the wrong thing because it was the value nearest to hand.

One gap left, the phone's: the companion.

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

**3. `apps/mobile` — the game is there; the shipped app's services are not.**
An Expo app that builds, installs and runs on an iOS simulator: the board from
`BOARD_ROWS`, the plan texts from `@leela/content`, the bundle id
`com.leelagame` kept.

**It carries no rule of its own, and that is the whole point of it.**
`GameService.ts` in `NeuroLeelaExpo` is 471 lines, of which
`getDirectionAndPosition` and `handleConsecutiveSixes` decide where a throw puts
a player — the fifth copy of the board's rules in this family of repositories,
after the published app, the Expo rewrite, the Solidity contract and the mini
app. Every copy has been somewhere the game could quietly become a different
game. So `src/game.ts` holds a seat, a die and the last event, and `advance`
does the rest.

Asserted two ways, because either alone is weak. The source is read for the
*shapes* a movement rule takes — a jump written as a number pair, the winning
square as a literal, arithmetic on a position — since a comment cannot stop
somebody writing one back in. And a game is played through the app's own
functions and replayed through the engine square by square, because matching
source text proves nothing about what happens on a throw.

**The gate had been half-built, and the wrong half.** The app shipped with a
button labelled *Write a report* that wrote nothing: it called `submitReport`,
the gate opened, and no account was kept anywhere. The requirement was cleared
and the thing it requires was removed — the ceremony without the reflection,
under a label promising otherwise. The gate exists so that a player reflects
before they move; a button that clears it without taking the reflection is the
whole purpose read backwards.

So the phone writes now, in `@leela/journal`'s format and to that package's
bounds, and a path written here is one the bot or the mini app can read.

**The decision came out of the component, and that is why it is tested.** No
test of `journal.ts` could have seen the defect: a handler inside a screen is
not a function anybody can ask. `takeAccount` is, and it gives three answers
that are separate on purpose — *was anything written* decides whether the gate
opens, *was it kept* decides what the player is told. Running the two together
is how a refused write came to be reported as "Written." in the app next door.

Two more of this repository's own lessons arrived within the hour of writing
it. A second `isReport` was written here and let `plan: 900` through, until the
format's own was used instead. And the no-rules test flagged `minHeight: 72` in
a stylesheet as the size of the board — a check that cries wolf on a layout is
one somebody deletes rather than obeys, so it reads the game code with the
styles taken out.

**The path survives the app closing now.** `AsyncStorage`, which is what the
published app used — `OfflinePlayers.ts` keeps its six players there — so a
phone that has run both is not holding two unrelated things in two unrelated
ways. `device.ts` is the only file in this app that knows what a phone is, and a
test says so: everything else takes a `Keeper` or a `Store` and is content with
a `Map`, which is what lets a path be tested without a simulator.

A `Keeper` is asynchronous, so it gets a deadline for the reason
`packages/ai` and `apps/bot` did: nothing in its type says it ever returns, and
a promise with no clock is the failure a `catch` cannot see. Here it would be
worse than in either — the write happens while the player is looking at the
words they just typed, and a screen still waiting on a disk is a screen that has
eaten them.

**Two identifiers, not one.** This file said *keep the `applicationId` and the
bundle id* as though they were the same string, and the app was built with one
of them on both platforms. They are: **`com.leelagame`** on Android
(`android/app/build.gradle`) and **`xyz.ghashtag.dharma`** on iOS
(`ios/leela.xcodeproj/project.pbxproj`), and the home screen calls it *Leela
Chakra* (`CFBundleDisplayName`). An iOS build under the wrong identifier is a
different application to the store, to the keychain, and to every player who has
the published one installed. Asserted now rather than commented.

**And it reads the path back.** The app wrote accounts and showed none of them
— `writingsOn` was written, exported, and called by no screen — which is the
shape the bot was found in, where reports went into SQLite correctly and nothing
ever returned them to the player. A record nobody can read is a record the game
is not producing. What a player wrote on a square is now under that square when
they stand on it again, which is the moment it is worth reading.

**The audit could not see it, and now can.** Uses are counted by name across
every package, and the mini app has a `writingsOn` of its own — so one live
caller there covered a dead export here and `audit-unread` reported that every
export has a caller. Thirteen names are declared in more than one place; for
those, each declaration is now asked whether **its own package** uses it.

Applications only. A library exists to be used by somebody else —
`@leela/journal` calls almost nothing it exports, and that is what a format is —
while an application's own export is for that application. The first version of
the check did not make that distinction and reported the format package as dead
in three places, which is how a check earns its way into being switched off.

**One question, one answer.** *Is this a question the game can hold* had three
of them: the mini app's `isIntention`, the bot's
`said.length < 2 || said.length > MAX_INTENTION_CHARS` written inline with the
two as a literal, and the phone about to write a fourth. Each carried a comment
saying it was the published app's bound — `yup.string().min(2).max(800)` in
`ChangeIntention` — and each was a separate place for that to stop being true.

It lives in `@leela/journal` now, with `MIN_INTENTION_CHARS` beside the maximum
that moved there five passes ago. That package is the one all three can reach:
no dependencies at all, on purpose, so a browser bundle, a Bun process and a
phone can each hold it. The mini app re-exports it, because its callers ask it
what an intention is and there is no reason to make them ask two.

The phone keeps one now — its own key, apart from the path, so that neither can
make the other unreadable. And the two questions stay apart: whether the words
are a question, and whether the device kept them. The mini app answered both
with one boolean for four passes, so a browser that refused the write told the
player their sentence was too short, in the one dialog the game will not start
without.

**And the die will not turn without a question.** The published app will not let
anybody near the board without one —
`if (!prof.intention) navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true })`
in `screens/helper.ts`, the back gesture blocked — and the mini app refuses a
throw for the same reason. The phone let a player straight to the die, so the
same game on the same board asked a different thing of them depending on what
they were holding it in. That is the one difference between surfaces this
repository does not allow: they differ in drawing, not in what the game asks.

Not a `RuleSet` change. The intention gate lives in the surfaces — the mini
app's `mayThrow`, the published app's navigation — and not in `@leela/engine`;
this is the phone joining them rather than a new rule.

A **reason** rather than a boolean, in the order a player meets them:
`no-intention`, then `owes-report`, then `game-over`. A dimmed control with no
explanation is the app ending somebody's game without saying so — and the
question comes first because every account is written inside it, so asking for
the writing before the question is asking somebody to answer a question nobody
put.

**And the path can leave the phone.** It could not: a player who had answered
there could not bring what they had written to a table, and the record the game
exists to produce lived exactly one reinstall. The bot reads this format from a
file and the mini app writes one — that the format has no dependencies at all is
the whole reason it can be all three.

`Share` is React Native's own, so nothing native came with it, and **the
question goes out with the answers**. A file without one is a year of answers
with the question missing, which is what the mini app's export was until it was
given the same argument; absent rather than empty when there is none, because
`""` says the player was asked and answered nothing.

The test is the round trip through the format's own reader rather than the shape
of a JSON object — a test that checked the fields would pass while
`parseDocument` refused the file.

**And it takes one back.** A path that can only leave is two paths, not one:
somebody who began at a table or in the mini app could not carry theirs here.

Three decisions, none of them new. They are the ones the mini app was taught by
its own defects, and this asks the same questions of the same format rather than
answering them again — which is what a format with no dependencies is for.
Nothing is lost: `newEntries` keys by the square and the moment, so a file
arriving twice adds nothing the second time. **A file does not open the gate**:
whether *this* player owes an account for the square they are standing on is the
engine's business and this game's, and a report written elsewhere about another
square is not a reason to let them throw. And the question is taken only where
there is none, because what somebody is playing for is theirs.

The sentences are the path's, not the square's. `app.paste` reads *Paste a
square* and was the nearest key to hand; using it would have been the same
defect this repository has now met four times — a sentence that names the wrong
thing because it was the one already written.

**And it spoke one language, on a device that knows twenty-two (171st pass).**
`App.tsx` said `resolveLanguage(undefined)` — a literal — so the fallback was
the answer and every player on earth was handed English, by a game whose whole
third pass was spent repairing 744 titles in fifteen languages.

Every other surface asks. The bot reads `ctx.from?.language_code`, the mini app
reads Telegram's user language and then `navigator.language`, and the app this
one replaces read `RNLocalize.getLocales()[0].languageCode` in `src/i18n.ts` and
served ten languages from it — falling back to *Russian* rather than English for
a Russian device (`ruOrEnLang`). Only the phone declared, and it declared the
one wrong answer that looks correct from an English desk.

`deviceLocale` in `device.ts`, which is where it has to live: everything else in
this app takes a `Keeper` or a `Store` and is content with a `Map`, and
`no-rules.test.ts` fails on a native import anywhere else. Three sources in the
order they are trustworthy — `Intl.DateTimeFormat().resolvedOptions().locale`,
which is the language the platform would format a date in and therefore the
question being asked, then iOS's `AppleLocale` and Android's `localeIdentifier`,
which are what `react-native-localize` reads underneath. Intl is present in the
Hermes this app links: checked in the `ios-arm64_x86_64-simulator` slice of
`hermes.xcframework` rather than assumed from a version number. **Nothing rather
than a guess** when none of them answers, because an invented locale is
indistinguishable from a phone really set to it.

The test states the shape rather than the call site: **no literal ever reaches
the resolver**, since a source cannot know what phone it is running on, and
`undefined` is the worst of them — it typechecks, it is the documented way to
say *I have no locale*, and it silently answers English. Plus every one of the
twenty-two resolves from the tag a device would report, in all three forms a
platform emits (`ru-RU`, `ru_RU`, `zh-Hans-CN`, and an `-u-ca-gregory`
extension), or asking the phone would mean nothing.

It also failed on its own explanation the first time it ran: `App.tsx` documents
the defect it fixed, and a comment naming `resolveLanguage(undefined)` reads
exactly like the defect to a regular expression. Comments are stripped before
the source is scanned — `no-rules.test.ts` takes the stylesheet out for the same
reason.

**And the guard that came with it.** `BOARD_ROWS` is the path itself, so which
side a row begins on is geometry and not typography; React Native reverses
`flexDirection: 'row'` under a right-to-left layout, which would mirror every
row and move the snakes and arrows to the wrong side. `styles.board` pins
`direction: 'ltr'`. It cannot happen today — the app declares no right-to-left
localisation, so `I18nManager.isRTL` is false on an Arabic phone too — and it
becomes possible the moment somebody adds one, which is what *the app now speaks
Arabic* invites. The text still follows the reader; the fields have carried
`writingDirection` from `directionOf(language)` since they were written, and it
was dead code until this pass, because the language was always English.

**Two letters of English in the sentence that says come back later (205th
pass).** `formatWait` lived in `@leela/engine` and returned
`${hours}h ${minutes}m`. The bot drops that into `roll.cooldown`, which is in
the catalogue in Russian — so a player under a variant with a day between
throws read *Пока нет. Следующий бросок через 23h 45m.*

The engine has no catalogue and no language, on purpose, so the words could
never have been right there. It does the arithmetic now — `waitParts` — and
`@leela/content` has the sentence, which is the split `describeMove` and
`writerHint` already use. Abbreviations in both languages, because that is how a
clock is written in either and it sidesteps four Russian plural forms for an
hour.

The check states the shape rather than the two letters: **a language whose own
script is not Latin is never handed Latin letters**, over every size of wait,
and every one of the twenty-two answers with something that is not a
placeholder.

**And a probe that found nothing, worth writing down.** Every command that takes
an argument was sent a bad one — `/plan 0`, `/plan 73`, `/plan 3.7`, `/plan abc`,
a twenty-one-digit number, `/rules 0`, `/rules two`, `/rules 2 99`, `/take` with
nothing and with prose. Each answered with the range it wanted, and paging past
the end gives the last page, as its own comment promises.

**Told to write more, after writing nine hundred characters (204th pass).** The
same lens, one field along. `isIntention` refuses a question shorter than two
characters **and** one longer than eight hundred, and the bot answered every
refusal with the same sentence: *a little more than that — two characters at
least.* So somebody who had just written a considered question in a chat was
told to write more, and nothing was held.

The wrong cause, in the one dialog the game will not start without — which is
the sentence this repository already wrote down about the same shape, when a
browser's refusal to store came back to a player as *a little longer, please*.

Measured before it was claimed: nine hundred and eighty characters in, *two
characters at least* out.

The mini app's box is `maxlength="800"` and the phone's is
`maxLength={MAX_INTENTION_CHARS}`, so on those two the boundary is met while
typing rather than discovered. A chat has no box to stop — the same reason the
over-long report was the bot's alone.

**Refused rather than clamped, and that is the difference from a report.** The
format keeps an over-long report by cutting the end off it and drops an
over-long question *whole*: a question cut mid-word is a different question, and
it is the frame every report is written inside. So it is refused at the door,
with the bound named and the number of characters over it.

**Ninety characters that disappeared on the way (203rd pass).** The third
surface, and the same bound. Telegram carries 4,096 characters and
`MAX_REPORT_CHARS` is 4,000, so a report written in a chat can be longer than
the format holds. The bot filed the whole of it, said *P has reported*, and the
tail was cut later — by `parseDocument`, when the path was carried to a phone.
Ninety characters of somebody's writing gone on the far side of a file, where
nobody was watching it happen.

Measured, not guessed: sent the longest thing Telegram will carry, read 4,090
out of the store, and 4,000 back out of the format.

The other two surfaces cap the box a player types in — `maxlength="4000"` and
`maxLength={MAX_REPORT_CHARS}`. A chat has no box to cap, so the clamp belongs
where the report is filed. Clamped rather than refused, which is the reading
`parseDocument` already makes about the same number: *a report of five thousand
characters is ordinary writing that is longer than the store will hold*, and
refusing it outright would throw away all of it to enforce a limit on the end of
it. And said, in English and Russian, because a bound nobody is shown is
indistinguishable from a bug.

The check states the shape rather than the number: **what is filed and what
comes back out of a file are the same text.**

**A bound nobody is shown, on the surface that wrote the sentence down (202nd
pass).** The same lens as last pass, on the other two bounds. `record` cuts a
report at `MAX_REPORT_CHARS` and drops the oldest account past `MAX_REPORTS`,
and the phone said neither: the text simply stopped appearing at four thousand
characters, and a player's first account went without a word when their five
hundred and first arrived.

The mini app had already met both and answered them — *both limits here used to
be silent… the published app has no maximum at all; ours exists because
`localStorage` is bounded, and **a bound nobody is shown is indistinguishable
from a bug***. It wrote its own `hintFor`, and the phone, cutting by the same two
numbers in the same two ways, had nothing at all: no counter, no sentence, no
warning.

`writerHint` in `@leela/journal` answers it once, and answers with a **key**
rather than a sentence — this package knows the bounds, `@leela/content` knows
the words, the same split `view.ts` already uses for the line under the mini
app's board. The order is part of the reading: running out of room in the box
beats a standing fact about the path, because one is what the next keystroke
meets. Both surfaces ask it now; the three sentences were already in the
catalogue in English and Russian.

**Twelve plans brought back, and eleven of them gone (201st pass).** Probed the
shared format at its bound instead of in the middle. `merge` joins a path and a
file and cuts to `MAX_REPORTS` — five hundred — and said nothing about the cut,
so both surfaces that call it told the player a number that was not what
happened.

The phone said `newEntries(...).length`: what was *new*, over a cut that had
just thrown that many of the oldest away. Directly above it, in as many words:
**Nothing is lost.** The mini app said `entries.length - before`: the *growth*
of the path — and at the bound a path does not grow, because every arrival costs
one of the oldest, so a player near five hundred was told *nothing new in that
file* about a file whose accounts had all landed.

Two wrong answers to one question, and the repository had already written down
the rule that governs it: *saying twelve accounts brought in over a store that
took none is the untruth this surface told about a report.* One function along.

`merged` in `@leela/journal` answers it once — the union, how many of the
incoming are **in** it, and how many of the oldest the bound pushed out — and
both surfaces say both halves. The count is a different question from *how many
were new*, and the case that proves it is a full path meeting a file of older
accounts: every one of them new, not one of them kept.

**Three probes before it that found nothing**, and that is worth writing down
too: the mini app's first launch, its two-seat hand-off and the journal's
round trip are all sound. Two of the three false starts were my own instruments
— a twenty-millisecond wait for a throw that takes two seconds, and a seat's
question written under a key the app does not use.

**The third surface with the same shape (200th pass).** `startOver` in the mini
app empties this seat's board, releases the gate and forgets the draft — and
kept the sentence the finished game was *played to answer*. So the new game
stood under the old question with `mayThrow` already satisfied by it, and
nobody beginning again was asked what they were beginning for.

The bot on `/end`, the phone on *Start over*, and now this: one question, three
surfaces, three separate places where it had to be decided. The mini app's
answer is its own — only this seat's question goes, because the others are in
the middle of their games on a shared device.

**Clearing is a different act from keeping, and needed its own function.**
`saveIntention('')` refuses anything `isIntention` refuses — which is what keeps
*a little longer, please* out of the store — so `forgetIntention` is beside it,
for the same reason `clearDraft` is not `saveDraft(…, '')` where a caller means
forget.

**And it had to ask, not merely forget.** This app already had the rule written
down, where a hand-off meets a seat that has never answered: *the die is shut
until it answers, so the question has to arrive by itself rather than wait
behind a control nobody can press.* Clearing without asking would have been
exactly that control — a disabled die and no dialog until the page was
reloaded.

**An existing test held the old behaviour** — *after restart the die is
usable* — and its rule was right while its example was the case where the die
must not be: it now asserts the die is shut and the question is on screen. The
same correction as the two passes where a check was written from the same
reading as the code.

**Beginning again kept the question of the game just ended (199th pass).**
`startOver` replaces the board and refuses to hand back the seed it was given —
written down, and argued for: *what was being written about the winning square*
must not reappear in the game that replaced it. The sentence the finished game
was **played to answer** survived all of it. It stood over the new game, and the
gate before the first throw — the one this app was given because it let a player
straight to the die — was already open on it, so nobody beginning again was ever
asked what they were beginning for.

The bot reached the same place from the other end two passes ago and answered it
the same way: `/end` lets go of the question along with the game. The decision is
the game's, so `StartingOver` says it — `askAgain` — and the screen clears the
question in both places it is held, because one cleared and one kept comes back
at the next launch. The box the question is typed into is cleared too: left as
it was, the new game opens with the old sentence in the field, one tap from
being answered again by accident.

**And a defect I did not report, because it was not there.** The report box
looked unguarded: it is drawn from the length of the text alone, and
`takeAccount` files against `standingOn`, which is the parking square for a
player who has not entered. Both true, and neither reachable — the whole writer
block is inside `owesAnAccount(game)`, so the box does not exist in either state.
Checked before claiming; the surface is protected by where it is drawn.

**The last act of a finished game was a crash (198th pass).** Played a game
through `apps/mobile`'s own functions until it ended, and then asked the two
questions the screen asks. On Cosmic Consciousness `mayThrow` answered **yes**
and `throwDie` threw `SessionError` — so the throw button stayed lit on the one
square the whole game is played to reach, and pressing it raised an unhandled
exception inside an `onPress`.

The two came apart in the engine. `canRoll` is asked about a *player*, and its
winner branch is guarded by `mayReenterAfterWinning`, which `classic` sets true.
With one seat, winning ends the session — and `advance` refuses a session nobody
can move in. So the check said one thing and the act did another about the same
game.

`canCurrentPlayerRoll` asks the session's own question first now. Whether a
winner may begin again is still `canRoll`'s and still the ruleset's to answer;
this is the prior one, and `advance` has always answered it the same way. Held
by a test over **every** ruleset: play to the end, and the check must refuse
what the act would refuse.

**And the line under the board was a debug dump.** It read
`${roll} · ${from} → ${to} · ${direction}` — the event's own fields with dots
between them, and `arrow 🏹` in English under a Russian board. It is the only
sentence that screen writes about the game, and a player reads it after every
throw.

The nine sentences it needed were already in the catalogue in both languages,
written for exactly this, and the mini app had been saying them since it was
written: *You threw 4. An arrow at 10 takes you to 23.* What was missing was a
second caller. `describeMove` is in `@leela/content` now, beside the catalogue
it is built from, so the two surfaces cannot drift into two wordings — the same
reason `bookFrom` lives there.

**Three of my own mistakes on the way, all caught by measuring.** A probe read
`game.last` where the field is `game.event`; a hand-built "waiting to enter"
state left out `is_finished` and the engine simply moved the piece off 68; and a
test die that cycled 1..6 in order never lands on the winning square, so the
game it played never ended.

**The gate everyone quoted, and the condition nobody read (197th pass).** The
contract is the one implementation that ever stated the report rule, and both
`contracts/README.md` and `ONCHAIN`'s comment rest on it:

```solidity
require(
  reports[reportIdCounter].reporter == msg.sender,
  'You must create a report before rolling the dice.'
);
```

The sentence is what has been quoted. The condition is a different rule.
`reportIdCounter` is the id of the last report filed by **anybody**, so what is
asked is *were you the last person to write* — not *have you written about the
square you are standing on*. Alone at the table a player writes once and may
throw for the rest of the game: nothing on the roll path touches `reports` or
`reportIdCounter`, so the answer cannot change. With two players it becomes a
turn-taking rule nobody wrote, where one player's report shuts the other out.

**And the flag that would have been the rule as everyone reads it is dead.**
`playerReportCreated` is set true on a report and false on a roll, and read
nowhere — public state that looks exactly like the gate and is not consulted by
it. The check states that as a shape: every mention outside the declaration is
an assignment, so an edit that *reads* it fails, because the flag becoming live
would change what the gate means.

Not a bug to fix. The bytecode is deployed and unreachable, `onchain` describes
it rather than correcting it, and `requireReportBeforeRoll` is still the nearest
true thing to say. It is a description to get right, which is the whole purpose
of this package — so the description now says what the condition asks.

**Four of `onchain`'s twelve fields were held to the Solidity and eight were
memory**, which is exactly how the one wrong flag got in the last time. Each is
now read off the source, or recorded as one the contract cannot express:
`turnCooldownMs`, `cooldownFrom` and `refusedThrowStartsCooldown` are that kind,
because a contract keeps no clock — `block.timestamp` is stamped onto a report
and consulted by nothing that decides whether a throw is allowed.

**A second contract exists and agrees.** `leela-ai-web3/contracts/LeelaGame.sol`
is a different, smaller implementation with a token attached — a sixth
description of the board. Run through this package's own comparison it reports
zero divergences: all twenty jumps and all three constants match the engine.

**Two arrows pointing away from where they led (196th pass).** The pager under
every plan is `← 11 · Contents · 13 →`. It is a flex row, so in an Arabic or
Urdu page the browser already puts the previous link on the right and the next
on the left — and both arrows carried on pointing the way they point in English,
each one away from the page it leads to. A hundred and forty-four pages, two
languages, every plan.

The mirror image and nothing else: the glyph swaps, the order does not. `→ 11`
in a right-to-left page puts the arrow at the outside edge of the link, pointing
right, which is the shape an English reader sees pointing left. The same family
as the legal pages filed under `lang="ar"` over English text, and as the board
mirrored into nonsense before `asLeftToRight` — knowing a language reads the
other way is not the same as laying it out that way.

**And a chapter three books have not got, which nothing on the site mentioned.**
Arabic, Malay and Ukrainian came through a different donor with a different
table of contents: none of the three has the chapter on the chakras, two have no
`meaning` chapter, and all three carry an `online` and a `foreword` nobody else
does. Malay and Ukrainian still have six chapters — **the same count as every
other language** — so nothing that counts sees anything, and `audit-dataset`
prints *133 rules chapters against their scripts* without asking whether they are
the same chapters.

The bot and the mini app already borrow the English chapter and mark it;
`bookFor` is where that decision is written, and its comment says so. The site
deliberately does not *file* English under `/ar/` — a page in the wrong language
is one `audit-dataset` refuses and a reader cannot see coming — and that
decision stands. What was missing is the other half: the contents page now names
the chapter, links it to `/en/`, and carries the sentence written for exactly
this, *in English — this chapter is missing from your book*. The reader's own
chapters keep their places; the borrowed one is appended.

**A page that became the next page halfway down (195th pass).** Built the docs
site and read the Arabic page for plan 12 end to end. It opens on envy — the
first snake, the bite that takes a player back to the first chakra — and then,
without a break, becomes **antariksha**, which is plan 13. A player standing on
Envy was reading the whole of Nullity, and the same is true in Malay and
Ukrainian.

One donor is where all three come from.
`leela/src/locales/en/translation.json` has `plan_12.content` at 3,070
characters: 1,408 of envy, then 1,662 that are the opening of
`plan_13.content`. Those three are the languages translated from that edition.

**Two wrong instruments before the right one, both caught by measuring.** The
first asked which plans are more than twice the length of their English — these
are 1.5× and it reported nothing. The second asked whether a plan *ends with*
the opening of the next: true of the English donor and false of every
translation, because the two copies were translated independently, so they agree
for a few hundred characters and then drift, and plan 12 holds a copy that stops
in the middle of plan 13. The question the data actually answers is whether a
plan **contains** the opening of the next one, and where.

**Repaired, where the untranslated titles were recorded**, and the difference is
the bar `lib/corrections.mjs` states: the donor must be checkably wrong, so that
correcting it overrules no translator. The cut starts at a run of 548 to 725
characters that is word for word, in that same language, the opening of plan 13.
What follows the run opens with plan 13's own name — `البطلان`, `Pembatalan`,
`Нікчема` — and shares runs of 251 to 321 characters with it. Every part of what
is cut is plan 13's, and it stays on plan 13. Plan 12 now ends where the English
donor's envy ends: *this envy is a negative reaction, which draws his energy
back down to the first chakra.*

Applied by the generator, so a rebuild reproduces it, and loud when it stops
matching — the rule the corrections already had. The check runs over all
twenty-two languages and all seventy-one neighbouring pairs, not over the three.

**`apps/site` is an empty directory** and has been since it was created. There
is nothing in it to audit; the site that exists is `apps/docs`.

**Two answers the player could never be shown (194th pass).** Handed the
companion a stub model and read what the transport was asked to send.

**An empty answer was passed on as an answer.** `Reflection.text` promises *what
to show the player, always non-empty*, and the call site handed back whatever
the model said — a filtered response, a completion cut at zero tokens, a
provider answering 200 with an empty choice. All of them arrive as success, so
the fallback that exists for exactly this was skipped: the call did not throw.
Downstream it is worse than a failure, because an empty message is the one thing
Telegram refuses. The player reads *something went wrong, try again in a moment*
about a companion that answered instantly, and trying again asks the same model
the same prompt.

**And a long one was sent whole.** The prompt asks for brevity and usually gets
it, but *usually* is not a limit. Nine thousand characters went to the transport
in one message, which is refused, which is the same generic error — about an
answer that was written and then thrown away.

Split rather than truncated, and in the transport rather than at the one call
site: `paginate` truncates an over-long block on purpose, because the blocks it
packs are *reports* and half of somebody's writing is worse than none, while the
companion's own prose loses nothing by arriving in two messages. Paragraphs
first, then lines, then a space, then mid-word — something has to give, and a
message that cannot be sent gives everything. Only text this side of escaping is
cut: a reply carrying its own HTML is paginated upstream and cutting a tag in
half would break it.

**Three of my own mistakes, caught by the tests before the commit.** The splitter
made an empty message out of a leading blank line; two of the tests compared
whitespace they had themselves inserted at the break; and one asserted about a
paragraph break in a text short enough to need no breaking at all.

**A new game asked the question of the one before it (193rd pass).** Played a
game, ended it, opened another, and read what the second one said about itself.
`/intention` answered *You are playing to answer this:* with the sentence
written for a game that no longer existed, and the gate before the first throw
— the one this bot was given because a whole game could be played without ever
being asked — stayed open on that answer.

`/end` had already been taught half of this. It clears the companion's memory,
under the right sentence: *a new game is a new conversation.* What a player is
playing for is kept the same way, by user id, and was left standing. So the
companion of the new game would have been told the old question, and the player
was never asked for a new one.

**And the same discard by the other route did neither.** `/new` replaces a table
whose game is over without `/end` being sent at all — a player who won and
opened another game kept both the question and the conversation. One helper now
serves both, because a table let go of is a table let go of.

**The question is per player, not per table**, which is what makes clearing it
the wrong default. A player at two tables who ends one must keep what they wrote
for the other, so this asks `roomOf` first and only lets go when there is no
table left. `roomOf` is optional on a store; one that does not offer it gets the
older behaviour, and that is written down rather than discovered.

**Anybody could clear a table somebody else was playing (192nd pass).** Played a
group game of two and read every line, including the ones sent to the player who
is not the host. `/end` asked nothing: not who sent it, not whether there was a
table. It deleted the room and replied *The table is cleared* to whoever typed
the word.

In a group that is everybody who can write in the chat. A lurker who never took
a seat wipes the board, whose turn it was, every player's position, and the
companion's memory of every exchange — in one word, with no confirmation and
nothing kept. The written accounts survive, because those are filed per player;
the game does not.

**The same file had already decided this twice.** `/start` is host-only, and
says so — *only whoever opened the table may start it* — because starting closes
the table on everybody else. `/new` refuses to discard a session that is not
over. Ending it was the door left open beside two locked ones.

A game in progress belongs to the people sitting at it, so any of them may end
it and nobody else may. Not host-only: five players should not need seat zero's
permission to stop. Before it starts and after it is over there is nothing to
lose and anybody may clear it — which is also what keeps a group from being
stuck, since `/new` will not replace a running session. The residue is stated
rather than hidden: a *running* table everybody seated has abandoned stays until
one of them comes back.

**And clearing nothing was reported as clearing something.** `/end` in a chat
that never had a table replied *the table is cleared* — a sentence about
something that did not happen, the shape this repository keeps meeting. It says
there is no table now.

**A title is two parts, and the check read one string (191st pass).** Played a
game as a Japanese player and read every line the bot sent. Plan 62 came back
as **`62. Happiness (スカ)`** — the Sanskrit rendered into katakana beside an
English word where the name of the square goes.

The check written the pass before asked whether the whole title held any of the
language's script, and about that title the answer is yes. Every title in this
dataset is `<the name> (<the Sanskrit>)`, and the term in parentheses is kept in
every language — Japanese plan 6 is `妄想(モハ)`. So a title can carry the
language's script in the half nobody is reading as the name. Four of them were:
Japanese 17 *Compassion (だや)*, 37 *Jnana（ジナナ）*, 58 *Plan of Radiance
(テジャ・ロカ)* and 62 *Happiness (スカ)*, recorded now at fourteen.

Both parenthesis characters, because the same file mixes them: plan 37 in
Japanese uses the full-width pair. A title that is only the term — `Sattvaguna`,
`マヤ` — is judged whole, since stripping it to nothing and then asking about
nothing would pass every one of them.

**The instrument was right about presence and wrong about where to look**, which
is the third time in three passes that the check needed checking before the
finding did. It was found the way all six of the last ones were: play the
surface and read every line, rather than ask the data a question it has already
answered.

**The script check had never looked at the game (190th pass).** `audit-dataset`
has asked *is this text written in the language it is filed under* since the
English rules book was found to have a Russian chapter in it. It asks it of the
rules book: six chapters a language, a manual a player may never open. It has
never asked it of the seventy-two plans — the text the game puts on the screen
on every throw — and the sentence it printed on a green run, *every rules
chapter is written in the language it is filed under*, is true and reads like
the dataset.

Pointed at the plans, it finds ten titles the machine handed back untouched. A
Japanese player standing on plan 12 is told they are on **Envy (irasya)**, in a
list where every neighbour is Japanese; Chinese, Korean, Bengali and Tamil
players on plan 40 read `Vyana-loka` where the same language renders every
neighbouring loka in its own script with the Sanskrit in parentheses. The donor
did it — `translate-leela/locales/ja/12-envy-ja.md` opens `# Plan 12. Envy
(irasya)` above a Japanese page — and `leelaWeb3`'s copy is byte-identical, so
there is no better source in the family to take instead.

**Recorded, not repaired**, under the bar `lib/corrections.mjs` already states:
a correction must be checkably wrong — arithmetic, not judgement — because nine
times two hundred and eighty is two thousand five hundred and twenty in every
language at once, and what a title should say in Tamil is not. The audit fails
on an eleventh finding, and equally on a record that has stopped matching
anything, which is how a record turns into a claim that keeps passing.

**And the first instrument was wrong, again caught by measuring before
claiming.** `couldBe` asks which script a text is *mostly* in — the right
question for a chapter and the wrong one for a title. Every title carries the
Sanskrit in parentheses, and eleven Latin letters outweigh four Han characters,
so weighing them reported 121 untranslated Chinese titles of which 111 are
translated. Presence is the question a title asks, and `writtenIn` asks it.

**What it cannot see is printed on a green run.** Nine of the twenty-two
languages are written in the Latin script, and an English title left in German
has every letter a German title has. The audit says which count it read and
which it could not, because *nothing found* and *nothing looked for* print the
same sentence — the confusion this dataset has already been read through once.

**A descent from Cosmic Consciousness that never happened (189th pass).** Read
the other prompt — the one every report produces — for a real game, printing one
example of each arrival sentence. The first report of **every game** said:

```
The player is on plan 6: Delusion (moha).
They walked here one square at a time.
They came from plan 68.
```

Two false things in two lines. A player waiting to enter is parked on `WIN_LOKA`
— the engine's own choice, and the published app draws the piece there from the
first screen — so an entering throw carries `previousPlan: 68` and a `direction`
of `step 🚶🏼`. The prompt read the first as a square they had come from and the
second as a walk, about somebody who had been off the board entirely.

The ninth sighting of the 68 ambiguity, and the first inside a model's
instructions: the companion's first answer of every game rested on a descent
from the winning square.

Nothing moves off 68 — a player who stood there has won and is out of play — so
a `previousPlan` of 68 on any *other* square can only be the parking space. That
is the same reasoning `isWaitingToEnter` encodes for the current square, applied
to the previous one. The prompt says what did happen instead.

**And the suite already held one (189th pass, second finding).** Chasing the
above, `apps/bot` was run fifteen times: *still offers a real return, when this
arrival has not been written about* failed about one run in twelve with *no
square came back in 200 turns*. It played a clock-seeded game and hoped somebody
would land twice on one square inside the bound — and a player who **finishes**
stops moving, so the remaining turns were spent throwing for a board nobody was
on. It now plays fixed games in order until one returns somebody, and finds it
in the first, in nine milliseconds.

A flaky check is worse than no check: it is a red run nobody believes, and this
one had been reporting a defect that was not there since the day it was written.

**And my own check was a coin toss.** The first version played a second throw
and asserted *that* arrival named a square. The die is seeded from
`(chatId, now())` — a different game every run — so which kind of arrival the
second report describes is drawn fresh each time. It passed eight runs here and
failed on CI. This file already carried the lesson, in a comment four hundred
lines further down: *an assertion on the words of a throw is then a coin toss.*
Both checks now fix the clock and state the rule over **every** arrival of one
whole game, with a guard that the game contained a move at all.

**And an existing test encoded this one too**, exactly as last pass: *tells it
where they came from, when that is somewhere else* filed the first report of a
game and asserted the prompt said *they came from plan N*. The rule was right
and the example was the one arrival with no somewhere else. It plays a move
first now, and a second test holds the entering case.

That is twice in two passes that a check was written from the same reading as
the code, and inherited its mistake. Both were found by looking at the artefact
— the prompt itself — rather than at either.

**A first visit announced as a return (188th pass).** Played a game and printed
the system prompt the model actually received, which no unit test can do: they
build a context by hand, and the defect was in what the caller assembles.

The prompt said:

```
They have stood here before, and wrote:
70. Sattvaguna — account 24: what this square asked of me…
```

One account, and the preamble says *before*. Three call sites hand the companion
a path — the report gate, a handed-over square, and `/ask` — and the first two
take out the words they are about to answer, with the reason written beside
them: *so the companion is not handed the words it is about to answer as though
they were already history*. `/ask` took none out. So a player who arrived
somewhere, wrote about it because the game requires that before anything else,
and then asked a question had their own minutes-old account announced as a
return, under a paragraph asking the model to notice *what changed between the
tellings* — of which there was one. Ninth sighting of a sentence naming the
wrong thing, and the first inside a model's instructions.

`/ask` has no text to filter by, so the rule is asked a different way: the newest
account on the square being stood on, and only once `reportSubmitted` says this
arrival has been written about. A player who asks **before** writing still gets a
real return, which is the whole reason that section exists.

**An existing test encoded the defect.** *carries what the player wrote before,
when they ask about a square* filed an account on the square being stood on and
asserted the prompt contained it. Its rule was right and its example was the one
case where the entry must not appear; it reports on a square, moves on, and then
asks now.

**And the second revert did not bite until the test was fixed.** Cutting the
entry unconditionally passed everything, because reaching a genuine return takes
a played game — and the first attempt never moved at all: the bot has refused a
throw without an intention since the 179th pass, and the loop had not answered
one. A test that cannot reach the case proves the case is unreachable in the
test, and nothing else.

**The end still owed an account, and said nothing about it (187th pass).**
Played a solo game the whole way to 68 and read every line. The closing three:

```
P100 reaches Cosmic Consciousness. 🕉
P100: finished 🕉 — owes a report
That is the game. /path shows what you wrote along the way; /new opens another table.
```

`classic` asks for a report on 68, and a pass went into making the winner's
account possible at all — the square a whole game is played to reach was, for a
while, the one arrival nobody was ever asked to write about. Having made it
possible, the closing line pointed at `/path` and `/new` and **not** at
`/report`. Every other arrival is met with the words that discharge it. The
obligation is named one line above, in a parenthesis in a list, in the same
breath as *that is the game* — which is not a place anybody reads an obligation.

The account *can* be given: `/report` after the win is accepted and answers
*their game is complete* 🕉. The sentence had somewhere to point all along.
`onchain` is the guard — `reportOnWinningSquare: false`, because an on-chain
winner is out of play and `createReport` requires `isStart` — and a game under
it ends without the instruction.

**Three instrument errors this pass, all caught before they became claims**,
which is now the larger half of what this method costs. `/path` reported *you
have not written anything yet* after fourteen accounts: `ReportSink.record`
takes one object and I had called it with four positional arguments, so the
history filtered on a field that was never set. Replaced the hand-rolled stub
with `MemoryReportSink`, which is the real contract and cannot be got wrong.
`/save` printed nothing because it sends a document and the harness only
recorded `sendMessage`. And *A six — throw again* after a refused overshoot
looked like the defect fixed the pass before — it is correct: nobody moved, so
nothing is owed, and the throw really can be taken again.

**And a test helper had to be corrected before the fix could land.** `finished()`
checks a reply for `/report` before checking it for the win, files a report and
plays on — and the new closing line contains both, so the game never finished.
One reply can be two things.

**A six that had to wait, and was told to throw (186th pass).** The method that
found the last two defects, turned on the surface with the most sentences: a
whole game played through `handleUpdate`, with every line the bot sent printed
and the addressee beside it.

The transcript put these two one under the other:

```
Bo: /roll  → P200 throws a six and enters the game on 6.
           → A six — throw again.
Bo: /roll  → Write what it brings up before you move on.
```

`roll.again` was announced whenever the six kept the turn. A six that moves a
player onto a new square also leaves them owing a report — which is **every
entering six**, the first six of every game — so the invitation and the refusal
sat in consecutive messages, contradicting each other. Under `classic` almost
every six owes an account, so the immediate promise was nearly always the wrong
sentence; it read as correct whenever anybody checked one throw in isolation.

The announcement asks `canCurrentPlayerRoll` now, the same function that refuses
the next throw, so the two cannot disagree. A six that can be taken says *throw
again*; one that must wait says *and another throw, once you have written about
this plan* — silence would be worse than the contradiction, because a player who
is not told loses an extra turn without knowing they had one. A six under a
cooldown says nothing extra: `online` measures the wait from the moment the
report is written, and any figure named now would be wrong by the time it
mattered.

**The existing check had the rule one notch too coarse.** It asserted that the
words *throw again* appear exactly when the turn is kept, which is what made the
defect invisible: the sentence was there, and it was wrong. The rule is two
rules — a player is *told* about the extra turn exactly when it is granted, and
*promised it now* only when it can be taken.

**And my first two tests for it were both wrong**, which is worth recording. One
required the immediate promise to occur, and after the fix it almost never does
— the proof of the finding, mistaken for a failure. The other counted a refused
`/roll` as a throw and read the gate's own words as an announcement.

**Read and left alone: `/intention` answers in the group when it is set and
privately when it is read.** That looks like an inconsistency and is a decision
with its reasons written beside it — two of the replies are about the bot rather
than the player, and the third is about a sentence typed where everyone could
see it. A decision written down is a decision.

**The third door had no name on it (185th pass).** Played the mini app again,
further in this time: an intention, into the board, a report filed, three seats,
a second player asked their own question, a square pasted, a path brought back.

The path view shows a section per seat under *The paths at this table*, and its
footer carries three controls that read or write one player's journal. Two say
whose — *Save Player 1's copy*, and a paste dialog opening as *Player 3 · Paste
a square somebody sent you*, both named after an unnamed one wrote the wrong
file. **The third said only *Bring one back***, while merging a whole path — and
the question it was written under — into whichever seat happened to hold the
turn. Brought a file back while looking at the section headed *Player 1*; it
landed in Player 3's journal, under a confirmation naming a count and no seat.

The control says whose now, and so does the confirmation: before the act for a
square, after it for a file, because a file is chosen in the operating system's
own dialog where this app cannot put a title. And the seat is counted in one
place — the paste dialog spelled the arithmetic out and the import needed the
same number, which is how a table comes to disagree with itself about which
player it is talking about.

**Four things were checked and found right**, which is most of what playing
buys. Resizing the table mid-game keeps the seats that stay and the journals
they wrote (pass 96 holds). A second seat is asked its **own** question, with an
empty box rather than the first player's answer (pass 81 holds). The new Close
on the question is hidden for a player who has none — the pass before's fix,
under a real second seat. And the report gate holds the whole table until the
account is written, which is the game.

**Two false alarms, both mine, both caught before they became claims.** A
journal read back as empty because I guessed the storage key (`leela.journal.v1`
for `leela.reports.v1`). And an account that looked like it had landed in the
wrong player's path was the turn holder's own square, filed correctly — my test
data was labelled *what the second player noticed* and the second player had not
written it.

**A dialog with no way out (184th pass).** Found by *playing* the mini app in a
browser, which this repository has now used four times and which has found
something every time. With the language set to Russian on the running page, the
four Close buttons read back as *Закрыть*, *Close*, *Close*, *Close*:
`applyChrome` named `#reader form button`, and there are four of them. The plans
list, the paste dialog and the writer kept the English in the markup, in every
one of the twenty-two languages.

None of the four carries an `id` — a way out does not need one to be read by a
person — which is how they slipped past the check that holds every named control
to the catalogue. The check reads ids; the rule is *named from the catalogue*,
and a group can satisfy it, so it asks the markup rather than trusting a name.

**And the question's dialog had no way out at all**, alone among the five. That
is right the first time: the published app blocks the back gesture for a player
who has none, and the `cancel` handler here refuses it for the same reason. It
is wrong every time after — and this is a phone. No Escape key, Telegram's own
back button unwired, Save refusing fewer than two characters. A player who
tapped *Change it* and cleared the box had **nothing left to press**.

`mayLeaveTheQuestion` is where that decision lives rather than the handler,
which the app's own check insisted on within the minute: a control drawn shut is
the shape three defects here came from.

**Two instrument corrections, both caught before they became claims.** A
synthetic `KeyboardEvent` does not make a browser cancel a `<dialog>` — that is
a user-agent action — so the first Escape reading proved nothing. And a *real*
Escape through the browser tool did not close the reader either, which has no
cancel handler at all: the control experiment said the instrument was at fault,
not the app. The Escape question was dropped rather than reported.

**The audit could not see the drawer it was standing next to (183rd pass).**
`audit-unread` searches `scripts` for *readers* and scans only `.tsx?` for
*declarations* — so an export in `scripts/lib/*.mjs` had no way of ever being
reported. The waiver list already named a dozen of them (`declaredFields`,
`readsOf`, `auditBoard`, `extractBoards`…), every one written by hand for a name
the audit could not have found.

Proved by walking into it: two exports were added to `scripts/lib/source.mjs`
one pass ago and **nothing said a word**. Widened to scan `scripts/lib`, and the
first run reported three — the two new ones and `brokenSomewhere` in
`promises.mjs`, a one-line wrapper over `windowsBreaking` with no caller
anywhere, sitting there unnoticed.

This is the same blind spot for the third time: a package left out of a
hand-written list (`packages/journal/src`), a file extension nobody had thought
of (`.tsx`, the day a React screen arrived), and now a directory scanned for one
question and not the other. Each was found by something new walking into it,
which is a poor way to find them and the only one that has worked.

`statementAt` was mine, written a pass ago for a caller that never came: removed
rather than waived, which is what the audit's own sentence says to do.
`brokenSomewhere` removed. `callsTo` waived with the true reason — its consumers
are the checks that read source, and those are tests, which this audit does not
search.

**And `callsTo` had a live one waiting.** `reader.test.ts` matched
`resolveLanguage\(([^)]*)\)` over the screen and captured **`deviceLocale(`** —
the call truncated at the bracket inside it — then asserted that the truncation
did not begin with a quote. It passed, on a reading of half a call, which is the
fourth sighting of that mistake and the first that was still live. Both it and
the bot's roll check read their calls by counting brackets now, and the
truncation is written down as its own case so the next reader can see what the
pattern saw.

**Nine checks were one comment away from asserting nothing (182nd pass).** A
dozen tests here read source rather than behaviour — every control carries a
name, a decision is asked and not written twice, no sentence is spelled into a
generator — and they found most of the defects of the last twenty passes. They
are also where the mistakes have been: **four in one night, all of one shape.** A
pattern that reads the file as text without knowing what text is.

`commands\.roll\(([^;]*?)\)` stopped at the `)` in `now()` and read a
four-argument call as three. `[^)]*` did the same over `asking.trim()`. A check
found its writes in a comment-stripped copy and read their reasons out of the
original, at indices drifted apart by every comment between. And a sweep that
blanked `*` instead of the whole comment reported fifteen hard-coded English
sentences, every one a quotation inside a comment explaining a string that had
been removed. Twice the mistake accused code that was right; twice it would have
let a defect through.

`scripts/lib/source.mjs` holds the two operations they all need — `blank`, which
takes comments out **character for character** so an index into the result is an
index into the file, and `callsTo`, which reads a call by counting brackets. The
same reason `whose.mjs` and `drawings.mjs` are there: a rule the checks share is
a rule to write down once. Sixteen test files use it now; four had hand-rolled a
blanker and **ten had none at all**.

**Proven rather than argued.** With the real `startOver(game, startingSeed())`
replaced by a comment mentioning it, `starting-over.test.ts` **passes** without
blanking and **fails** with it. Nine checks were one comment away from asserting
about prose — and this repository writes more prose in its sources than most
write code.

The rule is about **asserting** over source, not reading it: `assembled` and
`partly-written` load `index.html` into happy-dom and *play* the app through it,
where blanking would alter the thing under test. Named in the check with the
reason, rather than left to a pattern to miss.

**And two sweeps found nothing, recorded so the next pass does not repeat them.**
Hard-coded English a reader could see, across all five surfaces: fifteen hits,
every one legitimate — operator startup lines in the bot's terminal, two font
names, and the model prompt, which is English by design and says so. And no
check currently passes on a comment: every literal they require appears in real
code as well.

**The book spoke no language but English (181st pass).** `apps/docs` generates
1,784 pages in twenty-two languages and said **no catalogue key at all** — the
only surface in this repository that spoke none. A Russian reader met Russian
plan text under *The rules*, *The 72 plans* and *Legal*, with *Contents* under
every page, *Play* in the corner, and a language picker announced to a screen
reader as *Language*. Found by asking what the mini app had just been caught by
one surface over: eleven of fifteen controls named there, none of them here.

Six of the seven keys did not exist. `app.rules` and `app.plans` did, said by
two other surfaces and by none of this one's pages.

**And one of the strings was mine, from the 170th pass.** The contents page's
`<meta name="description">` was English with the language's own name spliced
into it — *The game of self-knowledge in Русский* — so every search result and
every Telegram preview of a contents page was in English. It reads as
translated at a glance, which is why it survived a whole pass about that page's
head.

`app.book` is a **plural**: it carries a count, and Russian agrees with one.
Written flat it read *Игра самопознания — 72 планов*, the genitive plural for a
number ending in five; seventy-two takes the few form, and `Intl.PluralRules`
decides. Twenty of the twenty-two fall back to English, which is the
catalogue's stated position — a visible gap rather than an invisible guess. The
root page is the exception and the check says so: it is the picker, it belongs
to nobody's language.

**`LEGAL_TITLES[name] ?? name`** would have published a `legal/cookies.en.md`
with *cookies* as its heading, its `<title>` and its `og:title`, in all
twenty-two languages — the same shape as the two maps the pass before, found by
sweeping every `x[y] ?? z` in the repository. Twelve such sites, eleven of them
legitimate by design. The build stops now instead.

**`audit-reachable` refused my first fix within the minute.** `type LegalName =
'policy' | 'eula'` declares a vocabulary whose words nothing ever says — they
come from a directory listing — and *a vocabulary with an unreachable word reads
as though the question is answered here*. Derived from the map with `keyof
typeof` now, so the words are said as the keys of the one place that holds them.

**Read in the donor and deliberately not done.** `translate-leela/locales/*`
carries `policy-<lang>.md` and `eula-<lang>.md` for **nineteen** languages —
every one of ours except `ar`, `ms` and `uk` — real translations of the same
documents, several thousand characters each. So `loadLegal`'s comment, *only
English and Russian were ever written*, is **false**: they were written and
never brought across. They are not imported here, for two reasons that are the
user's to weigh rather than mine: a push to this branch publishes the book, and
publishing a legal document in seventeen new languages is a commitment somebody
has to make on purpose. `ja` and `zh` also open with the fullwidth `＃` (U+FF03)
that cost the third pass twenty-five plan titles, so an import has that to
normalise too.

**Two restated lists of the twenty-two, both behind a fallback (180th pass).**
`packages/ai` had never been opened by this loop. It holds `LANGUAGE_NAMES` —
English names, for the instruction *Answer in Russian* — as a
`Record<string, string>` behind `?? 'English'`. A twenty-third language added to
`@leela/content` would have been handed the traditional text in its own script
under an instruction to answer in **English**, and every test would have passed:
the two the suite had were `ru` and `ja`, written out by hand.

`packages/content` had the same map in the file that *defines* the languages:
`SCRIPTS: Record<string, Script>` behind `?? 'latin'`, read by `scriptOf` →
`couldBe` → `audit-dataset`, which is the check written **because** the English
book once shipped a Russian chapter. Beside it, `RANGES` has been
`Record<Script, RegExp>` since the day it was written. One map in the file was
total and the other was not.

Both are `Record<Language, …>` now, so the compiler names the missing language
at the moment the omission is made, and both fallbacks are gone: `resolveLanguage`
answers `Language` and nothing else, so a `??` there could only ever have
covered for the map being short.

**What the revert corrected in the telling.** Taking a language out of `SCRIPTS`
under the old code makes `audit-dataset` **fail**, not pass — a Cyrillic chapter
declared latin is exactly what it looks for. So the silent half is narrower than
it first appeared: a new language written in a latin-family script would have
been declared latin and been right by luck, and only a non-latin one was caught.
`packages/ai` had no such backstop: there the fallback is wrong for every new
language. The compiler now names both at the moment of the omission rather than
leaving one to an audit that catches half of it.

**And a test found something about `couldBe`.** Asserting it over plan *titles*
failed on Chinese: `出生 (janma)` is two Han characters against five Latin ones,
so a transliteration in brackets outweighs the name it transliterates.
`dominantScript` counts characters, `audit-dataset` reads two thousand of them,
and the answer is a fact about short strings rather than about the map. Written
down as its own case, so nobody reads a verdict on a file out of a title.

**Before that, two sweeps that found nothing**, recorded because a negative
result is worth the same as a positive one for deciding where to look next.
Every one of the 35 source-reading test files was scanned for a loop over a
derived list with no guard that the list is non-empty — four candidates, all
false: three assert the list is *empty*, which is the correct form, and the
fourth (`ADD CONSTRAINT` in the migrations) has seven real matches. And
`messageIssues`/`messageCoverage` were run over all twenty-two languages: no
plural form missing, both complete catalogues at 186 of 186.

**Two things nobody said (179th pass).** The method the last pass turned up was
run over the whole catalogue: of 185 keys, **two** are said by no surface, and
both were a capability nobody wired up.

**`app.players`, and three controls with it.** The mini app's markup speaks
English until `applyChrome` replaces it, and it replaced eleven of fifteen. The
three buttons along the top — the rules, the players, the list of all
seventy-two plans — and the Save in the dialog that asks the question kept the
English in the file, in every one of the twenty-two languages. For an **icon
button** that English is the only name it has: the button renders an emoji, and
`aria-label` and `title` are the whole of what a screen reader and a tooltip
have. A player reading the game in Russian heard *Players*. The die beside them
was named correctly and the reasoning was written down — *the die shows a face,
not a word* — and applied to one of the four.

**`intention.ask`, and the gate it was written for.** The published app blocks
the board without an intention, the mini app's `mayThrow` refuses, the phone was
given the same gate two passes ago — and the bot was the surface where a whole
game could be played without ever being asked what it was being played for.
*The one difference between surfaces this repository does not allow is what the
game asks of a player.* Not a `RuleSet` change: the gate lives in the surfaces
and not in `@leela/engine`, exactly as it did when the phone joined them.

`roll` takes an `Asked` or nothing, and those are **different facts**: nothing
means this caller does not deal in intentions — a deployment whose store cannot
hold one — and there is no gate, because refusing a throw for an answer there is
nowhere to keep would end the game over a fact about the deployment.
`{ intention: '' }` means asked and unanswered. An optional string would have
made those one. A default that quietly skips a gate is an absence reading
exactly like a pass, so `bot.ts` is held to passing it at both places the die is
turned.

**Six existing tests failed, and they were right to.** Each plays a game and
none of them answered the question — which is what the gate is. They answer it
now, in the same place a player would.

**The same regex mistake, a third time.** `commands.roll\(([^;]*?)\)` stops at
the `)` in `now()` and read a four-argument call as three, reporting a defect in
code that was right. Twice before it was `[^)]*` over `asking.trim()` and an
index into a comment-stripped copy. A balanced-parenthesis assumption in a check
that reads source has now been wrong every time it has been made.

And the check for the mini app was written twice: the first version asked
whether `messageFor` appeared within three hundred characters of an id and
called four untranslated controls translated, because an event listener happened
to sit beside a line translating something else. **Proximity is not a citation.**

**A record nobody could read (178th pass).** The phone could write a path, carry
it away and bring one back, and never once show it — what it printed was the
writing about the square being stood on, and nothing else. The bot has `/path`
and `/returns`, the mini app has a view with a section per seat, and *a record
nobody can read is a record the game is not producing* is this repository's own
sentence about the bot, from the pass that found reports going into SQLite and
never coming out.

The absence was named out loud one pass earlier and then **worked around**: the
sentence about a device refusing a write had to stop saying *save a copy from
“My path”*, because there was no such screen here. A sentence bent around a hole
is the shape of one.

`app.path`, `app.pathEmpty`, `app.pathCount` and `app.returns` were already in
the catalogue in English and Russian, said by the other two surfaces and by
neither of this one's — the second time in three passes that **an unspoken key
marked a missing capability**. That is worth keeping as a place to look.

**Counted the format's way**, and proving it took a case that had to be built.
`revisited` and `writingsOn` are `@leela/journal`'s, so a square that came back
is the same square on all three surfaces. But a hand-rolled counter was put back
into `pathOf` to prove these tests and **every one of them still passed**: a
count kept in a `Map` comes back in first-seen order, `revisited` returns
most-returned first, and on the path the tests walked those two agree by luck.
A path where the least-returned square was stood on first tells them apart.

And `writingsOn` here was a local `journal.entries.filter(…)` under a comment
promising an order it did not impose — true only because `record` and `takeIn`
keep the list ordered three functions away. A promise held up by an invariant is
a promise the next writer breaks.

**The check written one pass ago fired on the fix.** It forbade any sentence
naming *My path*, because the screen did not exist. It does now, so the rule was
made to say what it meant: naming a screen is wrong only when the screen is not
there, and whether it is there is a fact about the handles rather than about a
word.

**The audit turned round on us (177th pass).** The published app's findings were
read as *a list of things these surfaces must not grow*, and two of them had
already grown here.

**The check was on the write that cannot fail.** Saving the question ran `void
keepIntention(intentionKeeper, …)` — the device, whose answer was thrown away —
beside `if (!saveIntention(store, …))`, which writes to the session's own `Map`.
`setItem` on a `Map` does not throw, so that returns false only when there is no
store, which there always is. The branch that spoke was **dead code**, and the
one write that can really refuse was the one nobody asked. A player answered the
question the game is played to answer, the disk said no, they were told it was
held, and at the next launch they were asked again as though they never had.
`UserEdit` in the published app closes its screen the same way, and this
repository has now fixed this shape on five writes.

Four were unanswered, not one: the question, a path brought back, a question
adopted with it, and a square somebody sent. The import answers once for both
halves, because bringing a path back is one act. The board and the draft stay
silent deliberately and each carries its reason beside it.

**And the one sentence it did say was the browser's.** `app.reportUnkept` reads
*this browser will not keep it — save a copy from “My path” before you close the
tab*. The phone has no browser, no tab, and **no path view at all**. One of the
twenty-three sentences it says, and the only borrowed one — eighth sighting of a
sentence naming the wrong thing, and the shape never varies: the words were
already written, so nobody wrote new ones. `app.notKept` and
`app.intentionNotKept` are what the catalogue was missing.

The check resolves the keys the screen actually passes to `messageFor` and
refuses any that mention a browser, a tab, a window or *My path*, so the next
borrowing fails before anyone reads it.

**And the check had the bug it was looking for.** Its first version found the
writes in a comment-stripped copy and read their reasons out of the original, at
indices that had drifted apart by every comment in between — so it reported a
defect in code that already carried the explanation it was demanding. Comments
are blanked character-for-character now rather than removed, so an index into
one is an index into the other. Stripping them at all is not optional: this file
documents its own defects, and one of them quotes `void keepIntention(…)` as the
thing that was wrong, which a plain reader counts as a fifth write.

**The published app's accounts, audited rather than ported.** The unified
monorepo has **no accounts at all** — the phone, the mini app and the bot each
identify a player without one, and nothing here reads a password. The published
app's sign-up and sign-in were read anyway, because what they do is a list of
things these surfaces must not grow. Forty-one findings survived a separate
refutation pass and twelve did not:
[`docs/published-app-auth-audit.md`](docs/published-app-auth-audit.md).

Three of them destroy or expose something. `getProfile` swallows its own error
and returns `undefined`, `onSignIn` reads that as *no profile yet* and routes an
existing player into the username step, and `createProfile` writes with `.set()`
and no merge — so one failed profile read on launch puts a long-time player's
`plan` back to 68 and replaces their whole `history`. The SendPulse address-book
call is awaited **after** the Firebase account is created and **before**
navigation, with its token fetch outside its own try, so a marketing-list
failure strands somebody with an account they cannot reach and a message saying
their brand-new address is already taken. And every sign-up posts the player's
email to that address book with no opt-in.

Nothing was changed: that code is on `main`.

**Asked once, never shown, never changed (176th pass).** The phone asked what
the player is playing for, kept it, wrote it into every square they shared —
and never showed it to them again, and never let them change it.
`intention === ''` was the whole condition for the box being open, so the second
time was never. Over seventy-two squares, the question somebody starts with is
the one most likely to change.

Both other surfaces do both, and the published app does it twice over:
`screens/helper.ts` sends a player who has none to `CHANGE_INTENTION_SCREEN`
with `blockGoBack: true`, and `ProfileScreen/Tabs/IntentionOfGame.tsx` sends
anyone there at any time with `{ prevIntention: intention }` and no block. The
mini app shows it at the head of the path — above the writing it frames — with
a *Change it* beside it.

**And the box opens with theirs.** `defaultValues: { newIntention: prevIntention
|| '' }` in `ChangeIntention`. Revising eight hundred characters is editing, not
retyping, and that is the whole difference between a question somebody can
change and one they can only replace. The pre-fill is held to `isIntention` over
the bounds rather than an example, because a box pre-filled with what the save
will then refuse is a control that cannot be dismissed.

The rule is `askingFor(intention, changing)` rather than a condition in the
screen, since the screen is where the defect lived: a comparison written inline
has nowhere for a second reason to open a box to live. One shape asserted over
every combination — the control that reopens the question and the box that first
asks it are the same question read two ways, and a screen showing both would be
asking somebody to change an answer they have not given.

`app.intentionYours` and `app.intentionChange` have been in the catalogue in
English and Russian since the mini app needed them. This surface said neither,
which is what a missing capability looks like from the catalogue's side.

**A rule in the RuleSet that two of three surfaces never asked (175th pass).**
`minReportChars` has been in `RuleSet` since the published app was read for its
rules — `yup.string().trim().min(100)` in `CreatePost`, because a line typed to
open the gate is not a reflection — and `audit-variants` has held the flag to
that source on every run since. The engine has the function that asks it.

Three surfaces ask *is this enough writing to count* and **only the bot asked
the engine.** The mini app and the phone each wrote `text.trim().length === 0`,
which is `classic`'s answer spelled out by hand — twice each, once for the
control's disabled state and once for the act. Right for the variant being
played and wrong for two of the five the engine ships: drift in the only
direction that looks like nothing.

**Not a rules change, and that is the point.** `countsAsReport(text, CLASSIC)`
and `text.trim().length > 0` are the same sentence, so nothing either surface
does today changes. What changed is who is asked, so a game handed
`legacy-mobile` or `online` is played under those rules instead of under a
comparison written in a screen.

The refusal names itself now. *Nothing was written* and *not enough was* are two
different things to be told, and one boolean left a player who typed ninety
characters under `legacy-mobile` looking at a control that declines and says
nothing — the app ending somebody's turn without telling them, which this
repository has now met on every surface it has. `report.tooShort` is the bot's
own sentence reused rather than copied: it names no command and reads the same
anywhere, and a second key with the same words would have been the seventh
restated list here.

**And the engine's `isReport` became `countsAsReport`.** `@leela/journal`
exports an `isReport(value): value is Report` — a type guard on a stored entry —
and every surface imports that package. Two exports of one name with different
questions and different signatures is exactly how the phone came to write a
second `isReport` of its own that let `plan: 900` through. One of them had to
say what it was for.

Each of the five parts was proved by reverting it: four tests fail when the
phone's `record` decides for itself, three when the mini app's does, and one
each for the two refusals and the button's own comparison.

**The one thing the game asks for was the one thing it did not keep (174th
pass).** The path is on the device, the board is on the device, what the player
is playing for is on the device — and the account they are **in the middle of
writing** lived in a `useState` and nowhere else. An iPhone reclaiming a
backgrounded app took it, and the gate that will not open without it was still
shut when they came back.

The mini app lost the same words the same way and wrote down why in `state.ts`:
*a phone discards a backgrounded tab, and a notification arriving mid-sentence
took the sentence with it.* A phone discards an **app** far more readily than a
browser discards a tab. And the published app loses it too — read rather than
assumed: `CreatePost` holds the text in `react-hook-form` and clears it with
`methods.reset()`, under `yup.string().trim().min(100)`. At least a paragraph,
held nowhere.

Kept on **every keystroke**, deliberately. A timer or a debounce keeps the
sentence except for the words typed in the last second or two, which is exactly
the window an app is killed in: the moment before somebody switches away is the
moment they stop typing. Read back once and never allowed to land on top of
something typed since — the rule all four reads follow — and `draftFor` decides
whether it is shown at all, so a draft from a game that no longer exists comes
back and is never seen. The reader asks no second question about a restored
draft, because it is the same question it asks about a live one.

**And the revert caught the check instead of the fix.** The first version of the
test asked whether `DRAFT_KEY` and `loadKeptDraft` were *mentioned* in
`App.tsx`. Deleting both effects left them mentioned — the import stayed — so
**removing the fix outright left all twenty-four tests green**. A check that an
import exists is a check on an import. It asks for the calls with their
arguments now, and for the effect to be keyed on `[draft]`: keyed on the game it
would keep the sentence only when the board moves, which, while a report is
owed, it cannot.

That is the second time in three passes that proving a fix by reverting it found
something the fix itself had not. It is the cheapest step in this loop and the
only one that has never been wrong.

**A whole act in one expression (173rd pass).** `onPress={() => setGame(newGame(
startingSeed()))}` was the restart: it asked nothing, kept nothing straight and
said nothing. Three faults, and the third puts the wrong words into the record
this game exists to produce.

**It trusted the drawing.** The button is hidden unless `isOver` and the act
asked nothing itself — the shape three defects in the mini app came from, and
the reason `throwDie` re-asks `mayThrow` five lines from a control that is
already disabled. **It took the default ruleset**, so a game begun under any
other variant came back as `CLASSIC` — the report gate, the entering six and the
three sixes all decided by an argument nobody passed.

**And it left the winning square's account in the box.** `CLASSIC` asks for a
report on 68, and winning also ends the game, so *Start over* and the writing
box are on screen at the same moment, on the same square — asserted, because the
whole defect rests on it. Tapping the second with the box full carried the words
about Cosmic Consciousness into the next game, where they reappeared as the
opening of an account of whatever square the player first landed on. One tap of
Save filed them there.

Answered **structurally**, the way the mini app answered the same thing twice
(`draftKeyFor`, and `resize` clearing only the drafts of seats that are new): a
`Draft` says which square of *which game* it is about and is shown only there. A
rule kept by remembering to clear something is a rule the next handler is
written without. The plan alone is not enough — a player can win, write about
68, start over, play a second game and win that one too, and both end standing
on 68 — so the seed is in it, and `startOver` refuses to hand back the seed it
was given. The game that replaces one is then never the same game to a draft, to
the die, or to the saved board.

`said` survived the act too, so a restart taken straight after filing the
winner's account left *Written. You may throw.* over a board that had just been
emptied — the mini app's 97th-pass defect in a new place. `app.restarted` has
existed in English and Russian since the messages catalogue was written and this
surface had never said it.

**Half a rule, and the half it kept was the one it wrote yesterday (172nd
pass).** The mini app states it in one sentence in `chrome.ts` — *prose follows
the reader; geometry does not* — and sets `dir` on the whole document, so every
word it shows obeys the first clause. This app obeyed **only the second**. The
board was pinned last pass, and the reader's direction reached the three boxes
the player types into and not one word the game says.

So the 72 plans and the entire rules book, in Arabic and Urdu, were laid out
left to right: the teaching this app exists to deliver, ragged down the wrong
margin, with each sentence's full stop on the wrong side of it. Nothing was
missing and nothing was broken — it was the direction of the whole text, which
is the one thing about a page a reader sees before they read a word.

It was invisible until the pass before, because the language was always English.
`writingDirection` on the fields had been **dead code since it was written**.

And the comment left here one pass ago says *the reader's direction is the
text's, and the fields already carry it* — as though the fields were the text.
They are where the player answers; the plan is what they are answering. Seventh
sighting of a sentence naming the wrong thing, and the first of them mine.

A screen has no `dir` to set, so every `Text` answers for itself and
`reader.test.ts` requires an answer: `prose` for a paragraph, `label` for a
centred control (where `textAlign: 'right'` would push *Roll* off the middle of
its own button), `styles.geometry` for a number in the grid. **Named rather than
omitted**, because an omission and a decision look identical in a stylesheet —
`audit-drawings` made the same requirement of every disabled control after three
passes in which one was drawn shut and refused nothing.

Both halves are checked, since a rule with one is a rule that can be satisfied
wrongly: nothing may be undecided, and nothing whose words come from
`@leela/content` may answer `geometry`. The first version of the second half
also caught the plan's heading — `{square}. {plan.title}` contains a number and
then prose, and is prose; a cell is a text that is **nothing but** the number.

The three fields had it spelled out at each site, three times, which is how they
came to be the only text in the app that carried it: **a thing written at each
site is a thing the next site can be written without.** One name now, and
`fields.test.ts` asks for that name.

Still to bring across from `leela`: RevenueCat, notifee and Sentry. **notifee
was read this pass and is not a port.** Its two uses are a chat-reply
notification with an inline reply action (`replyNotification.ts`,
`actionHandlers/reply.ts` — needs the posts server) and a daily phrase fetched
from `leelachakra.com/resource/LeelaChakra/dailyPhrases.json`, an endpoint
outside this repository. Neither is the local reminder the `online` cooldown
would want. RevenueCat and Sentry need keys.

**The published app cannot be rebuilt from its own source, and the reason is not
Xcode.** It has **no JavaScript lockfile at all** — `Gemfile.lock` and
`Podfile.lock` are there, `yarn.lock` and `package-lock.json` are not — so its
dependencies are caret ranges resolved fresh at every install. Three years on
they resolve to versions its own tooling cannot read:
`react-native-gesture-handler` is declared `^2.9.0` and comes back as 2.32.0,
whose Android manifest carries no `package=` attribute, and React Native 0.70's
CLI reads Android manifests while autolinking for *iOS* — so `pod install` dies
before a single file is compiled. `@react-native/eslint-config@0.70.4` is
declared too and has never existed at that version, so neither `yarn` nor `npm`
can even resolve the tree without dropping it first.

Every one of those was found by trying, in a copy under `/tmp` so that nothing
in `leela-src` was touched. `LeelaAiWeb3` has a `yarn.lock` and `NeuroLeelaExpo`
has two; the one that shipped to a store has none.

**The store, and what is not in the repository.** `xyz.ghashtag.dharma` is live
as *Leela Chakra Ai* **6.10**, updated 2024-08-12
([listing](https://apps.apple.com/us/app/leela-chakra-ai/id1296604457)). The
newest source anywhere is **6.8**: `MARKETING_VERSION` on `main`, whose last
commit is 2024-01-29, and the other five branches are 2021–2022. `com.leelagame`
returns nothing from the store, so that identifier is Android's alone. **The
published build's source is not in the repository.**

`main` and `unified` are branches of one repository — the published app and this
monorepo are the same GitHub project.

**How far the published app gets, and where it stops.** Nine blockers were
cleared in the `/tmp` copy before a tenth was reached, and each was verified by
doing it rather than reasoned about:

1. `@react-native/eslint-config@0.70.4` has never existed — nothing installs
   until it is dropped.
2. No lockfile, so every native dependency resolves to a modern version.
3. `react-native-gesture-handler ^2.9.0` → 2.32.0, whose Android manifest has no
   `package=`; React Native 0.70's CLI reads Android manifests while autolinking
   for **iOS** and dies.
4. `react-native-pager-view`, `react-native-screens` and
   `react-native-system-navigation-bar` fail the same way.
5. `react-native-screens` ≥ 3.21 calls `install_modules_dependencies`, added in
   React Native 0.71.
6. `boost 1.76.0` fails its checksum: the URL in the podspec no longer serves
   the artifact the hash was taken from. `archives.boost.io` still does, byte for
   byte — the expected `f0397ba6…` — so the mirror is the fix and the original
   host is the fault.
7. Yoga's `operator"" _pt` is deprecated under the current clang, and the build
   promotes warnings to errors.
8. `@sentry/react-native ^3.4.2` uses `std::set_terminate`, which the current
   libc++ no longer declares in that header.
9. Pinned to 5.24.3 it fails differently: `std::vector<const T>`, which the
   standard library now rejects outright. There is a `without-sentry` branch in
   this repository, and this is why.
10. With Sentry removed, `PurchasesHybridCommon` — RevenueCat — stops on an
    ambiguous `SubscriptionPeriod`.

Four more followed, and then it ran.

11. `BoringSSL-GRPC` passes `-GCC_WARN_INHIBIT_ALL_WARNINGS` in its per-file
    compiler flags — a build setting written as a flag — which clang reads as
    `-G` and refuses. 344 occurrences in the generated Pods project.
12. `boost 1.76` uses `std::unary_function`, removed in C++17 and no longer
    provided by libc++. `-D_LIBCPP_ENABLE_CXX17_REMOVED_UNARY_BINARY_FUNCTION`
    brings it back.
13. `gRPC-Core` trips `-Wmissing-template-arg-list-after-template-kw`, a
    warning that did not exist when it was written.
14. `react-native-image-crop-picker` calls `customAspectRatio`, removed from
    `TOCropViewController` after 2.6; the caret had resolved it to 3.2.
15. `GoogleService-Info.plist` is not in the repository, and correctly so. A
    placeholder of the right *shape* — Firebase validates the key's length and
    first letter before using it — gets past the check without being anybody's
    credential.
16. `react-native-gifted-chat` resolved to a version importing
    `react-native-keyboard-controller`, which the app has never depended on.

**It builds, installs, launches and reaches its welcome screen** — the logo,
the policy links, *Version: 6.8 (1)*, and Sign In / Sign Up — under
`xyz.ghashtag.dharma` on an iPhone 16 Pro simulator. Signing in needs a real
Firebase configuration, which is a secret and was not touched, so that is where
this stops.

It sat on the splash for a while first, and the reason was not Firebase. Two
things, and one of them was this work's own:

17. **Self-inflicted.** Sentry was removed with a regular expression that
    replaced its call sites with a function returning `undefined` — including
    `Sentry.wrap(AppWithProviders)`, so the app's *root component* became
    `undefined` and `AppRegistry.runApplication` failed. A shim module that
    keeps the shape of every export it stands in for fixed it, which is what
    should have been written in the first place. A crude removal is a defect
    with a different name.
18. **The app's own.** `src/store/OfflinePlayers.ts` uses `storageAdapter` on
    line 52 and never imports it. Under the Metro of 2024 the module graph
    happened to carry it; under this one it is a `ReferenceError` that takes
    down the whole store, and with it the app. One line, and it is a real defect
    in the published source.

Every one of the sixteen is the same root cause seen from a different angle: an
application whose dependencies were never pinned cannot be rebuilt once the
world moves. It is repairable — every step above has a fix, and they are all
written down — but it is an upgrade project, not a build, and it should end with
a lockfile committed.

**What running it cost, recorded so nobody pays it twice.** Expo Go cannot be
fetched here — its CDN answers 403 — so the app is built natively. CocoaPods
fails on this machine with `Encoding::CompatibilityError` unless `LANG` names a
UTF-8 locale. And neither donor builds under Xcode 26.6: `NeuroLeelaExpo`
(RN 0.76.9) dies in `Pods/fmt/format-inl.h`, and the published `leela`
(RN 0.70.4, Firebase, `use_frameworks!`, `platform :ios, '12.4'`) has neither
`node_modules` nor `Pods` and would need an upgrade before it could be tried.

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
a key the gate still works and reports are still kept, there is simply no
reply.

**Either provider.** OpenRouter was ported first because the newest of the six
generations used it; the *published* app called OpenAI directly, posting to
`api.openai.com/v1/chat/completions` with `gpt-4-1106-preview`, and
`LeelaAiWeb3` did the same with `gpt-4-0314` — both reading the key out of a
client bundle. `openAI` is now a second provider over the same client, since
OpenRouter deliberately reimplements OpenAI's endpoint and the two differ only
in host, default model, two attribution headers, and the name of the reply
ceiling. That last one matters: OpenAI has deprecated `max_tokens` and rejects
it outright for reasoning models, so each provider sends the name its own API
prefers rather than one guess for both.

The tests are written against the contract and run once per provider, so a new
one has a suite waiting for it and cannot arrive with a subtly different idea
of what a `LanguageModel` is. DeepSeek was the first to use that: a base URL
and a default model, no new client. It keeps `max_tokens` — the deprecation
that made `openAI` send `max_completion_tokens` is OpenAI's, not the format's.

`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`: the first one set
wins, in that order, and the startup line names the provider and model chosen.

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

`apps/site` is not built, and this pass opened the donor to check that
judgement rather than repeat it. `leela-chakra-nextjs` is an unmodified
`create-next-app`: `page.tsx` is the starter template down to the Vercel logo
and "Get started by editing src/app/page.tsx", `useLeelaGame.ts` is forty-six
lines of which every functional one is commented out, and both locale files —
`public/locales/en/common.json`, `de/common.json` — are empty. There is nothing
in it to port. The docs root is the landing page.

**Forty pages that claimed to be in a language they were not (170th pass).**
`/ar/legal/policy.html` served the English privacy policy under `<html lang="ar"
dir="rtl">`: English laid out right to left, and read aloud by a screen reader
reaching for Arabic phonemes. Only English and Russian legal documents were ever
written and the other twenty languages are served the English — which is right,
a missing privacy policy is a store rejection and a Telegram listing blocker.
Serving it is not the defect. Filing it as Arabic is.

`build.ts` already knew: it computes `byLanguage.has(language)` to decide
whether a language counts as translated, and then threw the answer away. So a
page now declares the language of its *words* and is still filed, linked and
reachable under the section's — and its `canonical` names the English original
that twenty URLs are copies of, which is the whole job of that tag.

The comment in `build.ts` had said this out loud about the rules chapters:
*writing English into `/de/rules/notes.html` is a published page in the wrong
language*. It was true one directory over the whole time. `audit-dataset` could
not have caught it — legal documents are not in `packages/content/data`.

**The book knew its own translations and told only the reader.** The `<head>` of
all 1,784 pages held four tags: charset, viewport, title, stylesheet. No
description, no canonical and — in a book that exists twenty-two times over — no
`hreflang` at all. `pathFor` is the function that answers *where does this page
live in language X*; the footer picker was built from it and nothing upstairs
was given it.

Both are built from it now, and told different things on purpose. `pathFor`
returns `null` where a language does not carry the page and `''` for the
contents — two facts that used to be the same value, because from the picker
they render the same link. The picker sends a reader looking for a chapter their
language lacks to that language's contents rather than to a 404, which is help.
The head declares nothing there, because the German contents is not a
translation of the Arabic `online` chapter, and saying so to a crawler is false.
Telling the two apart is what made the head derivable at all.

Descriptions come from `summarise`, which strips markdown and drops headings —
a heading is a label on the text and the page shows it as the `<h1>` already, so
kept, the privacy policy's preview opened *Privacy Policy This is the privacy
policy for…* and spent a quarter of itself repeating the title. The test asserts
the shape rather than the presence: no two plans may share a description, since
one repeated across pages describes none of them and any constant satisfies
"has a description". It cuts at a word where there is one and hard-cuts where
there is not — Chinese, Japanese and Thai write without word boundaries, and
walking back to find one returns the empty string.

And the title said the site's name twice. The suffix was appended
unconditionally, so the contents page — whose title *is* `Leela` — read `Leela —
Leela`, in all twenty-two languages.

**Two hundred and sixteen pages with nowhere to rest the eye (169th pass).**
Every reader here splits a plan on blank lines — the book, the mini app's
`paragraphs()`, the bot's pager. Three languages had no blank line anywhere, so
all 72 plans in each rendered as one unbroken block: Arabic, Malay and
Ukrainian.

The translations are fine. `leela/src/locales/<lang>` separates paragraphs with
a single newline and the markdown donors use a blank line; the generator passed
both through, and only one is what anything splits on. Measured before it was
believed, because getting it wrong shatters sentences: Malay plan 30 is four
lines of 583, 356, 1165 and 188 characters — paragraphs, not the ~80-character
lines a soft wrap makes.

The rule reads the text, not the filename: a body with no blank line and at
least one newline has its break there; a body that already has blank lines is
left alone, including one that mixes the two. Keyed on the donor's name it would
be a fact about a path, and the next source in this shape would ship the same
way with nothing to notice. In the generator, never in `packages/content/data`.

Nothing could have caught it: every check in `audit-dataset` asked whether a
plan has *text*, and a wall of text is text. It asks about *paragraphs* now.

**The companion was told a player stands where somebody sent them (168th
pass).** The mini app hands a square over through Telegram; the bot files it and
asks the companion about it. The player is **not** on that square — they may be
on plan 6, or waiting to enter at all — and `systemPrompt` said *The player is
on plan N* for every path alike. The sixth time a sentence has named the wrong
thing here because it was the one already written, and the first inside what a
model is told.

`PlanContext.arrival` carries it. A received square says it was handed over and
that the player is not standing there, and stops describing an arrival that
never happened: a snake brought nobody to a square they have never been on, and
68 is an ending only for whoever reached it.

Two things fell out, both worth more than the fix. **`contextOf` copies
`AskOptions` field by field** — a restated list, and it bit immediately:
`arrival` was declared on both types and left out of the copy, so the fix would
have been dead code. The test now reads the options back out of the prompt the
model is handed, because a field that reaches the context and is never rendered
is the same silence one field on. And **removing `arrival: 'received'` left all
532 of the bot's other tests green** — the fact travels in the transport, the
same hole that let `/plan 2 2` live. There is a `handleUpdate` case now, driving
the hand-over as Telegram delivers it, since `/take` in a chat files the same
square and never calls the companion.

`audit-reachable` caught the change within the hour: branching on
`!== 'received'` left `standing` declared and never said.

**Three fields that told the keyboard nothing about themselves (167th
pass).** Every `TextInput` in the phone declared `multiline` and a placeholder
and nothing else, so iOS guessed — the same way for a paragraph of reflection
and for a pasted machine-readable square.

The paste field is **not prose**: autocapitalisation changes the first letter of
a pasted account and autocorrect rewrites the transliterated Sanskrit the format
is mostly made of. Both writing fields had **no bound**, so a player could type
past `MAX_REPORT_CHARS` and lose the tail on save with nothing said — the defect
the mini app met and fixed, waiting here. Arabic and Urdu were **left-aligned**;
`directionOf` has been in `@leela/content` since the docs needed it. And the
placeholder was the platform's grey, a colour never measured, on two fields
where it is the only instruction there is.

Fixed outside this repository and not committed: the published app's *Possible
Unhandled Promise Rejection* on its first screen. `RevenueCatProvider` calls
`init()` bare, so a key absent from a `.env` that is correctly not in the
repository surfaced as a red warning over the sign-in screen. Absent is not an
error. That source is on `main`, so the fix lives only in the scratch build.

Recorded rather than changed: English typed into the simulator arrives as
Cyrillic because the **machine's** input source is RussianWin, letter for letter
— `hello@example.com` becomes `руддщ»учфьздуюсщь`. Ctrl+Space switches; changing
a system-wide preference unattended is not this loop's to make.

**Sixteen commands and no way to find any of them (166th pass).** Telegram
shows a menu behind the `/` button, built from `setMyCommands`, and this bot
registered nothing — so a player had to already know `/help` existed in order to
be told about the other fifteen, and `/help` was not discoverable either.

`BOT_COMMANDS` is the one list and `index.ts` the only place that hands it over.
Registered in both languages whose catalogue is complete, and English scopeless
as well: Telegram falls back to the unscoped list for a client whose language
nothing was registered for, and without that the menu is empty for twenty of the
twenty-two. Not all twenty-two, because `messageFor` falls back to English and a
menu registered *as Russian* holding English sentences is worse than none — a
test asserts the two say different things word by word, since agreement would
mean the fallback happened silently.

A menu is a **fourth** place to write the same names down, and six restated
lists have gone wrong here already. So the help text and the menu are both held
to `bot.command('x')`, in both directions: removing `/returns` from the menu
fails, and adding a `/ghost` no handler answers fails too — the second costing a
player more, because they tried it. Telegram refuses a description over 256
characters and refuses the *whole call*, so one sentence that grows in
translation would take the menu down; `menuFor` clamps and a test holds it.

**A debug build is not the published application (165th pass).** Installing
`apps/mobile` on a simulator replaced the published app twice in one day — two
apps with one identifier are one app to iOS, the install simply succeeds, and on
a phone it would have taken somebody's game with it. `app.json` still holds the
identity that ships, deliberately: this app is meant to succeed the published
one. What changed is that a *debug* build is no longer that application.

`app.config.ts` appends `.dev` to both identifiers and `(dev)` to the name when
`APP_VARIANT=development`, which every script that builds for a simulator sets —
and a test holds them to setting it, because one that forgets installs over the
published app silently. A release sets nothing and gets `app.json`, which is the
safe way round. Proved by doing it: the simulator held two identifiers before
and three after, with `xyz.ghashtag.dharma` still there.

`--clean` renamed the project to `LeelaChakradev.xcodeproj`, which the Detox
config survived because it finds the scheme by extension rather than by name.

**Tried and reverted:** a second Metro port. `RCT_METRO_PORT` does not reach a
Debug build's runtime lookup, so the app still asked 8081 and got another
project's bundle — which arrives as *unable to resolve module ./index* and reads
exactly like this app being broken. Two debug React Native apps still cannot be
served at once.

**Two things the table could read that were nobody's business (164th pass).**
`/save` called `ctx.replyWithDocument`, which always answers the chat the
command came from — so at a table of six a player's whole journal went out as a
file for everyone to keep, while `/path` next door had routed through
`destinationFor` since it was written. And `/intention` with no argument, which
is a request to be *told* something, read a privately-set intention out to the
room. Both go through the one decision now; the three replies that are about the
bot or about a sentence just typed in public stay in the chat deliberately.

**`/plan 2 2` was refused by the command that printed it.** `plan.continues`
says *…continues. /plan {plan} {next}* and `Number("2 2")` is `NaN`, so a reader
who typed back exactly what they were told got *the board runs from 1 to 72*.
175 plan texts across 22 languages had a second page nothing could reach.
Reverting the fix left **521 unit tests green** — the parsing lives in the
transport and nothing went through `handleUpdate`. The new case does, and it
types the marker's own text back rather than hard-coding `2 2`.

**And `/plan` with no argument answered a new player with square 68** — the
eighth sighting of the ambiguity, second on this surface. `standingSquare` is
exported because the transport was answering the same question separately, which
is how `describeStandings` came to carry the defect on its own.

**Detox walks the app, and found two things on its first honest run (163rd
pass).** Fourteen flows, all passing on an iPhone 16 Pro simulator. The app had
eleven controls and not one identifier, so `src/handles.ts` names them once and
both the screen and the walk read from it — a suite reaching for `roll` while
the screen says `roll-button` fails with *not found*, which is
indistinguishable from the control being gone.

**The keyboard covered the button that keeps what was just typed.** Detox
refused to tap Save because it was not visible — `view bounds: {{16, 702.7},
{370, 45}}` on an 874-point screen, under a keyboard about 300 points tall.
`KeyboardContainer` in the published app is the same answer to the same problem.

**And the question the game is played to answer was kept in memory.**
`loadIntention` and `saveIntention` were right and were handed the wrong store:
`forTheSession()` is a `Map` made fresh at every launch, so a player was asked
what they were playing for every single time — with a year of their answers to
it on the device underneath, because the journal went to AsyncStorage and the
question did not. No unit test could see it; the walk found it by relaunching.

Three things the walk got wrong before the app did: `toHaveToggleValue` is for a
switch and answered *not a UISwitch* against `accessibilityState`; Detox
replaces the global `expect`, so `expect(17).toBeGreaterThan(0)` fails with *17
is not a Detox matcher*; and the restart button is gated on `isOver(game)` — the
walk called its absence mid-game a defect when it is the rule.

**The die is not seeded, deliberately.** Making the six certain means a launch
argument only a test passes, and a code path nobody who plays the game takes is
a code path nobody maintains. The walk taps until the board says it is on it,
bounded at forty throws — about one run in two thousand — and fails saying so.
It cannot run in CI, where every job is `ubuntu-latest`, so it is a command a
person runs and `apps/mobile/README.md` says so.

**The phone kept a year of writing and lost the board (162nd pass).**
`apps/mobile` restored the journal and the intention at startup and made a
*fresh* game with a random seed. Somebody who had climbed to plan 41 came back
to the waiting square needing a six to begin, with their own accounts intact
underneath, about squares they were no longer on. This repository has met that
shape five times from the other side — a report written, stored and never read
back; this is the first time it was the board.

`game.ts` already promised otherwise: *the die is `(seed, rollsTaken)`, so a
game replays exactly from two numbers a player can carry away.* Both were
computed and thrown away. `src/game-store.ts` keeps them and the session beside
them — whether an account is still owed is a fact about the player, not about
the numbers that got them there. The half that is easy to get wrong is turning
the die `rollsTaken` times on the way back: without it the next throw is the
game's *first* throw again, so a player sees their opening roll on every
relaunch. `deviceKeeper` takes a key now; it had `REPORTS_KEY` inside its two
methods, and two things kept in one slot overwrite each other silently.

**And `Podfile.lock` is now read as the lockfile, not just described as one.**
`scripts/lib/podlock.mjs` + `scripts/audit-podlock.mjs` recover the versions a
React Native app was actually built with. The pod name is not the package name
and the mapping is not guessable — `@react-native-async-storage/async-storage`
ships `RNCAsyncStorage` — so it is read from each package's own podspec filename
rather than from a list. Run against the rebuilt app it caught a package pinned
wrongly by hand: `react-native-spinkit` at 1.4.1 where the lock records 1.0.2.
It says out loud when the lock has never heard of a podspec, and claims no pin
for a package the lock never saw — a pure-JavaScript dependency has no
recoverable version, and inventing one would be the check writing a lockfile of
its own.

**The published app rebuilt in three steps instead of eighteen (161st pass).**
The `/tmp` copy did not survive a restart, and the app was gone from the
simulator for a second reason: `apps/mobile` carries the same bundle
identifier, `xyz.ghashtag.dharma`, so installing the port **replaced** the
published app. On a real phone that would take a player's game with it.

Rebuilding it found a much shorter road. **`Podfile.lock` is the JavaScript
lockfile this app never had.** Fourteen packages had drifted — every one a caret
that npm resolved forward — and the Pods lockfile records exactly what each was
when the shipped build was made:

    react-native-gesture-handler   2.32.0 installed, 2.14.0 locked
    react-native-screens           3.37.0 installed, 3.27.0 locked
    @react-native-async-storage    1.24.0 installed, 1.19.8 locked
    … eleven more

Reading the pod name out of each package's own `.podspec` and pinning the npm
version to what the lock remembers turns blockers 3, 4, 5, 14 and 16 into one
edit, and `pod install` then succeeds where it had refused on changed
constraints. What remained: the boost mirror (6), the four compiler blockers
(7, 11, 12, 13) as one settings change on the generated Pods project, the
RevenueCat `SubscriptionPeriod` ambiguity (10) qualified by module, Sentry
shimmed (8, 9), and `storageAdapter`'s missing import (18) — still one line, and
still the app's own defect.

Two things cost a cycle each and are worth writing down. **The Firebase
placeholder must be exactly 39 characters**: `FIRInstallations validateAPIKey`
checks the length before anything uses it, and a 41-character stand-in aborts
the process at launch. And **a shim must keep the shape of every export, not the
ones somebody remembered** — the same lesson as blocker 17, learned again:
`Navigation.tsx` ends `export default Sentry.withProfiler(App)`, at module
scope, so one absent export is `undefined(App)` and `AppRegistry.runApplication`
has nothing to run.

It reaches the welcome screen — *Version: 6.8 (1)*, Sign In / Sign Up. Signing
in still needs a real Firebase configuration, which is a secret and was not
touched.

**apps/mobile runs, and three things came out of running it (159th-160th
passes).** The Expo app had never been built natively. It builds and launches on
an iPhone 17 simulator, 0 errors and 0 warnings, and the first screen showed
three defects that reading the source had not.

**It installed under the Android identifier.** `app.json` states
`xyz.ghashtag.dharma` for iOS and `com.leelagame` for Android, and
`tests/identity.test.ts` asserts both and asserts they differ — a test that
exists because this file once said *keep the applicationId and the bundle id* as
though they were one string. The test was green and the app on the simulator
answered to `com.leelagame`: `ios/` is generated by `expo prebuild`, and prebuild
does not rewrite the identifier of a native project that already exists. The
same shape as `lib/corrections.mjs` — a check that reads the source cannot see a
defect in the artifact. `expo prebuild --clean` is the repair and the only one;
the test now reads the native project too, and finds it by extension rather than
by name, since `--clean` renames it from `expo.name`.

**The winning square's teaching was handed to a player who had not begun.**
Somebody who has never thrown a six stands on `loka` 68, and this app read that
number straight into `planFor` — so it opened with *68. Cosmic Consciousness
(Vaikuntha Loka)* and the whole text of the square the game is played to reach,
under a line correctly saying *throw a six to enter*. `squareToRead` asks the
engine's `isWaitingToEnter`, which is also why it cannot simply refuse 68: a
winner stands there legitimately. Seventh sighting of the 68 ambiguity, first on
this surface, and `tests/sixty-eight.test.ts` is the table that stops the eighth.

**The intention's Save button was an empty grey strip** — the one control a new
player must press. `styles.button` carried `flex: 1`, right for the row of three
at the bottom and wrong in a column, where it gave the button a flex-basis of
zero and clipped the label out. And the label was white on `#cdc6ba`: **1.70:1**.
Measured while there, the live button was **4.35:1** and the square the piece
stands on the same pair at 12 points. `src/palette.ts` names every colour and
`contrast.test.ts` measures all eight pairs, refuses a hex the palette does not
name, and asserts the two that were wrong would still fail.

**And Metro warned on every launch.** *Require cycle: content/src/index.ts ->
messages.ts -> index.ts.* `messages.ts` imported two **values** from `index.ts`
while `index.ts` re-exports `messages.ts`, so which finished evaluating first
depended on which the bundler reached first — `resolveLanguage` inside
`messageFor` was one import-order change from silently answering English to
everybody. The four language primitives are a leaf now, `src/language.ts`.

**Nineteen translations of an English nobody compared them to (158th pass).**
`lib/numbers.mjs` said *Ukrainian, Malay and Arabic follow the English text, the
rest follow the Russian*, and the second half was false — it was also the
justification for how nineteen languages are judged.
`translate-leela/index.js` reads `./docs` and writes `./locales/<lang>`, and
`docs` is **English**. So the machine translations are translations of an
English edition, and of a *different* English from the one this dataset ships:
`NeuroLeelaAgent/docs/plans/1-birth.md` is 2,240 bytes where
`translate-leela/docs/1-birth.md` is 1,977, and the two say different things.
The same defect as the pass before, one donor family over.

It changes **nothing** about the board references, and that was measured rather
than assumed: both comparisons report nothing for all seventeen shipped
languages of that family. The edition is kept anyway, because *nothing found*
and *nothing looked for* print the same sentence, and the next number to go
missing should be seen by a check that is right rather than one that agrees by
luck. `editionOf` now answers for every shipped language, and a test holds it
to that — a language is either an original or names an edition, since the
default when it names none is the shipped English.

**And they are not LibreTranslate's**, though this repository never wrote that
down. `libre.js` in that donor is fifteen lines, calls
`translate('Привет, мир!', 'ru', 'en')` as an example, and **nothing imports
it**. The translator is Google Cloud Translate, in `index.js`. The 19 languages
are `bn de es fr hi ja jv ko mr pa pt ta te tr ur vi zh` plus `en` and `ru`,
which are outputs too and are beaten in the merge by the hand-authored English
and the Russian GitBook.

**Judged against the wrong English (157th pass).** Twenty-one of the
twenty-three recorded lost board references were never lost. The audit's third
false alarm — *not every language was translated from the same edition* — was
known, acted on, and closed against the wrong English: everything was compared
to the one English this dataset ships. Arabic, Malay and Ukrainian come from
`leela/src/locales/<lang>`, whose sibling is `leela/src/locales/en`, an older
and shorter edition the generator reads, loses to the hand-authored markdown,
and throws away. It says *the snake of tamoguna* where the shipped English says
*the tamoguna square (field 72)*, and *see the lokas prana, apana and vyana*
where the shipped one numbers all three.

That edition is kept under `packages/content/data/editions/` now — the donor
repositories are not in CI, and asking which edition a translation followed is
the only way to tell a lost number from a number that was never there. As text
rather than as the numbers it states, so the reading of it stays in
`lib/numbers.mjs` with every other reading. Which edition a language followed is
read off its own plans, since every plan carries the file it came from.

**Two remain**, both read in the file they come from: `leela-en` states *There
are 72,000 nerves in the body, called nadis* and the Arabic keeps `nadi` without
the number; it states *(see square 11)* on plan 23 and the Ukrainian has no 11
anywhere. The count went 42 → 36 → 31 → 23 → 2, and **not one of those numbers
came off because anything was repaired** — each time the check had been asking
the wrong question. That is the argument for writing down what a check believes.

An empty edition would turn the whole thing green: `lossesIn` skips a plan the
edition lacks, so every number in it is excused, and a silent excuse reads
exactly like a language with nothing wrong. The audit fails when an edition does
not cover a plan the translation has.

**The sum with no sign in it — the third layer, and the gap between two
checks.** `audit-numbers` handed the multiplication tables to `audit-arithmetic`
and wrote that it holds them *to a stricter rule than presence*. Presence was
exactly what neither asked: one excuses a table term, the other examines the
sums that are there. Arabic and Malay carry 15 equations where every other
language carries 21, Ukrainian 17, and nothing had ever said so — the audit
counted *plans* into a variable called `equations` and printed neither.

The rows are not missing. Plan 8's run ends in a sentence rather than in the
list — *when an 8 is multiplied by a 9 it becomes a 9 (8x9=72), and in the next
cycle it returns to its original state, 8x10=80=8* — and the machine
translation ate the multiplication sign there. Malay says `8 9 = 72` and
`8 80 = 80 = 8`; Arabic `8 9 9 = 72` and `81 10 = 80 = 8`. Every reader in
`lib/arithmetic.mjs` finds a sum **by** its sign, so a sum without one is not a
sum to any of them and is not a missing sum either: it reads as prose with
numbers in it, and the check was blind in the one place the damage was.

The shape is a run of two or more numbers separated by nothing but space on the
left of an `=` — a left side is one number or an expression, never two numbers
side by side — and across 22 languages and 1,584 plans it matches four times,
all four of them this.

**A record that outlives its reason (159th pass).** The three operator-less
sums are recorded so the audit does not fail on them, and nothing ever asked
whether a record still matched anything. Repair one and the excuse stays: the
next sum that reads the same way passes on a licence issued for something else.
This repository had already written the principle down one section above, about
editions — *nothing found* and *nothing looked for* print the same sentence — and
then granted three permanent exemptions without it.

The list lives in `lib/arithmetic.mjs` now as `OPERATORLESS_RECORDED`, read by
both the audit and the test, because a record written in two places is a record
that will disagree with itself. `staleRecords` answers the new question, and it
is deliberately not *the found set equals the recorded set*: an unrecorded
defect is work for a translator and a stale record is work for whoever keeps the
list, and one comparison answering both sends somebody to fix the wrong thing.

The test that enumerated the three lines is gone. It asserted the cases, not the
shape, and it was the second copy of the list — the day one was repaired, the
two would have disagreed and the failure would have been a string comparison
saying nothing about why. What is asserted now is that no record is stale and no
defect is unrecorded, which is true of a list of three and of a list of none.

Proven by breaking, in both directions: repairing `ms/8` fails the audit with
*these records no longer match anything* and fails the test that grants no
excuse; adding an unrecorded `7 7 = 49` to Ukrainian fails the other one. Before
this pass the first of those two was silent.

**A rule was tried and thrown away**, and it matters which one. Comparing the
rows a translation carries against the rows both editions carry reports `ar/8`
and `ms/8` as having *lost* `8x9` and `8x10`; they have not, and a check that
names the wrong defect asks somebody to write what is already written. It also
could not be trusted on plan 9, where uk/ms/ar carry `9x23` — a row **neither**
edition has — because those three follow the published app's own English, a
third edition whose table genuinely is shorter.

One of the four is repaired: Malay's `8 9 = 72` has both operands and the
product, and no other operation on 8 and 9 gives 72, so the sign is what
arithmetic says it is. The three that remain each need a number restored or a
digit removed — a reading of what the machine did rather than a calculation —
and they are recorded with that reasoning rather than quietly fixed.

`lib/arithmetic.mjs` had **no tests at all** while checking 466 sums in 22
languages, and its header described four false alarms nothing held it to.
Fifteen tests do now.

**Translation audit, second layer — and this one found something.** See the
eighty-ninth pass below: 23 plans across three languages have lost the board
references the text states. It read 42 across eight until the hundred and
thirty-eighth pass, 36 until the one after, and 31 until the hundred and
fifty-fifth: six of the forty-two were references written as words, five more
records were multiplication tables rather than references at all, three were a
numbered list, and eight were the same sentences spelled out in words in
languages nobody had read. The first audit is still true at the layer it
checked.

**Each record now says which kind of loss it is, and the audit prompts the
reading rather than waiting for it.** Whether a plan still *names* the square it
has stopped numbering is the difference between a numeral to put back and a
sentence to write — and it can be asked of the translation itself, because every
locale keeps the parenthesised transliteration in its own titles. So `(prana-loka)`
on plan 38 is that edition saying which square `prana` is, in its own script, and
nothing has to be trusted from the English. Five hand-read lines became a
derivation over all of them; it agrees with four of the five and the fifth was
wrong.

The eight spelled-out records were found by the audit pointing at itself: a
number *some* translator wrote as a word is a number to check the others for.
`uk/68` had been excused eleven passes earlier, and the identical sentence sat
in the recorded damage in Malay and Arabic the whole time, because reading is
done one file at a time and nothing pointed from one to the next.

**The one repair that needed no translator did not survive a rebuild.**
`9х280=7,380` is false in the plan whose whole argument is that nine keeps its
identity under multiplication, and it was corrected in
`packages/content/data/plans.*.json` — which are *generated* files — and nowhere
else. The next `node scripts/build-content.mjs` put the false sum back, and the
only reason anybody saw it was that a rebuild happened to run in the same pass
as `audit-arithmetic`. A repair that lives in an artifact is a repair with a
countdown on it, and how long it has is a matter of who rebuilds and when.

It lives in `scripts/lib/corrections.mjs` now, applied by the generator and
checked by `audit-dataset` against the shipped data. A correction that stops
matching fails the build rather than doing nothing quietly: the donor was fixed
upstream, or the sentence moved, and those are indistinguishable from silence.
The bar for adding one is that the source is *checkably* wrong — arithmetic, not
judgement — so that correcting it overrules no translator. Everything else the
audits find is recorded and left alone for exactly that reason.

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

**Two divergences, described rather than fixed.** *(The forty-first pass
asked four chains: the address holds no code on any of them, and Mumbai — the
only network this was ever configured for — was shut down in April 2024. So
"permanent because deployed" was wrong; see `packages/contracts/README.md`.)*
The entering six is counted as
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
