import { ARROWS, SNAKES, START_LOKA, TOTAL_PLANS, WIN_LOKA } from './board';

/**
 * The board, in words, once — because it was in words twice.
 *
 * Both companions are told what game they are talking about before the player
 * says anything: `apps/bot/src/bot.ts` built that paragraph, and
 * `apps/webgl/src/ask.ts` built it again, eight sentences each, word for word.
 * The bot's copy carried a comment saying the two "cannot describe two
 * different games" because every number in it comes from `@leela/engine`.
 *
 * **That was true of the bot's copy and false of the board's.** Measured
 * 2026-08-28: the bot derived the arrow that ends the game —
 *
 *     const straightIn = Object.entries(ARROWS).find(([, to]) => to === WIN_LOKA)?.[0];
 *
 * — while the board wrote `plan 54 leads straight to it` with the number typed
 * in. It is the right number today. It is right by luck: nothing re-derives it,
 * and the first principle of this repository is about exactly that kind of
 * figure, in exactly those words — *a figure nobody had re-derived against the
 * disk it describes, in the one principle whose subject is not trusting a
 * copy*. A `RuleSet` that moves that arrow leaves the web board's companion
 * describing a game nobody is playing while the bot's stays correct, and the
 * two surfaces then do describe two different games.
 *
 * The board's copy had a second defect the bot's did not: it promised a
 * straight-in arrow unconditionally. A board with none would have been
 * described as having one.
 *
 * It lives in the engine because every input is an engine export and the output
 * is a description of the engine. It is deliberately NOT in `@leela/ai`: that
 * package holds no copy of the board on purpose, and its `AboutContext` takes
 * the rules from its caller.
 *
 * English, and not from `@leela/content`, because this is not a sentence the
 * game says to a player. It is what a model is told before it answers, and it
 * answers in the player's language.
 */

/** A board this can describe — the engine's own, or a variant's. */
export interface BoardInWords {
  plans: number;
  start: number;
  win: number;
  arrows: Readonly<Record<number, number>>;
  snakes: Readonly<Record<number, number>>;
}

/** The engine's board, which is what both callers mean when they say nothing. */
export const THIS_BOARD: BoardInWords = {
  plans: TOTAL_PLANS,
  start: START_LOKA,
  win: WIN_LOKA,
  arrows: ARROWS,
  snakes: SNAKES,
};

const listOf = (jumps: Readonly<Record<number, number>>): string =>
  Object.entries(jumps)
    .map(([from, to]) => `${from}->${to}`)
    .join(', ');

/**
 * What the companion is told the board is.
 *
 * Takes a board rather than reading the module's, so the derivation can be
 * tested against a board that is not this one: handed a variant whose winning
 * arrow starts somewhere else, the sentence has to say so. That is the
 * difference between testing the derivation and testing today's numbers, and
 * it is the whole reason the hard-coded `54` went unnoticed.
 */
export function rulesText(board: BoardInWords = THIS_BOARD): string {
  // Found on the board rather than written as a number. Naming its square by
  // hand is what the board's copy did, and it agreed by luck.
  const straightIn = Object.entries(board.arrows).find(([, to]) => to === board.win)?.[0];

  return [
    `The board has ${board.plans} plans.`,
    `A player is off the board until they throw a six, which places them on plan ${board.start}.`,
    'A six earns another throw; three sixes in a row send the player back to where that run began.',
    `Arrows lift: ${listOf(board.arrows)}.`,
    `Snakes drop: ${listOf(board.snakes)}.`,
    `A throw that would pass plan ${board.plans} does not move the player at all.`,
    `Reaching plan ${board.win} completes the game` +
      (straightIn === undefined ? '.' : `; plan ${straightIn} leads straight to it.`),
    'After every landing the player writes what they meet there, and the die stays closed until they do.',
  ].join(' ');
}
