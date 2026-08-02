/**
 * A wait, in the player's language.
 *
 * `formatWait` lived in `@leela/engine` and returned `${hours}h ${minutes}m`.
 * The bot dropped that into `roll.cooldown`, which is in the catalogue in
 * Russian, so a player under a variant with a day between throws read *Пока
 * нет. Следующий бросок через 23h 45m.* — two letters of English in the one
 * sentence that tells somebody to come back later.
 *
 * The engine still does the arithmetic; the words are here. It is the split
 * `describeMove` and `writerHint` already use, and the engine cannot do
 * otherwise: it has no catalogue and no language, on purpose.
 */

import { waitParts } from '@leela/engine';
import type { Language } from './language';
import { messageFor } from './messages';

/**
 * How long until the next throw, said in `language`.
 *
 * Empty when there is nothing to wait for, which is what every caller already
 * treats as "say no sentence about waiting".
 */
export function formatWait(language: Language, waitMs: number): string {
  const parts = waitParts(waitMs);
  if (parts === null) return '';

  if (parts.hours > 0) {
    return messageFor(language, 'wait.hoursMinutes', {
      hours: parts.hours,
      minutes: parts.minutes,
    });
  }

  if (parts.minutes > 0) {
    return messageFor(language, 'wait.minutesSeconds', {
      minutes: parts.minutes,
      seconds: parts.seconds,
    });
  }

  return messageFor(language, 'wait.seconds', { seconds: parts.seconds });
}
