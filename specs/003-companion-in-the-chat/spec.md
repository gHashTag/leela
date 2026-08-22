# The companion talks back, everywhere the player already is

Two asks from the owner on 2026-08-22, landed together because they are one
promise: a companion you can simply talk to, and whose thinking you can see.

## Words in a private chat reach the companion

`answerInWords` dead-ended plain words into canned hints twice. In private
chats both ends now answer:

- **No table:** `Guide.about(question, {language, rules, history})` — a new
  plan-less prompt in `packages/ai` resting on rules rendered from
  `@leela/engine` exports (never hand-written numbers), which itself offers
  `/new` when it fits. Fallback when no model or silenced: the exact
  `chat.noTableHelp` sentence from before.
- **Seated, report filed:** the same answer `/ask` gives — the `/ask` body is
  extracted into one function used by both, one gate rather than two that
  drift. Byte-identical prompts for identical questions, pinned by test.

Unchanged, deliberately: group chats (stray chatter must not summon the
model); words from a player who owes a report are still the report; `/`-words
still get `chat.unknown`; a waiting-to-enter player keeps `chat.hint` — they
stand on no square, and answering would describe plan 68, the defect the
`/ask` guard documents. Both new paths spend the same shared allowance.

## The production route streams the thinking

The Railway `/api/ask` answered whole via `LanguageModel.complete`, which
discards reasoning — the phone shows the model think; the web page showed a
spinner. The route now takes an optional `StreamAsk`; when the key is Z.AI's,
`index.ts` connects with `stream: true, thinking: enabled` (the dev route's
request) and forwards `{thinking}`/`{text}` deltas as they arrive. Every
early-knowable failure — bounds, origin, allowance, the upstream connection —
is still a status before the 200; the two empty endings ("empty completion"
vs "spent the whole budget thinking") stay told apart, the dev route's rule.

## Doubles called by the audit, unified

`RESTING_FACE` now lives once in `@leela/engine` (`= MAX_ROLL`: the die at
rest shows the throw the game is waiting for); webgl's `TIMEOUT_MS` lives
once in `ask.ts`.

## Acceptance

All package gates green (engine 544, ai 237, bot 732, webgl 429, miniapp 532),
all four root audits exit 0 by their real exit codes, README counts regenerated
by `audit-claims --write`, and a live production probe shows `{thinking}`
frames before the answer.
