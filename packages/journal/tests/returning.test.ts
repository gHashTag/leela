import { describe, expect, it } from 'vitest';
import { revisited, writingsOn, type Report } from '../src/index';

/**
 * Coming back to a square, held in one place because two surfaces need it.
 *
 * The mini app worked this out first: `record` had always appended, so every
 * return was already stored, and the only way to read reports was the whole
 * path — everything, oldest first, one flat run. The bot has exactly the same
 * material behind `/path` and had exactly the same gap.
 *
 * A second implementation is two answers. That is what this package is for, and
 * it is why `revisited` is stated over `{ plan }` alone: the bot's rows carry
 * `createdAt` where the file format carries `at`, and the answer must not
 * depend on which of the two is asking.
 */

const at = (index: number) => 1_700_000_000_000 + index;

function reports(plans: ReadonlyArray<number>): Report[] {
  return plans.map((plan, index) => ({ plan, text: `about ${plan}, entry ${index}`, at: at(index) }));
}

/** A game that returns: some squares once, some twice, one many times. */
const GAME = [6, 41, 12, 41, 3, 12, 41, 68, 41, 9];

describe('the squares that came back', () => {
  it('are exactly those written about more than once', () => {
    const entries = reports(GAME);
    const counted = new Map(revisited(entries).map((visit) => [visit.plan, visit.times]));

    // Named before it is compared. Every other check in this file is true of an
    // empty answer, so without this one `revisited` could return nothing at all
    // and only this test would notice — which a mutation sweep showed it did.
    expect(counted.size).toBeGreaterThan(0);

    for (const plan of new Set(GAME)) {
      const times = entries.filter((entry) => entry.plan === plan).length;
      expect(counted.get(plan), `plan ${plan}`).toBe(times > 1 ? times : undefined);
    }
  });

  it('are none at all in a game that never repeated', () => {
    expect(revisited(reports([1, 2, 3, 4, 5]))).toEqual([]);
    expect(revisited([])).toEqual([]);
  });

  it('do not depend on which surface is asking', () => {
    // The bot's rows and the file's entries are the same fact in two shapes,
    // and a returns list that differed between them would be the defect this
    // package exists to prevent.
    const rows = GAME.map((plan, index) => ({
      plan,
      text: 'kept in sqlite',
      createdAt: new Date(at(index)),
    }));

    expect(revisited(rows)).toEqual(revisited(reports(GAME)));
  });

  it('come most-returned first, and the same way every time', () => {
    const entries = reports(GAME);
    const once = revisited(entries);

    // An empty list is sorted and stable, and says nothing about either.
    expect(once.length).toBeGreaterThan(1);

    expect(once.map((visit) => visit.times)).toEqual(
      [...once.map((visit) => visit.times)].sort((a, b) => b - a),
    );
    // Reordering the entries must not reorder the answer: a list that shuffles
    // between two identical journals is a list nobody can read twice.
    expect(revisited([...entries].reverse())).toEqual(once);
  });
});

describe('what was written about one square', () => {
  it('is everything about it and nothing about another', () => {
    const entries = reports(GAME);

    for (const plan of new Set(GAME)) {
      const shown = writingsOn(entries, plan);
      expect(shown.every((entry) => entry.plan === plan), `plan ${plan}`).toBe(true);
      expect(shown.length, `plan ${plan}`).toBe(
        entries.filter((entry) => entry.plan === plan).length,
      );
    }
  });

  it('accounts for every entry exactly once across the board', () => {
    // The half the check above cannot give: nothing shown twice, nothing lost
    // between the squares.
    const entries = reports(GAME);
    const gathered = [...new Set(GAME)].flatMap((plan) => writingsOn(entries, plan));

    expect(gathered.length).toBe(entries.length);
    expect(new Set(gathered.map((entry) => entry.at)).size).toBe(entries.length);
  });

  it('is oldest first, whatever order it was handed', () => {
    const entries = reports(GAME);

    for (const source of [entries, [...entries].reverse()]) {
      for (const plan of new Set(GAME)) {
        const stamps = writingsOn(source, plan).map((entry) => entry.at);
        expect([...stamps].sort((a, b) => a - b), `plan ${plan}`).toEqual(stamps);
      }
    }
  });

  it('is nothing at all for a square never written about', () => {
    expect(writingsOn(reports([41]), 6)).toEqual([]);
  });
});
