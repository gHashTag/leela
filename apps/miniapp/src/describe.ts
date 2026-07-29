/**
 * A move, in a sentence.
 *
 * Kept out of `main.ts` so it can be tested: the wording is where the game is
 * either legible or confusing, and the first version told a player waiting to
 * enter that there was "not enough room" — describing a rule they were not
 * under yet.
 */

import { WIN_LOKA, type MoveEvent } from '@leela/engine';

/** Look up a plan's title. Injected so this stays free of the content loader. */
export type TitleOf = (plan: number) => string;

export function describeMove(event: MoveEvent, titleOf: TitleOf): string {
  const title = titleOf(event.to);

  if (event.isGameStart) {
    return `A six. You enter the game on ${event.to}. ${title}`;
  }

  // Still waiting on the win square: nothing was overshot, the six simply has
  // not come yet.
  if (event.isBlocked && event.from === WIN_LOKA && event.to === WIN_LOKA) {
    return `You threw ${event.roll}. It takes a six to enter the game.`;
  }

  if (event.isBlocked && event.from === event.to) {
    return `You threw ${event.roll}. Not enough room — you stay on ${event.to}.`;
  }

  if (event.isThreeSixesReset) {
    return `A third six. The run burns and you return to ${event.to}. ${title}`;
  }

  if (event.direction === 'win 🕉') {
    return 'You reach Cosmic Consciousness. 🕉';
  }

  if (event.jumpedFrom !== null) {
    const kind = event.direction === 'snake 🐍' ? 'A snake at' : 'An arrow at';
    return `You threw ${event.roll}. ${kind} ${event.jumpedFrom} takes you to ${event.to}. ${title}`;
  }

  return `You threw ${event.roll}. ${event.from} → ${event.to}. ${title}`;
}
