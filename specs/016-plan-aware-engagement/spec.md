# A companion that knows why this morning matters

The owner's request (2026-09-01): the bot's agent should proactively draw a
player back into Leela with wisdom grounded in the plan under their piece,
increasing engagement and loyalty without turning the private chat into a
notification feed.

## The gap

The initiative already sends one private daily word, rotates excerpts from the
canonical plan text, respects `/quiet`, and uses the player's most recently
played table. It does not use the companion at all. The same excerpt and the
same `/roll` instruction are sent whether the player owes a reflection, must
wait for another player, is in a cooldown, or is actually ready to roll.

That makes the call to action wrong at the most important moment: `/roll` is
not always the next action the engine accepts. The companion also leaves the
canonical text of the player's current plan unused in the only flow where it
speaks first.

## Research translated into product rules

- Self-determination research on game engagement identifies autonomy,
  competence, and relatedness as durable motivational needs. The message must
  therefore leave room for choice, make the next valid action obvious, and
  sound related to the player's present square — never a streak collector.
- Reviews of digital prompts find that relevance, timing, and message content
  matter, and that more simultaneous engagement tactics are not proven to add
  value. Keep the existing one-touch-per-day cap and add one contextual layer,
  not a campaign of extra reminders.
- Research on personalization supports tailoring communication content and
  reminders to relevant context. For a message the player did not request,
  the privacy boundary is stricter: send the model only the language and
  current canonical plan, never the intention, reports, conversation, user id,
  or other private writing.
- Telegram's official guidance caps ordinary bulk broadcasts and recommends
  spreading sends over time. This feature keeps the existing single scheduled
  tick and sequential delivery; it does not add a second broadcast.

Sources:

- https://selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf
- https://pmc.ncbi.nlm.nih.gov/articles/PMC4723726/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9168921/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10239832/
- https://core.telegram.org/bots/faq#how-can-i-message-all-of-my-bot-39s-subscribers-at-once

## What ships

For a standing player selected by the existing daily or fresh-start arm, the
initiative asks the configured companion for a short bridge from the canonical
plan to the next action the game will accept.

- If a report is owed, the bridge contains one gentle, concrete reflection
  question. The CTA asks for a reply and states the configured minimum length
  when one exists. It does not promise that a short sentence opens the throw.
- Otherwise the bridge is one brief plan-grounded insight with no question.
  The CTA is derived from the whole turn verdict: `/roll`, another player's
  turn, the remaining cooldown, or the end of the game.
- The proactive prompt receives only the player's language and current plan.
  It must not diagnose, praise unclaimed progress, create urgency, count
  absence, issue commands, or invent teaching beyond the canonical plan text.
- Model output longer than 800 characters, containing a slash/game-action
  instruction, pressure about absence/streak/urgency, diagnosis, invented
  praise, or violating the one-question/no-question shape is discarded in
  favour of the localized canonical bridge. The vocabulary guard is complete
  over all 22 supported languages, and the English guard is always applied in
  case a provider answers in the wrong language.
- If no model is configured, it is cooling down, times out, or refuses the
  request, a localized canonical bridge is used. The morning word still goes
  out and the game never waits on the companion. The first fallback or thrown
  call opens a tick-wide circuit breaker so one provider outage cannot cost one
  timeout per player.
- Doorstep words remain deterministic because a player waiting for their first
  six stands on no plan. Quiet, channel, lapsed, finished, and once-per-day
  gates remain unchanged.
- A private reply to a word sent from a group game resolves that same group
  room and files the reflection there, so chat and Mini App read one state.

## Operational truth

The tick summary records how many delivered messages used a model-written
bridge and how many used the canonical bridge. Startup says whether the
plan-aware companion is configured. Proactive delivery never reads private
intention/report history; an ineligible player or doorstep word does not even
inspect the companion's availability.

## Acceptance

- A deterministic RED test proves the old daily word neither calls the agent
  nor changes its CTA when a report is owed.
- The agent prompt contains the exact current plan's canonical text and no
  intention, path, report, conversation, or user identifier; it cannot be used
  with a plan outside 1..72.
- Pending-report, ready-to-roll, not-your-turn, cooldown, and finished messages
  expose the action the engine actually accepts and use the player's language.
- Unsafe, manipulative, or oversized model output falls back without losing the Telegram
  message, and one failed provider attempt is the maximum per tick.
- A private reply to a group table is stored in that table's report state.
- A failed, absent, or silenced model produces a useful localized bridge and
  does not reduce the tick's delivered count.
- Existing eligibility, `/quiet`, one-message-per-day, blocked-channel,
  doorstep, fresh-start, and restart-persistence properties remain green.
- The full repository gate and root audits pass; the PR is reviewed, merged,
  deployed to the existing Railway service, and verified from runtime logs.
