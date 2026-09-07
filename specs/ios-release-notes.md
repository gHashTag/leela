# Candidate 7.1 (10) — not yet submitted

## English

Improved the AI companion's connection and long conversations. Added control
over AI text sharing in Settings. Fixed subscription access on the offline
board and handling of cancelled purchases and restore errors. Restored the
matching native Firebase configuration instead of the inherited placeholder.
Removed an irrelevant chat-connection notice from the native game board.

## Русский

Улучшили подключение AI-компаньона и работу длинных диалогов. Добавили управление
передачей текста AI в настройках. Исправили доступ по подписке на офлайн-доске,
обработку отменённых покупок и ошибок восстановления. Восстановили корректную
конфигурацию подключения аккаунта вместо заглушки.
Убрали постороннее уведомление о подключении чата с мобильной игровой доски.

## Review notes draft

The board is bundled and can be played without signing in. AI is optional:
before sending conversation/game context to the companion service, a native
consent dialog names the external AI providers. Declining does not disable
local play. Permission can be changed under Settings → AI text sharing.

Existing App Store products and prices are unchanged. RevenueCat resolves
active pro-plan access at launch and after purchase or restore. Cancellation
does not grant access or close the subscription screen.

## Release gate

The approved 7.1 (7) remains untouched. Uploaded build 8 is superseded because
its Firebase placeholder disabled account/cloud functions. Build 9 was not
uploaded and is superseded by the native-copy correction in build 10. Build 10
passed simulator launch/board visual QA, signed archive and exported IPA audits.
Upload succeeded; Apple processing is VALID for build
`9d09eb43-a3d0-423a-9a8f-7b80ce602631`. App Privacy, export compliance and
account/purchase QA remain gates before replacing the approved build.
Replacing that build requires another Apple review; an upload is not a release.
