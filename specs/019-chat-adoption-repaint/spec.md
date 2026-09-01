# One adopted chat game, one rendered screen

The production screenshot on 2026-09-01 shows three mutually contradictory
facts in the same Mini App: the Telegram bridge says `План 6`, while the header,
die gate, and companion thread still describe the browser's former plan 11.
The signed chat state reached the client, but the client only repainted part of
the screen after adopting it asynchronously.

## Root cause

- The initial local session is rendered at module open before `myGame(...)`
  resolves.
- Successful chat adoption replaces `session` in memory and redraws the token,
  lotus, plan article, and gate, but it does not redraw the standing header.
- The prior die face and `stillMoving` flag survive even though roll history is
  cleared.
- The companion has already arrived on the local plan; adoption does not reset
  that thread or arrive on the chat plan.
- `placeSeats()` moves the token without focusing or drawing the board, while
  `settle()` is the existing complete board repaint.

## Observable contract

- After a signed single-seat chat game is adopted, every visible game fact is
  derived from the adopted server state in the same repaint: plan number,
  title, progress, standing sentence, token position, board focus, plan text,
  companion context, reflection gate, and die state.
- No line about the former local plan remains in the companion thread.
- The adopted game starts with no locally remembered throw: the die returns to
  its resting face, roll history is empty, `lastThrower` is null, and
  `stillMoving` is false.
- A language-changing adoption may reload first. On the converged load the same
  complete repaint occurs without a reload loop.
- Old-bot, multi-seat, and busy-session guards continue to refuse adoption and
  therefore do not rewrite the local screen or import the rejected game's
  payment access into the local gate.
- Any answer that began for the former local plan is invalidated when chat
  adoption starts: no late stream chunk, model answer, fallback, thinking
  state, or refusal state may appear in the adopted plan's thread.
- The progress element's accessible label is repainted by the same standing
  renderer as its visible value; after adopting plan 6 it says `6 / 68`, not
  the startup value `0 / 68`.
- The browser's saved local game remains untouched; only the in-memory Telegram
  session is adopted.

## Acceptance

- A deterministic test first fails against the current partial repaint and
  names every stale player-visible surface, not only the reported plan number.
- The smallest production repair uses the existing rendering authorities rather
  than reproducing their logic.
- Focused WebGL tests, its normal and strict typechecks, the complete WebGL
  suite, `bun run verify`, explicit root audits, independent review, PR checks,
  merge, Railway deployment, and live signed production probes all pass.

## Non-goals

- No game rule, payment price, Telegram identity, saved-game schema, initiative
  schedule, or content text changes in this wave.
