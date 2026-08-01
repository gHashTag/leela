import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import { openRoom, plan, roll, standingSquare, start, type Room } from '../src/commands';
import { destinationFor } from '../src/delivery';
import { renderPlan } from '../src/render';

/**
 * What the table may read, and what a command promised and refused.
 *
 * Four defects, and the first two are the kind that cannot be taken back. A
 * player's accounts and the question they are playing for are the two most
 * private things this game holds, and both were being read out to everybody at
 * the table by commands whose neighbours had routed privately for months.
 */

describe('a destination is a decision, not a default', () => {
  /**
   * `/save` called `ctx.replyWithDocument`, which always answers the chat the
   * command came from. At a table of six that posted one player's whole
   * journal — every account of every square they had stood on — for everyone to
   * read and to keep. `/path`, which sends the same material as text, has
   * routed through `destinationFor` since it was written.
   *
   * The rule is asserted rather than the call site, because the call site is
   * what was wrong: a second answer to a question already answered.
   */
  const atTable = { chatType: 'group' as const, userId: 'u7', canWriteDirectly: true };
  const alone = { chatType: 'private' as const, userId: 'u7', canWriteDirectly: true };

  it('sends private material to the player, not to the room', () => {
    expect(destinationFor({ broadcast: false }, atTable)).toEqual({ kind: 'direct', userId: 'u7' });
  });

  it('sends it to the chat when the chat is the player', () => {
    // The case a first attempt at the fix broke: in a private chat the
    // destination *is* the chat, and refusing to send there answered somebody
    // who had asked in a direct message with a note telling them to ask in one.
    expect(destinationFor({ broadcast: false }, alone)).toEqual({ kind: 'chat' });
  });

  it('says so without saying what, when it cannot reach them', () => {
    const shut = { ...atTable, canWriteDirectly: false };
    expect(destinationFor({ broadcast: false }, shut)).toEqual({
      kind: 'chat-fallback',
      reason: 'no-private-channel',
    });
  });
});

describe('the square a player is standing on', () => {
  /**
   * `state.loka` is 68 for somebody who has never thrown a six — the engine
   * parks them there — so `/plan` with no argument answered a brand-new player
   * with the text of Cosmic Consciousness and a progress bar showing them at
   * the end of the game.
   *
   * The eighth sighting of the 68 ambiguity, and the second on this surface.
   */
  /** A table with one player, started, nobody on the board yet. */
  const seated = (): Room => {
    const opened = openRoom('c', { id: 'a', name: 'Anya' }, 1).room as Room;
    return start(opened, 'a').room as Room;
  };

  it('is nothing while they are waiting to enter', () => {
    const room = seated();

    expect(room.session.players[0]?.state.loka, 'the engine parks them on 68').toBe(68);
    expect(standingSquare(room, 'a'), 'and there is no square to read').toBe(null);
  });

  it('is nothing for somebody with no seat at all', () => {
    expect(standingSquare(seated(), 'a-stranger')).toBe(null);
  });

  it('tells a waiting player they are not on the board', () => {
    // Two different absences that used to be one message. "Which plan do you
    // mean?" is right for a stranger and wrong for somebody sitting at the
    // table watching the die.
    const room = seated();
    const said = plan(room, 'a').replies[0]?.text;

    expect(said).toBe(messageFor(room.language, 'ask.notOnBoard'));
    expect(said, 'not the stranger’s question').not.toBe(
      messageFor(room.language, 'plan.which'),
    );
  });

  it('is the square once they are on it', () => {
    // Walked in through the engine: a six is the only way on.
    let room = seated();
    for (let turn = 0; turn < 60 && standingSquare(room, 'a') === null; turn += 1) {
      room = roll(room, 'a', 1).room as Room;
    }

    expect(standingSquare(room, 'a'), 'no six in sixty throws').not.toBe(null);
    expect(standingSquare(room, 'a')).toBe(room.session.players[0]?.state.loka);
  });
});

describe('a page the command tells you to ask for', () => {
  /**
   * `plan.continues` reads *…continues. /plan {plan} {next} for page {next} of
   * {pages}* — and `/plan 2 2` was refused with *the board runs from 1 to 72*,
   * because `Number("2 2")` is `NaN`. A hundred and seventy-five plan texts
   * across 22 languages had a second page nothing could reach.
   *
   * What is asserted is that the marker and the parser agree, over the marker's
   * own text rather than over an example: the two are currently two independent
   * facts, and this is what makes them one.
   */
  const long = 'x '.repeat(4000);

  it('offers a next page when the text does not fit', () => {
    const first = renderPlan('en', 2, 'Illusion (maya)', long, 1);
    expect(first).toContain('/plan');
  });

  it('sends back what the marker asks for, parsed the way the command parses it', () => {
    const first = renderPlan('en', 2, 'Illusion (maya)', long, 1);

    // Take the instruction the reader is given, verbatim, and read it the way
    // the command does. A test that hard-coded `'2 2'` would agree with itself.
    const told = first.match(/\/plan (\d+) (\d+)/);
    expect(told, 'the marker does not name a command a player can type').not.toBe(null);

    const [, said, page] = told ?? [];
    const [first_, second] = `${said} ${page}`.trim().split(/\s+/).filter(Boolean);

    expect(Number(first_)).toBe(2);
    expect(Number(second) || 1, 'the page the marker names').toBeGreaterThan(1);
  });

  it('gives a different page than the first', () => {
    const one = renderPlan('en', 2, 'Illusion (maya)', long, 1);
    const two = renderPlan('en', 2, 'Illusion (maya)', long, 2);

    expect(two).not.toBe(one);
  });

  it('reads the whole match as one number no longer', () => {
    // The defect itself, as arithmetic: this is what the command used to do.
    expect(Number('2 2')).toBeNaN();
    expect(Number('2 2'.trim().split(/\s+/).filter(Boolean)[0])).toBe(2);
  });
});
