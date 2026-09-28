# UX Improvement Loop Report — Wave 084 / Cycle 38

**Date:** 2026-08-08
**Theme:** Shared scene states + haptic coverage across shared interactive components
**Branch:** leela-ai-streaming-vedic

## 1. Weak spots researched

- **Вкладки профиля без полноценных состояний.** `HistoryScene` не имел empty/error/loading; `ReportsScene`/`BookmarksScene`/`AiAnswersScene` имели только `ListEmptyComponent`, но не обрабатывали ошибку и не давали pull-to-refresh.
- **Гаптика была точечной.** `triggerHaptic` существовал, но использовался только в `Dice`, `ConfirmDialog` и `ErrorBoundary`. `Pressable`, `Button`, `Reactions`, `BookmarkButton` не давали тактильной обратной связи.
- **Нет shared компонента для состояний экрана.** Каждая сцена писала пустые состояния самостоятельно, из-за чего UX был непоследовательным.

## 2. Competitor / pattern research

- **Skeleton vs spinner:** для профиля с известной структурой лучше skeleton, для переменных списков — spinner или состояние. В текущей реализации нет skeleton, но spinner + empty/error с retry уже закрывает базовый UX.
- **Pull-to-refresh:** должен сохранять существующий контент, иметь статус «Refreshing…» и защиту от дублирующихся запросов.
- **Haptics best practices:** частые микровзаимодействия — light/tick, основные действия — medium, ошибки/отмены — warning/heavy. Android/iOS предлагают platform-константы; `react-native-haptic-feedback` даёт cross-platform fallback.

Sources:
- [Mobile App Wiki — Empty/Loading States Guide](https://mobileapp.wiki/en/uiux/empty-loading-states-guide)
- [UX Patterns Guide — Pull to Refresh](https://uxpatternsguide.com/patterns/pull-to-refresh/)
- [The Frontend Casebook — Skeletons vs Spinners](https://anmshpndy.com/cases/skeleton-vs-spinner-choice/)
- [Android Developers — Haptics design principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles)
- [Saropa — 2025 Guide to Haptics](https://saropa.com/articles/2025-guide-to-haptics-enhancing-mobile-ux-with-tactile-feedback)

## 3. Decomposed plan

1. Создать `src/components/SceneStates/index.tsx` — reusable компонент для состояний `loading`, `error`, `empty`, `ready` с retry и pull-to-refresh.
2. Применить `SceneStates` к `ProfileScreen` табам: `HistoryScene`, `ReportsScene`, `BookmarksScene`, `AiAnswersScene`.
3. Обновить `useHistoryData` так, чтобы возвращал `{ data, loading, error, refresh }`, и покрыть тестами.
4. Добавить `triggerHaptic('impactLight')` в общий `Pressable` — автоматически покрыть все интерактивные элементы, использующие этот компонент.
5. Добавить гаптику в `Reactions` (light при снятии, medium при выборе) и `BookmarkButton` (medium при добавлении).
6. Добавить локализацию `sceneStates.*` для `en` и `ru`, плюс `aiAnswers.empty`.
7. Добавить тесты для `SceneStates`, `Pressable`, `useHistoryData`.
8. Запустить полный Jest и убедиться в зелёных.

## 4. What was implemented

- `src/components/SceneStates/index.tsx` + `SceneStates.test.tsx` — shared состояния сцены.
- `src/screens/Tabs/ProfileScreen/Tabs/HistoryScene.tsx` — loading/error/empty + pull-to-refresh.
- `src/screens/Tabs/ProfileScreen/Tabs/ReportsScene.tsx` — error handling + retry + pull-to-refresh.
- `src/screens/Tabs/ProfileScreen/Tabs/BookmarksScene.tsx` — loading/error/empty + pull-to-refresh.
- `src/screens/Tabs/ProfileScreen/Tabs/AiAnswersScene.tsx` — loading/error/empty + pull-to-refresh.
- `src/hooks/useHistoryData.ts` — приведён к форме `{ data, loading, error, refresh }`, добавлен `useHistoryData.test.ts`.
- `src/components/Pressable/index.tsx` + `Pressable.test.tsx` — light haptic на каждом нажатии.
- `src/components/Reactions/index.tsx` — haptic при выборе/снятии реакции.
- `src/components/BookmarkButton/index.tsx` — haptic при добавлении/удалении закладки.
- `src/components/index.ts` — экспорт `SceneStates`.
- `src/locales/en/translation.json` и `src/locales/ru/translation.json` — `sceneStates.*`, `aiAnswers.empty`.

## 5. Verification

```bash
npx jest --runInBand
```

- **67/67 suites passed**
- **267/267 tests passed**
- No new dependencies or native changes.

## 6. Notes

- `SceneStates` оборачивает `FlatList`/`ScrollView` и передаёт `refreshControl` только внутрь контента; в состоянии `error` при наличии `onRefresh` оборачивает fallback в `ScrollView` с `RefreshControl`.
- `Pressable` теперь импортирует `triggerHaptic` через `require` внутри `handlePress`, чтобы избежать циклических зависимостей на старте (haptics → components index).
- Незакоммиченные правки из предыдущих сессий (`src/screens/helper.ts`, `Gem`, `aiStream`, `OnboardingScreen`, `GameScreen`, удаление `TutorialOverlay`) остались в дереве и продолжают проходить тесты.

## 7. Cooperation options for the next loop

1. **Покрыть оставшиеся «голые» экраны состояниями.** Цель: `GameScreen`, `OnlineGameScreen`, `ChatScreen`, `UserProfileScreen`, `PlansScreen`, `RulesScreen` — skeleton/empty/error + pull-to-refresh через `SceneStates`.
2. **Расширить haptic-карту.** Добавить success/warning/error haptics к `Button`, `ButtonSimple`, `ButtonWithIcon`, primary action buttons, form submit; ввести `hapticFeedback` setting в `SettingsScene`.
3. **Полировать auth-флоу.** Видимость пароля, recovery ввода после ошибки, inline validation, явная обработка ошибок `SignUpUsername` / `ConfirmSignUp` и accessible labels для `Input`.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
