# UX Improvement Loop Report — Wave 086 / Cycle 40

**Date:** 2026-08-08
**Theme:** OfflineProfileScreen polish — empty states, filtered history, and destructive-action confirmations
**Branch:** leela-ai-streaming-vedic

## 1. Weak spots researched

- **`OfflineProfileScreen` был самым «голым» экраном.** Новый или офлайн-пользователь видел пустой фон с плавающими кнопками `Start Over` и `Sign Out`, без пояснений.
- **Деструктивные действия выполнялись мгновенно.** `Start Over` и `Sign Out` на `OfflineProfileScreen` не требовали подтверждения, хотя в основном профиле (`ProfileScreen`) те же действия уже были защищены `ConfirmDialog`.
- **`useHistoryData` возвращал пустые секции.** Для офлайн-игры в список попадали все слоты игроков (`Player 1`…`Player 6`) в пределах `DiceStore.multi`, даже если у них не было истории.
- **Предыдущий цикл оставил `IntentionPrompt.test.tsx` неактуальным.** Компонент возвращает `null` при сохранённой намерении, а тест ожидал отображение карточки с намерением.

## 2. Competitor / pattern research

- **Offline — это нормальное состояние, не ошибка.** web.dev рекомендует показывать кешированные данные, не обвинять пользователя и давать понятный CTA.
- **Empty state должна объяснять что, почему и что делать дальше.** NN/g: пустой экран без пояснений вызывает ощущение сломанного приложения.
- **Sign out всегда требует подтверждения.** web.dev: подтверждение предотвращает случайные тапы и позволяет очистить локальную сессию.
- **Mobile profile:** аватар/имя, активность, настройки и sign-out — группировать, CTAs full-width, touch targets ≥44×44 pt.

Sources:
- [web.dev — Offline UX design guidelines](https://web.dev/articles/offline-ux-design-guidelines)
- [NN/g — Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)
- [web.dev — Sign-out best practices](https://web.dev/articles/sign-out-best-practices)
- [UX Patterns for Developers — User Profile](https://uxpatterns.dev/patterns/authentication/user-profile)

## 3. Decomposed plan

1. Обновить `useHistoryData.ts` — фильтровать пустые офлайн-секции (`Player N` без истории).
2. Покрыть `useHistoryData.test.ts` новым кейсом на фильтрацию пустых секций.
3. Переписать `OfflineProfileScreen/index.tsx`:
   - использовать новую форму `useHistoryData` (`{ data, loading, error }`);
   - показывать empty state с иконкой `EmptyComments`, заголовком и сообщением;
   - показывать inline-ошибку;
   - оборачивать `Start Over` и `Sign Out` в `ConfirmDialog`;
   - заменить обычные `Button` на `LoadingButton` с индикатором загрузки.
4. Добавить ключи `offlineProfile.emptyTitle` и `offlineProfile.emptyMessage` в `en` и `ru` локали.
5. Исправить `IntentionPrompt.test.tsx` в соответствии с текущим поведением компонента.
6. Запустить полный Jest suite.

## 4. What was implemented

- `src/hooks/useHistoryData.ts` — фильтрация пустых офлайн-секций; для онлайн-истории возвращается массив как раньше.
- `src/hooks/useHistoryData.test.ts` — новый тест «filters out empty offline sections».
- `src/screens/Tabs/OfflineProfileScreen/index.tsx` — empty state, inline error, `ConfirmDialog` для `Start Over`/`Sign Out`, `LoadingButton`, haptic warning перед подтверждением.
- `src/locales/en/translation.json` и `src/locales/ru/translation.json` — `offlineProfile.*` строки.
- `src/components/IntentionPrompt/IntentionPrompt.test.tsx` — тест приведён в соответствие с поведением компонента (возврат `null` при сохранённом намерении).

## 5. Verification

```bash
npx jest --runInBand
```

- **68/68 suites passed**
- **273/273 tests passed**
- No new dependencies or native changes.

## 6. Notes

- `OfflineProfileScreen` теперь использует тот же `ConfirmDialog`, что и основной профиль (`ProfileScreen`), поэтому UX согласован.
- `useHistoryData` фильтрует пустые секции только для офлайн-режима, потому что онлайн-история — это плоский список шагов.
- `LoadingButton` из cycle 39 повторно использован, что укрепляет консистентность форм.

## 7. Cooperation options for the next loop

1. **Подтверждения destructive/admin действий в ленте.** Применить `ConfirmDialog` к удалению постов/комментариев, бану/разбану и массовым удалениям в `PostCard/CommentCard` `ModalActions`.
2. **Optimistic UI rollback.** Добавить rollback для лайков, реакций, закладок, AI-фидбека и комментариев при ошибке запроса.
3. **SceneStates для оставшихся экранов.** Покрыть `GameScreen`, `OnlineGameScreen`, `ChatScreen`, `UserProfileScreen`, `PlansScreen`, `RulesScreen` состояниями loading/error/empty + pull-to-refresh.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
