/**
 * A move, in a sentence.
 *
 * Kept out of `main.ts` so it can be tested: the wording is where the game is
 * either legible or confusing, and the first version told a player waiting to
 * enter that there was "not enough room" — describing a rule they were not
 * under yet.
 */

import { needsSixToEnter, type MoveEvent } from '@leela/engine';
import { type Language, messageFor } from '@leela/content';

/** Look up a plan's title. Injected so this stays free of the content loader. */
export type TitleOf = (plan: number) => string;

export function describeMove(language: Language, event: MoveEvent, titleOf: TitleOf): string {
  const title = titleOf(event.to);
  const say = (key: Parameters<typeof messageFor>[1], params: Record<string, string | number>) =>
    messageFor(language, key, params);

  if (event.isGameStart) {
    return say('app.entered', { to: event.to, title });
  }

  // Still waiting on the win square: nothing was overshot, the six simply has
  // not come yet. The engine's question, since the bot asked it too.
  if (needsSixToEnter(event)) {
    return say('app.needSix', { value: event.roll });
  }

  if (event.isBlocked && event.from === event.to) {
    return say('app.noRoom', { value: event.roll, to: event.to });
  }

  if (event.isThreeSixesReset) {
    return say('app.threeSixes', { to: event.to, title });
  }

  if (event.direction === 'win 🕉') {
    return say('app.won', {});
  }

  if (event.jumpedFrom !== null) {
    const key = event.direction === 'snake 🐍' ? 'app.snake' : 'app.arrow';
    return say(key, { value: event.roll, from: event.jumpedFrom, to: event.to, title });
  }

  return say('app.step', { value: event.roll, from: event.from, to: event.to, title });
}

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
