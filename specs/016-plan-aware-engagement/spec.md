# A companion that knows why this morning matters

The owner's request (2026-09-01): the bot's agent should proactively draw a
player back into Leela with wisdom grounded in the plan under their piece,
increasing engagement and loyalty without turning the private chat into a
notification feed.

## The gap

The initiative already sends one private daily word, rotates excerpts from the
canonical plan text, respects `/quiet`, and uses the player's most recently
played table. It does not use the companion at all. The same excerpt and the
same `/roll` instruction are sent whether the player owes a reflection, has
already reflected, has a stated intention, or has a path of earlier reports.

That makes the call to action wrong at the most important moment: `/roll` is
not the next available action when the report gate is closed. It also leaves
the companion's richest context — plan, intention, and path — unused in the
only flow where the companion speaks first.

## Research translated into product rules

- Self-determination research on game engagement identifies autonomy,
  competence, and relatedness as durable motivational needs. The message must
  therefore offer a choice, make the next valid action obvious, and sound like
  a companion who remembers the player's path — never a streak collector.
- Reviews of digital prompts find that relevance, timing, and message content
  matter, and that more simultaneous engagement tactics are not proven to add
  value. Keep the existing one-touch-per-day cap and add one contextual layer,
  not a campaign of extra reminders.
- Research on personalization supports tailoring communication content and
  reminders to known context. Use only game context the player already gave
  Leela: the current plan, intention, and report history.
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
plan to the player's present game context.

- If a report is owed, the bridge contains one gentle, concrete reflection
  question. The single CTA tells the player that replying in one sentence files
  the report and opens the next throw. It does not tell them to `/roll` while
  the engine would refuse it.
- If the report is already filed, the bridge is one brief plan-grounded insight
  with no question. The single CTA remains `/roll`.
- The prompt may use the player's intention and earlier reports, but must not
  quote them back, diagnose them, praise unclaimed progress, create urgency,
  count absence, or invent teaching beyond the canonical plan text.
- If no model is configured, it is cooling down, times out, or refuses the
  request, a localized canonical bridge is used. The morning word still goes
  out and the game never waits on the companion.
- Doorstep words remain deterministic because a player waiting for their first
  six stands on no plan. Quiet, channel, lapsed, finished, and once-per-day
  gates remain unchanged.

## Operational truth

The tick summary records how many delivered messages used a model-written
bridge and how many used the canonical bridge. Startup says whether the
plan-aware companion is configured. No report or intention history is read for
a sleeping player, a doorstep word, or a companion already in cooldown.

## Acceptance

- A deterministic RED test proves the old daily word neither calls the agent
  nor changes its CTA when a report is owed.
- The agent prompt contains the exact current plan's canonical text and, when
  present, the intention and path; it cannot be used with a plan outside 1..72.
- Pending-report and ready-to-roll messages each expose exactly one next action
  and use the player's language.
- A failed, absent, or silenced model produces a useful localized bridge and
  does not reduce the tick's delivered count.
- Existing eligibility, `/quiet`, one-message-per-day, blocked-channel,
  doorstep, fresh-start, and restart-persistence properties remain green.
- The full repository gate and root audits pass; the PR is reviewed, merged,
  deployed to the existing Railway service, and verified from runtime logs.
