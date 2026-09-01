/**
 * A move, in a sentence.
 *
 * `describeMove` moved to `@leela/content` when the phone turned out to need
 * the same nine sentences and to have been printing the event's fields with
 * dots between them instead. Re-exported here so this module stays the one
 * place a surface asks about the wording of a move.
 */

import { type Language, messageFor } from '@leela/content';

// The sentence for a move lives in `@leela/content`, beside the catalogue it is
// built from: the phone needs the same nine and had none of them.
export { describeMove } from '@leela/content';
export type { TitleOf } from '@leela/content';

/**
 * Whose throw the sentence is about.
 *
 * The wording is second person — "You threw 4. An arrow at 10 takes you to
 * 23." — which was exact while one person played and became a lie the moment a
 * second sat down: by the time it is read the header says whose turn it is
 * *now*, so the sentence appears to be about the wrong player.
 *
 * The published app has the same problem and the same shape of answer: it
 * keeps `playerTurn # N` as a separate line rather than rewording every
 * message. Naming the thrower is the smaller change and the clearer one.
 *
 * Alone at the table, nothing is prefixed: "Player 1 — you threw 4" to
 * somebody playing by themselves is a form filled in by a machine.
 */
export function attribute(
  language: Language,
  said: string,
  seat: number,
  seated: number,
): string {
  if (seated <= 1) return said;
  return messageFor(language, 'app.seatSaid', { seat: seat + 1, said });
}
