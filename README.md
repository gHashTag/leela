# Leela

The ancient game of self-knowledge — 72 plans, ten snakes, ten arrows, and a
die that only a six can start.

This repository unifies the work that had spread across 25 repositories. The
game logic lives in one place, the texts live in one place, and every surface —
mobile, web, bot, contract — reads from those two.

## Layout

```
packages/
  engine/     the rules, as pure functions. No I/O, no framework, no platform.
  content/    72 plans and the rules chapters, in 22 languages.
  db/         persisted shape of a game, and the row <-> state mapping.
  ai/         the companion, resting on the canonical text.         ok
  ui/         not built — see MIGRATION.md
  contracts/  LeelaGame.sol, checked against the engine.            ok
apps/
  mobile/     Expo Router: iOS, Android and web from one codebase.  (to port)
  site/       not built - the donor was an untouched create-next-app
  docs/       the book: 72 plans and the rules, 22 languages.       ok
  bot/        Telegram, on grammY. Group play in a chat.            ok
  miniapp/    Telegram mini app: the board, the die, the texts.      ok
services/
  inngest/    not built — its copy of the rules was a different game
scripts/
  build-content.mjs   regenerates packages/content/data from the source repos.
```

## Why an engine package

Across six generations of this game the rules were rewritten every time the
client was rewritten, because they had never been separated from the code that
talked to Firebase, Supabase or Apollo. Two versions ended up playing
**different games** — see [MIGRATION.md](MIGRATION.md).

`@leela/engine` is the fix. It exports one function:

```ts
import { applyRoll, initialState } from '@leela/engine';

const { state, event } = applyRoll(initialState(), 6);
// state.loka === 6, event.isGameStart === true
```

No database, no clock, no randomness inside. Give it a state and a die value,
get back the next state. That makes the same rules usable from the app, the
bot, the mini app and a smart contract, and it makes them testable without a
network.

It also exports `auditBoard`, `compareToReference` and `detectRules`, so any
implementation carrying its own copy can be held to this one. `detectRules`
looks for a rule being *played*, not mentioned: counting to three is not the
three-sixes rule until the third six sends the player somewhere. That is not
hypothetical: of the eighteen copies across the 25 repositories **six have the
wrong board**, and the rules divide into **five different games** — see
[MIGRATION.md](MIGRATION.md).

```bash
bun scripts/audit-copies.mjs --src ../leela-src
```

## Rule variants

The two shipped generations disagree about what a six means, and each
implemented one half of the traditional rule:

| Variant | Extra throw on a six | Three sixes reset | Report before rolling | Cooldown | Shipped in |
|---|---|---|---|---|---|
| `legacy-mobile` | yes | no | no | — | `com.leelagame` v6.5.1, Play versionCode 77 |
| `neuroleela` | no | yes | no | — | NeuroLeela (Expo/Inngest) |
| `online` | yes | no | yes | 24h | the published app's online mode |
| `onchain` | no | yes | yes | — | `LeelaGame.sol`, deployed and unchangeable |
| `telegram` | no | yes | yes | — | the shipped Telegram bot (`leela-chakra-bot`) |
| `classic` | yes | yes | yes | — | the traditional rule — no app shipped it whole |

`telegram` is the sixth variant and the one this table published last. It ships
in the Telegram bot, which states the report gate per player and with a length
on it — `report.length < 50` — and that gate is the reason the variant exists.
Its flags are measured at the donor with line numbers in
`packages/engine/src/rulesets.ts`, with one exception stated there: *three sixes
reset* is **indirect**. The bot computes no move at all — it hands the roll to a
Supabase edge function whose source is in no clone — so the flag records that
the variant *has* the rule, taken from the bot storing `consecutive_sixes` and
`position_before_three_sixes`, and says nothing finer about which throw fires it
or which square it returns to.

`neuroleela` is the default, so adopting the engine changes nothing for current
players. Each game records its variant in `players.ruleset`, so history stays
reproducible when a surface migrates.

## Sessions

Leela is traditionally played in a facilitated group, and the published app
seated six players around one device. The rewrite dropped that. No competing
app offers group play across devices either, so the engine models it directly:

