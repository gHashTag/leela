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

| Variant | Extra throw on a six | Three sixes reset | Shipped in |
|---|---|---|---|
| `legacy-mobile` | yes | no | `com.leelagame` v6.5.1, Play versionCode 77 |
| `neuroleela` | no | yes | NeuroLeela (Expo/Inngest) |
| `classic` | yes | yes | the traditional rule — neither app shipped it |

`neuroleela` is the default, so adopting the engine changes nothing for current
players. Each game records its variant in `players.ruleset`, so history stays
reproducible when a surface migrates.

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
| `@leela/engine` | 52 | done — 100% branch coverage |
| `@leela/content` | 101 | done — 22 languages complete |
| `@leela/db` | 12 | schema and mapping done; migrations pending |
| everything else | — | not yet ported |

See [MIGRATION.md](MIGRATION.md) for what remains and in what order.
