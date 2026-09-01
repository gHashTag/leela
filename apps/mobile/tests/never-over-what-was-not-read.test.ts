/**
 * A path nobody managed to read is not a path to write over.
 *
 * `keep` writes the whole path. That is right when the app knows what the phone
 * already holds, and wrong when it does not — and `loadKept` could not tell the
 * two apart, because `within` returns its fallback on a timeout and the
 * fallback was `null`, the same word the store returns for an empty slot.
 *
 * Measured through this app's own functions, before anything changed. A phone
 * holding forty accounts and a read that answers a moment past the five-second
 * timeout:
 *
 *   on the disk                    40
 *   read into the app               0   (and nothing reported lost)
 *   the player writes one more
 *   on the disk                     1
 *
 * Thirty-nine accounts destroyed by a slow disk, on the record the game exists
 * to produce, with the app telling the player their account was saved.
 *
 * The rule asserted here is not about five seconds. It is that **the disk never
 * ends up holding less than it did**: whatever the store does — answers, waits,
 * refuses, holds nothing — nothing already written is replaced by a path this
 * app was never told about.
 */

import { describe, expect, it } from 'vitest';
import { EMPTY_PATH, keepPath, loadKept, type Journal, type Keeper } from '../src/journal';

const account = (plan: number) => ({
  plan,
  text: `something written about plan ${plan}`,
  at: 1_700_000_000_000 + plan,
});

/** Forty accounts, as a year of playing leaves them. */
const aYear = Array.from({ length: 40 }, (_, at) => account(at + 1));

/**
 * A phone whose store answers after `delay`, and remembers what it was told.
 */
function phone(delay: number, held: Journal = { entries: aYear }) {
  let stored: string | null = JSON.stringify(held);
  const writes: string[] = [];

  const keeper: Keeper = {
    read: () => new Promise((resolve) => setTimeout(() => resolve(stored), delay)),
    write: async (value: string) => {
      writes.push(value);
      stored = value;
      return true;
    },
  };

  return {
    keeper,
    writes,
    onDisk: () => (stored === null ? [] : (JSON.parse(stored) as Journal).entries),
  };
}

const TIMEOUT = 20;

describe('an account written while the phone is busy', () => {
  it('never leaves the disk holding less than it did', () => {
    // The shape, over every way a store can behave. A test naming five seconds
    // would pass a store that is slow in some other way.
    const stores: Array<[string, number]> = [
      ['answers at once', 1],
      ['answers just in time', TIMEOUT - 5],
      ['answers a moment late', TIMEOUT + 30],
      ['answers much later', TIMEOUT * 20],
    ];

    return Promise.all(
      stores.map(async ([what, delay]) => {
        const device = phone(delay);
        const kept = await loadKept(device.keeper, TIMEOUT);

        // Exactly what the screen does: hold what was read, add the account.
        const session: Journal = { entries: [...kept.journal.entries, account(41)] };
        await keepPath(device.keeper, session, kept.answered, TIMEOUT * 40);

        expect(device.onDisk().length, `a store that ${what}`).toBeGreaterThanOrEqual(aYear.length);
      }),
    );
  });

  it('keeps the new account too, once the phone will say what it holds', async () => {
    // Not writing is the safe answer, and it cannot be the whole answer: a
    // player whose phone is busy for one moment must still end up with what
    // they wrote.
    const device = phone(TIMEOUT + 30);
    const kept = await loadKept(device.keeper, TIMEOUT);
    expect(kept.answered, 'the read is meant to have timed out').toBe(false);

    const session: Journal = { entries: [...kept.journal.entries, account(41)] };
    const written = await keepPath(device.keeper, session, kept.answered, TIMEOUT * 40);

    expect(written.unread).toBe(false);
    expect(written.kept).toBe(true);
    expect(device.onDisk()).toHaveLength(aYear.length + 1);
    expect(device.onDisk().at(-1)?.plan).toBe(41);
  });

  it('writes nothing at all when the phone will not answer either time', async () => {
    // The only choice that cannot lose anything. The account is in the session,
    // the disk keeps what it has, and the caller is told so it can be said.
    const device = phone(TIMEOUT * 100);
    const written = await keepPath(device.keeper, { entries: [account(41)] }, false, TIMEOUT);

    expect(written.unread).toBe(true);
    expect(written.kept).toBe(false);
    expect(device.writes).toEqual([]);
    expect(device.onDisk()).toHaveLength(aYear.length);
  });

  it('writes straight through once the path has been read', async () => {
    // The ordinary path, which must not pay for the careful one: no second
    // read, one write, on every account after the first.
    const device = phone(1);
    const kept = await loadKept(device.keeper, TIMEOUT);
    expect(kept.answered).toBe(true);

    const written = await keepPath(
      device.keeper,
      { entries: [...kept.journal.entries, account(41)] },
      true,
      TIMEOUT,
    );

    expect(written.kept).toBe(true);
    expect(device.writes).toHaveLength(1);
    expect(device.onDisk()).toHaveLength(aYear.length + 1);
  });

  it('adds nothing twice when the session and the disk overlap', async () => {
    // The merge is `@leela/journal`'s, the same one the file import uses. A
    // path read after a slow start holds entries the session already has.
    const device = phone(TIMEOUT + 30);
    const session: Journal = { entries: [...aYear.slice(-3), account(41)] };

    await keepPath(device.keeper, session, false, TIMEOUT * 40);

    expect(device.onDisk()).toHaveLength(aYear.length + 1);
  });

  it('writes a first account on a phone that really is empty', async () => {
    // Otherwise the rule above is satisfiable by never writing anything, and a
    // new player would keep nothing at all.
    const device = phone(1, EMPTY_PATH);
    const kept = await loadKept(device.keeper, TIMEOUT);

    expect(kept.answered).toBe(true);
    await keepPath(device.keeper, { entries: [account(1)] }, kept.answered, TIMEOUT);

    expect(device.onDisk()).toHaveLength(1);
  });

  it('says nothing was read when there is no store at all', async () => {
    // Asked nothing, so it knows nothing — and a path it knows nothing about
    // is one it must not replace.
    expect(await loadKept(undefined)).toMatchObject({ answered: false });
    expect(await keepPath(undefined, { entries: [account(1)] }, false, TIMEOUT)).toMatchObject({
      unread: true,
      kept: false,
    });
  });
});
