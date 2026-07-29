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
  site/       Next.js landing page.                                 (to port)
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

It also exports `auditBoard` and `compareToReference`, so any implementation
that carries its own copy of the board can be held to this one. That is not
hypothetical: of the thirteen copies across the 25 repositories, **six disagree**
— see [MIGRATION.md](MIGRATION.md).

```bash
node scripts/audit-copies.mjs --src ../leela-src
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

Regenerate after changing a source repository:

```bash
node scripts/build-content.mjs --src ../leela-src
```

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
| `@leela/engine` | 123 | rules, four variants, sessions, turn gating, seeded dice |
| `@leela/content` | 109 | 22 languages, quality guards |
| `@leela/db` | 66 | schema, mapping, SQL migrations, legacy import |
| `@leela/ai` | 50 | the companion — prompts built from the plan text |
| `@leela/contracts` | 20 | `LeelaGame.sol`, board verified against the engine — [readme](packages/contracts/README.md) |
| `@leela/bot` | 137 | group play in Telegram, durable on SQLite — [readme](apps/bot/README.md) |
| `@leela/docs` | 89 | the book, live at [t27.ai/leela/docs](https://t27.ai/leela/docs/) — [readme](apps/docs/README.md) |
| `@leela/miniapp` | 11 | the board as a mini app, live at [t27.ai/leela](https://t27.ai/leela/) — [readme](apps/miniapp/README.md) |
| everything else | — | not yet ported |

605 tests, run on every push by [CI](.github/workflows/ci.yml).

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
rules, and preserves the Firebase uid in `legacy_id`. `migrateBatch` converts
everything it can and reports every failure at once rather than aborting on the
first bad row.

See [MIGRATION.md](MIGRATION.md) for what remains and in what order.
