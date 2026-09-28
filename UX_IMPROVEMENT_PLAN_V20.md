# UX Improvement Plan V20 — Value-First Auth Gate

**Date:** 2026-08-08
**Cycle:** 16
**Focus area:** Hello auth screen / post-onboarding value gate

---

## Research summary

### Weak spots
Immediately after the 9-step onboarding, `HELLO` presents only a logo, legal links, and two equally-weighted "Sign In" / "Sign Up" buttons. There is no:

- social proof
- preview of online benefits (community, AI guide, progress sync)
- recovery cue for existing accounts
- explanation of why creating an account is worth the friction

`WelcomeScreen` forces a binary "play online vs offline" choice with no context.

### Competitor / pattern research
- **Duolingo** delivers a full first lesson before asking to "Save your progress".
- **Headspace / Calm** lead with a first guided session, then ask for account creation.
- **Course Hero** added "10M+ student community" social proof and "free account" emphasis for a **+19.0% conversion lift**.
- **2024 fintech onboarding analysis** recommends a Preview → Gate → Bridge flow: show value before auth, make auth transparent, then bridge to a first meaningful action.

### Patterns to adopt
1. Add a value-preview card at the top of `Hello` showing 3 benefits (community reports, AI guide, progress sync).
2. Add a credible social-proof line ("Loved by 10K+ players" / existing trust line already in app).
3. Make "Sign Up" the primary CTA and "Sign In" a secondary text link.
4. Keep "Play offline" as a low-friction escape hatch at the bottom.
5. Update `WelcomeScreen` to explain what "online" means instead of a cold binary choice.
6. Add tests for both screens.

---

## Goals

1. Reduce drop-off between onboarding and first value.
2. Increase sign-up starts by framing online play as valuable, not mandatory.
3. Keep offline play clearly available for users who want to skip registration.
4. Add test coverage to the auth gate.

---

## Decomposed tasks

### Task 1 — Hello screen value preview
- Update `src/screens/Authenticator/Hello/index.tsx`:
  - Add a `ValuePreview` section with 3 benefit rows (icon + title + body).
  - Add social-proof line using the existing `subscriptionTrust` copy.
  - Reorder CTAs: primary "Continue with email" (Sign Up), secondary "Already have an account? Sign in".
  - Move legal/version links into a compact footer.
  - Keep "Play offline" as a subtle bottom link.

### Task 2 — WelcomeScreen education
- Update `src/screens/WelcomeScreen/index.tsx`:
  - Add a short subtitle explaining online vs offline.
  - Change primary CTA to "Play online" with explanation, keep "Play offline without account".

### Task 3 — Localization
- Add keys to `src/locales/en/translation.json` and `src/locales/ru/translation.json`:
  - `auth.valueTitle`
  - `auth.valueCommunityTitle` / `auth.valueCommunityBody`
  - `auth.valueAiTitle` / `auth.valueAiBody`
  - `auth.valueSyncTitle` / `auth.valueSyncBody`
  - `auth.continueWithEmail`
  - `auth.alreadyHaveAccount`
  - `auth.playOffline`
  - `welcome.subtitle`
  - `welcome.onlineDescription`
  - `welcome.offlineDescription`

### Task 4 — Tests
- Create `src/screens/Authenticator/Hello/index.test.tsx`:
  - Renders value preview.
  - Sign Up button navigates to `SIGN_UP`.
  - Sign In link navigates to `SIGN_IN`.
  - Play offline navigates to `SELECT_PLAYERS_SCREEN`.
- Update `src/screens/WelcomeScreen/index.test.tsx` if it exists, or create it.

### Task 5 — Report
- Write `AUTONOMOUS_UX_LOOP_REPORT_2026-08-08_cycle16.md`.

---

## Success criteria

- `Hello` shows a value preview and social proof before asking for auth.
- Primary action is "Continue with email" (Sign Up); sign-in is secondary.
- Offline play remains reachable without account creation.
- Jest: 77+ suites, 334+ tests passing.

---

## Next-cycle options (preview)

- A: Interactive onboarding mini-game (guided first throw + first report).
- B: Comment/reply composition failure recovery (preserve draft, inline retry).
- C: AI report streaming cancel/retry + better failure recovery.
