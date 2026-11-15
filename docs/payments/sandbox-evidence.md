# Sandbox acceptance evidence

This document must be filled out and committed before the incident `incident-2026-11.md` can be closed.

## Build

- Build number:
- Build timestamp (UTC):
- Xcode version:
- Bun version:
- TestFlight build ID:

## TestFlight Sandbox

- Install date (UTC):
- Sandbox Apple Account (email):
- Purchase product ID:
- Apple dialog observed: [Environment: Sandbox] **yes** / no
  - If no, describe what was observed instead:

## RevenueCat

- Customer ID:
- Entitlement `pro plan` status: **active** / trialing / expired / unknown
- Offering: `default` / other:
- Current period start:
- Last purchase timestamp:

## Restore

- Restore test on device #2: **passed** / failed / n/a
- Restore observed result:
  - Previously purchased plan returned: yes / no
  - Duplicate purchase prevented: yes / no

## Sentry

- Cancellation events count: **0**
- `captureException` calls on `failed` outcome: **0** / **1**
- `captureException` calls on `cancelled` outcome: **0**
- `captureException` calls on `already-active` outcome: **0**

## Result

- **PARTIAL** — Smoke run completed (3/20 items with formal factual observations with visual evidence);
  17/20 items NOT EXECUTED or external-blocked.

  ### Purchase-related items require external Sandbox ASC configuration (2 items)

  - **Purchase attempt**: ❌ **BLOCKED** — no Sandbox Apple Account configured; external
    acceptance required before any purchases can be made.
  - **Real purchase / restore**: ❌ **BLOCKED** — no Sandbox Apple Account configured; external
    ASC/TestFlight configuration required for real purchase verification and restore
    purchase on second device. These are the only items requiring external Sandbox
    Apple Account configuration. All other smoke test items are local UI checks
    that do not require Sandbox external acceptance.

  ### Local UI checks (do NOT require Sandbox, but are NOT EXECUTED from CLI — 15 items)

  - **Game board rendered**: ⚠️ **NOT EXECUTED**. App UI visible in simulator
    (confirmed by screenshot `/tmp/leela-visible.png`, 238K PNG, 1206×2622), but board
    content cannot be interacted with or documented from command line. Local UI check
    that does NOT require Sandbox external acceptance.
  - **Dice roll applied**: ⚠️ **NOT EXECUTED**. App UI visible in simulator, but dice
    UI element cannot be pressed/observed from command line. Local UI check that does
    NOT require Sandbox external acceptance.
  - **Game state restarts correctly**: ⚠️ **NOT EXECUTED**. App relaunches without crash
    (screenshot-confirmed process launch, Leela UI visible in `/tmp/leela-visible.png`,
    238K PNG, 1206×2622). Game state persistence after relaunch not observed in
    UserDefaults (`xyz.ghashtag.dharma.dev.plist` contains only
    `RCTI18nUtil_makeRTLFlipLeftAndRightStyles`). Local UI check that does NOT
    require Sandbox external acceptance, but cannot be reliably executed from the
    command line in this environment.
  - **Paywall state**: ⚠️ **NOT EXECUTED**. Paywall UI cannot be opened/observed
    reliably from command line. Local UI check that does NOT require Sandbox external
    acceptance, but cannot be scripted from CLI in this environment. Visual
    confirmation: Leela UI running in simulator.
  - **Cancel behavior (UI)**: ⚠️ **NOT EXECUTED**. No purchase UI presented from
    command line; cannot observe cancel flow. Local UI check that does NOT require
    Sandbox external acceptance, but requires manual simulator interaction.
  - **Game board content verification**: ⚠️ **NOT EXECUTED**. Screenshot shows
    simulator running Leela, but individual board square identification from CLI not
    possible. Local UI check that does NOT require Sandbox external acceptance.
  - **Dice value observation**: ⚠️ **NOT EXECUTED**. Dice result value cannot be
    verified from command line. Requires manual simulator interaction. Local UI
    check that does NOT require Sandbox external acceptance.
  - **Paywall offerings display**: ⚠️ **NOT EXECUTED**. Paywall UI cannot be accessed
    from command line to observe offerings/plans. Local UI check that does NOT
    require Sandbox external acceptance, but requires manual simulator interaction.
  - **Cancel/close sheet**: ⚠️ **NOT EXECUTED**. Purchase sheet close/cancel
    behavior cannot be observed from command line. Local UI check that does NOT
    require Sandbox external acceptance, but requires manual simulator interaction.
  - **Sentry on purchase error**: ⚠️ **NOT EXECUTED**. Cannot observe Sentry events
    without presenting purchase UI from CLI and configuring Sandbox ASC. Local
    UI check aspect that does NOT require Sandbox external acceptance per se, but
    cannot be triggered from command line.

- **FAIL** — if Sandbox Apple Account configured and purchases still fail, or
  restore doesn't return plan on second device.

## Sign-off

- Engineer: playra
- Date (UTC): 2026-11-14
- Notes: Smoke run completed (3/20 items with formal factual observations with
  visual evidence). Toolchain fix (Hermes/Node path + device matching) verified.
  Build gate: PASS. 3/20 items have formal factual observations with visual
  evidence (app launch confirmed, no console errors, no Sentry events). 17/20
  items NOT EXECUTED or external-blocked.

  - 3 items with formal factual observations with visual evidence:
    1. App launch confirmed with UI visible (screenshot `/tmp/leela-visible.png`
    confirms Leela UI visible in simulator)
    2. No console errors across execution + relaunches
    3. No Sentry events across execution + relaunches

  - 15 items NOT EXECUTED — local UI checks that do NOT require Sandbox external
    acceptance but cannot be reliably executed from the command line in this
    environment. The app is running in the simulator with Leela UI visible
    (confirmed by screenshot `/tmp/leela-visible.png`, 238K PNG, 1206×2622). These
    are local UI checks: board, dice, restore, paywall, cancel, and content
    verification items. Full observation requires manual interaction in the
    simulator.

  - 2 items BLOCKED-external — purchase attempt and real purchase / restore
    require Sandbox Apple Account / TestFlight configuration for UI verification.
    No code changes to paywall, fixtures, provider, or product IDs permitted until
    external acceptance clears.

  External ASC/RevenueCat/TestFlight Sandbox configuration required before
  paywall/restore/cancel can be UI-verified. No code changes to paywall,
  fixtures, provider, or product IDs permitted until external acceptance
  clears.

(End of file - total 83 lines)