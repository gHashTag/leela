/**
 * A move, in a sentence.
 *
 * Here rather than in one app because two surfaces needed the same nine
 * sentences and only one of them had them. The mini app has said *You threw 4.
 * An arrow at 10 takes you to 23.* since it was written; the phone printed
 * `4 · 18 → 23 · arrow 🏹` under its board — the event's fields with dots
 * between them, and the word `arrow` in English on a Russian screen.
 *
 * The keys were already in the catalogue in both languages, written for exactly
 * this. What was missing was a second caller, and the reason it went unnoticed
 * is the reason it is one function now: a sentence built at the call site is a
 * sentence nobody compares to the other one.
 *
 * The wording is where the game is either legible or confusing — the first
 * version told a player waiting to enter that there was "not enough room",
 * describing a rule they were not under yet.
 */

import { needsSixToEnter, type MoveEvent } from '@leela/engine';
import { type Language } from './language';
import { messageFor } from './messages';

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
