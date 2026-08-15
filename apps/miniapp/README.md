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
bun run scripts/smoke-run.ts https://t27.ai/leela/
```

Five checks, each failing for a different reason: the app's HTML, the book's
index, a page deep inside it, the stylesheet it needs, and the privacy policy —
the one whose absence is a store rejection rather than a broken page. Every
check asserts something beyond a 200, because a 200 proves a file exists, not
that it is the file we meant to ship.

CI runs this after every deploy. The checks are pure functions over a fetcher,
so the same code is tested against a fake site with no network.

## Attaching it to the bot

**The bridge back to the bot is not set up here.** It is a reply-keyboard
button, `reply_markup` on a message, and the bot sends it itself — see
[apps/bot/README.md](../bot/README.md). Nothing an operator does in BotFather
can attach it, and this section used to say otherwise.

What BotFather's Menu Button *is*: a second way in. In
[@BotFather](https://t.me/BotFather): `/mybots` → the bot → **Bot Settings** →
**Menu Button** → set the URL to `https://t27.ai/leela/`, and the app is one tap
from the message box in every chat with the bot.

It opens the board and **cannot answer with anything**. `sendData` works only
for a Web App launched from a reply-keyboard button, so a square handed over
from a Menu Button launch goes nowhere: no `message:web_app_data` arrives, the
bot files nothing and the companion is never asked. Worth having anyway — most
of this app is reading, not handing over — but it is a shortcut, not the bridge,
and setting it does not make the bridge exist.

Known and not fixed here: the page cannot tell which launch it got. `initData`
is non-empty for both, so "Ask the companion" is drawn under a Menu Button
launch too, where pressing it does nothing. `src/main.ts` says as much about
itself at the `TelegramWebApp` declaration.

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

## Colour

The snake, arrow and win colours were picked by eye and measured 3.0–4.5:1
against the surface they are drawn on — below the 4.5:1 small text needs, in
both themes at once, which is what one palette for two backgrounds produces.

There are two palettes now, and `contrast.ts` measures them. Dark is selected
two ways because neither alone suffices: a media query for a plain browser, and
`data-theme` set from Telegram's own `colorScheme`, which is authoritative
inside the app and can differ from the system setting.

## The bundle

`@leela/content` carries all 22 languages and the rules book for all of them.
Importing it whole means a phone downloads twenty-two to read one.

`content.ts` loads exactly one dataset through `import.meta.glob`, so Vite emits
one chunk per language and fetches only what is asked for. The rules book is a
chunk of its own, fetched when a reader opens it and not before.

Measured from `bun run build`, raw and transferred (gzip):

| | raw | gzip |
|---|---|---|
| app | 94.5 kB | 41.0 kB |
| CSS | 8.1 kB | 2.5 kB |
| one language (en) | 206.6 kB | 64.9 kB |
| **first load, English** | **309 kB** | **108 kB** |
| rules book, on first open | 1515 kB | — |

Russian is the largest at 361.8 kB raw, 84.9 kB gzipped.

**This table is checked.** `tests/bundle.test.ts` builds the app and asserts the
split is engaged — one chunk per language, no dynamic import defeated by a
static one, no plan text in the entry. It exists because the numbers above were
written down once before and then stopped being true: three value imports of
`@leela/content` in `browse.ts` folded every language back into the entry, and
the app shipped **8.1 MB** for a hundred and twelve commits under a README
promising 368 kB. Nobody rechecks a number that is already written down.

The language comes from the Telegram user's `language_code`, falling back to
the browser's, then to English.

## What is missing

- Group play across devices. Several players share *this* device — each with
  their own journal, intention and draft — but a table spread across phones
  needs `initData` verified server-side, which needs somewhere to run. Group
  play in one chat lives in the bot, and the two do not share a game yet.

## Every name comes from the catalogue

The markup says something before the script runs, so it says it in English, and
`applyChrome` replaces it. It replaced eleven of the fifteen. The three buttons
along the top — the rules, the players, the list of all seventy-two plans — and
the Save in the dialog that asks the question kept the English in the file, in
every one of the twenty-two languages.

For an **icon button** that English is the only name it has. The button renders
an emoji; `aria-label` and `title` are the whole of what a screen reader and a
tooltip have to go on. So a player reading the game in Russian heard *Players*.
The die beside them was named correctly, with the reason written down — *the die
shows a face, not a word* — and that reasoning was applied to one of the four.

`app.rules`, `app.plans` and `app.players` were already in the catalogue in both
complete languages and said by nobody, which is how this was found.

`tests/named.test.ts` reads the markup for every element whose name a person
reads or hears and requires each one to be named from the catalogue. Written
twice: the first version asked whether `messageFor` appeared within three
hundred characters of the id and called four untranslated controls translated,
because an event listener happened to sit beside a line that translated
something else. It follows the statement now, and the local a `getElementById`
is bound to.

## Every dialog can be left

Found by using the app rather than reading it. With the language set to Russian
on the running page, the four Close buttons read back as *Закрыть*, *Close*,
*Close*, *Close*: `applyChrome` named `#reader form button`, and there are four
of them. The plans list, the paste dialog and the writer kept the English in the
markup, in every one of the twenty-two languages.

None of the four carries an `id` — a way out of a dialog does not need one to be
read by a person — which is how they slipped past the check that holds every
named control to the catalogue. The check reads ids; the rule is *named from the
catalogue*, and a group can satisfy it.

**And the question's dialog had no way out at all.** That is right the first
time: the published app blocks the back gesture for a player who has none
(`blockGoBack: true`), and the `cancel` handler here refuses it for the same
reason. It is wrong every time after, and this is a phone — no Escape key,
Telegram's own back button unwired, and Save refusing fewer than two characters.
A player who tapped *Change it* and cleared the box had nothing left to press.

`mayLeaveTheQuestion` is where that decision lives, not the handler: a control
drawn shut is the shape three defects in this app came from.

## Three doors into a journal

The path view shows a section per seat under *The paths at this table*, and its
footer carries three controls that read or write one player's journal. Two of
them were named when an unnamed one wrote the wrong file: *Save Player 1's
copy*, and a paste dialog that opens as *Player 3 · Paste a square somebody sent
you*.

**The third said only *Bring one back*** — while merging a whole path, and the
question it was written under, into whichever seat happened to hold the turn.
Found by playing: three seated, a file brought back while looking at the section
headed *Player 1*, and it landed in Player 3's journal under a confirmation that
named a count and no seat.

The control says whose now, and so does the confirmation — before the act for a
square, after it for a file, because a file is chosen in the operating system's
own dialog where this app cannot put a title.

And the seat is counted in one place. `session.players.indexOf(currentPlayer(
session)) + 1` was written out in the paste dialog and the import needed the
same number; two copies of a counting rule is how a table comes to disagree with
itself about which player it is talking about.
