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

Still missing: a `RoomQueries` implementation against a real driver. The
interface and the store are done and tested against a fake, but choosing and
wiring a database is a deployment decision, so the bot still starts in memory
and says so.

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

**5. `packages/contracts`.** Take `smart-contract-leela` and the newest
subgraph (`leela-ai-4`) only. Archive the three older subgraph iterations.

**6. Archive the source repositories.** Twenty of the twenty-five have been
superseded. Archiving on GitHub is reversible and keeps every commit, which
matters for `leela` (211 commits) and `NeuroLeelaExpo` (114) — `NeuroLeelaAgent`
is a squashed import and does not carry that history.

## Repository sizes

`leela` is 400 MB, `LeelaAiWeb3` and `LeelaChakraAiMobile` 62 MB each. Assets
should go to git-lfs in the monorepo. History is not worth rewriting: the
archived repositories preserve it.
