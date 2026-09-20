# Feature 010: One game, one companion

## Problem

The Telegram chat and its linked board now share throws, but they do not yet
share the whole game. The board keeps the player's intention and reports in
browser storage, while the bot keeps them in the durable report store. A daily
word can therefore open the right app and still show a different question and
path. Its copy also always points at `/roll`, even when the player owes a report,
is waiting for another player, or is in a cooldown.

## Research translated into product rules

- Ryan, Rigby, and Przybylski's self-determination account of video-game
  motivation treats autonomy, competence, and relatedness as the useful
  motivational needs. Leela therefore offers one truthful next action and
  preserves choice; it does not add streaks, loss framing, or variable rewards.
  Source: <https://doi.org/10.1007/s11031-006-9051-8>.
- Dai, Milkman, and Riis found greater aspirational activity after temporal
  landmarks. A Monday fresh-start message remains a clean-slate invitation,
  never a count of missed days. Source: <https://doi.org/10.1287/mnsc.2014.1901>.
- Mehrotra et al. show that receptivity to notifications depends on context.
  The agent uses game state as the context it actually knows instead of
  pretending to know a timezone or interruptibility. Source:
  <https://doi.org/10.1145/2858036.2858566>.
- Telegram limits groups to 20 bot messages per minute and ordinary bulk
  broadcasts to about 30 messages per second. The existing private, once-daily
  scheduler and bounded sends remain; this feature adds no broadcast fan-out.
  Source: <https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this>.

## User stories

### US1 — One private player context across both surfaces (P0)

As a seated player opening the board from Telegram, I see the same intention
and report history that the bot uses. Changing the intention or filing the
required report in either surface immediately affects the same durable record
and the same report gate.

Acceptance scenarios:

1. An authenticated `read` returns the room plus only the requesting player's
   intention and reports; it never returns another player's private writing.
2. Setting an intention in the linked board writes through `ReportSink`; the
   next `/intention` and linked read return it.
3. Submitting a report in the linked board runs `commands.report`, saves its
   changed room, records its report effect, and returns the updated room and
   private context.
4. Invalid, expired, non-member, wrong-origin, blank, short, duplicate, or
   otherwise rule-invalid writes are refused by the same validation and engine
   rules as chat commands.
5. Standalone WebGL behavior remains local and playable.

### US2 — Every proactive launch opens the same table (P0)

As a player following the daily companion message, I open the most recently
played table selected by the initiative pass, not a standalone board.

Acceptance scenarios:

1. The reply-keyboard URL contains the selected room's `chat` id without
   dropping existing query parameters.
2. The text remains deliverable without the keyboard if Telegram rejects its
   markup.

### US3 — A state-aware engagement agent (P1)

As a player receiving a proactive word, I get one honest next step based on my
current state: enter, reflect, roll, or read/wait.

Acceptance scenarios:

1. Waiting to enter gets the bounded doorstep invitation.
2. A current player who owes a report is invited to reflect, never told to roll.
3. A current player who may roll is invited to continue their turn.
4. A player waiting for somebody else, or waiting through a cooldown, gets the
   plan excerpt and an invitation to read/return, not a false action prompt.
5. The Monday fresh-start frame may wrap any applicable on-board action.
6. `/quiet`, one delivered message per UTC day, 14-day active and 35-day
   fresh-start windows, three-doorstep lifetime cap, private delivery, canonical
   plan excerpts, and failure handling remain unchanged.
7. The proactive copy is deterministic and canonical. A generative model may
   respond after the player writes, but it does not invent unsolicited nudges.

## Non-goals

- No streaks, badges, guilt, urgency, scarcity, or dark-pattern retention.
- No timezone inference, notification surveillance, new analytics, or storage
  of engagement scores.
- No public reports or intentions.
- No deployment, secret rotation, commit, or push from this repository task.

## Success criteria

- All player-owned game data visible in the linked board comes from the server.
- Chat and linked board enforce the same report and intention rules.
- Each proactive message's CTA agrees with the engine state at the tick.
- Existing delivery caps and opt-out tests continue to pass.
- `bun run verify` passes.
