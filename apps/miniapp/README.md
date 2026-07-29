# @leela/miniapp

Leela as a Telegram mini app: the board players know, the die, and the
canonical text for every square they land on.

## Running it

```bash
cd apps/miniapp && bun run dev
```

Opens on `http://localhost:5173`. It runs in a plain browser too — the
Telegram-specific parts (theme colours, haptics) degrade to sensible defaults,
which is what makes it developable without a phone.

## Where it is published

**https://t27.ai/leela/**

Deployed by [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml)
on every push to `unified` that touches the app, the engine or the content. The
tests for what is being shipped run before the build, because a broken deploy
reaches whoever is mid-game.

Two things had to be arranged once, and are worth knowing if it ever moves:

- Pages is set to `build_type: workflow`, and **HTTPS is enforced** — Telegram
  will not open a Web App over plain HTTP.
- The `github-pages` environment only admits the default branch by default, so
  `unified` had to be added to its deployment branch policy. Until it was, the
  build passed and the deploy was rejected with no obvious reason.

## Attaching it to the bot

In [@BotFather](https://t.me/BotFather): `/mybots` → the bot → **Bot
Settings** → **Menu Button** → set the URL to `https://t27.ai/leela/`.

That button is set in BotFather and **cannot be changed through the API** —
`setChatMenuButton` returns `ok: true` and leaves the value alone. Worth
knowing, because it looks like a bug for as long as you believe the API.

## How it is put together

`@leela/engine` decides everything about the game; nothing here reimplements a
rule. `BOARD_ROWS` gives the arrangement — eight rows of nine, 1 bottom-left,
72 top-left — so the grid matches the physical board and the bot's rendering of
it.

State lives in `localStorage`, validated on read: a hand-edited or stale value
must not put a player on a square that does not exist.

`describe.ts` turns a move into a sentence, and is separate from `main.ts`
purely so it can be tested. That is where a bug lived: a player still waiting
to enter was told there was "not enough room", which describes a rule they are
not under yet.

## The bundle

`@leela/content` carries all 22 languages. Importing it whole produced a
**6.5 MB** bundle — 1.6 MB gzipped — to show one language on a phone.

`content.ts` loads exactly one dataset through `import.meta.glob`, so Vite emits
one chunk per language and fetches only what is asked for:

| | before | after |
|---|---|---|
| first load | 6543 kB | **368 kB** (11 kB app + 3 kB CSS + one language) |

The language comes from the Telegram user's `language_code`, falling back to
the browser's, then to English.

## What is missing

- The mini app plays solo. Group play lives in the bot, and the two do not
  share a game yet — joining them needs `initData` verified server-side, which
  needs somewhere to run.
- Reports are not written here. The gate that makes them matter is a rule of
  the `classic` variant the bot uses; this app plays without the gate.
