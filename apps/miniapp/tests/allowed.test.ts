import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  advance,
  createSession,
  currentPlayer,
  isSessionOver,
  seededRoller,
  submitReport,
  type Session,
} from '@leela/engine';
import { arrived, record, revisited, seatOwesReport, type Journal } from '../src/reports';
import { mayThrow } from '../src/view';

/**
 * A disabled button is a drawing, and a drawing refuses nothing.
 *
 * The die was disabled by `draw` and the throw was taken by `roll`; the report
 * button was disabled by `draw` and the report was filed by `saveReport`. Only
 * the drawing asked any questions. That is the shape the bot was caught in
 * twice, and in the mini app the other path is a **double tap** — a slip on a
 * phone, two clicks before the dialog can close.
 *
 * The second tap filed a second account of the same square. `revisited` counts
 * a square as returned to when more than one thing was written about it, so a
 * fumbled tap made the game claim a return that never happened — in the one
 * record it exists to produce, and in the file the player exports to keep.
 *
 * These tests play whole games through the same pieces the app uses, with the
 * player fumbling every tap, and hold the rule the whole feature rests on:
 * **the squares the journal says came back are exactly the squares the player
 * arrived at more than once.**
 */

/**
 * A game played by somebody whose thumb bounces on Save.
 *
 * One throw a turn, because a second tap on the *die* is a second throw and
 * always was — a six grants another. The fumbling that used to change the
 * record is the one on Save, and every tap goes through the same question the
 * button's disabled state is drawn from.
 */
function fumbledGame(seed: number, taps = 3) {
  let session: Session = createSession('device', [{ id: 'p1' }], CLASSIC);
  let journal: Journal = { reported: true, entries: [] };
  const arrivals: number[] = [];
  const roll = seededRoller(seed);

  for (let turn = 0; turn < 400 && !isSessionOver(session); turn++) {
    if (
      mayThrow(session, 'to see it through', false, seatOwesReport(currentPlayer(session))) === 'yes'
    ) {
      const moved = advance(session, roll(), turn);
      session = moved.session;

      if (moved.owesReport) {
        journal = arrived(journal);
        arrivals.push(moved.session.players[0]?.state.loka ?? 0);
      }
    }

    for (let tap = 0; tap < taps; tap++) {
      if (!seatOwesReport(currentPlayer(session))) continue;

      journal = record(journal, currentPlayer(session).state.loka, `Turn ${turn}.`, turn);
      session = submitReport(session, currentPlayer(session).id, turn);
    }
  }

  return { journal, arrivals };
}

/** How many times each square was actually arrived at. */
function arrivalCounts(arrivals: ReadonlyArray<number>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const plan of arrivals) counts.set(plan, (counts.get(plan) ?? 0) + 1);
  return counts;
}

describe('a fumbled tap files one account, not two', () => {
  const SEEDS = [1, 7, 4242, 20260802];

  it('writes about a square exactly as often as the player arrived there', () => {
    // The rule the returns rest on. A double tap used to add an entry with no
    // arrival behind it, and nothing downstream could tell the difference.
    for (const seed of SEEDS) {
      const { journal, arrivals } = fumbledGame(seed);
      const counts = arrivalCounts(arrivals);

      for (const [plan, times] of counts) {
        const written = journal.entries.filter((entry) => entry.plan === plan).length;
        expect(written, `seed ${seed} / plan ${plan}`).toBe(times);
      }

      expect(journal.entries.length, `seed ${seed}`).toBe(arrivals.length);
    }
  });

  it('claims a return only where the player really returned', () => {
    for (const seed of SEEDS) {
      const { journal, arrivals } = fumbledGame(seed);
      const counts = arrivalCounts(arrivals);

      const claimed = new Map(revisited(journal).map((visit) => [visit.plan, visit.times]));
      const truly = new Map([...counts].filter(([, times]) => times > 1));

      expect([...claimed].sort(), `seed ${seed}`).toEqual([...truly].sort());
    }
  });

  it('returns really happen, or the check above is about nothing', () => {
    const returns = SEEDS.map((seed) => revisited(fumbledGame(seed).journal).length);
    expect(returns.some((count) => count > 0)).toBe(true);
  });

  it('is the same game however many times the player taps Save', () => {
    // One tap, three taps, ten: the fumbling changes nothing at all, which is
    // what "the act asks the same question" means.
    const once = fumbledGame(4242, 1);
    for (const taps of [2, 3, 10]) {
      const again = fumbledGame(4242, taps);
      expect(again.journal, `taps ${taps}`).toEqual(once.journal);
      expect(again.arrivals, `taps ${taps}`).toEqual(once.arrivals);
    }
  });
});

describe('what a throw is refused for', () => {
  const session = createSession('device', [{ id: 'p1' }], CLASSIC);

  it('is the question the game is played to answer, before anything else', () => {
    expect(mayThrow(session, '', false, false)).toBe('no-intention');
  });

  it('is a throw already under way', () => {
    // Ahead of the intention: a spin that has begun has already used the die,
    // and asking about anything else would let a second tap into the middle of
    // it.
    expect(mayThrow(session, '', true, false)).toBe('rolling');
  });

  it('is an account the game has asked for and not been given', () => {
    expect(mayThrow(session, 'to see', false, true)).toBe('owes-report');
  });

  it('is a game that has ended', () => {
    const won: Session = {
      ...session,
      players: session.players.map((player) => ({
        ...player,
        state: {
          loka: 68,
          previous_loka: 51,
          direction: 'win 🕉' as const,
          consecutive_sixes: 0,
          position_before_three_sixes: 0,
          is_finished: true,
        },
      })),
    };

    expect(mayThrow(won, 'to see', false, false)).toBe('game-over');
  });

  it('is nothing, when there is nothing in the way', () => {
    expect(mayThrow(session, 'to see', false, false)).toBe('yes');
  });
});

describe('what is said once the report is filed', () => {
  /**
   * "Written. You may throw." was said whatever the state was.
   *
   * The last report of a game is the one on Cosmic Consciousness — `CLASSIC`
   * asks for it, `reportOnWinningSquare`, because it is the square a whole game
   * was played to reach. So the most meaningful moment in the game ended with
   * the app inviting the player to throw again, over a dimmed die. The bot said
   * the same sentence in the same situation and stopped two passes ago.
   *
   * The sentence is chosen by the same question the die is drawn from, so the
   * two cannot disagree: whatever `mayThrow` says, the line says.
   */
  const solo = createSession('device', [{ id: 'p1' }], CLASSIC);

  const won = (session: Session): Session => ({
    ...session,
    players: session.players.map((player) => ({
      ...player,
      state: {
        loka: 68,
        previous_loka: 51,
        direction: 'win 🕉' as const,
        consecutive_sixes: 0,
        position_before_three_sixes: 0,
        is_finished: true,
      },
    })),
  });

  it('promises a throw exactly when there is one to make', () => {
    // Both halves, over the two states a filed report can leave behind.
    expect(mayThrow(solo, 'to see', false, false)).toBe('yes');
    expect(mayThrow(won(solo), 'to see', false, false)).not.toBe('yes');
  });

  it('does not depend on anybody else still playing', () => {
    // A game of three where one has finished: their last report is still the
    // last report of *their* game, and the sentence has to say so.
    const table = createSession('device', [{ id: 'p1' }, { id: 'p2' }], CLASSIC);
    const finished: Session = {
      ...table,
      turnIndex: 0,
      players: table.players.map((player, index) =>
        index === 0 ? won(table).players[0] ?? player : player,
      ),
    };

    expect(mayThrow(finished, 'to see', false, false)).toBe('game-over');
  });
});
