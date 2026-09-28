# UX Improvement Loop Report — Wave 085 / Cycle 39

**Date:** 2026-08-08
**Theme:** Form resilience — non-blocking loading states, preserved input, and inline error recovery
**Branch:** leela-ai-streaming-vedic

## 1. Weak spots researched

- **Формы скрываются за `<Loading />` во время отправки.** Шесть экранов (`SignIn`, `SignUp`, `Forgot`, `SignUpUsername`, `UserEdit`, `ChangeIntention`) заменяли всю форму на спиннер, убирая клавиатуру и введённый текст из контекста.
- **Потеря ввода при ошибках.** Если сетевая или Firebase ошибка случалась во время submit, форма пропадала, пользователь не видел, что именно отправлял.
- **Отсутствие inline recovery.** `SignUpUsername`, `UserEdit` и `ChangeIntention` не показывали ошибку сохранения; `SignIn`/`SignUp`/`Forgot` уже имели текст ошибки, но прятали форму под спиннером.

## 2. Competitor / pattern research

- **Mobile form best practices 2024:** форма должна оставаться видимой во время submit; submit-кнопка меняется на «Sending…» + spinner; ввод не сбрасывается при ошибке; ошибки показываются inline / summary с `aria-live`.
- **Adrian Roselli:** не отключать submit до попытки пользователя; разрешено отключать только во время реальной отправки, но при этом состояние загрузки должно быть явным.
- **FormCraft / StaticForms:** preserve input after failure, focus на первое невалидное поле, global banner только для системных ошибок.

Sources:
- [Mobile Form Design: Patterns That Maximize Completion](https://www.formcreatorai.com/mobile-form-design-patterns-maximize-completion)
- [Forms — UI Craft docs](https://skills.smoothui.dev/docs/forms)
- [Effective Form Error Messages: UX & Accessibility Guide](https://www.staticforms.dev/blog/form-error-messages)
- [Don’t Disable Form Controls — Adrian Roselli](https://adrianroselli.com/2024/02/dont-disable-form-controls.html)

## 3. Decomposed plan

1. Создать `src/components/LoadingButton/index.tsx` — кнопку с индикатором загрузки внутри, disabled-статусом и haptic feedback.
2. Заменить `<Button />` на `<LoadingButton loading={loading} />` в `SignIn`, `SignUp`, `Forgot`, `SignUpUsername`, `UserEdit`, `ChangeIntention`.
3. Убрать `loading ? <Loading /> : <Form />` паттерн — форма остаётся видимой с активным индикатором на кнопке.
4. Добавить `try/catch` + `error` state в `SignUpUsername`, `UserEdit`, `ChangeIntention` с inline `TextError`.
5. Добавить тесты для `LoadingButton`.
6. Запустить полный Jest suite.

## 4. What was implemented

- `src/components/LoadingButton/index.tsx` + `LoadingButton.test.tsx` — кнопка с `ActivityIndicator`, disabled-статусом, accessibility state (`busy`/`disabled`) и haptic.
- `src/components/Buttons/index.ts` — экспорт `LoadingButton` рядом с остальными кнопками.
- `src/screens/Authenticator/SignIn/index.tsx` — форма остаётся видимой, кнопка показывает загрузку.
- `src/screens/Authenticator/SignUp/index.tsx` — форма остаётся видимой, кнопка показывает загрузку.
- `src/screens/Authenticator/Forgot/index.tsx` — форма остаётся видимой, кнопка показывает загрузку.
- `src/screens/Authenticator/SignUpUsername/index.tsx` — форма видна + обработка ошибки `createProfile` через `TextError`.
- `src/screens/Authenticator/UserEdit/index.tsx` — форма видна + обработка ошибки `updateProfName` через `TextError`.
- `src/screens/ChangeIntention/index.tsx` — форма видна + обработка ошибки `updateIntention` через `TextError`.

## 5. Verification

```bash
npx jest --runInBand
```

- **68/68 suites passed**
- **272/272 tests passed**
- No new dependencies or native changes.

## 6. Notes

- `LoadingButton` визуально наследует размеры стандартной `Button` (`ms(230, 0.9)` × `ms(50, 0.9)`, радиус `s(40)`) и использует тот же `Text` компонент, чтобы вписаться в дизайн-систему.
- Haptic на `LoadingButton` по умолчанию `impactLight`; формы аутентификации используют `impactMedium` для важных submit-действий.
- Предыдущие циклы продолжают работать: `ErrorBoundary`, `ConfirmDialog`, `SceneStates`, `Pressable` haptic остаются зелёными в тестах.

## 7. Cooperation options for the next loop

1. **Optimistic UI rollback.** Вернуть rollback для лайков, реакций, закладок, AI-фидбека и комментариев — если запрос падает, UI возвращается к предыдущему состоянию с inline ошибкой.
2. **Подтверждения для админ/destructive действий.** Применить `ConfirmDialog` к удалению постов/комментариев, бану/разбану и массовым удалениям в `PostCard/CommentCard` `ModalActions`.
3. **SceneStates для оставшихся экранов.** Покрыть `GameScreen`, `OnlineGameScreen`, `ChatScreen`, `UserProfileScreen`, `PlansScreen`, `RulesScreen` состояниями loading/error/empty + pull-to-refresh.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
