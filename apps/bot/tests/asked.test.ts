import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank, callsTo } from '../../../scripts/lib/source.mjs';
import { messageFor } from '@leela/content';
import { currentPlayer } from '@leela/engine';
import { openRoom, roll, start, type Room } from '../src/commands';

/**
 * The question comes before the die, here as on every other surface.
 *
 * The published app will not let anybody near the board without one —
 * `if (!prof.intention) navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true })`
 * in `screens/helper.ts`, with the back gesture blocked — the mini app's
 * `mayThrow` refuses, and the phone was given the same gate. The bot was the one
 * surface where a whole game could be played without ever being asked what it
 * was being played for.
 *
 * *The one difference between surfaces this repository does not allow is what
 * the game asks of a player.* Not a `RuleSet` change: the gate lives in the
 * surfaces and not in `@leela/engine`, exactly as it did when the phone joined
 * them.
 *
 * **How it was found.** `intention.ask` — *What are you playing for? Send
 * /intention followed by your answer.* — has been in the catalogue in English
 * and Russian since the bot learned `/intention`, and was said by nobody. A key
 * nothing says is either dead text or a capability nobody wired up.
 */

const BOT = blank(readFileSync(resolve(__dirname, '../src/bot.ts'), 'utf8'));
const NOW = 1_700_000_000_000;
const HOST = { id: 'p1', name: 'Anna' };

/** A table with one player, started and waiting for a throw. */
function table(language = 'en'): Room {
  const opened = openRoom('chat-1', HOST, 4242).room as Room;
  return { ...(start(opened, HOST.id).room as Room), language } as Room;
}

const said = (result: ReturnType<typeof roll>) =>
  result.replies.map((reply) => reply.text).join(' ');

describe('a player who has not said what they are playing for', () => {
  it('is asked, and does not throw', () => {
    const before = table();
    const result = roll(before, HOST.id, NOW, { intention: '' });

    expect(said(result)).toBe(messageFor('en', 'intention.ask'));
    expect(result.room, 'nothing moved').toBe(before);
  });

  it('is asked in the table\'s language, not in the catalogue\'s', () => {
    const russian = table('ru');

    expect(said(roll(russian, HOST.id, NOW, { intention: '' }))).toBe(
      messageFor('ru', 'intention.ask'),
    );
  });

  it('is asked when the answer is only whitespace', () => {
    // A gate cleared by spaces is the rule with its point removed — the same
    // sentence this repository wrote about a report cleared by an empty string.
    expect(said(roll(table(), HOST.id, NOW, { intention: '   \n\t ' }))).toBe(
      messageFor('en', 'intention.ask'),
    );
  });
});

describe('a player who has', () => {
  it('throws', () => {
    const result = roll(table(), HOST.id, NOW, { intention: 'to see what I keep avoiding' });

    expect(said(result)).not.toBe(messageFor('en', 'intention.ask'));
    expect(result.room?.session.rollCount, 'the die turned').toBe(1);
  });

  it('is asked once and not again', () => {
    // The gate is a question, not a toll: a player who has answered plays on.
    let room: Room = table();
    const asked = { intention: 'to see what I keep avoiding' };

    for (let turn = 0; turn < 5; turn += 1) {
      const result = roll(room, currentPlayer(room.session).id, NOW + turn * 1_000, asked);
      expect(said(result), `turn ${turn}`).not.toBe(messageFor('en', 'intention.ask'));
      if (result.room) room = result.room;
      if (said(result).includes('before you move on')) break;
    }
  });
});

describe('a deployment that cannot hold a question', () => {
  it('does not gate, because refusing would end the game for everybody on it', () => {
    /**
     * Absent means *this caller does not deal in intentions*, which is what a
     * bot built with a store that has no `intention` method is. Refusing every
     * throw for an answer there is nowhere to keep would be the app ending
     * somebody's game over a fact about the deployment.
     *
     * The two are different facts and an optional string would make them one:
     * `{ intention: '' }` is *asked, and they have not answered*.
     */
    const result = roll(table(), HOST.id, NOW);

    expect(said(result)).not.toBe(messageFor('en', 'intention.ask'));
    expect(result.room?.session.rollCount).toBe(1);
  });
});

describe('the gate is asked where the die is turned', () => {
  it('is passed at every place the bot rolls', () => {
    /**
     * The guard the optional parameter needs. A default that quietly skips the
     * gate is an absence reading exactly like a pass — so the one caller that
     * *can* read a question must always hand it over, at both the command and
     * the button.
     */
    /**
     * By counting brackets, not by splitting lines. `now()` closes a bracket
     * inside the argument list, and the line split was itself a workaround —
     * one that a call written across two lines defeats. `callsTo` is the shared
     * answer, written down after four checks got this wrong in one night.
     */
    const rolls = callsTo(BOT, 'commands.roll');

    expect(rolls.length, 'the bot rolls somewhere').toBeGreaterThan(1);
    for (const { args } of rolls) {
      expect(args, 'a roll with no question read for it').toMatch(/asked/);
    }
  });

  it('reads it from the store rather than inventing one', () => {
    expect(BOT).toContain('reports.intention');
    expect(BOT).toContain('async function askedOf');
  });

  it('hands over nothing when the store keeps no questions', () => {
    // The other half of the same rule, in the one place that decides it.
    const asked = BOT.slice(BOT.indexOf('async function askedOf'));
    expect(asked.slice(0, 300)).toContain('if (!reports.intention) return undefined');
  });
});
