/**
 * When the bot says you may throw, there must be something to throw with.
 *
 * Its owner reported the moves as broken, and the screenshot showed why:
 *
 *     Отчёт от Dmitrii T27 DEV принят. Можно бросать.
 *
 * with no die under it, and the only button on the screen being the one that
 * opens the board. `/roll` still worked. Knowing to type `/roll` is not
 * something a player should have to do, and **a permission granted in a
 * sentence and withheld in the interface is indistinguishable from a bug.**
 *
 * The cause is worth stating precisely, because the button was never missing
 * globally. `buttonsFor` drops `roll` while a report is owed — correctly: the
 * game is waiting for an account of where the player landed, and offering the
 * die then is offering to skip it. But `roll` was the only command that put a
 * keyboard back, so after a throw that owed a report the last markup on screen
 * was the one drawn WITHOUT the die, and filing the report — the exact moment
 * the debt clears — redrew nothing.
 *
 * So this asserts the invariant rather than the line: every reply that says the
 * player may throw carries a way to throw. Written that way because the same
 * defect can return through any other command that clears a debt.
 */

import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import { isSessionOver } from '@leela/engine';

import { buttonsFor, openRoom, report, roll, start } from '../src/commands';
import type { Room } from '../src/commands';

const PLAYER = '1018085064';
const NAME = 'Дмитрий';
const NOW = 1_788_400_000_000;

/** A room with one player, seated and standing on the board. */
const seated = (): Room => {
  const opened = openRoom('chat', { id: PLAYER, name: NAME }, 1, { language: 'ru' });
  const room = opened.room as Room;
  return (start(room, PLAYER).room ?? room) as Room;
};

/**
 * Play the game to its end, filing a report whenever one is owed.
 *
 * Played rather than forged. My first attempt hand-set `isFinished` and
 * `hasWon` on the seated player's state and the assertion failed — `hasWon`
 * reads the position, not a flag I can write, so what I had built was not a
 * finished game but a shape that resembled one. Reaching a state is the only
 * way to be sure it is the state the code means.
 */
const untilFinished = (): Room | null => {
  let room = seated();
  for (let at = 0; at < 5000; at += 1) {
    if (isSessionOver(room.session)) return room;
    const canThrow = buttonsFor(room).some((b) => b.action === 'roll');
    const out = canThrow
      ? roll(room, PLAYER, NOW + at * 60_000)
      : report(room, PLAYER, 'заметил', NOW + at * 60_000);
    room = (out.room ?? room) as Room;
  }
  return null;
};

/** Throw until the player owes a report, or give up after a bounded search. */
const untilOwing = (): Room | null => {
  let room = seated();
  for (let at = 0; at < 400; at += 1) {
    const out = roll(room, PLAYER, NOW + at * 60_000);
    room = out.room ?? room;
    const buttons = buttonsFor(room).map((b) => b.action);
    if (!buttons.includes('roll')) return room;
  }
  return null;
};

describe('a permission with nothing to press', () => {
  it('reaches a state where the die is withheld, or it is testing nothing', () => {
    // The control for the whole file. If a report is never owed, every
    // assertion below passes vacuously and the defect walks straight back in.
    expect(untilOwing()).not.toBeNull();
  });

  it('gives the die back in the same message that says you may throw', () => {
    const owing = untilOwing();
    expect(owing).not.toBeNull();
    if (owing === null) return;

    // Before: the last keyboard on screen has no die.
    expect(buttonsFor(owing).map((b) => b.action)).not.toContain('roll');

    const filed = report(owing, PLAYER, 'я заметил, что тороплюсь', NOW);
    const last = filed.replies[filed.replies.length - 1];

    expect(last?.text).toBe(messageFor('ru', 'report.filed', { name: NAME }));
    expect(last?.buttons?.map((b) => b.action)).toContain('roll');
  });

  it('labels the die in the room language, not in English', () => {
    const owing = untilOwing();
    if (owing === null) return;
    const filed = report(owing, PLAYER, 'коротко', NOW);
    const die = filed.replies[filed.replies.length - 1]?.buttons?.find((b) => b.action === 'roll');

    expect(die?.label).toBe(messageFor('ru', 'button.roll'));
    expect(die?.label).not.toMatch(/roll/i);
  });

  it('reaches the end of a real game, or the case below proves nothing', () => {
    expect(untilFinished()).not.toBeNull();
  });

  it('offers nothing once the session is over', () => {
    // The other half of the invariant: a die under a finished game is an offer
    // the engine will refuse, which is this same defect pointed the other way.
    const finished = untilFinished();
    if (finished === null) return;
    expect(isSessionOver(finished.session)).toBe(true);

    const filed = report(finished, PLAYER, 'дошёл', NOW);
    const last = filed.replies[filed.replies.length - 1];
    expect(last?.buttons ?? []).toEqual([]);
  });
});
