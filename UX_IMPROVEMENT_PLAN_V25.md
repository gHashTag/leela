# UX Improvement Plan V25

**Cycle:** 20  
**Date:** 2026-08-08  
**Theme:** Chat AI stream controls and message-level recovery

## 1. Weak spots

- `ChatScreen` already has a small stop icon inside the loading bubble, but no persistent composer-level indicator that Leela is generating.
- The last assistant message has no "Regenerate" action; the user must retype the prompt to retry a finished turn.
- The last user message has no "Edit prompt" action; there is no quick way to refine a question after a failed/cancelled/unsatisfying answer.
- `lastUserMessageRef` / `lastApiMessagesRef` are never cleared after a successful turn, so a stray regenerate could reuse stale context.
- The error bubble only shows a retry icon, not an edit affordance.

## 2. Competitors / patterns

- **ChatGPT / Claude mobile apps**: a visible "Stop generating" bar and per-message "Regenerate" / "Edit prompt" actions.
- **Apple HIG (Human Interface Guidelines)**: always give users an escape hatch from AI generation; place the cancel affordance in the same region as the send control.
- **Perplexity**: message-level retry and edit-last-prompt reduce friction when the model answer misses the mark.

## 3. Decomposed plan

1. Add locale keys `chat.stopGenerating`, `chat.generatingHint`, `chat.regenerate`, `chat.editPrompt`, `chat.regenerateHint`, `chat.editHint` to all 10 translation files.
2. Add a top `StreamStatusBar` in `ChatScreen` that appears while `loading` and offers a large, accessible **Stop generating** button.
3. Track `inputText` with `GiftedChat` controlled composer; add `handleEditLastPrompt` that pre-fills the composer, removes the failed/error assistant turn, and keeps the user message in context.
4. Add `handleRegenerate` that re-runs the stream for the most recent assistant message without duplicating the user message.
5. Clear `lastUserMessageRef` / `lastApiMessagesRef` after a successful turn so regenerate only applies to the immediately previous turn.
6. Render regenerate/edit actions on the last assistant / last user bubbles via `renderBubble`.
7. Add `src/screens/Tabs/ChatScreen/index.test.tsx` covering stop from the status bar, regenerate, and edit-last-prompt.

## 4. Success metrics

- Jest suite stays green.
- Composer-level stop is visible during every streaming turn.
- Regenerate and edit actions appear on the last assistant and user messages respectively.
