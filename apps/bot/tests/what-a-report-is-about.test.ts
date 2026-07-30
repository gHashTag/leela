import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  arrivedByJump,
  currentPlayer,
  isSessionOver,
  isWaitingToEnter,
  owesReport,
} from '@leela/engine';
import { join, openRoom, report, roll, start, type Room } from '../src/commands';

/**
 * What a report is about.
 *
 * A report is an account of the square you are standing on. A player who has
 * not thrown a six is not standing on one — the engine parks them on `WIN_LOKA`
 * until they enter, which is the 68 ambiguity this repository has now met seven
 * times.
 *
 * The bot took their report anyway. Before `/start`, before anybody had thrown
 * anything, `/report` was accepted, answered with *"You may throw"* — while
 * `/roll` correctly refused, because the table had not started — and filed
 * against **plan 68, Cosmic Consciousness**. So somebody who had never begun
 * could put an account of the winning square into the record the game exists to
 * produce, and `/returns` would later count it as a square that came back to
 * them.
 *
 * Found by playing the commands rather than reading them, which is the only way
 * anything on this surface has ever been found.
 *
 * The rule is not the two moments that were wrong. It is: **every report the
 * bot files is about the square its author was standing on.**
 */

const NOW = 1_700_000_000_000;

interface Filed {
  userId: string;
  plan: number;
  standingOn: number;
  waiting: boolean;
  owed: boolean;
  jumped: boolean;
}

/** Every report a whole game files, with where its author actually stood. */
function reportsOf(seed: number): Filed[] {
  let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, seed).room as Room;
  room = join(room, { id: 'u2', name: 'Bo' }).room as Room;
  room = join(room, { id: 'u3', name: 'Cy' }).room as Room;
  room = start(room, 'u1').room as Room;

  const filed: Filed[] = [];

  for (let turn = 0; turn < 400 && !isSessionOver(room.session); turn++) {
    const thrown = roll(room, currentPlayer(room.session).id, NOW + turn * 1000);
    if (thrown.room) room = thrown.room;

    for (const seated of room.session.players) {
      // Everybody writes every turn, whether or not they owe one — a player
      // sends what they send, and the bot decides what to do with it.
      const before = seated.state;
      const result = report(room, seated.id, `About ${before.loka}.`, NOW + turn * 1000 + 1);
      if (result.room) room = result.room;

      for (const effect of result.effects ?? []) {
        if (effect.kind !== 'report') continue;
        filed.push({
          userId: seated.id,
          plan: effect.plan,
          standingOn: before.loka,
          waiting: isWaitingToEnter(before),
          owed: owesReport(before, room.session.rules) && !seated.reportSubmitted,
          jumped: arrivedByJump(before),
        });
      }
    }
  }

  return filed;
}

describe('every report the bot files', () => {
  const SEEDS = [1, 4242, 77, 20260801];

  it('is about the square its author was standing on', () => {
    for (const seed of SEEDS) {
      for (const entry of reportsOf(seed)) {
        expect(entry.plan, `seed ${seed} / ${entry.userId}`).toBe(entry.standingOn);
      }
    }
  });

  it('is never filed by somebody who has not entered the game', () => {
    // The defect, stated as a shape: the waiting square is not a square you are
    // standing on, and 68 is the one plan a player must never be able to claim
    // without having reached it.
    for (const seed of SEEDS) {
      for (const entry of reportsOf(seed)) {
        expect(entry.waiting, `seed ${seed} / ${entry.userId}`).toBe(false);
      }
    }
  });

  it('happens at all, or the two checks above are about nothing', () => {
    expect(reportsOf(4242).length).toBeGreaterThan(10);
  });
});

