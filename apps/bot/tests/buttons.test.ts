import { describe, expect, it } from 'vitest';
import { currentPlayer, isSessionOver, owesReport } from '@leela/engine';
import {
  buttonsFor,
  join,
  openRoom,
  report,
  roll,
  start,
  type Button,
  type Room,
} from '../src/commands';

/**
 * A keyboard is the bot's drawing of a control.
 *
 * The mini app spent three passes learning what a drawing is worth: a double
 * tap on Save filed two accounts of one square, a tap on the players button
 * threw away a month of play, and the die took a throw the drawing had already
 * refused. The rule that came out of it — a control's availability is decided
 * by a named function, and the act behind it asks the same one — was closed
 * over that app in the pass before this.
 *
 * This is the same shape on the other surface, read backwards. The bot's acts
 * all refuse correctly; what they were not doing was *offering* correctly.
 * `🎲 Roll` sat under a table that was waiting for a report, so the tap was
 * taken and answered with a no. A button the game will refuse is a promise it
 * does not keep.
 *
 * The rule here: **every button offered is an action the game would accept from
 * the seat holding the turn.**
 */

const NOW = 1_700_000_000_000;

function table(seed: number): Room {
  let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, seed).room as Room;
  room = join(room, { id: 'u2', name: 'Bo' }).room as Room;
  return start(room, 'u1').room as Room;
}

/** Whether the game would take a throw from whoever holds the turn. */
function wouldTakeAThrow(room: Room): boolean {
  const holder = currentPlayer(room.session);
  return !(owesReport(holder.state, room.session.rules) && !holder.reportSubmitted);
}

describe('every button the bot offers', () => {
  const SEEDS = [1, 4242, 77, 20260803];

  it('offers a throw exactly while the game would take one', () => {
    // Over whole played games, at every reply that carries a keyboard: the
    // offer and the answer are the same thing or one of them is lying.
    for (const seed of SEEDS) {
      let room = table(seed);

      let owingSeen = 0;

      for (let turn = 0; turn < 400 && !isSessionOver(room.session); turn++) {
        const holder = currentPlayer(room.session);
        const thrown = roll(room, holder.id, NOW + turn * 1000);
        if (thrown.room) room = thrown.room;

        // Checked *after* the throw and *before* the reports, which is the
        // moment a player is actually looking at the keyboard. Checking it at
        // the top of the loop — with every report already filed — made the
        // assertion true for want of a case, and the first version of this test
        // stayed green with the whole rule deleted.
        const offered = buttonsFor(room).map((button: Button) => button.action);
        expect(offered.includes('roll'), `seed ${seed} turn ${turn}`).toBe(wouldTakeAThrow(room));
        if (!wouldTakeAThrow(room)) owingSeen += 1;

        for (const seat of room.session.players) {
          if (seat.reportSubmitted) continue;
          const filed = report(room, seat.id, `About ${seat.state.loka}.`, NOW + turn * 1000 + 1);
          if (filed.room) room = filed.room;
        }
      }

      // The interesting half has to occur, or the check above is about nothing.
      expect(owingSeen, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('never leaves a throw on offer while an account is owed', () => {
    // The case in one line, because it is the one a player meets every turn.
    let room = table(4242);

    for (let turn = 0; turn < 60; turn++) {
      const holder = currentPlayer(room.session);
      const thrown = roll(room, holder.id, NOW + turn * 1000);
      if (thrown.room) room = thrown.room;

      const owing = room.session.players.find((seat) => !seat.reportSubmitted);
      if (!owing || currentPlayer(room.session).id !== owing.id) continue;

      expect(buttonsFor(room).map((button: Button) => button.action)).not.toContain('roll');
      // And what is left is what they need in order to say yes.
      expect(buttonsFor(room).map((button: Button) => button.action)).toContain('plan');
      return;
    }

    throw new Error('the turn holder never owed a report');
  });

  it('rides the throw itself, so the keyboard is never a stale one', () => {
    // A throw used to carry no buttons at all, which left whatever was last
    // drawn on screen — `🎲 Roll` included, however the game had moved on.
    const room = table(4242);
    const thrown = roll(room, currentPlayer(room.session).id, NOW);
    const carried = thrown.replies.filter((reply) => reply.buttons?.length);

    expect(carried).toHaveLength(1);
    expect(carried[0]).toBe(thrown.replies[thrown.replies.length - 1]);
  });

  it('offers joining and starting only before a game begins', () => {
    const waiting = openRoom('chat-1', { id: 'u1', name: 'Ada' }, 4242).room as Room;
    const actions = buttonsFor(waiting).map((button: Button) => button.action);

    expect(actions).toContain('join');
    expect(actions).toContain('start');
    expect(buttonsFor(table(4242)).map((button: Button) => button.action)).not.toContain('join');
  });

  it('offers nothing once the game is over', () => {
    // The last reply of a finished game says so and offers no way to keep
    // playing it.
    let room = table(77);

    for (let turn = 0; turn < 400 && !isSessionOver(room.session); turn++) {
      const thrown = roll(room, currentPlayer(room.session).id, NOW + turn * 1000);
      if (thrown.room) room = thrown.room;

      for (const seat of room.session.players) {
        if (seat.reportSubmitted) continue;
        const filed = report(room, seat.id, `About ${seat.state.loka}.`, NOW + turn * 1000 + 1);
        if (filed.room) room = filed.room;
      }
    }

    expect(isSessionOver(room.session)).toBe(true);

    const last = roll(room, 'u1', NOW + 999_000);
    expect(last.replies.some((reply) => reply.buttons?.length)).toBe(false);
  });
});
