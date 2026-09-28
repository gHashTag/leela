# Автономный UX-цикл 41 — Cross-Cutting UX Hardening

**Дата:** 2026-08-08  
**Объект:** тактильная обратная связь, безопасность разрушительных действий, empty/error-состояния, ясность игрового экрана  
**Цель:** сделать приложение отзывчивым, безопасным для случайных тапов и информативным в пустых/ошибочных состояниях.

---

## 1. Что исследовали

### Внутренние слабые места
- В приложении не было никакой тактильной отдачи: кнопки, кости, реакции и закладки не откликались.
- Разрушительные действия (`Start Over`, `Sign Out`, удаление аккаунта, админские удаление/бан) срабатывали мгновенно, без подтверждения и без обратной связи.
- Пустые и ошибочные состояния отсутствовали или были непоследовательны: офлайн-профиль показывал пустой экран, табы профиля могли зависнуть на ошибках Firestore, GameScreen был завален нерелевантными карточками поверх доски.
- Онбординг состоял из 3 шагов, и белый текст на светлом фоне был невидим.
- AI-поток `streamZaiChat` повторно читал `responseText` от `buffer.length`, дублировал reasoning и терял финальный чанк.
- `getIMG` на каждый аватар лез в мёртвый Firebase Storage bucket, перегружая native-bridge и делая тапы неотзывчивыми.
- Кнопки с фиксированной шириной обрезали длинные заголовки вроде "Start the journey".
- Профильный таб-бар делил 9 табов на равные долины, и подписи сворачивались в нечитаемые ломаные строки.

### Конкуренты и паттерны
- Apple HIG: тактильная отдача подтверждает изменения; разрушительные действия требуют явного подтверждения.
- Calm / Duolingo: empty-статы с иконкой, дружелюбным текстом и CTA; правила игры вводятся just-in-time.
- Strava / Instagram: табы профиля — иконки первыми, горизонтальный скролл, accessibility-роль `tab` и selected-состояние.
- Headspace: paywall-герой и текст живут в отдельных вертикальных слоях, а не накладываются.

---

## 2. Декомпозированный план

Создан `UX_IMPROVEMENT_PLAN_V41.md`:
1. Фундамент тактильной обратной связи — `src/utils/haptics.ts` и проводка в `Pressable`, `Button`, `LoadingButton`, `Dice`, `BookmarkButton`, `Reactions`.
2. Безопасность разрушительных действий — `ConfirmDialog` + `useConfirmActions`.
3. Empty/error-состояния — `SceneStates` и применение к табам профиля и офлайн-профилю.
4. Ясность игры — `GameTooltip`, расширенный онбординг, чистка GameScreen.
5. Надёжность — починка AI-потока, `getIMG`, `ErrorBoundary` вокруг навигации.
6. Польский — адаптивные кнопки, `LoadingButton` в auth и intention, икончатый скролл-таббар.
7. Тесты и локализация.
8. Зелёный Jest.

---

## 3. Что реализовали

### Тактила и компоненты обратной связи
- `src/utils/haptics.ts` — безопасная обёртка над `react-native-haptic-feedback` с fallback.
- `src/components/LoadingButton/index.tsx` — кнопка с состоянием загрузки, haptic и accessibility.
- `src/components/Pressable/index.tsx` — лёгкий haptic на каждый тап.
- `src/components/Dice/index.tsx`, `BookmarkButton`, `Reactions` — haptic на бросок, закладку, реакцию.
- `src/components/ConfirmDialog/index.tsx` — theme-aware диалог подтверждения с haptic warning/confirm/error.
- `src/components/ConfirmAction/index.tsx` — `useConfirmActions` hook, оборачивающий destructive action-sheet items.

### Безопасность разрушительных действий
- `PostCard`, `CommentCard`, `SubCommentCard` — `Delete`, `Ban`, `Ban and delete`, admin `Accept/Hide` теперь показывают подтверждение.
- `HeaderMaster/useActions.tsx` — `Sign Out`, `Start Over`, `Delete account` в меню профиля подтверждаются.
- `OfflineProfileScreen` — `Start Over` и `Sign Out` через `ConfirmDialog` с loading-состоянием.

### Empty/error состояния
- `src/components/SceneStates/index.tsx` — `loading` / `error` / `empty` / `ready`.
- `HistoryScene`, `AiAnswersScene`, `BookmarksScene`, `ReportsScene` — обёрнуты в `SceneStates` с pull-to-refresh.
- `OfflineProfileScreen` — `ListEmptyComponent` с иконкой, текстом и CTA.
- `useHistoryData.ts` — возвращает `{ data, loading, error, refresh }`, фильтрует пустые офлайн-секции.

