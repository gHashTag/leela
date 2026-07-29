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
  ai/         the Leela voice: prompts and model routing.          (to port)
  ui/         shared design system.                                 (to port)
  contracts/  LeelaGame.sol and the subgraph.                       (to port)
apps/
  mobile/     Expo Router: iOS, Android and web from one codebase.  (to port)
  site/       Next.js landing page.                                 (to port)
  docs/       Docusaurus: the book of rules.                        (to port)
  bot/        Telegram, on grammY.                                  (to port)
services/
  inngest/    event-driven move and report handlers.                (to port)
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
bot, an Inngest function and a smart contract, and it makes them testable
without a network.

## Rule variants

The two shipped generations disagree about what a six means, and each
implemented one half of the traditional rule:

| Variant | Extra throw on a six | Three sixes reset | Report before rolling | Cooldown | Shipped in |
|---|---|---|---|---|---|
| `legacy-mobile` | yes | no | no | — | `com.leelagame` v6.5.1, Play versionCode 77 |
| `neuroleela` | no | yes | no | — | NeuroLeela (Expo/Inngest) |
| `online` | yes | no | yes | 24h | the published app's online mode |
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
| `@leela/engine` | 99 | rules, four variants, sessions, turn gating, seeded dice |
| `@leela/content` | 101 | 22 languages complete |
| `@leela/db` | 20 | schema and mapping done; migrations pending |
| everything else | — | not yet ported |

220 tests, run on every push by [CI](.github/workflows/ci.yml).

See [MIGRATION.md](MIGRATION.md) for what remains and in what order.
