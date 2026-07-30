import { describe, expect, it } from 'vitest';
import { MAX_SEATS } from '@leela/engine';
import * as reports from '../src/reports';
import * as seats from '../src/seats';
import * as state from '../src/state';
import type { GameStorage } from '../src/state';

/**
 * What belongs to a player, and what belongs to the device.
 *
 * The published app keeps one profile per account — `Profiles/{uid}` — and the
 * player's plan, history, `isReported` and **intention** are all fields on it.
 * `updateIntention` writes it there beside the rest. When this app grew seats,
 * three of those four moved to the seat and the intention stayed with the
 * device: one key, `leela.intention.v1`, read once at startup and never again.
 *
 * So three people sharing a phone played for one question. The second and third
 * were never asked what they were playing for — they inherited the first's — and
 * a square shared by the third was signed with the first's intention. The
 * draft had the same shape of fault from the other side: the owner was checked
 * but the shelf was one, so a second player typing overwrote the first player's
 * unfinished sentence and the check then correctly refused to give either of
 * them anything.
 *
 * The rule this file holds is not a list of the two that were wrong. It is:
 * **whatever a player writes is that player's own** — no other seat can read
 * it, and no other seat can destroy it by writing their own.
 */

/** A storage that remembers, and can say what was written to. */
function recording() {
  const map = new Map<string, string>();

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    keys: () => [...map.keys()].filter((key) => (map.get(key) ?? '') !== ''),
  };
}

/** Every seat a table can have, which is where two players become six. */
const SEATS = Array.from({ length: MAX_SEATS }, (_, index) => seats.seatId(index));

/**
 * One thing a player writes, as the app writes it.
 *
 * Written and read through the app's own functions rather than through keys: a
 * store that keeps its owner inside the value would pass a check on key names
 * and still hand one player another player's words.
 */
interface Own {
  what: string;
  write: (storage: GameStorage, playerId: string, text: string) => void;
  read: (storage: GameStorage, playerId: string) => string;
}

const PLAN = 41;

const OWN: Own[] = [
  {
    what: 'the journal',
    write: (storage, playerId, text) =>
      reports.saveJournalFor(storage, playerId, {
        reported: true,
        entries: [{ plan: PLAN, text, at: 1_700_000_000_000 }],
      }),
    read: (storage, playerId) =>
      reports
        .loadJournalFor(storage, playerId)
        .entries.map((entry) => entry.text)
        .join(' '),
  },
  {
    what: 'the draft',
    write: (storage, playerId, text) => state.saveDraft(storage, playerId, PLAN, text),
    read: (storage, playerId) => state.loadDraft(storage, playerId, PLAN),
  },
  {
    what: 'the intention',
    write: (storage, playerId, text) => void state.saveIntention(storage, text, playerId),
    read: (storage, playerId) => state.loadIntention(storage, playerId),
  },
];

describe('what a player writes is that player’s own', () => {
  it('is never read back by another seat', () => {
    for (const own of OWN) {
      for (const author of SEATS) {
        const store = recording();
        const written = `${author} wrote this, and meant it privately.`;
        own.write(store, author, written);

        for (const other of SEATS) {
          if (other === author) continue;
          expect(own.read(store, other), `${own.what}: ${author} → ${other}`).toBe('');
        }

        expect(own.read(store, author), `${own.what}: ${author}`).toContain(written);
      }
    }
  });

  it('survives another seat writing their own', () => {
    // The half of the rule a per-value owner check cannot give you. Reading is
    // refused correctly and the writing is gone anyway, which looks from the
    // inside exactly like a player who never wrote anything.
    for (const own of OWN) {
      const store = recording();
      const first = 'The first player, mid-sentence.';
      own.write(store, SEATS[0] as string, first);

      for (const other of SEATS.slice(1)) {
        own.write(store, other, `${other} writing over the top.`);
      }

      expect(own.read(store, SEATS[0] as string), own.what).toContain(first);
    }
  });

  it('keeps the key it had before there were seats, for the seat that had it', () => {
    // Weeks of play happened with one player and one key. Moving that writing
    // to a new name to add seats would be a feature that costs somebody their
    // path, their unfinished sentence, or the question they came with.
    for (const [keyFor, written] of [
      [reports.journalKeyFor, 'p1'],
      [state.draftKeyFor, 'p1'],
      [state.intentionKeyFor, 'p1'],
    ] as const) {
      expect(keyFor(written)).not.toContain('.p1');
    }

    const store = recording();
    store.setItem(state.INTENTION_KEY, 'to see it through');
    expect(state.loadIntention(store, 'p1')).toBe('to see it through');
    expect(state.loadIntention(store, 'p2')).toBe('');
  });

  it('goes on a shelf no other seat writes to', () => {
    // Key-level, because the two rules above are about values and this is the
    // reason they hold: two players sharing one key is one player losing.
    for (const own of OWN) {
      const first = recording();
      own.write(first, 'p1', 'one');
      const second = recording();
      own.write(second, 'p2', 'two');

      expect(first.keys().filter((key) => second.keys().includes(key)), own.what).toEqual([]);
    }
  });
});

describe('every shelf this app has is classified', () => {
  /**
   * The guard against the next one.
   *
   * `leela.intention.v1` was not wrong when it was written — there was one
   * player. It became wrong when seats arrived and nobody re-read the list of
   * keys. So the list is a test: a new `*_KEY` has to be declared as one or the
   * other, and a per-player one has to arrive with a `*KeyFor` beside it.
   */
  const DEVICE_WIDE: ReadonlyArray<[string, string]> = [
    [state.STORAGE_KEY, 'the pre-seats game, read once to seat whoever was playing'],
    [state.DIE_KEY, 'the face on screen, which is the device’s and not a player’s'],
    [seats.SEATS_KEY, 'the table itself'],
  ];

  const PER_PLAYER: ReadonlyArray<[string, (playerId: string) => string]> = [
    [reports.REPORTS_KEY, reports.journalKeyFor],
    [state.DRAFT_KEY, state.draftKeyFor],
    [state.INTENTION_KEY, state.intentionKeyFor],
  ];

  it('declares every key the app defines as the device’s or a player’s', () => {
    const defined = [state, reports, seats].flatMap((module) =>
      Object.entries(module)
        .filter(([name, value]) => name.endsWith('_KEY') && typeof value === 'string')
        .map(([, value]) => value as string),
    );

    const classified = new Set([
      ...DEVICE_WIDE.map(([key]) => key),
      ...PER_PLAYER.map(([key]) => key),
    ]);

    expect([...new Set(defined)].filter((key) => !classified.has(key))).toEqual([]);
  });

  it('gives every player their own shelf for the ones that are theirs', () => {
    for (const [key, keyFor] of PER_PLAYER) {
      const shelves = SEATS.map((seat) => keyFor(seat));

      expect(new Set(shelves).size, key).toBe(SEATS.length);
      // The first seat's shelf is the original name; nobody else's is.
      expect(shelves[0], key).toBe(key);
      for (const shelf of shelves.slice(1)) expect(shelf, key).toContain(key);
    }
  });
});
