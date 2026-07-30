import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS } from '@leela/engine';
import { planEntries } from '../src/browse';
import { path, record, revisited, writingsOn, type Journal } from '../src/reports';

/**
 * Coming back to a square, which is what the game is about.
 *
 * Leela's teaching is that the same states arrive again: you stand on 41 in
 * February and on 41 again in September, and what you wrote the first time is
 * the measure of what has changed. This app recorded every one of those returns
 * — `record` appends, so a second report about a square does not overwrite the
 * first — and then offered them only as a path: everything, oldest first, one
 * flat run of text. Two accounts of the same square could be a year and forty
 * entries apart and nothing would put them together.
 *
 * The competing apps all sell this. `com.gmapp.lillagame` leads its listing
 * with recurring life patterns; none of them builds it. The published app's
 * `UserProfileScreen` renders `history.map` — one flat chronological list — and
 * its `HistoryT` does not even carry the report text.
 *
 * The rule these tests hold is not the two or three cases below. It is:
 * **everything a player wrote about a square is what reading that square shows,
 * and nothing they wrote about another one.**
 */

/** A journal built by playing: reports filed in the order they were written. */
function written(plans: ReadonlyArray<number>): Journal {
  let journal: Journal = { reported: true, entries: [] };

  plans.forEach((plan, index) => {
    // Distinct, increasing timestamps: two reports filed in the same
    // millisecond would make "oldest first" a claim about nothing.
    journal = record(journal, plan, `about ${plan}, entry ${index}`, 1_700_000_000_000 + index);
  });

  return journal;
}

/** A game that returns: some squares once, some twice, one many times. */
const GAME = [6, 41, 12, 41, 3, 12, 41, 68, 41, 9];

describe('what reading a square shows', () => {
  it('is everything written about it and nothing written about another', () => {
    const journal = written(GAME);

    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      const shown = writingsOn(journal, plan);

      expect(
        shown.every((entry) => entry.plan === plan),
        `plan ${plan}`,
      ).toBe(true);
      expect(shown.length, `plan ${plan}`).toBe(
        journal.entries.filter((entry) => entry.plan === plan).length,
      );
    }
  });

  it('accounts for every entry exactly once across the whole board', () => {
    // The half the check above cannot give: nothing is shown twice, and
    // nothing is lost between the squares.
    const journal = written(GAME);
    const gathered = Array.from({ length: TOTAL_PLANS }, (_, index) =>
      writingsOn(journal, index + 1),
    ).flat();

    expect(gathered.length).toBe(journal.entries.length);
    expect([...gathered].sort((a, b) => a.at - b.at)).toEqual(path(journal));
  });

  it('is oldest first, so the change is what a reader sees', () => {
    const journal = written(GAME);

    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      const stamps = writingsOn(journal, plan).map((entry) => entry.at);
      expect([...stamps].sort((a, b) => a - b), `plan ${plan}`).toEqual(stamps);
    }
  });

  it('is nothing at all for a square never written about', () => {
    const journal = written([41]);
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      if (plan === 41) continue;
      expect(writingsOn(journal, plan), `plan ${plan}`).toEqual([]);
    }
  });
});

describe('the squares a player keeps returning to', () => {
  it('are exactly those written about more than once', () => {
    const journal = written(GAME);
    const returned = new Map(revisited(journal).map((visit) => [visit.plan, visit.times]));

    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      const times = writingsOn(journal, plan).length;
      expect(returned.get(plan), `plan ${plan}`).toBe(times > 1 ? times : undefined);
    }
  });

  it('are none at all in a game that never repeated', () => {
    expect(revisited(written([1, 2, 3, 4, 5]))).toEqual([]);
  });

  it('come most-returned first, and the same way every time', () => {
    const journal = written(GAME);
    const once = revisited(journal);
    const again = revisited({ ...journal, entries: [...journal.entries].reverse() });

    expect(once.map((visit) => visit.times)).toEqual(
      [...once.map((visit) => visit.times)].sort((a, b) => b - a),
    );
    // Reordering the entries must not reorder the answer: a list that shuffles
    // between two identical journals is a list nobody can read twice.
    expect(again).toEqual(once);
  });
});

describe('the list of all 72', () => {
  it('marks a square exactly when the player has returned to it', () => {
    const journal = written(GAME);
    const returns = new Map(revisited(journal).map((visit) => [visit.plan, visit.times]));

    for (const entry of planEntries('en', undefined, returns)) {
      const times = writingsOn(journal, entry.key as number).length;
      expect(entry.returns, `plan ${entry.key}`).toBe(times > 1 ? times : undefined);
    }
  });

  it('marks nothing when no journal is passed at all', () => {
    // The reader and the rules book open this list too, and a mark there would
    // be counting a game nobody asked about.
    expect(planEntries('en', 41).some((entry) => entry.returns !== undefined)).toBe(false);
  });

  it('still lists all 72 in order, marked or not', () => {
    const returns = new Map([[41, 3]]);
    const entries = planEntries('en', 41, returns);

    expect(entries).toHaveLength(TOTAL_PLANS);
    expect(entries.map((entry) => entry.key)).toEqual(
      Array.from({ length: TOTAL_PLANS }, (_, index) => index + 1),
    );
  });
});