```ts
import { advance, createSession, submitReport } from '@leela/engine';

let session = createSession('table-1', [{ id: 'a' }, { id: 'b' }], CLASSIC);
session = advance(session, 6, Date.now()).session;  // a enters on plan 6
session = submitReport(session, 'a');               // a reflects, then may roll
```

Turn order, the report gate, the cooldown between rolls and skipping players
who have already finished all live in `session.ts` as pure functions.

## The die

`rollDie()` uses the platform RNG. `seededRoller(seed)` is deterministic — same
seed, same sequence, every platform — which is what makes a game replayable
from its seed alone and lets a server and a client agree on a roll without
trusting each other. `noRepeatRoller()` reproduces the published app's habit of
re-rolling a repeated value; it is there for fidelity, not for new work.

`rollerFor(rules, base)` picks the die a variant is played with. Use it rather
than choosing a roller by hand: `rerollOnRepeat` spent five passes declared on
every variant and read by nothing, so `legacy-mobile` and `online` claimed to
reproduce the published app and rolled a fair die instead.

## Content

22 languages, 72 plans each, all with full text, merged from four sources:

| Source | Language(s) | Format |
|---|---|---|
| `dharmaapp/leelabook` | ru | markdown, numbered via `SUMMARY.md` |
| `NeuroLeelaAgent/docs/plans` | en | markdown, `<n>-<slug>.md` |
| `translate-leela/locales` | 19 | markdown, `<n>-<slug>-<lang>.md` |
| `leela/src/locales` | 10 | JSON, `plan_<n>: {title, content}` |

```ts
import { planFor, resolveLanguage } from '@leela/content';

planFor('ru-RU', 1).title;  // "Рождение (джанма)"
resolveLanguage('zh-Hans'); // "zh"
```

The plans are one half of what the game says; the sentences around them are the
other. Those live in the same package, because `room.language` used to reach
`planFor` and nothing else — a Russian table read Russian plans and English
instructions.

```ts
import { messageFor, messageCoverage } from '@leela/content';

messageFor('ru', 'roll.next', { name: 'Аня' }); // "Следующий ход — Аня."
messageFor('ru', 'path.heading', { count: 5 }); // "Ваш путь — 5 планов."
messageFor('ja', 'roll.again');                 // English: no catalogue yet
messageCoverage();                              // what each language covers

directionOf('ur');           // "rtl" — the page, and only the page
asLeftToRight(board);        // the grid, held out of the reader's paragraph
```

English and Russian are complete; the other twenty languages get the plans in
their own language and the scaffolding in English. That is a gap the bot prints
on startup rather than one you find out about from a player — and it is
deliberately not filled by machine translation, which is what put 744 rotted
titles in this repository in the first place.

Fourteen of those plans still carry the title the machine handed back untouched:
a Japanese player on plan 12 stands on *Envy (irasya)* among Japanese
neighbours, on plan 62 on *Happiness (スカ)*, and Chinese, Korean, Bengali and
Tamil players on plan 40 read *Vyana-loka*. A title is two parts — the name and
the Sanskrit term beside it, which every language keeps — and it is the name
that has to be in the language: `Happiness (スカ)` holds katakana and is still
an English word where the name of the square goes. The
donors did it — `translate-leela` and `leelaWeb3` hold byte-identical copies —
so `audit-dataset` records them rather than repairing them, under the bar
`scripts/lib/corrections.mjs` states: a correction has to be checkably wrong,
and what a title should say in Tamil is a judgement. The audit fails on a
fifteenth, and equally on a record that has stopped describing anything.

It reads thirteen languages that way and says so: the nine written in the Latin
script cannot be checked like this at all, because an English title left in
German has every letter a German title has.

Regenerate after changing a source repository:

```bash
node scripts/build-content.mjs --src ../leela-src
```

## How the work is done

