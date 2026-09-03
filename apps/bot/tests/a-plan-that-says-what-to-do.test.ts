/**
 * `/plan` handed over a page of philosophy with no sentence anywhere in it
 * saying what to do next.
 *
 * The mini app already says this clearly — *"Запишите, что вы переживаете на
 * этом плане. Пока не запишете, кубик не бросится."* — sitting right under
 * the board. The chat had nothing like it. A player who plays mostly in a
 * chat and never opens the board had exactly one way to learn the rule
 * exists: throw the die, get refused, and read `roll.reportRequired`. Until
 * then, `/plan` read as a library, not as a game asking something of you.
 *
 * `reportOwedNote` is the fix, and it is deliberately narrow: it speaks only
 * about the VIEWER'S OWN current square, and only while a report is actually
 * owed. Every case below that returns `''` is as important as the one that
 * doesn't — a reminder attached to the wrong square is worse than none,
 * because it teaches a player that the game talks about things that aren't
 * true of them.
 */

import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import { join, openRoom, plan, report, reportOwedNote, roll, start, type Room } from '../src/commands';

const NOW = 1_700_000_000_000;

/** A single-seat table, started, so `roll` always lands the one player. */
function soloTable(seed: number): Room {
  let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, seed).room as Room;
  room = start(room, 'u1').room as Room;
  return room;
}

/** The first seed, among the first hundred, whose first throw enters the board. */
function seedThatEnters(): number {
  for (let seed = 0; seed < 100; seed += 1) {
    const after = roll(soloTable(seed), 'u1', NOW).room as Room;
    if (after.session.players[0]?.state.loka !== 68) return seed;
  }
  throw new Error('no entering seed found in the first hundred');
}

describe('the plan a player is standing on says what to do', () => {
  it('reminds a player standing on their own square with no report yet', () => {
    const entered = roll(soloTable(seedThatEnters()), 'u1', NOW).room as Room;
    const square = entered.session.players[0]?.state.loka as number;

    const said = plan(entered, 'u1').replies[0];
    expect(said?.text).toContain(messageFor(entered.language, 'plan.reportOwed'));
    expect(said?.text).toContain('/report');
    // And the reminder comes after the text it is a reminder about.
    expect(said?.text.indexOf('/report')).toBeGreaterThan(said?.text.indexOf(String(square)) ?? -1);
  });

  it('says nothing once the report for that square is filed', () => {
    const entered = roll(soloTable(seedThatEnters()), 'u1', NOW).room as Room;
    const filed = report(entered, 'u1', 'It brought up patience.', NOW).room as Room;

    const said = plan(filed, 'u1').replies[0];
    expect(said?.text).not.toContain(messageFor(filed.language, 'plan.reportOwed'));
  });

  it('says nothing about a square that is not the one they are standing on', () => {
    const entered = roll(soloTable(seedThatEnters()), 'u1', NOW).room as Room;
    const elsewhere = (entered.session.players[0]?.state.loka as number) === 1 ? 2 : 1;

    const said = plan(entered, 'u1', elsewhere).replies[0];
    expect(said?.text).not.toContain(messageFor(entered.language, 'plan.reportOwed'));
  });

  it('says nothing to a player who has not entered the board yet', () => {
    const waiting = soloTable(0);
    const said = plan(waiting, 'u1', 5).replies[0];
    expect(said?.text).not.toContain(messageFor(waiting.language, 'plan.reportOwed'));
  });

  it('says nothing about a square that belongs to somebody else', () => {
    let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, 0).room as Room;
    room = join(room, { id: 'u2', name: 'Bo' }).room as Room;
    room = start(room, 'u1').room as Room;
    room = roll(room, 'u1', NOW).room as Room;
    const adaSquare = room.session.players.find((p) => p.id === 'u1')?.state.loka;
    if (adaSquare === undefined) throw new Error('u1 did not move');

    // u2's own view of u1's square: nothing is owed BY u2.
    const said = reportOwedNote(room, 'u2', adaSquare);
    expect(said).toBe('');
  });

  it('the note itself: empty unless every condition holds', () => {
    // The unit the two integration cases above exercise through the command,
    // tested directly so each branch is named rather than inferred.
    const entered = roll(soloTable(seedThatEnters()), 'u1', NOW).room as Room;
    const square = entered.session.players[0]?.state.loka as number;

    expect(reportOwedNote(entered, 'u1', square)).not.toBe('');
    expect(reportOwedNote(entered, 'u1', square === 1 ? 2 : 1)).toBe('');
    expect(reportOwedNote(entered, 'nobody-seated', square)).toBe('');

    const filed = report(entered, 'u1', 'noted', NOW).room as Room;
    expect(reportOwedNote(filed, 'u1', square)).toBe('');
  });
});
