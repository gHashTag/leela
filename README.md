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
| `classic` | yes | yes | yes | — | the traditional rule — no app shipped it whole |

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

## Развитие

```bash
bun install
bun run verify     # rebuild content, then run every package's tests
```

Per package:

```bash
cd packages/engine && bun test
```

## Status

| Package | Tests | State |
|---|---|---|
| `@leela/engine` | 334 | rules, four variants, sessions, turn gating, seeded dice |
| `@leela/content` | 267 | 22 languages of plans, 2 of the game's own voice |
| `@leela/journal` | 54 | the path as a file, and what came back — shared by the bot and the mini app |
| `@leela/db` | 101 | schema, mapping, SQL migrations, legacy import |
| `@leela/ai` | 165 | the companion — prompts built from the plan text |
| `@leela/contracts` | 43 | `LeelaGame.sol`, board verified against the engine — [readme](packages/contracts/README.md) |
| `@leela/bot` | 510 | group play in Telegram, durable on SQLite — [readme](apps/bot/README.md) |
| `@leela/docs` | 115 | the book, live at [t27.ai/leela/docs](https://t27.ai/leela/docs/) — [readme](apps/docs/README.md) |
| `@leela/miniapp` | 377 | the board as a mini app, live at [t27.ai/leela](https://t27.ai/leela/) — [readme](apps/miniapp/README.md) |
| `@leela/mobile` | 73 | the board on a phone (Expo), moved by the engine and by nothing else |
| everything else | — | not yet ported |

2039 tests, run on every push by [CI](.github/workflows/ci.yml), which also
builds the bot's image and starts it, and reports fields that are written and
never read, and exports with no caller:

```bash
node scripts/audit-unread.mjs       # fields nobody reads, exports and class members nobody calls
node scripts/audit-configs.mjs
node scripts/audit-claims.mjs       # the table above, against the suites
node scripts/audit-scripts.mjs      # every script runs under the runtime it names
node scripts/audit-arithmetic.mjs   # the sums the text states, in all 22 languages,
                                    # and sums a translation dropped the operator out of
node scripts/audit-doubles.mjs      # one bound, declared once
node scripts/audit-reachable.mjs    # every word a type declares, against the code that says it
node scripts/audit-offers.mjs       # what the game offers, on every surface that is the game
node scripts/audit-promises.mjs     # every injected dependency, against a test that breaks it
                                    # and asserts what anyone is told
bun  scripts/audit-dataset.mjs      # the data, against the languages declared
                                    # and against the corrections the generator states
bun  scripts/audit-variants.mjs     # what legacy-mobile and online claim, against the app
node scripts/audit-deployment.mjs   # asks four chains where the contract is
```

Two of them take a runtime other than `node`, and that is checked rather than
remembered: `audit-copies.mjs` spent some time documented here as a `node`
command that died in the module loader. A check nobody can run reads exactly
like a check that passes, so `audit-scripts.mjs` holds each script's shebang,
these commands and the CI jobs to each other — and every audit either runs in
CI or says in its own header why it cannot.

The table is checked rather than trusted. It was kept by hand for forty passes,
and a hand-kept number is one that will eventually be wrong — which is what the
two passes before this one were both about.

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
