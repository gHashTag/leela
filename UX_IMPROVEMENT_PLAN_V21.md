# UX Improvement Plan V21 — Comment Failure Recovery

**Date:** 2026-08-08
**Cycle:** 17
**Focus area:** Comment / reply composition failure recovery

---

## Research summary

### Weak spots
The comment/reply flow in Leela discards user input on failure:

- `INPUT_TEXT_MODAL` navigates back immediately after a successful-looking submit; if `onSubmit` throws, the modal is already gone and the text is lost.
- `DetailPostScreen` adds an optimistic comment, then removes it and shows a generic alert on failure, losing the typed text.
- `CommentCard` and `SubCommentCard` reply/edit actions pass `onSubmit` to `INPUT_TEXT_MODAL` but do not pass `onError`, so failures are swallowed and the modal closes.
- `SubCommentCard` has no visible reply affordance; reply is only reachable through the chevron overflow menu.

### Competitor / pattern research
- **UX Patterns Guide — Comments** defines required states: draft, saving, saved, failed save, retry, discarded draft. Draft text must survive temporary offline state, validation errors, and permission checks.
- **UX Patterns Guide — Error state** recommends keeping failure visible near the affected content, preserving user context, and offering a recovery path (Retry, Edit, etc.).
- **OpenChamber real-world fix** captures a submission snapshot before clearing input and restores it on hard errors.
- **PostHog** moved reply out of the overflow menu to an always-visible icon to improve discoverability.

### Patterns to adopt
1. Keep `INPUT_TEXT_MODAL` open when `onSubmit` fails and show an inline error + Retry button.
2. Preserve typed text in the composer on failure.
3. Pass `onError` from all comment/reply/edit callers so failures propagate.
4. Add a visible reply button to `SubCommentCard`.
5. Localize the comment placeholder (`online-part.uComment` already exists but the Input placeholder uses it).

---

## Goals

1. Never lose a user's typed comment on network or server failure.
2. Make retry a one-tap action inside the composer.
3. Improve reply discoverability on threaded comments.
4. Add test coverage for the comment failure path.

---

## Decomposed tasks

### Task 1 — InputTextModal failure state
- Update `src/screens/Modals/InputTextModal/index.tsx`:
  - Track `submitting` and `error` states.
  - On submit, call `onSubmit(text)` and only navigate back on success.
  - If `onSubmit` throws, keep the modal open, set `error` state, and show a Retry button.
  - Disable the input/send button while `submitting`.

### Task 2 — Propagate errors from callers
- Update `src/screens/DetailPostScreen/index.tsx`:
  - Pass `onError` to `INPUT_TEXT_MODAL`.
  - Do not remove the optimistic comment until success; on failure, keep the optimistic comment marked `pending` and let the modal handle retry.
  - Actually, simpler: let the modal keep the text and do not add optimistic comment until success, or remove optimistic only on success. Use pessimistic submit in the modal; caller can still do optimistic UI separately.
- Update `src/components/Cards/CommentCard/ModalActions.ts` and `src/components/Cards/SubCommentCard/ModalActions.ts`:
  - Make `onSubmit` async and let errors propagate (do not swallow).
  - Optionally pass `onError` for logging.

### Task 3 — SubCommentCard reply affordance
- Update `src/components/Cards/SubCommentCard/index.tsx`:
  - Add a visible reply button/icon next to the existing actions (or below the body).
  - Tapping it opens `INPUT_TEXT_MODAL` with the reply-thread initial text.

### Task 4 — Localization
- Add/reuse keys:
  - `inputTextModal.send` / `inputTextModal.retry`
  - `inputTextModal.error`
  - Ensure `online-part.uComment` is used as placeholder.

### Task 5 — Tests
- Create `src/screens/Modals/InputTextModal/index.test.tsx`:
  - Renders input.
  - Calls `onSubmit` with typed text.
  - Stays open and shows retry when submit fails.
  - Navigates back on success.
- Update or create tests for `DetailPostScreen` comment flow if feasible.

### Task 6 — Report
- Write `AUTONOMOUS_UX_LOOP_REPORT_2026-08-08_cycle17.md`.

---

## Success criteria

- Typed comment text survives a failed submit.
- Retry button appears inline when submission fails.
- SubCommentCard has a visible reply affordance.
- Jest: 79+ suites, 341+ tests passing.

---

## Next-cycle options (preview)

- A: AI report streaming cancel/retry + draft preservation.
- B: Consolidated Profile/Settings tab with Pro upsell and account tools.
- C: Dice roll stuck-state fix with safe timeout/unmount recovery.