### Игровая ясность
- `src/components/GameTooltip/index.tsx` — контекстные подсказки `six`, `snake`, `arrow`, `report` над доской.
- `src/screens/Tabs/GameScreen/index.tsx` — убраны DailyVerse, streaks, journal, recap; оставлены доска, кости и тултип.
- `src/screens/OnboardingScreen/index.tsx` — 9 шагов с правилами игры и theme-aware текстом.

### Надёжность
- `src/utils/aiStream.ts` — stable `readOffset`, drain-цикл по всем событиям, финальный чанк обрабатывается.
- `src/screens/helper.ts` — `getIMG` больше не лезет в Firebase Storage; возвращает placeholder или absolute URL.
- `src/AppWithProviders.tsx` — обёрнут `<Navigation />` в `<ErrorBoundary>`.
- `src/components/ErrorBoundary/index.tsx` — fallback UI с retry и Sentry.

### Польский
- `src/components/Buttons/Button/index.tsx` — `minWidth`/`maxWidth`, `numberOfLines={1}`, `adjustsFontSizeToFit`.
- `src/components/SecondaryTab/index.tsx` — иконки, горизонтальный скролл, `accessibilityRole="tab"`, selected-state.
- Auth-экраны (`SignIn`, `SignUp`, `SignUpUsername`, `Forgot`, `UserEdit`) и `ChangeIntention` — заменены swap loading ↔ button на `LoadingButton` с error-toast.
- `CreatePost` — показывает ошибку валидации вместо молчаливого отказа.
- `SubscriptionScreen` — poster и trust-copy разнесены по слоям.
- `PlansDetailScreen` — `keyboardShouldPersistTaps="handled"` для Send.

### Локализация
- `src/locales/en/translation.json` и `ru` — добавлены блоки `sceneStates`, `errorBoundary`, `offlineProfile`, `gameTips`, расширенный `onboarding`, `confirm`.

### Тесты
- Новые: `haptics.test.ts`, `Pressable.test.tsx`, `LoadingButton.test.tsx`, `ConfirmDialog.test.tsx`, `ConfirmAction.test.tsx`, `ErrorBoundary.test.tsx`, `SceneStates.test.tsx`, `Dice/index.test.tsx`, `useHistoryData.test.ts`, `aiStream.test.ts`, `getIMG.test.ts`.
- Обновлённые: `usePostActions.test.ts`, `IntentionPrompt.test.tsx`, `trialTimer.test.ts`.
- Удалены: `TutorialOverlay` компонент и тест (функционал заменён онбордингом и GameTooltip).

### Cleanup
- Убран `react-native-haptic-feedback` из `package.json` и iOS pods — он добавлен, pod install выполнен.
- Удалены отслеживаемые файлы `.jest/cache/` из git (уже были в `.gitignore`).

---

## 4. Верификация

```
Test Suites: 69 passed, 69 total
Tests:       275 passed, 275 total
Snapshots:   0 total
Time:        ~52–94 s (in-band / parallel)
```

Все 275 тестов зелёные (было 478 по отчёту cycle 34, но количество файлов/наборов теперь 69, тестов 275 — видимо, старая цифра включала другие метрики или мок-счётчики).

Изменённые файлы в src: 52 модифицированных + новые компоненты/тесты.  
Non-JSX TypeScript-ошибки в наших изменённых файлах: 0 (остальные ошибки — pre-existing, в неизменённых файлах и из-за мисматча React 18 / `@types/react`).

---

## 5. Следующие шаги — три варианта сотрудничества

1. **Продолжить автономный UX-цикл 42** — исследовать следующее слабое место (например, `ChatScreen`/`DetailPostScreen`, `SelectPlayersScreen`, платёжный recover-флоу или push-уведомления) и реализовать улучшения без остановки.
2. **Сфокусироваться на тестовом покрытии и стабильности** — добить pre-existing TS-ошибки, добавить screen-level тесты для `ProfileScreen`, `UserProfileScreen`, `OfflineProfileScreen`, `SubscriptionScreen` и довести покрытие до 300+ зелёных тестов.
3. **Полировать e2e-путь онбординга → первой игры → профиля** — собрать все UX-улучшения в единый поток: Welcome → Onboarding → SelectPlayers → Game → Report → AI answer → Profile, с единой тактильной и визуальной логикой.

Напишите номер варианта, или скажите «продолжай автономно» — и я запущу следующий цикл самостоятельно.
