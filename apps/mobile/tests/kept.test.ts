import { describe, expect, it } from 'vitest';
import { EMPTY, KEEP_TIMEOUT_MS, keep, loadKept, record, type Keeper } from '../src/journal';

/**
 * What survives the app closing.
 *
 * The phone kept a path for the length of a session and no longer: the account
 * was written, the sentence under it was true, and closing the app threw the
 * whole thing away. That is the one loss a player cannot be told about, because
 * by the time it happens there is nobody looking.
 *
 * A device store is asynchronous — `AsyncStorage` is what the published app
 * used — so it is its own interface, and this file holds it to what every
 * injection point in this repository is held to: **it is handed the worst
 * implementation its type allows.** Throwing, refusing, and the one no `catch`
 * can see, a promise nobody settles.
 */

const kept = (): Keeper & { held: string | null } => {
  const box = {
    held: null as string | null,
    read: async () => box.held,
    write: async (value: string) => {
      box.held = value;
      return true;
    },
  };
  return box;
};

const refuses: Keeper = { read: async () => null, write: async () => false };

const throws: Keeper = {
  read: async () => {
    throw new Error('the disk is gone');
  },
  write: async () => {
    throw new Error('the disk is gone');
  },
};

const silent: Keeper = {
  read: () => new Promise<string | null>(() => {}),
  write: () => new Promise<boolean>(() => {}),
};

const path = record(record(EMPTY, 6, 'the first square', 1), 41, 'and the human plane', 2);

describe('a path comes back after the app is closed', () => {
  it('comes back as it went in', async () => {
    const keeper = kept();

    expect(await keep(keeper, path)).toBe(true);
    expect(await loadKept(keeper)).toEqual(path);
  });

  it('is an empty path when there is nothing kept yet', async () => {
    expect(await loadKept(kept())).toEqual(EMPTY);
  });

  it('is an empty path when there is no keeper at all', async () => {
    // The app on a device that has none, which is what this ran as until now.
    expect(await loadKept(undefined)).toEqual(EMPTY);
    expect(await keep(undefined, path), 'and nothing pretends otherwise').toBe(false);
  });
});

describe('the keeper is handed the worst its type allows', () => {
  it('says the path was not kept when the device refuses', async () => {
    expect(await keep(refuses, path)).toBe(false);
  });

  it('says the path was not kept when the device throws', async () => {
    expect(await keep(throws, path)).toBe(false);
  });

  it('starts with an empty path rather than crashing on a device that throws', async () => {
    expect(await loadKept(throws)).toEqual(EMPTY);
  });

  it('gives up on a device that never answers, rather than waiting for it', async () => {
    /**
     * The failure a `catch` cannot see, and the reason this deadline exists at
     * all. `@leela/ai` met it as a model that never answered and `apps/bot` as a
     * download that never arrived; here it is worse than either, because the
     * write happens while the player is looking at the words they just typed. A
     * screen still waiting on a disk is a screen that has eaten them.
     */
    const started = Date.now();

    expect(await keep(silent, path, 20), 'not kept, and said so').toBe(false);
    expect(await loadKept(silent, 20), 'and an empty path rather than a spinner').toEqual(EMPTY);
    expect(Date.now() - started, 'both inside the deadline').toBeLessThan(1_000);
  });

  it('waits for a device that is merely slow', async () => {
    // The guard against the deadline becoming a way of never keeping anything:
    // a store that answers late still answers.
    const slow: Keeper = {
      read: async () => null,
      write: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 30)),
    };

    expect(await keep(slow, path, 500)).toBe(true);
  });

  it('has a deadline a person would accept', () => {
    // Stated rather than assumed: five seconds is long for a disk and short for
    // somebody holding a phone.
    expect(KEEP_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});
