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
