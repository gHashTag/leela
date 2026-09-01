/**
 * One unreadable line, and forty accounts gone.
 *
 * `loadJournal` refused the whole file over any single bad entry, on an
 * argument written above `isJournal`: *losing what someone wrote is bad, and
 * handing the game a report about plan 900 is worse*. Both halves are true.
 * The choice between them was not: dropping the entry about plan 900 and
 * keeping the other forty does neither harm.
 *
 * What the choice cost, measured on this browser before anything changed —
 * forty accounts and one damaged entry written to `localStorage`:
 *
 *   on the disk                    41
 *   read into the app               0   (and nothing said)
 *   the player writes one more
 *   on the disk                     1
 *
 * A year of writing destroyed by one bad line, permanently, and the overwrite
 * done by the app itself a moment later. This is the published surface.
 *
 * The rule asserted here is not "forty survive one bad entry". It is that for
 * any file this app wrote, **what comes back plus what is reported lost is what
 * was there**, and every entry that comes back is one the format accepts. A
 * forty-second way to damage a line is covered by the same sentence.
 */

import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS } from '@leela/engine';
import { isJournal, readJournal, saveJournal, REPORTS_KEY, type Journal } from '../src/reports';

const account = (plan: number) => ({
  plan,
  text: `something written about plan ${plan}`,
  at: 1_700_000_000_000 + plan,
});

/** Entries the format refuses, one of each shape it knows how to refuse. */
const damaged: unknown[] = [
  { plan: 900, text: 'a square nobody has stood on', at: 1 },
  { plan: 0, text: 'nor that one', at: 1 },
  { plan: TOTAL_PLANS + 1, text: 'nor the one past the end', at: 1 },
  { plan: 1.5, text: 'nor half a square', at: 1 },
  { plan: 4 },
  { plan: 4, text: '', at: 1 },
  { plan: 4, text: 'a moment that is not one', at: 1.5 },
  { plan: 4, text: 'nor a moment before time', at: -1 },
  { plan: 4, text: 'no moment at all', at: 'yesterday' },
  'not an entry',
  null,
  42,
];

function browser() {
  const held = new Map<string, string>();
  return {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => {
      held.set(key, value);
    },
    /** What is actually on the disk, as opposed to what the app is holding. */
    onDisk: (key = REPORTS_KEY) => JSON.parse(held.get(key) ?? 'null') as Journal | null,
  };
}

const wrote = (entries: unknown[], reported = false) =>
  JSON.stringify({ reported, entries });

describe('a path with an unreadable line in it', () => {
  it('accounts for every entry that was written', () => {
    // kept + dropped = written, for every mixture. A reader that quietly
    // filtered satisfies the first term alone; the old one satisfied neither.
    const unaccounted: string[] = [];

    for (let bad = 0; bad <= damaged.length; bad += 1) {
      for (const good of [0, 1, 40]) {
        const entries = [
          ...Array.from({ length: good }, (_, at) => account((at % TOTAL_PLANS) + 1)),
          ...damaged.slice(0, bad),
        ];

        const store = browser();
        store.setItem(REPORTS_KEY, wrote(entries));
        const back = readJournal(store);

        if (back.journal.entries.length + back.dropped !== entries.length) {
          unaccounted.push(
            `${good} good and ${bad} damaged: ${back.journal.entries.length} kept, ` +
              `${back.dropped} reported, ${entries.length} written`,
          );
        }
      }
    }

    expect(unaccounted).toEqual([]);
  });

  it('hands the game nothing the format refuses', () => {
    // The other half of the argument this replaces, kept whole: a report about
    // plan 900 must not reach the board, whatever else survives beside it.
    const store = browser();
    store.setItem(REPORTS_KEY, wrote([account(1), ...damaged, account(2)]));

    const back = readJournal(store);

    expect(isJournal(back.journal)).toBe(true);
    expect(back.journal.entries.map((entry) => entry.plan)).toEqual([1, 2]);
  });

  it('does not destroy what it kept when the next account is written', () => {
    // The permanent half. The app saves what it is holding, so whatever the
    // read threw away is gone from the disk one account later.
    const store = browser();
    const path = Array.from({ length: 40 }, (_, at) => account(at + 1));
    store.setItem(REPORTS_KEY, wrote([...path.slice(0, 20), damaged[0], ...path.slice(20)]));

    const back = readJournal(store);
    saveJournal(store, {
      reported: true,
      entries: [...back.journal.entries, account(41)],
    });

    expect(store.onDisk()?.entries).toHaveLength(41);
  });

  it('reports nothing lost when nothing was', () => {
    // Otherwise "kept + dropped = written" is satisfiable by losing everything.
    const store = browser();
    store.setItem(REPORTS_KEY, wrote([account(1), account(2), account(3)]));

    expect(readJournal(store)).toEqual({
      journal: { reported: false, entries: [account(1), account(2), account(3)] },
      dropped: 0,
    });
  });

  it('keeps the flag the file was written with', () => {
    const store = browser();
    store.setItem(REPORTS_KEY, wrote([account(1), damaged[0]], true));

    expect(readJournal(store).journal.reported).toBe(true);
  });

  it('calls a file that is not this app\'s an absence, not a loss', () => {
    // No count to give, and nothing the player wrote is being described. There
    // is no salvage in a file whose flag is not a boolean: nothing inside it
    // can be trusted to be an entry either.
    // `EMPTY` is `reported: true`: a path with nothing in it owes no account.
    const nothing = { journal: { reported: true, entries: [] }, dropped: 0 };

    for (const raw of [
      'not json at all',
      '42',
      'null',
      '{}',
      '{"entries":[]}',
      '{"reported":"yes","entries":[]}',
      '{"reported":false,"entries":"none"}',
    ]) {
      const store = browser();
      store.setItem(REPORTS_KEY, raw);
      expect({ raw, ...readJournal(store) }).toEqual({ raw, ...nothing });
    }
  });

  it('reports the loss even when nothing at all survived it', () => {
    const store = browser();
    store.setItem(REPORTS_KEY, wrote(damaged));

    const back = readJournal(store);

    expect(back.journal.entries).toEqual([]);
    expect(back.dropped).toBe(damaged.length);
  });
});
