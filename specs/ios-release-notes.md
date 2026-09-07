# Candidate 7.1 (8) — not yet submitted

## English

Improved the AI companion's connection and long conversations. Added control
over AI text sharing in Settings. Fixed subscription access on the offline
board and handling of cancelled purchases and restore errors.

## Русский

Улучшили подключение AI-компаньона и работу длинных диалогов. Добавили управление
передачей текста AI в настройках. Исправили доступ по подписке на офлайн-доске,
обработку отменённых покупок и ошибок восстановления.

## Review notes draft

The board is bundled and can be played without signing in. AI is optional:
before sending conversation/game context to the companion service, a native
consent dialog names the external AI providers. Declining does not disable
local play. Permission can be changed under Settings → AI text sharing.

Existing App Store products and prices are unchanged. RevenueCat resolves
active pro-plan access at launch and after purchase or restore. Cancellation
does not grant access or close the subscription screen.

## Release gate

The approved 7.1 (7) remains untouched. Build 8 must finish archive/signature,
runtime and TestFlight processing checks before replacing the approved build.
Replacing that build requires another Apple review; an upload is not a release.
