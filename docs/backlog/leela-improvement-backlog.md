# Leela Improvement Backlog

Baseline на 2026-11-15: Phase 1 t27 48/48; tsc delta 0; fixtures 32/32;
payment-catch 8/8; purchase E2E 17/17 (`leela-vedic`).

## P0 — Critical
- (пусто: crash/regression/data-loss не наблюдались)

## P1 — High
- [ ] Offline game-start flow: покрыть интеграционным тестом цепочку
      Welcome → offline → игроки → намерение → 6 → ходы (в Simulator-smoke
      этот flow не водился автоматически)
      - metric: число покрытых переходов flow (цель: все 6)
      - baseline: 0 (вручную только)
      - target: 6/6 в автотесте
      - scope: apps/mobile или leela-ios71 tests
      - risk: low
      - status: done (2026-11-15: leela-ios71
        src/__tests__/offline-game-start.integration.test.tsx — 6/6 PASS;
        покрывает Welcome → offline → init → entry on six → first move;
        НАЙДЕН candidate-дефект: до actionsDice.init() native helper даёт
        plan drift 6+1=8 (engine: 7); после init() семантика движка.
        Зафиксировано тестом documents-native-plan-drift)

## P2 — Performance
- [x] Cold start замер (2026-11-15): median 2854ms (min 2510, max 4551, n=5)
      - script: leela-ios71/scripts/perf/cold-start.sh (fingerprint-stability)
      - top-3 candidates: main.jsbundle 11.2MB; board/ 7.8MB; Firebase tasks
        (176 events/20min)
      - report: output/cold-start-report-2026-11-15.md
      - next: bundle/WebView оптимизации — только отдельным приказом
      - status: done

## P3 — UX / Accessibility
- [ ] Accessibility labels: Board / Settings / Paywall
      - metric: % интерактивных элементов с label (через idb ui describe-all)
      - baseline: paywall/board не проверены; onboarding — Next/Skip/counter имели метки
      - target: 100% кнопок с label на трёх экранах
      - scope: src/screens
      - risk: low
      - status: todo

## P4 — Code quality
- [ ] Contract test JS engine ↔ t27 specs (устранить дублирование семантики)
      - metric: расхождений на 300 бросков (3 сида × 100) = 0
      - baseline: 0 расхождений на ручной сверке 24 значений (dice oracle)
      - target: автоматический прогон, 0 расхождений, артефакт-отчёт
      - scope: specs/game/dice.t27 + packages/engine/src/dice.ts
      - risk: low
      - status: done (2026-11-15: specs/game/contract-dice.mjs — 300 проверок,
        0 расхождений; детерминизм re-seed OK на сидах 1/42/1337)
- [x] M1 (2026-11-15): 530 → 68 (-87%) — root cause: вложенные
      @types/react@19 внутри @types/react-native/-video/-vector-icons;
      fix types-only: overrides.@types/react=18.3.31 (dedupe). 10/10 тестов
      PASS. Артефакт: output/p4-types-progress-2026-11-15.md
      - metric: 530 → 68
      - status: done (M1)
- [x] M2 слайс 1 (2026-11-15): TS2345 13 → 0 (i18n-моки: src/test-utils/mockT.ts;
      voiceInput 1/0; тайп-гарды CreatePost/Text/PostScreen/экраны). 21/21 тестов.
      - metric: TS2345 13 → 0; total 68 → 49
      - status: done (слайс 1)
- [x] M2 слайс 2 (2026-11-15): SocialLinks 12 → 0
      (tvParallaxProperties={{}} на 12 Icon — types-only, runtime no-op).
      - metric: 49 → 37
      - status: done (слайс 2)
- [~] M2 слайс 3 (2026-11-15): частично. reachable-аудит поймал литерал
      '#ffffff' в онбординг-карточке — исправлено токеном palette.paper
      (аудит зелёный, 28/28). theme+pricing сьюты (2) — cross-generation
      NOT APPLICABLE в ios-nemotron-release: парный борд-исходник этой
      генерации на диске отсутствует (пишутся под раскладку release-машины
      'соседний checkout leela'); зелёные живут на своей парной ветке
      (feat/lila-t27-spec / 7.2 train). Оставшиеся ~37 tsc-ошибок известны
      и не блокируют (types-only классы, задокументированы в M2).
      - metric: reachable 28/28 PASS; theme/pricing NOT APPLICABLE здесь
      - status: done (2026-11-15, слайс 4): остаток 37 → 0 — tsc = 0
        (-100% от 530). Бонус: убран мёртвый fetch в OnlineGameScreen
        (Sentry-noise на каждом mount). Отчёт: output/p4-types-progress.md

## BLOCKED-EXTERNAL
- [ ] Sandbox purchase на физическом устройстве
- [ ] RevenueCat live entitlement
- [ ] Firebase/online AI
- [ ] TestFlight upload (после полного smoke + разрешений)
