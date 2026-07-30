import { describe, expect, it } from 'vitest';
import { planFor } from '@leela/content';
import { revisited } from '@leela/journal';
import {
  join,
  openRoom,
  returns,
  returnsFor,
  start,
  type PathEntry,
  type Room,
} from '../src/commands';

/** A table with two players, already started. */
function table(count = 2): Room {
  let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, 20260731).room as Room;
  for (let i = 2; i <= count; i++) {
    room = join(room, { id: `u${i}`, name: `P${i}` }).room as Room;
  }
  return start(room, 'u1').room as Room;
}

/**
 * `/returns` — the squares that came back.
 *
 * `/path` is everything a player has written, oldest first, and it answers
 * "what have I written". It cannot answer the question the game is actually
 * about: what keeps arriving. A player forty entries in has the material for
 * that answer and no way to ask for it — two accounts of plan 41 sit a year
 * apart in one long scroll.
 *
 * The answer is `@leela/journal`'s, because the mini app worked it out first
 * and a second implementation is two answers. What is asserted here is the
 * bot's half: that the reply says what the shared function decided, and that
 * the three different situations stay three different statements.
 */

const day = 86_400_000;

function rows(plans: ReadonlyArray<number>): PathEntry[] {
  return plans.map((plan, index) => ({
    plan,
    text: `entry ${index} about ${plan}`,
    createdAt: new Date(1_700_000_000_000 + index * day),
  }));
}

/** A game that returns: 41 four times, 12 twice, the rest once. */
const GAME = [6, 41, 12, 41, 3, 12, 41, 68, 41, 9];

describe('the squares that came back', () => {
  it('names every square that returned and none that did not', () => {
    // The rule rather than a list: whatever the game was, the reply mentions a
    // square exactly when the shared function counted more than one writing
    // about it.
    const entries = rows(GAME);
    const text = returnsFor('en', entries)
      .map((reply) => reply.text)
      .join('\n');

    const returned = new Set(revisited(entries).map((visit) => visit.plan));

    for (const plan of new Set(GAME)) {
      const named = text.includes(planFor('en', plan).title);
      expect(named, `plan ${plan}`).toBe(returned.has(plan));
    }
  });

  it('carries every writing about a square that returned', () => {
    const entries = rows(GAME);
    const text = returnsFor('en', entries)
      .map((reply) => reply.text)
      .join('\n');

    for (const entry of entries) {
      const returned = revisited(entries).some((visit) => visit.plan === entry.plan);
      expect(text.includes(entry.text), `${entry.plan}: ${entry.text}`).toBe(returned);
    }
  });

  it('puts a square’s writings oldest first, which is the only order that says anything', () => {
    // The first account is what the later ones are measured against. Handed
    // newest-first, as a store may well return them.
    const entries = [...rows(GAME)].reverse();
    const text = returnsFor('en', entries)
      .map((reply) => reply.text)
      .join('\n');

    const forty = rows(GAME).filter((entry) => entry.plan === 41);
    const places = forty.map((entry) => text.indexOf(entry.text));

    expect(places.every((place) => place >= 0)).toBe(true);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
  });

  it('keeps three situations three statements', () => {
    // A store that keeps nothing and a player who has written nothing and a
    // player whose squares have not repeated are different facts, and one
    // message for two of them is the app lying about one.
    const absent = returnsFor('en', null)[0]?.text ?? '';
    const nothing = returnsFor('en', [])[0]?.text ?? '';
    const noRepeat = returnsFor('en', rows([1, 2, 3]))[0]?.text ?? '';

    expect(absent).not.toBe(nothing);
    expect(new Set([absent, nothing, noRepeat]).size).toBeGreaterThan(1);
    expect(nothing).toBe(noRepeat);
  });

  it('answers in the language it is given', () => {
    const text = returnsFor('ru', rows(GAME))
      .map((reply) => reply.text)
      .join('\n');

    expect(text).toContain(planFor('ru', 41).title);
  });

  it('answers privately, and needs no table', () => {
    const entries = rows(GAME);
    expect(returns(table(2), 'stranger', entries).replies[0]?.broadcast).toBe(false);
    expect(returnsFor('en', entries).length).toBeGreaterThan(0);
  });

  it('changes nothing about the game', () => {
    const room = table(2);
    expect(returns(room, 'u1', rows(GAME)).room).toEqual(room);
  });
});
