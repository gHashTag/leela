import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS } from '@leela/engine';
import { planEntries } from '../src/browse';
import {
  loadJournalFor,
  path,
  pathSections,
  record,
  revisited,
  saveJournalFor,
  writingsOn,
  type Journal,
} from '../src/reports';
import { saveDraft } from '../src/state';

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

describe('the path view, seat by seat', () => {
  /**
   * The thing that can go wrong here is not rendering: it is whose.
   *
   * Every journal in this app is per seat — the pass that fixed the intention
   * and the draft found that out the hard way — and the defect this shape keeps
   * producing is a screen that computes one player's summary and draws it under
   * another player's name. `pathSections` takes the journals and returns the
   * sections, so the question can be asked directly.
   */
  const SEATS = [
    { id: 'p1', journal: written([6, 41, 41, 41]), intention: 'to stop hurrying' },
    { id: 'p2', journal: written([12, 12, 9]), intention: 'to say it out loud' },
    { id: 'p3', journal: written([3]) },
    { id: 'p4', journal: written([]), intention: 'to begin' },
  ];

  it('gives every seat its own returns and nobody else’s', () => {
    const sections = pathSections(SEATS);

    expect(sections).toHaveLength(SEATS.length);
    for (const [index, section] of sections.entries()) {
      const own = SEATS[index] as (typeof SEATS)[number];

      expect(section.playerId).toBe(own.id);
      expect(section.seat).toBe(index + 1);
      expect(section.returns).toEqual(revisited(own.journal));
      expect(section.entries).toEqual(path(own.journal));
      // The intention is the frame the reports are written inside, and it used
      // to be drawn once at the top under the word "you" — so at a shared
      // table every other player read the turn holder's question as theirs.
      expect(section.intention).toBe(
        (own as { intention?: string }).intention ?? '',
      );
    }
  });

  it('never shows a seat a square only another seat returned to', () => {
    // The rule stated over the pairs rather than by naming p1 and p2: whatever
    // came back to somebody else is not this player's to see.
    const sections = pathSections(SEATS);

    for (const [index, section] of sections.entries()) {
      const mine = new Set(section.returns.map((visit) => visit.plan));

      for (const [other, elsewhere] of sections.entries()) {
        if (other === index) continue;
        for (const visit of elsewhere.returns) {
          const alsoMine = writingsOn(
            (SEATS[index] as (typeof SEATS)[number]).journal,
            visit.plan,
          ).length;
          if (alsoMine <= 1) expect(mine.has(visit.plan), `${index} vs ${other}`).toBe(false);
        }
      }
    }
  });

  it('gives a seat that has written nothing an empty section rather than none', () => {
    // A missing section is a player missing from their own path view; an empty
    // one is a player who has not written yet. Only the second is true.
    const sections = pathSections(SEATS);
    const last = sections[sections.length - 1];

    expect(last?.playerId).toBe('p4');
    expect(last?.entries).toEqual([]);
    expect(last?.returns).toEqual([]);
  });

  it('keeps seating order, which is how the view labels them', () => {
    expect(pathSections(SEATS).map((section) => section.seat)).toEqual([1, 2, 3, 4]);
  });

  it('never hands one seat another seat’s question', () => {
    // The rule over the pairs rather than by naming p1: an intention belongs to
    // exactly one section, and a seat that has not answered has none — not
    // somebody else's.
    const sections = pathSections(SEATS);

    for (const [index, section] of sections.entries()) {
      for (const [other, elsewhere] of sections.entries()) {
        if (other === index || elsewhere.intention === '') continue;
        if (section.intention === '') continue;
        expect(section.intention === elsewhere.intention, `${index} vs ${other}`).toBe(false);
      }
    }

    expect(sections.find((section) => section.playerId === 'p3')?.intention).toBe('');
  });
});

describe('what the box asking for the next account shows', () => {
  /**
   * The writer now opens with what was written here the last times, because
   * that is the moment it matters: the game is asking for another account of
   * the same square, and the measure of what has changed is the last one. It
   * was already in the app — in the reader, one dialog away.
   *
   * The failure this invites is specific. A draft is saved on every keystroke,
   * and if an unfiled one ever counted as an account, a player would reopen the
   * box and be shown their own half-sentence quoted back at them as something
   * they had already said. What you are saying is not what you have said.
   */
  function memory(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
    } as unknown as Storage;
  }

  it('never counts the draft in progress as something already said', () => {
    const store = memory();
    saveJournalFor(store, 'p1', written([41, 41]));

    const before = writingsOn(loadJournalFor(store, 'p1'), 41);
    saveDraft(store, 'p1', 41, 'Halfway through a sentence about this square');

    expect(writingsOn(loadJournalFor(store, 'p1'), 41)).toEqual(before);
  });

  it('shows the seat’s own accounts and not the seat beside them', () => {
    // Two people on one phone can stand on the same square, and the box asks
    // one of them for an account of it.
    const store = memory();
    saveJournalFor(store, 'p1', written([41, 41]));
    saveJournalFor(store, 'p2', written([41]));

    expect(writingsOn(loadJournalFor(store, 'p1'), 41)).toHaveLength(2);
    expect(writingsOn(loadJournalFor(store, 'p2'), 41)).toHaveLength(1);
  });

  it('shows nothing at all the first time a square is met', () => {
    const store = memory();
    saveJournalFor(store, 'p1', written([6, 12]));

    expect(writingsOn(loadJournalFor(store, 'p1'), 41)).toEqual([]);
  });
});
