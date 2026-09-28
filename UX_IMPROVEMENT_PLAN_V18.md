# UX Improvement Plan V18 — Onboarding Engagement

**Date:** 2026-08-08
**Cycle:** 14
**Focus area:** First-run onboarding

---

## Research summary

### Weak spots
The onboarding screen is a 9-step static slideshow. Users must tap "Next" nine times with no way to swipe, go back, or skip efficiently. This creates first-session friction before the user ever rolls the die.

### Competitor / pattern research
- **Nielsen Norman Group** recommends keeping deck-of-cards onboarding minimal, one concept per card, with a visible Skip option. Interactive walkthroughs outperform static slideshows.
- **Appcues 2024 guide** emphasizes progress bars/checklists to gamify onboarding and communicate value fast.
- **Android Developers** recommend steppers/pagers, progress indicators, and resume-later options.
- **UXmatters 2024 framework** recommends interactive tutorials for products with steep learning curves (Leela qualifies).

### Patterns to adopt
1. Swipeable horizontal pager for the rule cards.
2. Visible progress ("3 / 9") + stronger active indicator.
3. Back button so users can re-read a rule.
4. Skip always available.
5. Final step CTA renamed to a clear completion action.
6. Persist step index so resuming later returns to the same place.

---

## Goals

1. Reduce perceived onboarding length by letting users swipe naturally.
2. Improve comprehension by allowing backward navigation.
3. Motivate completion with a visible progress indicator.
4. Respect user agency with persistent Skip and optional resume.
5. Keep all existing copy and localization keys.

---

## Decomposed tasks

### Task 1 — Onboarding pager rewrite
- Update `src/screens/OnboardingScreen/index.tsx`:
  - Replace single card with horizontal `ScrollView` `pagingEnabled` containing all 9 cards.
  - Track current page from scroll position and from explicit Next/Back buttons.
  - Add Back button when not on first page.
  - Add visible progress text (`1 / 9`).
  - Keep Skip available on every page.
  - Persist current step in AsyncStorage (`@onboardingStep`) so returning users resume.
  - On completion, set `@onboardingComplete` and navigate to HELLO.

### Task 2 — Navigation resume
- When the onboarding screen mounts, load `@onboardingStep` and jump to that index if onboarding is not complete.

### Task 3 — Localization
- Add keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `onboarding.progress` (e.g., "{{current}} / {{total}}")
  - `onboarding.back`
  - `onboarding.skip`
  - Keep existing `onboarding.next`, `onboarding.start`, and all `step*Title/Body`.

### Task 4 — Tests
- Update/create `src/screens/OnboardingScreen/index.test.tsx`:
  - Renders all 9 cards.
  - Next/Back buttons update progress.
  - Swipe/scroll updates progress.
  - Skip calls completeOnboarding.
  - Start on last step completes and navigates.

### Task 5 — Report
- Write `AUTONOMOUS_UX_LOOP_REPORT_2026-08-08_cycle14.md`.

---

## Success criteria

- Onboarding cards are swipeable left/right.
- Progress label shows "3 / 9" style indicator.
- Back button appears from step 2 onward.
- Skip is always visible.
- Returning user resumes at last seen step (within the same install).
- Jest: 75+ suites, 320+ tests passing.

---

## Next-cycle options (preview)

- A: Add an interactive onboarding mini-game (tap-to-roll demo, guided first throw) instead of static rules.
- B: Reduce the 9-step slideshow to 4 high-impact cards with progressive tooltips inside the first real game.
- C: Add social proof / value preview before the onboarding rules (e.g., "10K+ players today" card).
