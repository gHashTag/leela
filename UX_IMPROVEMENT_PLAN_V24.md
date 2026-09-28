# UX Improvement Plan V24 — ChatScreen AI Streaming Reliability

**Date:** 2026-08-08  
**Cycle:** 20  
**Focus area:** AI chat streaming in `ChatScreen`

---

## Research summary

### Weak spots in the current AI chat flow
- `ChatScreen.onSend` (`src/screens/Tabs/ChatScreen/index.tsx:116-258`) starts a `streamZaiChat` call but does not pass an `AbortSignal`, so users cannot cancel an in-progress stream.
- The loading indicator is just an `ActivityIndicator` inside the `LOADING_MESSAGE_ID` bubble (index.tsx:286-296) with no stop/cancel affordance.
- Users can send a new message while a stream is running because `onSend` does not guard against `loading === true`.
- On error, the code shows a native `Alert.alert` (index.tsx:237-242) and removes the loading bubble, but there is no inline retry button for the failed assistant turn.
- Partial output is preserved in `messages` state as it streams, but the conversation is not persisted to storage. A background kill or crash wipes `messages` and `contextSummary` (index.tsx:64-68).
- `onError` callback removes the loading message and calls `setLoading(false)`, but the outer `catch` also shows an alert, so the user gets a modal error even though partial content may exist.

### Competitor / pattern research
- **Ably — Stop vs disconnect**: robust stop needs partial snapshot persistence, active stream ID checking, and clearing the stream reference only after confirmed cancellation.
- **DEV Community — Cancel, Retry, Announce**: explicit state machine (`idle`, `connecting`, `streaming`, `cancelling`, `done`, `cancelled`, `error`), partial output preserved, one-tap retry.
- **Frontend Patterns — Stop Generation**: use `AbortController`, keep already-arrived tokens, mark message `stopped`, offer Regenerate.
- **OnboardJS / Rork Lab**: critical app data should be persisted across lifecycle events; use `AppState` + AsyncStorage to flush and restore state.
- **llmbestpractices.com**: detect truncated streams, mark messages incomplete, offer resume or retry rather than showing a half-sentence as final.

### Patterns to adopt
1. Create an `AbortController` per `onSend` and pass its `signal` to `streamZaiChat`.
2. Render a stop/cancel button inside the loading bubble while streaming.
3. Disable the composer while `loading` to prevent concurrent sends.
4. On failure, replace the loading bubble with an inline error bubble that has a **Retry** button.
5. Persist `messages` (excluding transient loading/error states) and `contextSummary` to AsyncStorage and restore them on mount.
6. Use stable IDs for reasoning/content messages so retries do not duplicate bubbles.

---

## Goals

1. Give the user a way to cancel an in-progress AI stream.
2. Prevent accidental double sends while a stream is running.
3. Offer one-tap inline retry when a stream fails.
4. Preserve the chat session across app backgrounding/crashes.

---

## Decomposed tasks

### Task 1 — Abortable stream in ChatScreen
- Update `src/screens/Tabs/ChatScreen/index.tsx`:
  - Add `abortControllerRef`.
  - In `onSend`, create an `AbortController` and pass `signal` to `streamZaiChat`.
  - On unmount, abort any active controller and clean up.

### Task 2 — Stop button and send lock
- Render a stop/cancel button inside the `LOADING_MESSAGE_ID` bubble while `loading`.
- Wire the button to `abortControllerRef.current?.abort()`.
- Disable `GiftedChat` input while `loading` (`textInputProps={{ editable: !loading }}` or similar).
- Guard `onSend` to return early if `loading` is already true.

### Task 3 — Inline retry on failure
- Add a new message type/bubble for failed assistant turns (e.g., `_id === 'error-message-id'`).
- When the stream errors, remove the loading bubble and show the error bubble with a **Retry** button.
- Tapping Retry re-sends the last user message using the same `apiMessages` context.
- Remove the native `Alert.alert` on stream failure.

### Task 4 — Persist chat session
- Save `messages` (excluding `LOADING_MESSAGE_ID` and `error-message-id`) and `contextSummary` to AsyncStorage whenever they change.
- On mount, load saved messages and context, prepend the initial assistant greeting only if no saved session exists.
- Clear persisted session when the user explicitly starts a new chat or after a configurable inactivity threshold (optional — keep simple: clear on mount if empty).

### Task 5 — Localization
- Add keys:
  - `chat.stop`
  - `chat.retry`
  - `chat.messageFailed`
- Update all 10 locale files.

### Task 6 — Tests
- Add/update `src/screens/Tabs/ChatScreen/index.test.tsx`:
  - renders initial assistant greeting;
  - disables send while loading;
  - shows retry button after a failed stream;
  - persists/restores messages from AsyncStorage.

### Task 7 — Report and memory
- Write `AUTONOMOUS_UX_LOOP_REPORT_2026-08-08_cycle20.md`.
- Update memory index.

---

## Success criteria

- A Cancel/Stop button is visible while the assistant is streaming.
- The composer is disabled while streaming.
- A failed stream shows an inline Retry button instead of a modal alert.
- The chat session survives a background kill / relaunch.
- Jest: 82+ suites, 354+ tests passing.

---

## Next-cycle options (preview)

- A: Consolidated Profile/Settings tab with Pro upsell and account tools.
- B: Onboarding resume-state persistence and clearer progress recovery (polish existing flow).
- C: Push notification permission UX — clearer rationale, retry, and settings deep-link.
