/**
 * What the screen says, decided without a screen.
 *
 * Everything the player reads is a function of the move the engine reported and
 * the language they read in, so it is computed here and merely written into the
 * DOM by `screen.ts`. A sentence assembled at the call site is a sentence
 * nobody compares to the other surface's — which is the reason `describeMove`
 * exists in `@leela/content`, and the reason this file calls it instead of
 * writing a tenth wording of *an arrow at 10 takes you to 23*.
 *
 * The board this replaced wrote its own: `'${hop.from} → ${hop.to} · a snake:
 * an old pattern asks to be lived again'`, in English, on every screen, for a
 * game that ships in twenty-two languages.
 */

import { WIN_LOKA, hasWon, type Direction, type GameState, type MoveEvent } from '@leela/engine';
import { describeMove, messageFor, type Language, type TitleOf } from '@leela/content';

/**
 * What kind of move the player is being told about.
 *
 * Drives one stripe of colour, the same five the mini app's `.say` uses. Not
 * decorative: after a fall of thirty squares, the difference between *a snake
 * took you* and *you stepped* is the difference between a board that explains
 * itself and one that appears to teleport.
 */
export type Tone = 'wait' | 'step' | 'snake' | 'arrow' | 'win';

export const toneOf = (direction: Direction | '' | undefined): Tone => {
  if (direction === 'win 🕉') return 'win';
  if (direction === 'snake 🐍') return 'snake';
  if (direction === 'arrow 🏹') return 'arrow';
  if (direction === 'step 🚶🏼') return 'step';
  return 'wait';
};

export interface Standing {
  /** The plan the player stands on, or null while they wait to enter. */
  readonly plan: number | null;
  /** What to print where the number goes. */
  readonly number: string;
  /** The plan's name, or the invitation to throw. */
  readonly title: string;
  /** How far to Cosmic Consciousness, 0..1. */
  readonly progress: number;
  /** The move, in a sentence, in the player's language. */
  readonly say: string;
  readonly tone: Tone;
}

/**
 * Before the first six.
 *
 * A waiting player sits on `WIN_LOKA` with `is_finished` set — the engine's way
 * of saying *not playing yet* — so position alone cannot tell waiting from
 * having won, and the caller passes `entered` rather than letting this guess.
 */
export const opening = (language: Language): Standing => ({
  plan: null,
  number: '—',
  title: messageFor(language, 'app.waiting'),
  progress: 0,
  say: messageFor(language, 'app.opening'),
  tone: 'wait',
});

/** Where the player is standing, once they are on the board. */
export const standingOn = (
  language: Language,
  plan: number,
  titleOf: TitleOf,
  event: MoveEvent | null,
): Standing => ({
  plan,
  number: String(plan),
  title: titleOf(plan),
  // Against the winning square rather than against 72: 68 is the end of the
  // game and the four squares past it are the ones you are made to walk back
  // from. A bar that reads 94% at the finish is a bar that is measuring the
  // wrong thing.
  progress: Math.max(0, Math.min(1, plan / WIN_LOKA)),
  say: event
    ? describeMove(language, event, titleOf)
    : messageFor(language, 'app.standing', { plan, title: titleOf(plan) }),
  tone: event ? toneOf(event.direction) : 'step',
});

/**
 * Which of the three things a seat can be doing.
 *
 * Not a boolean, and that is the whole point. `is_finished` is set both before
 * the first six and after the win, so *on the board* has one negation and two
 * meanings — and every caller that reduced it to `entered` handed the winner
 * the invitation to throw for a six.
 */
export type Presence = 'waiting' | 'playing' | 'won';

/**
 * Read a seat's presence off its state.
 *
 * `hasWon` rather than the condition it stands for: the engine's own comment
 * records that this check lived in three places and the copy in `game.ts` was
 * the wrong one. A fourth copy here would be the same mistake with this app's
 * name on it.
 */
export const presenceOf = (state: GameState): Presence => {
  if (hasWon(state)) return 'won';
  return state.is_finished ? 'waiting' : 'playing';
};

/**
 * The whole readout for one moment of the game.
 *
 * @param presence what the seat is doing. A winner stands on 68 having arrived;
 *        a player waiting for a six stands on 68 having never left.
 */
export const screenFor = (
  language: Language,
  plan: number,
  presence: Presence,
  titleOf: TitleOf,
  event: MoveEvent | null,
): Standing => {
  if (presence === 'waiting') {
    const waiting = opening(language);
    // A refused throw is still news: *you threw 4, it takes a six*. The opening
    // line is only for the moment before anybody has thrown at all.
    return event ? { ...waiting, say: describeMove(language, event, titleOf) } : waiting;
  }
  const standing = standingOn(language, plan, titleOf, event);
  if (presence !== 'won') return standing;
  // Arrived. The number, the name and a full bar are all `standingOn`'s already;
  // what it cannot know is that this is the end rather than another landing, and
  // a winner who reloads has no move to be described.
  return { ...standing, say: messageFor(language, 'app.won'), tone: 'win' };
};

/**
 * The readout for a seat, presence and all.
 *
 * This exists so that the deciding is not done at the call site. `showStanding`
 * used to pass `entered(of)` — a boolean it derived itself — and that is where
 * the winner's readout went wrong: the rule was in the wiring, where this app's
 * own first paragraph says no rule lives, and no test could reach it.
 */
export const standingFor = (
  language: Language,
  state: GameState,
  titleOf: TitleOf,
  event: MoveEvent | null,
): Standing => screenFor(language, state.loka, presenceOf(state), titleOf, event);

/**
 * Who throws next, in the player's language, or null when nobody changed.
 *
 * At a table the only thing that followed the rotation was the colour of the
 * mark beside the die. A colour is not a sentence, and this game is played by
 * people passing one phone between them.
 *
 * Ids rather than seat numbers for the comparison, because the comparison *is*
 * the condition: `nextSeat` returns the same seat at a table of one and stays
 * put when everyone else has finished, so equal ids are exactly the cases where
 * there is nobody to announce. A one-seat table therefore never says it,
 * without needing to ask how many are playing.
 *
 * `roll.next` rather than `roll.notYourTurn`: both exist and both are true, but
 * this is said in the instant after a throw, where *{name} is next* reads as
 * the continuation it is and *It is {name}'s turn* reads as a label. It is also
 * the sentence `apps/bot` already sends in this exact position. Neither is
 * written here — no surface writes its own sentences.
 *
 * The name is the seat, not the deity: two seats may end up wearing the same
 * deity, and a transliterated Sanskrit name inside a Russian sentence is two
 * scripts in one line. `app.seatTurn` is the same wording the lotus mark
 * already announces to a screen reader.
 *
 * @param holderSeat 0-based, as the engine counts. The +1 happens here, once.
 */
export const turnPassed = (
  language: Language,
  mover: string,
  holder: string,
  holderSeat: number,
): string | null =>
  mover === holder
    ? null
    : messageFor(language, 'roll.next', {
        name: messageFor(language, 'app.seatTurn', { seat: holderSeat + 1 }),
      });
