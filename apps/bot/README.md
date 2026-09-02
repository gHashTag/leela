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
OPENAI_API_KEY=sk-...          # optional: the companion that answers reports
OPENAI_MODEL=gpt-4o-mini       # optional: defaults to gpt-4o-mini
```

The companion takes any of four: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`,
`ZAI_API_KEY` or `OPENROUTER_API_KEY`, each with an optional `*_MODEL`. The
first one set wins, in that order. Set `ZAI_PLAN=coding` for a Z.AI Coding Plan
key — sent to the pay-as-you-go host it returns error 1113, which reads as an
expired key. All three publish the same chat-completions format, so the
choice is a host and not a code path — and the startup line names the provider
and model it picked up, so a key in the wrong variable is visible immediately.

The process says on startup which of the two it is doing, rather than losing
games quietly.

One token, one running bot. If a webhook is set on that token, polling will not
receive anything until it is cleared:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook"
```

## Running it as a service

`apps/bot/Dockerfile` builds the whole workspace, because the bot imports four
sibling packages by `workspace:*` and `@leela/content` carries the 22 datasets
it serves plans from. `railway.json` points a Railway deployment at it.

Two things that are not in the repository and cannot be:

- **`BOT_TOKEN`** is set on the service, by a person. It is never committed and
  never copied by a script.
- **A volume mounted at `/data`.** Without one the bot runs, says on startup
  that games are held in memory, and forgets every table on the next deploy.
  `LEELA_DB` points inside it.

The branch matters. `main` in this repository is the old React Native app and
shares no ancestor with `unified`; a service pointed at `main` builds something
else entirely.

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

## Who each reply is for

`Reply.broadcast` had been set on every reply since the command layer was
written, and the transport ignored it — everything went to the chat the command
came from. In a private chat that is harmless. In a group it meant a player's
`/path`, their own reflections on themselves, was read out to everyone at the
table, along with the gate telling them to write one and the companion's answer
to it.

Private replies now go to the player directly. Telegram refuses a message to
anyone who has not started a chat with the bot, and there is no way to ask in
advance — so the bot assumes it can, remembers a refusal, and forgets the
refusal once a message gets through, in case they started one later.

When there is nowhere private to send it, the group gets a nudge that **carries
none of the content**: naming the command and asking the player to open a chat.
Exposing the text would defeat the point of it being private.

## Forgetting finished tables

Nothing deleted a finished game, so every table ever opened stayed in the
database. `pruneFinished` runs at startup and forgets tables whose game ended
more than a week ago — at startup rather than on a timer, because a bot that is
never restarted is not accumulating tables either.

The reports are deliberately untouched. A table is scaffolding; a report is the
player's, and `/path` must still find it years later.

A game counts as over when every seat has finished *after* being on the board.
A seat that never entered has `previous_plan = 0` — waiting, not done — and
treating those as finished would delete a game before it started.

## The daily word

Once a day the bot writes first: privately, to each player who is standing on
a plan, active within the last fourteen days, reachable, not already written
to today and not quieted — a rotating excerpt of the plan's own text, one line
naming where they stand, and one call back into the game. The first message a
player ever receives ends by naming `/quiet`, which stops it; `/quiet` again
brings it back. What was sent, when, and which excerpt live in the same
storage the games do — in memory when the games are.

`LEELA_NUDGE_HOUR` sets the hour it goes out, an integer 0–23 read as UTC
because the deployment's clock is UTC; the default is 6, which on Railway is
09:00 in Moscow. Anything else in the variable takes the default. The engine
and its sleeping conditions are `src/initiative.ts`; every eligibility branch,
the excerpt rotation and the once-per-day cap are held by
`tests/initiative.test.ts` and `tests/the-daily-word.test.ts`.

## The public invitation

The bot can publish one plan-led invitation per UTC day to a public Telegram
channel. The feature is dark unless the channel is named explicitly:

```
LEELA_PUBLIC_CHANNEL=@leelachakraapp
LEELA_PUBLIC_LANGUAGE=ru       # optional; defaults to ru
LEELA_PUBLIC_HOUR=7            # optional; UTC, defaults to 7
```

The rotation visits all 72 plans exactly once every 72 days. Each post contains a canonical
excerpt, one short reflective bridge from the companion (or a canonical
fallback), and one button leading to the bot. A private `/start` creates and
starts the player's durable single-player game and offers the signed Mini App
board immediately; `/start` in an empty group keeps its existing help-only
semantics.

Only the channel receives a send. When Telegram links a discussion group to a
channel, Telegram itself forwards each channel post into that group and opens
its comment thread; sending a second copy would duplicate the invitation. The
database keeps one anonymous daily cohort (`day`, plan, send time, bridge and
aggregate starts), never reader ids, usernames or message text.

## Telegram Stars, dark until somebody names a price

Telegram Stars (`XTR`) are the only sanctioned way for a bot to sell a digital
good, and this bot has the rail for them. It is **off**.

Whether this game charges for anything, and what for, is the owner's decision
and it has not been made. So the rail is written, tested, and gated on one
thing — a price in the environment:

```
LEELA_STARS_MONTH=150          # optional: Stars for 30 days
LEELA_STARS_HALFYEAR=700       # optional: Stars for 182 days
LEELA_STARS_YEAR=1200          # optional: Stars for 365 days
LEELA_STARS_OPERATORS=11,22    # optional: who may /refund a payment
```

With **none** of the three set, `offering(process.env)` in `src/stars.ts`
answers `null` and that is the whole feature off: no `/pro` is registered, it is
in no menu and no help text, no invoice can be assembled — `invoiceFor` refuses
one and says why — and a `pre_checkout_query` or a `successful_payment` falls
off the end of the chain unanswered. A deployment with no price behaves exactly
as it did before the rail was written, and `/pro` typed into one is answered
byte for byte as any other word this bot does not know.

**One bad price darkens all of them.** A deployment with a good
`LEELA_STARS_YEAR` and a mistyped `LEELA_STARS_MONTH` is one somebody meant to
price twice; selling the half that parsed would be charging for an offer nobody
wrote. The startup line says which of the two states this process is in, and
names the variable when it is a typo — otherwise a mistyped price is invisible,
because the bot runs either way.

**What a subscription buys, said plainly.** Every player receives three
successful moves for free. A throw that cannot enter the board or would
overshoot it does not consume that allowance. From the fourth successful move,
one live entitlement opens both `/roll` in the chat and `/api/roll` used by the
mini app until its recorded expiry. The count is durable and per player, so a
reload, another chat, or another surface cannot refill or double-spend it. A
deployment with no configured price remains fully open and shows no payment
surface.

**Refunds.** Telegram requires that a bot taking Stars can give them back.
`/refund <charge id>` calls `refundStarPayment` and then clears this bot's own
record — Telegram first, so a refusal from Telegram leaves the record untouched
and nobody is told they have been paid back when they have not. It is an
operator's command: registered only where `LEELA_STARS_OPERATORS` names
somebody, answered only for them, and to everybody else it does not exist — a
player who types it reads the ordinary *I do not know that one*. The charge id
comes from the log line written the moment a payment arrives, before anything
else that could fail.

**Payments are kept one row each**, in `entitlements`, keyed by Telegram's
charge id rather than by player — the one place `sqlite.ts` departs from the
tables beside it. A refund is granted against a charge, so a store holding only
a player's current expiry could not say which payment a refund undid. The
player's expiry is derived from those rows and never stored, so the two cannot
drift. A second payment **extends** rather than replaces: somebody who buys a
second year in month eleven has bought two years, and replacing would take
eleven months from them for paying again.

**One-off, not recurring.** Telegram's `subscription_period` — a Stars
subscription that renews — is on `createInvoiceLink` only and must be exactly
2592000 seconds, and nothing here sends one. So no recurring charge can arrive.
If subscriptions are turned on later, `SuccessfulPayment.subscription_expiration_date`
is Telegram's own answer to when the entitlement ends, and it is the number to
record.

**Terms and payment support precede checkout.** A priced deployment publishes
`/terms` and `/paysupport` beside `/pro`. They point to the Terms and contact
address already published by `@leela/docs`; the bot adds no legal promise or
support SLA of its own, and says explicitly that Telegram cannot resolve a
purchase made through this bot. `/pro <tier>` now sends a private acceptance
prompt rather than an invoice. Only the player's *I have read and agree*
callback resolves the tier against the current offer and calls `sendInvoice`.
An old or forged callback can therefore show the current offer but cannot
charge for a tier the deployment no longer sells. The invoice remains one step
before payment: only Telegram's later `successful_payment` opens access. New
invoices carry a consent-bound `v2` payload, so an unpaid `v1` invoice from the
older direct-invoice flow is refused at pre-checkout. A `v1` payment Telegram
already completed across the deployment boundary is still honoured after the
money moved.

The pre-checkout answer has a deadline: Telegram must receive it **within ten
seconds**, and past that the payment fails for the player with no reason given.
So nothing awaited stands between the update arriving and the answer going out
— `tests/a-payment-answered-in-ten-seconds.test.ts` proves it by handing the bot
stores whose promises never settle, and by asserting that the path touches no
store at all.

## The mini app's companion

The mini app has the plans, the returns, the arrival and the whole path —
everything `packages/ai` is given except the model. It is a static page, a model
needs a key, and a key in a browser bundle is a key given away. So the half of
the product that was missing was never the reflection: it was the bridge.

Telegram provides one. A mini app **opened from a keyboard button** may call
`sendData`, and the bot receives it as `message:web_app_data`. What arrives is
the square format both surfaces already read and write, so the bot files it —
exactly as `/take` does, one account per arrival — and then answers it, which is
the part only this side can do.

**The bot sends the launch, and it is the one thing only the code can do.** This
paragraph used to say the opposite — *this needs setting up once, and it is not
something the code can do* — and it was backwards in the way that mattered: a
reply keyboard is `reply_markup` on a message the bot sends, and BotFather has
no reply-keyboard setting at all. So for as long as that sentence stood, the
operator was told to go and do something impossible, and the bridge was never
attached. Measured, by driving a real `createBot` through eighteen commands with
an api-transformer over every outgoing call: 37 API calls, 4 carrying
`reply_markup`, all four `inline_keyboard`, **zero reply keyboards, zero
`web_app` buttons**. The handler for `message:web_app_data` had been unreachable
since it was written.

What is sent now, and from where:

```
{ keyboard: [[{ text: '🗺 Board', web_app: { url: 'https://t27.ai/leela/' } }]],
  resize_keyboard: true }
