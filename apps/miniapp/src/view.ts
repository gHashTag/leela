/**
 * What the screen should show, decided without a screen.
 *
 * `draw()` in `main.ts` did this inline, and the one thing it got wrong could
 * only have been seen by playing to the end: it asked `state.is_finished` to
 * mean "waiting to enter". A player who has *won* is also finished, so at the
 * moment of reaching Cosmic Consciousness the header reset to "—", the progress
 * bar dropped to zero and the token vanished from square 68 — while the line
 * underneath said they had arrived.
 *
 * `hasWon` is the engine's own answer to that ambiguity and exists because 68
 * means two different things depending on how you got there. This is the fourth
 * place that has bitten.
 */

import { WIN_LOKA, hasWon, type GameState } from '@leela/engine';
import { messageFor, type Language } from '@leela/content';

export interface Headline {
  /** What goes where the plan number is. `—` while off the board. */
  number: string;
  title: string;
  /** 0..WIN_LOKA, for the progress bar. */
  progress: number;
  /** Whether "read this plan" refers to anything. */
  canRead: boolean;
  /** The square to mark as the player's, or null while they are off it. */
  here: number | null;
  /** The square they came from, or null when there is nothing to trace. */
  from: number | null;
  /** True while waiting for a six, so the caller can style it as a pause. */
  waiting: boolean;
}

/** Look up a plan's title. Injected so this stays free of the content loader. */
export type TitleOf = (plan: number) => string;

function traceFrom(previous: number, current: number): number | null {
  if (previous < 1 || previous === current || previous === WIN_LOKA) return null;
  return previous;
}

export function headline(state: GameState, language: Language, titleOf: TitleOf): Headline {
  const won = hasWon(state);

  // Out of play and not a winner: nobody has thrown a six yet.
  if (state.is_finished && !won) {
    return {
      number: '—',
      title: messageFor(language, 'app.waiting'),
      progress: 0,
      canRead: false,
      here: null,
      from: null,
      waiting: true,
    };
  }

  return {
    number: String(state.loka),
    title: titleOf(state.loka),
    // A win is the bar full, not the bar reset.
    progress: Math.min(state.loka, WIN_LOKA),
    canRead: true,
    here: state.loka,
    // Never a trail from the win square. Entering the game is recorded as a
    // move from 68 — that is where a waiting player sits — and drawing it says
    // the player has just come down from Cosmic Consciousness. Nobody moves
    // *from* 68 in play, so a trail starting there is always the wrong story.
    from: traceFrom(state.previous_loka, state.loka),
    waiting: false,
  };
}
