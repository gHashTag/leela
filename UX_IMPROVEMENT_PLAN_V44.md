# UX Improvement Plan V44 — wave 090

## Goal
Polish the **community feed and AI chat** experiences: remove dead-end empty states, make engagement actions (like, comment, bookmark, share) more responsive and accessible, and add contextual starter prompts to the AI chat so first-time users know what to ask.

## Weak points found

1. **ChatScreen empty start.** After the single welcome message there is no guidance on what Leela AI can do; the composer is blank and intimidating for a new user.
2. **No starter prompts in AI chat.** Users must type from scratch; there are no single-tap suggestions like "Explain plane 6" or "What does my current position mean?".
3. **PostScreen empty state is already decent but lacks personalization.** It shows a lotus icon and a generic CTA; it does not adapt to whether the user has no reports because they never played or because they are filtering to "my posts".
4. **Engagement actions lack consistent feedback.** `PostCard` and `CommentCard` have like/bookmark/comment buttons but not all of them trigger haptics, and not all have clear accessibility labels.
5. **DetailPostScreen comment flow is modal-heavy.** Adding a comment requires navigating to `INPUT_TEXT_MODAL`, which breaks context and feels heavy for a quick reply.
6. **Feed filter has no active-state haptics.** Switching between "newest", "most discussed", and "my posts" gives no tactile feedback.
7. **AI answer copy action is hidden in long-press menu.** There is no visible copy affordance on assistant messages; users must discover it.

## Competitor patterns applied

- **Koder Design / AuditBuffet AI chat empty state:** branded welcome + 3–4 starter prompt chips that pre-fill (but do not auto-send) the composer.
- **Stream chat UX guide:** seed the first experience; inline onboarding beats modal tours.
- **Bluesky / HiveSnaps:** haptic feedback on engagement buttons, optimistic UI updates, accessibility roles on images/buttons.
- **Twitter/X thread design:** clear hook/body/payoff structure; design for skimming with bullets and line breaks.

## Decomposed plan

### 1. AI chat starter prompts
- Add a `ChatStarterPrompts` component that renders 3–4 chips above the composer on `ChatScreen` when there is only the welcome message.
- Chips pre-fill the composer with suggested prompts (localized):
  - "Explain my current plane"
  - "How do arrows and snakes work?"
  - "Give me a daily intention"
  - "What is the goal of Leela?"
- Tapping a chip fills the input but does **not** auto-send; the user reviews and sends.
- Add haptic feedback on chip tap.
- Hide chips after the first user message is sent.

### 2. AI chat empty-state welcome block
- Replace the bare welcome bubble with a centered welcome block:
  - AI avatar + greeting: "Ask Leela about the board, your plane, or a daily step."
  - Optional: small hint "Your conversations stay private to this device."
- Keep the welcome message in the list, but render the starter prompts below it.

### 3. PostScreen empty-state personalization
- Detect the selected filter and show tailored empty copy:
  - `newest` / `mostDiscussed`: "Be the first to share a reflection."
  - `myPosts`: "You haven't shared a report yet. Play a game and your reflection can appear here."
- Keep the existing icon and CTA but make the headline/hint dynamic.

### 4. Consistent engagement haptics and accessibility
- Audit `PostCard`, `CommentCard`, `SubCommentCard`, `BookmarkButton`, `Reactions`:
  - Ensure every primary engagement action triggers a light/medium haptic.
  - Ensure every icon button has an `accessibilityLabel` and `accessibilityRole="button"`.
  - Ensure pressed states use `triggerHaptic` where missing.
- Add a visible copy button on assistant chat bubbles (next to citations or below the bubble).

### 5. Inline comment composer on DetailPostScreen
- Add a lightweight `InlineCommentInput` to `DetailPostScreen` that appears at the bottom of the screen.
- It uses the same `INPUT_TEXT_MODAL` logic but stays in context.
- Existing comment cards keep their action-sheet flows; this is an additional quick-reply path.

### 6. Feed filter haptics
- Add `triggerHaptic('impactLight')` inside `FeedFilter` when a chip is selected.

### 7. Localization
- Add English keys for starter prompts, personalized empty feed copy, and inline comment placeholder.
- Add Russian translations.

### 8. Tests
- Add `ChatStarterPrompts.test.tsx` covering chip rendering and pre-fill behavior.
- Add/extend `FeedFilter.test.tsx` to assert haptic trigger.
- Add/extend `PostScreen.test.tsx` to assert dynamic empty-state copy.
- Keep full suite green.

## Acceptance criteria
- ChatScreen shows starter prompt chips before the first user message.
- Tapping a chip fills the composer without sending.
- PostScreen empty copy adapts to the active feed filter.
- All primary engagement buttons in cards trigger haptics and have accessibility labels.
- FeedFilter chips trigger haptic feedback.
- Inline comment input is available on DetailPostScreen.
- All new copy localized in en/ru.
- Full test suite passes; no regressions.
