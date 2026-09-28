# UX Improvement Plan V22 — Cancellable AI Report Streaming with Partial-Output Recovery

**Date:** 2026-08-08  
**Cycle:** 18  
**Focus area:** AI report generation streaming state (CreatePost)

---

## Research summary

### Weak spots
The AI report flow in Leela leaves users trapped and discards progress on failure:

- `streamZaiChat` (`src/utils/aiStream.ts:66-214`) creates an `XMLHttpRequest` but exposes no abort handle or `AbortSignal`. The only abort path is the built-in `onabort` handler, which callers cannot reach.
- `CreatePost` (`src/components/CreatePost/index.tsx:282-302`) replaces the form with a read-only streaming view and offers no **Cancel** button. The user must wait up to the 120 s `request.timeout`.
- If the stream fails mid-generation, `CreatePost` resets `isStreaming` and drops the accumulated `aiContent`/`reasoning`. Only a generic `Alert.alert` is shown, so the partial answer disappears.
- `handleSubmit` (`src/components/CreatePost/index.tsx:222-276`) creates a post first and then starts the AI stream. If the stream fails and the user taps Send again, a duplicate post is created.
- `PlansDetailScreen` blocks the hardware back button when a report is not finished (`src/screens/PlansDetailScreen/index.tsx:48-61`) but does not stop the stream, so the request keeps running after the user leaves.
- No cleanup on unmount: `CreatePost` can call `setState` on an unmounted component and waste network/LLM work.

### Competitor / pattern research
- **TRUETECH — Mobile AI Streaming with SSE & WebSocket** notes that streaming is now expected, and that robust cancellation needs explicit server signaling plus partial-output persistence.
- **Ably — Stop vs disconnect** explains that client-side abort alone is insufficient; the server may keep generating and billing. A good stop flow needs a dedicated cancel signal, partial snapshot persistence, active stream ID checking, and clearing the stream reference only after confirmed cancellation.
- **DEV Community — Streaming Chat Needs Cancel and Retry States** recommends a state machine (`Draft / Sending / Streaming / Interrupted / Failed / Complete`), accessible transitions, and preserving partial output as data, not garbage.
- **FrontendAtlas — AI Chat Composer and Streaming Turn System Design** recommends stable `commandId`/`streamId` identities, idempotent retry, and keeping drafts separate from the active turn.
- **Sean Kim — Android LLM client architecture in 2026** emphasizes local persistence of the user message before sending, saving partial assistant output if the stream dies, and retrying only text generation (not unsafe side effects).

### Patterns to adopt
1. Make `streamZaiChat` accept an `AbortSignal` and call `request.abort()` when aborted.
2. Store the active abort controller in `CreatePost`, expose a **Cancel** button during streaming, and abort on unmount.
3. Preserve partial `aiContent`/`reasoning` when the stream is cancelled or fails, and show a **Retry / Continue** affordance.
4. Decouple post creation from AI generation: create the post once, then pass `postData` into `runAiStream`. If the stream fails, retry only the stream, avoiding duplicate posts.
5. Replace generic `Alert` with inline error state in the streaming view.
6. Keep the draft saved until the full flow (post + AI comment) succeeds.

---

## Goals

1. Give the user an explicit way to cancel an in-progress AI stream.
2. Never discard a partially generated AI answer on cancel/error.
3. Prevent duplicate posts when retrying a failed AI stream.
4. Clean up the active stream when `CreatePost` unmounts.

---

## Decomposed tasks

### Task 1 — Abortable stream helper
- Update `src/utils/aiStream.ts`:
  - Add optional `signal?: AbortSignal` to `ZaiStreamCallbacks`.
  - Call `request.abort()` when `signal` aborts.
  - Return a clean cancellation error from `onabort` so callers can distinguish cancellation from failure.
  - Track `isAborted` to avoid calling callbacks after abort.

### Task 2 — Active stream state in CreatePost
- Update `src/components/CreatePost/index.tsx`:
  - Add `abortControllerRef` with `useRef`.
  - In `runAiStream`, create an `AbortController` and pass `signal` to `streamZaiChat`.
  - Add `handleCancelStream` that aborts the controller and sets `streamStatus` to `'cancelled'`.
  - Add cleanup `useEffect` that aborts any active controller on unmount.

### Task 3 — Streaming UI with cancel, partial output, and retry
- Update `src/components/CreatePost/index.tsx` streaming view:
  - Add a **Cancel** button (enabled while streaming).
  - Show `aiContent`/`reasoning` as it streams.
  - When status is `cancelled` or `error`, keep showing the partial output and display an inline error message + **Retry** button.
  - Disable the form / Send button while a post is being created or a stream is running.

### Task 4 — Retry without duplicate post
- Update `src/components/CreatePost/index.tsx`:
  - Store `createdPost` in state after `PostStore.createPost` succeeds.
  - `runAiStream` should use the stored `createdPost` if available; `handleSubmit` only creates a post when `createdPost` is absent.
  - On retry, call `runAiStream(reportText, createdPost)` instead of creating a new post.

### Task 5 — Draft lifecycle
- Ensure `@draftReport` is removed only after the full flow (post created + AI comment created) succeeds.
- On cancellation or stream error, keep the draft so the user can retry or edit.

### Task 6 — Localization
- Add keys:
  - `createPost.cancel`
  - `createPost.retry`
  - `createPost.continue`
  - `createPost.cancelled`
  - `createPost.streamError`
- Update all 10 locale files.

### Task 7 — Tests
- Add `src/utils/aiStream.test.ts`:
  - Test abort path: stream stops when `signal` aborts.
  - Test error path: network error rejects.
- Update or add `src/components/CreatePost/index.test.tsx` if it exists; otherwise create a focused test for the streaming states.

### Task 8 — Report and memory
- Write `AUTONOMOUS_UX_LOOP_REPORT_2026-08-08_cycle18.md`.
- Update memory index.

---

## Success criteria

- A Cancel button is visible and functional during AI streaming.
- Partial output is preserved after cancel or error.
- Retry continues AI generation on the same post without creating duplicates.
- Active stream is aborted on unmount.
- Jest: 81+ suites, 349+ tests passing.

---

## Next-cycle options (preview)

- A: Apply the same cancel/retry/draft pattern to `ChatScreen` AI chat messages.
- B: Consolidated Profile/Settings tab with Pro upsell and account tools.
- C: Dice roll stuck-state fix with safe timeout/unmount recovery.