```

- `/roll`, `/board`, and the same two as inline buttons — the step, which is
  where the donor bot put its own `Gameboard` button.
- After the companion's reflection on a report — the donor's other one.
- **Into a private chat only**, because Telegram refuses a `web_app` keyboard
  button anywhere else and a reply keyboard at a table is drawn for everybody.
  At a table it goes to the player's own chat, the same route the report gate's
  answers take; when the bot has never been able to write to them, nothing is
  sent and the existing nudge stands.
- **Once per chat per process.** A reply keyboard is not markup on a message:
  Telegram keeps it under the input field until something replaces it, so
  redrawing it every turn would be an extra message a turn for a button that is
  already there. A restart forgets, and the cost of forgetting is one message.

`LEELA_MINIAPP_URL` overrides the URL, for a staging copy of the app. It must be
HTTPS: Telegram refuses a `web_app` button with anything else by failing the
whole `sendMessage`, so a typo would stop the bot answering rather than produce
a dead button — an environment variable that is not an HTTPS URL is refused, the
default used, and the substitution logged.

Not an inline button and not a link, and this is the trap. grammY has
`.webApp()` on **both** `Keyboard` and `InlineKeyboard`, so nothing in the type
system stops the wrong one; the difference is a sentence in `Keyboard.webApp`'s
own doc-comment — *the Web App will be able to send a "web_app_data" service
message* — that `InlineKeyboard.webApp`'s does not have. The donor bot fell in:
`leela-chakra-bot/src/commands/step/index.ts` puts `{ text: 'Gameboard',
web_app: … }` inside an `inline_keyboard`, which opens the board and can never
answer with anything. `tests/a-launch-that-can-answer.test.ts` holds the shape —
for every inbound update kind `bot.ts` registers that only the bot's own markup
can produce, something the bot sends must be able to produce it — and refuses
the inline form explicitly.

`sendData` exists in every browser — `telegram-web-app.js` is served from
telegram.org and defines it everywhere — so it cannot be feature-detected. The
mini app therefore offers "Ask the companion" only when `initData` is non-empty,
which is the one honest sign of being inside Telegram at all; whether the launch
was from a keyboard button is not visible from the page.

**Known, and deliberately not fixed here:** `initData` is non-empty for a Menu
Button launch too, where `sendData` does nothing at all. So a player who opens
the app from the menu instead of from this keyboard is still offered a control
that silently does not work. That is `apps/miniapp/src/main.ts`'s to fix and it
is left untouched, so that this change and that one do not have to be reviewed
as one.

## What is missing

- The room language comes from the host's Telegram locale and cannot be changed
  afterwards.
- The companion cannot be verified without an OpenRouter key: the prompt is
  tested, the answer's quality is not.

## The question comes before the die

The published app will not let anybody near the board without one —
`if (!prof.intention) navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true })`
in `screens/helper.ts`, with the back gesture blocked — the mini app's
`mayThrow` refuses, and the phone was given the same gate. The bot was the one
surface where a whole game could be played without ever being asked what it was
being played for.

*The one difference between surfaces this repository does not allow is what the
game asks of a player.* Not a `RuleSet` change: the gate lives in the surfaces
and not in `@leela/engine`, exactly as it did when the phone joined them.

`intention.ask` has been in the catalogue in English and Russian since the bot
learned `/intention`, and was said by nobody. That is how this was found.

`roll` takes an `Asked` or nothing, and the two are different facts: **nothing**
means this caller does not deal in intentions — a deployment whose store cannot
hold one, and every test that plays a game without them — and then there is no
gate, because refusing a throw for an answer there is nowhere to keep would end
the game over a fact about the deployment. `{ intention: '' }` means they were
asked and have not answered. An optional string would have made those one.

A default that quietly skips a gate is an absence reading exactly like a pass,
so `tests/asked.test.ts` holds `bot.ts` to passing it at both places the die is
turned — the command and the button.

## A six that has to wait

`A six — throw again.` was announced whenever the six kept the turn. But a six
that moves a player onto a new square also leaves them owing a report — which is
**every entering six**, the first six of every game — so the bot said *A six —
throw again* and answered the next `/roll` with *write what it brings up before
you move on*. Two sentences in a row, contradicting each other, on the
most-travelled path there is.

Found by playing a game through `handleUpdate` and reading every line it sent,
with the addressee beside it. The transcript put the two replies one under the
other.

The announcement asks `canCurrentPlayerRoll` now — the same function that will
refuse the next throw — so the two cannot disagree. A six that can be taken says
*throw again*; a six that must wait says *and another throw, once you have
written about this plan*; a six under a cooldown says nothing extra, because
`online` measures the wait from the moment the report is written and any figure
named now would be wrong by the time it mattered.

Under `classic` almost every six owes an account, so the immediate promise was
nearly always the wrong sentence. That is why it lasted: it read as correct
whenever anybody checked one throw in isolation.

## The end still owes an account

`classic` asks for a report on 68, and a pass went into making the winner's
account possible at all — the square a whole game is played to reach was, for a
while, the one arrival nobody was ever asked to write about. Having made it
possible, the closing line pointed at `/path` and `/new` and not at `/report`,
which is the one thing still to do.

Every other arrival is met with the words that discharge it: *write what it
brings up before you move on — send /report followed by your words*. The
standings just above the closing line do say *owes a report*, in a list. An
obligation named in a parenthesis, in the same breath as *that is the game*, is
one nobody reads as an obligation.

Found by playing a game to its end and reading what it said. The account can be
given — `/report` after the win is accepted and answers *their game is
complete* — so the sentence had somewhere to point all along.

`onchain` is the guard: it sets `reportOnWinningSquare: false`, because an
on-chain winner is out of play and `createReport` requires `isStart`, so they
could not file one if asked. A game under it ends without the instruction.

## What the companion is told about a return

Three call sites hand the companion a player's path: the report gate, a
handed-over square, and `/ask`. The first two take out the words they are about
to answer, and say why in as many words — *so the companion is not handed the
words it is about to answer as though they were already history*. `/ask` took
none out.

So a player who arrived on a square, wrote about it because the game requires
that before anything else, and then asked a question had their own minutes-old
account announced to the model as **They have stood here before, and wrote:** —
under a paragraph asking it to notice *what changed between the tellings*, of
which there was one.

Found by playing a game and printing the system prompt the model actually
received. No unit test could see it: they build a context by hand, and the
defect is in what the caller assembles.

`/ask` has no text to filter by, so the rule is asked a different way — the
newest account on the square being stood on, and only once `reportSubmitted`
says this arrival has been written about. A player who asks **before** writing
still gets a real return, which is the whole reason that section exists: the
eight-most-recent window is structurally unable to see it.
