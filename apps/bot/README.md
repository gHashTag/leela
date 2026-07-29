# @leela/bot

Leela as a group game in a Telegram chat.

Leela is traditionally played in a facilitated group, and no competing app
offers that across devices. A chat is the cheapest place to put it: everyone is
already there, the turn order is visible, and a report is just a message.

## Running it

```bash
BOT_TOKEN=... bun run apps/bot/src/dev
```

Get a token from [@BotFather](https://t.me/BotFather). Nothing else is needed —
rooms are held in memory.

## Commands

| Command | What it does |
|---|---|
| `/new` | open a table |
| `/join` | take a seat, up to six |
| `/start` | begin — host only |
| `/roll` | throw the die |
| `/report <text>` | reflect on the plan you stand on |
| `/plan [n]` | read a plan, defaulting to yours |
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

`store.ts` is where rooms live between messages. `MemoryRoomStore` is enough
for one process; a Postgres implementation belongs in `@leela/db`, next to the
`sessions` and `session_players` tables that already model this.

## The die

Each room gets a seed derived from its chat id, and each roll is the *n*-th
value from `seededRoller(seed)`. So a whole game replays from `(seed,
rollsTaken)` — both of which are stored — and no player has to take another's
word for a throw. `seedFor` is a hash, not `Math.random()`, so two tables opened
in the same millisecond still get different games.

## What is missing

- Persistence. A restart loses every game in progress; the process says so on
  startup rather than losing them quietly.
- Reports are gated but not stored. They belong in the `reports` table.
- The room language comes from the host's Telegram locale and cannot be changed
  afterwards.