Spec-driven, through [spec-kit](https://github.com/github/spec-kit):

```
/speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement
```

Specs live in `specs/<nnn>-<slug>/`, on `unified` — this repository does not
branch per feature. The principles the work is held to are in
[`.specify/memory/constitution.md`](.specify/memory/constitution.md), and
[`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) are the working
instructions. `MIGRATION.md` is the record of how each principle was learned.

### Why every workspace runs `vitest --testTimeout=30000 --hookTimeout=60000`

Because the defaults are 5 and 10 seconds, and **`bun run test` runs twelve
workspaces at once**, each with its own worker pool. Measured over three days in
August 2026, three different suites went red at a clean checkout with nothing
changed:

| what failed | contended | alone |
|---|---|---|
| `packages/content/tests/undo.test.ts`, a test | 5104 ms | 480 ms |
| `apps/docs/tests/render.test.ts`, a hook | over 10 s | 2.56 s for the file |
| `apps/miniapp/tests/the-same-seat-asked-three-times.test.ts`, a test | 6461 ms | 250 ms for the file |

Every one of them is **starvation, not slowness**: fast work waiting on busy
cores. The first two were fixed where they stood, which left every other suite
holding the same bet — hence a setting rather than a third patch.

**One number in that table was nearly wrong, and the correction is the useful
part.** The third row first measured 6127 ms alone, and that reading is what
justified writing this section in the first place: *a test that slow was never
going to be reliable*. Re-run three times it took 250 ms for the whole file. The
first "alone" run had been started while the workers of a failed full run were
still winding down, so it was not alone at all. **A measurement taken to explain
a load problem is itself subject to the load**, which is easy to write into a
document and hard to notice afterwards.

Raising a deadline cannot make a passing test fail; it can only stop a false
red. Thirty seconds is still far beyond anything measured here, so a genuine
hang is still caught. **A default deadline is one nobody chose**, and a suite
that goes red for reasons a reader cannot act on is a suite people learn to
re-run instead of read.

## Развитие

```bash
bun install
bun run verify     # rebuild content, typecheck twice, run the audits, then every package's tests
bun run audit      # only the audits, without the suites after them
```

`verify` ran no audit at all until this pass — it was `content:build`,
`typecheck`, `typecheck:strict`, `test` — so the command this file tells a
person to run said green while the push said red, and the difference was never
about the code. `audit` is now a step of it, before `test`, because a stale
number or a check nobody can run is cheaper to hear about than a test failure
is to read.

It costs about a minute, most of it `audit-claims.mjs`, which runs all ten
suites to learn the counts and so runs them a second time inside `verify`. That
is the price of the number in the table being measured rather than remembered.

Per package:

```bash
cd packages/engine && bun test
```

## Status

| Package | Tests | State |
|---|---|---|
| `@leela/engine` | 553 | rules, four variants, sessions, turn gating, seeded dice |
| `@leela/content` | 705 | 22 languages of plans, 2 of the game's own voice |
| `@leela/journal` | 90 | the path as a file, and what came back — shared by the bot and the mini app |
| `@leela/db` | 116 | schema, mapping, SQL migrations, legacy import |
| `@leela/storage` | 38 | addressing files in an S3-compatible bucket, after Firebase Storage |
| `@leela/ai` | 237 | the companion — prompts built from the plan text |
| `@leela/contracts` | 95 | `LeelaGame.sol`, board verified against the engine — [readme](packages/contracts/README.md) |
| `@leela/bot` | 964 | group play in Telegram, durable on SQLite — [readme](apps/bot/README.md) |
| `@leela/docs` | 239 | the book, live at [t27.ai/leela/docs](https://t27.ai/leela/docs/) — [readme](apps/docs/README.md) |
| `@leela/miniapp` | 654 | the board as a mini app, live at [t27.ai/leela](https://t27.ai/leela/) — [readme](apps/miniapp/README.md) |
| `@leela/mobile` | 408 | the board on a phone (Expo), moved by the engine and by nothing else |
| `@leela/webgl` | 586 | the board in three dimensions, in a browser, on the same rules the apps play |
| everything else | — | not yet ported |

4685 tests, run on every push by [CI](.github/workflows/ci.yml), which also
builds the bot's image and starts it, and reports fields that are written and
never read, and exports with no caller:

```bash
node scripts/audit-unread.mjs       # fields nobody reads, exports and class members nobody calls
                                    # — and it fails on them now, both halves
# scripts/lib/source.mjs           # blank a comment, read a call: shared by every check that reads source
node scripts/audit-configs.mjs
node scripts/audit-claims.mjs       # the table above, against the suites
node scripts/audit-scripts.mjs      # every script runs under the runtime it names, and a
                                    # stopped mutation run is not still in the tree
node scripts/audit-arithmetic.mjs   # the sums the text states, in all 22 languages,
                                    # and sums a translation dropped the operator out of
node scripts/audit-numbers.mjs      # board references a translation lost — and records
                                    # that have stopped describing anything
node scripts/audit-records.mjs      # every recorded exception is asked whether it still
                                    # describes anything, including this rule's own list;
                                    # a record, a standing permission or a vocabulary, and
                                    # a fourth kind spelled by hand fails
node scripts/audit-doubles.mjs      # one bound, declared once
node scripts/audit-podlock.mjs      # Podfile.lock as the JS lockfile an app never had
                                    # (needs a donor with node_modules and ios/)
node scripts/audit-reachable.mjs    # every word a type declares, against the code that says it
node scripts/audit-offers.mjs       # what the game offers, on every surface that is the game
node scripts/audit-promises.mjs     # every injected dependency, against a test that breaks it
                                    # and asserts what anyone is told
bun  scripts/audit-dataset.mjs      # the data, against the languages declared
                                    # and against the corrections the generator states
bun  scripts/audit-variants.mjs     # what legacy-mobile and online claim, against the app
node scripts/audit-deployment.mjs   # asks four chains where the contract is
node scripts/audit-preview.mjs      # both pages ready to be shared, and agreeing on every
                                    # file and address they name
```

The picture a shared link shows is drawn, not hand-made:

```bash
node scripts/make-card.mjs          # redraws og.png and icon.png from the game's own art
node scripts/make-card.mjs --check  # writes nothing; exits 1 if the committed pair is stale
```

It needs ImageMagick, which this repository does not depend on and CI does not
have — which is why both files are committed. The script is how they are
derived, and `--check` is what keeps that claim true: it redraws into a
temporary directory and compares byte for byte, so repainting
`board-dark.webp` and forgetting the card is a thing somebody is told about.
That comparison only works because the output is deterministic, and it was not
at first: ImageMagick stamps a `tIME` chunk into every PNG, so the first
`--check` called a file it had written one second earlier stale.

Two of them take a runtime other than `node`, and that is checked rather than
remembered: `audit-copies.mjs` spent some time documented here as a `node`
command that died in the module loader. A check nobody can run reads exactly
like a check that passes, so `audit-scripts.mjs` holds each script's shebang,
these commands and the CI jobs to each other — and every audit either runs in
CI or says in its own header why it cannot.

That list above is prose, and prose is the thing that goes stale. `bun run
audit` does not read it: it lists `scripts/audit-*.mjs` on disk, subtracts the
table in `package.json` under `auditsThisGateCannotRun`, and starts each
survivor under the runtime its own shebang names. An audit added to the
directory is run by the next person who types `bun run verify`, whether or not
anybody remembered to add it here — and if it needs something a laptop has not
got, the gate stays red until somebody writes down what.

Five are excused there today, each with the reason attached: `audit-copies`,
`audit-variants` and `audit-podlock` read the donor clones at `../leela-src`,
which a clone of this repository does not carry; `audit-deployment` asks four
public chains where the contract is and exits 2 when one of them does not
answer; `audit-mutants` edits shipped source on purpose and takes minutes,
which is a tool rather than a gate. An excuse with no reason, an excuse for a
file nobody has, and a table that covers every audit on disk are all failing
states rather than quiet ones — the last because a gate that runs nothing
reads exactly like a gate that passes.

Recovering from a stopped mutation run is `node scripts/audit-mutants.mjs
--restore`, and it is written here because it was written nowhere: no markdown
file in this repository named that script with a runtime at all. It restores
the file and stops. A plain re-run also restores, and then goes on to make new
decisions for several minutes, which is not what somebody staring at ten red
tests in a package they never touched wants next.

The table is checked rather than trusted. It was kept by hand for forty passes,
and a hand-kept number is one that will eventually be wrong — which is what the
two passes before this one were both about. When it disagrees with the suites,
`node scripts/audit-claims.mjs --write` puts what it measured into the table.

**RETRACTED, 2026-08-06.** For part of that day this table published
`@leela/content` 716 as 661 and the total as 3499, on the stated ground that
this suite parameterises over the donor clones at `../leela-src`, runs fewer
cases without them, and that CI is the machine without them — so `--write` was
not to be trusted on a machine that has them. Every clause of that was assumed
and none of it was measured, and the donor clones are not the cause: `git
archive HEAD | tar -x` into a directory whose parent has never held `leela-src`
runs the same 29 files and the same 705 cases that commit's working tree ran.

**And that retraction closed wrong in turn** — three wrong explanations of one
gap, so both are kept. It closed by calling 661 impossible, a figure it said
nothing had ever run — and CI ran it twice in one go: run 31072659705, commit
d0ad661, `Tests 661 passed (661)` in the `test` job's vitest output and
`@leela/content … 661` from its `audit-claims` step, in the same log. (The old
sentence is paraphrased, not quoted: a false claim about a number is what
somebody greps for, and a verbatim copy would put every such search on the
paragraph that corrects it.) The real cause was measured on this
machine and needed no Linux runner. `packages/content/tests/undo.test.ts` built
a grid of truncated notes, one case per byte of `JSON.stringify({ path,
original })`, with `path` inside `mkdtempSync(join(tmpdir(), …))` — 134 bytes
under macOS's `/var/folders/…/T`, 90 under Linux's `/tmp`, 44 cases of
difference, which is the whole gap. Per-file counts put all 44 in that one file
and nowhere else. So CI, the machine that gates the merge, was running a third
fewer truncation offsets than the author saw. The grid is built from a literal
path now and asserts its own width, and the package runs the same count under
any `TMPDIR`. The `git archive` measurement looked decisive because it moved
the repository and left `tmpdir()` alone.

Both retractions are kept here rather than swapped out silently, because a
wrong number published by the check whose whole purpose is unpublished numbers
is worth more as a warning than as an absence. What holds the shape now, rather
than the figure, is `packages/content/tests/a-count-a-stranger-cannot-run.test.ts`
and the width assertion in `packages/content/tests/undo.test.ts`.

The board art and the rules are two descriptions of the same thing. To compare
them in one look — a ring where each jump starts, a dot where it lands:

```bash
node scripts/board-overlay.mjs board-overlay.svg
```

What ships is typechecked a second time with `noUncheckedIndexedAccess`, which
is what an index into an array or a record actually means. Tests are out of
scope on purpose: `rows[0]` there is a value the test built two lines earlier.

```bash
bun run typecheck:strict
```

## Migrating a live database

```bash
psql "$DATABASE_URL" -f packages/db/migrations/0000_initial.sql   # fresh
psql "$DATABASE_URL" -f packages/db/migrations/0001_adopt_existing_installs.sql  # existing
psql "$DATABASE_URL" -f packages/db/migrations/0002_session_language.sql
```

All three are safe to re-run. `0001` adopts a database the Expo app already
created: it only adds columns, defaults existing players to `neuroleela` — the
rules they were already playing — and adds the board constraint `NOT VALID` so
a bad row cannot block a live migration.

Bringing players off the published app is `playerFromLegacy` in
`packages/db/src/legacy.ts`: it reads the Firebase document shape, recovers
`previous_plan` from the move history, keeps the account on `legacy-mobile`
rules, and preserves the Firebase uid in `legacy_id`.

`migrateBatch` is **re-runnable**. Pass the uids already in `players.legacy_id`
and they are skipped rather than returned again:

```ts
const report = migrateBatch(users, { idFor, alreadyMigrated: existingUids });
console.log(describeMigration(report)); // "2 to migrate, 1 already migrated, 1 failed"
```

It reports in three categories, and a skip is not a failure — an operator
reading "3 failed" would go looking for a problem that is not there. A live
migration is never one attempt, and without this a second pass returns rows
that already exist, which `players_legacy_id_key` rejects, taking down the
transaction and the accounts that had not come across yet.

See [MIGRATION.md](MIGRATION.md) for what remains and in what order.