describe('a player who is not on the board', () => {
  function fresh(): Room {
    const room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, 4242).room as Room;
    return join(room, { id: 'u2', name: 'Bo' }).room as Room;
  }

  it('is told why rather than having their words filed somewhere wrong', () => {
    const result = report(fresh(), 'u1', 'Something I felt like writing.', NOW);

    expect(result.effects ?? []).toEqual([]);
    expect(result.replies[0]?.text).toMatch(/not on the board/i);
    expect(result.replies[0]?.text).not.toMatch(/may throw/i);
  });

  it('is refused before the table has even started, as the die is', () => {
    // `/roll` said "the table has not started yet" and `/report` said "you may
    // throw" — the same table, the same moment, two different games.
    const room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, 4242).room as Room;

    expect(report(room, 'u1', 'Before anything began.', NOW).effects ?? []).toEqual([]);
    expect(roll(room, 'u1', NOW).replies[0]?.text).toMatch(/not started/i);
  });

  it('is refused once seated and started, until a six puts them there', () => {
    const room = start(fresh(), 'u1').room as Room;
    const waiting = room.session.players.filter((seated) => isWaitingToEnter(seated.state));

    expect(waiting.length).toBe(room.session.players.length);
    for (const seated of waiting) {
      expect(report(room, seated.id, 'Not yet anywhere.', NOW).effects ?? [], seated.id).toEqual([]);
    }
  });

  it('leaves the game exactly as it was', () => {
    // A refusal is not a move: nothing about the table may change because
    // somebody wrote at the wrong moment.
    const room = start(fresh(), 'u1').room as Room;
    const after = report(room, 'u1', 'Nothing to report on yet.', NOW);

    expect(after.room ?? room).toEqual(room);
    expect(room.session.rules).toBe(CLASSIC);
  });
});

describe('one account per arrival', () => {
  /**
   * `/returns` counts a square as returned to when more than one thing was
   * written about it. So `/report` twice without moving was enough to make the
   * game claim a return that never happened — in the one record it exists to
   * produce, and in the file a player exports to keep.
   *
   * The mini app has gated on `owesReport` since seats arrived. The bot never
   * had: it took a second account of the same visit, a third, any number, and
   * filed every one.
   */
  const SEEDS = [1, 4242, 77, 20260801];

  it('is filed only when the engine says one is owed', () => {
    // The condition is the engine's, not the bot's: `owesReport` knows about
    // the winning square, about a six that keeps the turn, and about the snake
    // at 12 that puts a player back where they started.
    for (const seed of SEEDS) {
      for (const entry of reportsOf(seed)) {
        expect(entry.owed, `seed ${seed} / ${entry.userId} on ${entry.plan}`).toBe(true);
      }
    }
  });

  it('writes about one square twice running only when the player left and came back', () => {
    // Two accounts of the same square in a row look like a second account of
    // one visit, and are not always: standing on 71, a throw moves the player
    // and the snake at the far end puts them back on 71. They left, they were
    // bitten, they returned — the most eventful turn there is, and a genuine
    // second arrival. `arrivedByJump` is how the engine tells those apart, and
    // it is the only thing that may make a repeat legitimate.
    let repeats = 0;

    for (const seed of SEEDS) {
      const filed = reportsOf(seed);

      for (const author of new Set(filed.map((entry) => entry.userId))) {
        const theirs = filed.filter((entry) => entry.userId === author);

        for (let index = 1; index < theirs.length; index += 1) {
          if (theirs[index]?.plan !== theirs[index - 1]?.plan) continue;
          repeats += 1;
          expect(
            theirs[index]?.jumped,
            `seed ${seed} / ${author} wrote about ${theirs[index]?.plan} twice without moving`,
          ).toBe(true);
        }
      }
    }

    // And the case occurs, or the assertion is passing for want of one.
    expect(repeats).toBeGreaterThan(0);
  });

  it('says so instead, naming the square already written about', () => {
    let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, 4242).room as Room;
    room = join(room, { id: 'u2', name: 'Bo' }).room as Room;
    room = start(room, 'u1').room as Room;

    // Roll until somebody owes a report, then file two.
    for (let turn = 0; turn < 60; turn += 1) {
      const owing = room.session.players.find((seated) => !seated.reportSubmitted);
      if (owing) {
        const first = report(room, owing.id, 'The first account.', NOW);
        expect(first.effects ?? []).toHaveLength(1);

        const second = report(first.room ?? room, owing.id, 'And another.', NOW + 1);
        expect(second.effects ?? []).toEqual([]);
        expect(second.replies[0]?.text).toContain(String(owing.state.loka));
        return;
      }

      const thrown = roll(room, currentPlayer(room.session).id, NOW + turn * 1000);
      if (thrown.room) room = thrown.room;
    }

    throw new Error('nobody ever owed a report');
  });
});
