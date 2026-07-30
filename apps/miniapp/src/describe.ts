/**
 * A move, in a sentence.
 *
 * Kept out of `main.ts` so it can be tested: the wording is where the game is
 * either legible or confusing, and the first version told a player waiting to
 * enter that there was "not enough room" — describing a rule they were not
 * under yet.
 */

import { WIN_LOKA, type MoveEvent } from '@leela/engine';
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
  // not come yet.
  if (event.isBlocked && event.from === WIN_LOKA && event.to === WIN_LOKA) {
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
