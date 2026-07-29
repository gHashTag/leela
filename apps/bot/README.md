# @leela/bot

Leela as a group game in a Telegram chat.

Leela is traditionally played in a facilitated group, and no competing app
offers that across devices. A chat is the cheapest place to put it: everyone is
already there, the turn order is visible, and a report is just a message.

## Running it

Put the token in `apps/bot/.env`, which is gitignored:

```
BOT_TOKEN=123456:AA...
```

Then:

```bash
cd apps/bot && bun run src/index.ts
```

Get a token from [@BotFather](https://t.me/BotFather).

Games are held in memory unless `LEELA_DB` points at a file:

```
BOT_TOKEN=123456:AA...
LEELA_DB=.leela.db
OPENROUTER_API_KEY=sk-or-...   # optional: the companion that answers reports
```

The process says on startup which of the two it is doing, rather than losing
games quietly.

One token, one running bot. If a webhook is set on that token, polling will not
receive anything until it is cleared:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook"
```

## Staying up

`bot.catch` handles a failing update. It does not handle a failing *poll* — a
dropped socket, or a second process calling `getUpdates`, throws out of the run
loop and takes the process with it. That is not theoretical: it is how the first
run of this bot died.

`supervisor.ts` wraps the run loop. Network failures back off exponentially from
1s to a minute. A 409 waits a flat 30 seconds and says plainly that another
instance holds the token, because backing off from 30s would take minutes to
recover once the other one stops. A 401 does not retry at all — a revoked token
cannot be fixed by asking again.

The policy is a pure function, so `tests/supervisor.test.ts` covers every branch
without waiting a second.

## Commands

| Command | What it does |
|---|---|
| `/new` | open a table |
| `/join` | take a seat, up to six |
| `/start` | begin — host only |
| `/roll` | throw the die |
| `/report <text>` | reflect on the plan you stand on |
| `/plan [n]` | read a plan, defaulting to yours |
| `/path` | what you have written, and where — works with or without a table |
| `/board` | where everyone stands |
| `/end` | clear the table |

## How it is put together

`commands.ts` is the whole game: pure functions from `(room, input)` to
`(room, replies)`. No socket, no database, no clock — the time is passed in.
That is why `tests/commands.test.ts` can play a game to its finish, twice, with
no bot token and no network.

`bot.ts` is the transport. It turns a Telegram update into a call into
`commands.ts` and the replies back into messages, and it holds no rules. If you
find yourself writing a condition about the board in there, it belongs in
`commands.ts` or in `@leela/engine`.

`store.ts` is where rooms live between messages, and where reports go once
written. `MemoryRoomStore` is enough for one process; `DatabaseRoomStore` in
`persistence.ts` is the durable one, backed by the `sessions` and
`session_players` tables that already model a table.

Commands never write. A command that needs something recorded returns an
`Effect` describing it, and the transport applies effects *after* the room has
been saved — so a failed write can never leave the board ahead of the writing.

## The die

Each room gets a seed derived from its chat id, and each roll is the *n*-th
value from `seededRoller(seed)`. So a whole game replays from `(seed,
rollsTaken)` — both of which are stored — and no player has to take another's
word for a throw. `seedFor` is a hash, not `Math.random()`, so two tables opened
in the same millisecond still get different games.

## Persistence

`DatabaseRoomStore` takes a `RoomQueries` — four methods — and splits a room
into a `sessions` row and its `session_players` rows. `roomToRows` and
`roomFromRows` are pure, and tested to round-trip a game exactly, because the
failure here is silent: a game that reloads with the wrong turn holder, or in
the wrong language, still looks like a game.

Two things the round trip protects that are easy to lose:

- **Seat order.** Turn order comes from the `seat` column, never from the order
  a query returned rows in. The test's fake deliberately reverses them.
- **The language.** Before `sessions.language` existed, a restarted table
  dropped everyone into English. Migration `0002` adds it.

## Storage

`SqliteRoomQueries` implements `RoomQueries` on SQLite, which is built into
both runtimes — no dependency, no server. One file holds the games and the
reports.

Node ships `node:sqlite`; Bun ships `bun:sqlite` and has no `node:sqlite` at
all. The bot runs under Bun and the tests under Node, so both are tried at
startup. Their prepared-statement APIs agree on everything used here.

The module is loaded through `createRequire` rather than imported: Vite's list
of Node builtins predates `node:sqlite`, so a static import makes the test
bundler try to resolve it as a file and fail to load the suite.

A save writes the session and replaces its seats in one transaction. Both or
neither — a room half-written after a roll is a game with the wrong turn
holder, which still looks like a game.

Moving to Postgres is a change of driver: the columns already mirror `sessions`
and `session_players` in `@leela/db`.

## What is missing

- The room language comes from the host's Telegram locale and cannot be changed
  afterwards.
- The companion answers a report but never sees the path it belongs to; a
  reflection on plan 40 is read without the thirty-nine before it.
