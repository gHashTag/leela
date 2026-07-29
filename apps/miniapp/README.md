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

## Checking a deployment

`actions/deploy-pages` reports success when the upload succeeded, which is not
the same as the game being playable. A build that emits a broken asset path, or
a book whose pages never reached the artifact, deploys green.

```bash
bun run src/smoke-run.ts https://t27.ai/leela/
```

Five checks, each failing for a different reason: the app's HTML, the book's
index, a page deep inside it, the stylesheet it needs, and the privacy policy —
the one whose absence is a store rejection rather than a broken page. Every
check asserts something beyond a 200, because a 200 proves a file exists, not
that it is the file we meant to ship.

CI runs this after every deploy. The checks are pure functions over a fetcher,
so the same code is tested against a fake site with no network.

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

## Keyboard and screen readers

The board shipped as 72 `<div role="button" tabindex="0">` with a click
handler. Every square was reachable by Tab and announced as a button, and
neither Enter nor Space did anything — confirmed against the live site before
it was fixed. Focusable and inoperable is worse than not focusable at all: it
promises something and withholds it.

They are `<button>` elements now. A native element brings its keyboard
behaviour with it and cannot drift away from it, which is the whole argument
against the `role` version. Each carries an `aria-label` with the plan's name,
because the visible text is a bare number, and the snake and arrow glyphs are
`aria-hidden` — the direction is already in the label, and an unlabelled glyph
reads as punctuation.

`createCell` is split out of `main.ts` so this is tested rather than asserted
in a README.

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
