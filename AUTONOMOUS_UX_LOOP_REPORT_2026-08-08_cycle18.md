# Autonomous UX Improvement Loop Report
**Cycle:** 18  
**Date:** 2026-08-08  
**Theme:** Cancellable AI report streaming with partial-output recovery

---

## 1. Research findings

### Weak spots in the current AI report flow
- `streamZaiChat` (`src/utils/aiStream.ts:66-214`) created an `XMLHttpRequest` but exposed no abort handle or `AbortSignal`. Callers could not stop an in-progress stream.
- `CreatePost` (`src/components/CreatePost/index.tsx:282-302`) replaced the form with a read-only streaming view and offered no **Cancel** button, locking the user in for up to 120 s.
- On stream failure, `CreatePost` reset state and dropped the accumulated `aiContent`/`reasoning`, showing only a generic `Alert.alert` and losing the partial answer.
- `handleSubmit` created a post first and then ran the AI stream; retrying created a duplicate post.
- `PlansDetailScreen` blocked the hardware back button during a report but did not stop the stream, so generation continued after the user left.
- There was no cleanup on unmount, risking state updates on unmounted components and wasted network/LLM work.

### Competitors / patterns consulted
- **TRUETECH — Mobile AI Streaming with SSE & WebSocket**: streaming is now expected; cancellation needs explicit server signaling plus partial-output persistence.
- **Ably — Stop vs disconnect**: client-side abort alone is insufficient; robust stop needs a cancel signal, partial snapshot persistence, active stream ID checking, and clearing the stream reference only after confirmed cancellation.
- **DEV Community — Streaming Chat Needs Cancel and Retry States**: use explicit state machine (`Draft / Sending / Streaming / Interrupted / Failed / Complete`), preserve partial output, and offer Continue/Retry.
- **FrontendAtlas — AI Chat Composer and Streaming Turn System Design**: stable `commandId`/`streamId` identities, idempotent retry, and drafts separate from the active turn.
- **Sean Kim — Android LLM client architecture in 2026**: local persistence of user message before sending, saving partial assistant output if the stream dies, and retrying only text generation (not side effects).

---

## 2. Implementation summary

### 2.1 `src/utils/aiStream.ts` — abortable streams
- Added optional `signal?: AbortSignal` to `ZaiStreamCallbacks`.
- `streamZaiChat` now registers an abort listener, calls `request.abort()` on signal abort, and tracks `isAborted` to ignore late events.
- Introduced `settled`/`finish`/`fail` helpers to prevent double resolution and to route all terminal outcomes through a single path.
- Abort rejects with an `AbortError` so callers can distinguish cancellation from network failure.

### 2.2 `src/components/CreatePost/index.tsx` — cancel, retry, and partial-output UI
- Replaced boolean `isStreaming` with `streamStatus: 'idle' | 'streaming' | 'cancelled' | 'error'`.
- Added `createdPost` state and `abortControllerRef` to hold the active stream controller.
- `runAiStream` creates an `AbortController`, passes its signal to `streamZaiChat`, and preserves existing `aiContent`/`reasoning` when retrying after an error or cancellation.
- Added `handleCancelStream` and a **Cancel** button visible only while `streamStatus === 'streaming'`.
- On cancellation the UI keeps the partial output and shows a **Retry** / **Edit report** button row plus a localized cancellation message.
- On error the UI keeps the partial output and shows the same retry/edit affordances plus a localized error message.
- Added `handleRetryStream` that re-runs the AI stream on the existing `createdPost` without creating a duplicate post.
- Added `handleEditReport` to return to the form and clear `createdPost`.
- Added unmount cleanup that aborts any active stream.
- `handleSubmit` now guards against duplicate submission when `createdPost` is already set.
- The Send button is disabled while loading, streaming, or when a post is already created.

### 2.3 `src/components/Buttons/Button/index.tsx`
- Added a `disabled` prop to `ButtonT` and applied `opacity: 0.5` + `accessibilityState={{ disabled }}` when disabled.

### 2.4 Localization
- Added `createPost.cancel`, `createPost.retry`, `createPost.edit`, `createPost.cancelled`, and `createPost.streamError` to all 10 locale files.
- Translated the RU keys (`Отменить`, `Повторить`, `Редактировать отчёт`, etc.).

### 2.5 Tests
- Extended `src/utils/aiStream.test.ts`:
  - aborts when the signal aborts mid-stream and preserves already-delivered content;
  - does not deliver callbacks after an abort;
  - rejects with an abort error when aborted before `send()`.
- Also fixed the import of `i18next` in `src/components/Cards/SubCommentCard/index.tsx` (a small carry-over from cycle 17 that TypeScript surfaced).

---

## 3. Verification

```
Test Suites: 80 passed, 80 total
Tests:       348 passed, 348 total
```

The TypeScript checker still reports pre-existing React-type mismatch errors across the codebase (e.g., `View cannot be used as a JSX component`), but no new errors were introduced by this cycle's changes. `src/utils/aiStream.ts`, `src/components/CreatePost/index.tsx`, and the updated Button/SubCommentCard compile without new issues.

---

## 4. Collaboration options for the next loop

### Option A — Apply cancel/retry/draft pattern to `ChatScreen` AI chat
`ChatScreen` currently allows concurrent sends, has no cancel affordance, and drops failed turns. Port the `streamStatus`, `AbortController`, and retry-on-same-turn logic there.

### Option B — Consolidated Profile/Settings tab with Pro upsell and account tools
Design a single Profile screen that surfaces subscription status, restore purchase, data export, language, support, and sign-out. Currently these actions are scattered across tab bar and modals.

### Option C — Dice roll stuck-state fix with safe timeout/unmount recovery
Investigate reports of the dice animation freezing or leaving the board in a non-interactive state. Add a timeout guard, cleanup on unmount, and a visible "Roll again" affordance when the dice promise hangs.

---

## 5. Files changed

- `src/utils/aiStream.ts`
- `src/utils/aiStream.test.ts`
- `src/components/CreatePost/index.tsx`
- `src/components/Buttons/Button/index.tsx`
- `src/components/Cards/SubCommentCard/index.tsx`
- `src/locales/*/translation.json` (10 files)
- `UX_IMPROVEMENT_PLAN_V22.md` (new)

---

*Report generated by the autonomous UX improvement loop for Leela.*
