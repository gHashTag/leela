import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_PATH,
  KEEP_TIMEOUT_MS,
  keep,
  loadKept,
  record,
  within,
  writingsOn,
  type Keeper,
} from '../src/journal';

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

const path = record(record(EMPTY_PATH, 6, 'the first square', 1), 41, 'and the human plane', 2);

describe('a path comes back after the app is closed', () => {
  it('comes back as it went in', async () => {
    const keeper = kept();

    expect(await keep(keeper, path)).toBe(true);
    expect((await loadKept(keeper)).journal).toEqual(path);
  });

  it('is an empty path when there is nothing kept yet', async () => {
    expect((await loadKept(kept())).journal).toEqual(EMPTY_PATH);
  });

  it('is an empty path when there is no keeper at all', async () => {
    // The app on a device that has none, which is what this ran as until now.
    expect((await loadKept(undefined)).journal).toEqual(EMPTY_PATH);
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
    expect((await loadKept(throws)).journal).toEqual(EMPTY_PATH);
  });

  it('gives up on a device that never answers, rather than waiting for it', async () => {
    /**
     * The failure a `catch` cannot see, and the reason this deadline exists at
     * all. `@leela/ai` met it as a model that never answered and `apps/bot` as a
     * download that never arrived; here it is worse than either, because the
     * write happens while the player is looking at the words they just typed. A
     * screen still waiting on a disk is a screen that has eaten them.
     */
    expect(await keep(silent, path, 20), 'not kept, and said so').toBe(false);
    expect((await loadKept(silent, 20)).journal, 'and an empty path rather than a spinner').toEqual(EMPTY_PATH);

    /*
     * These two assertions ARE the proof, and they are the whole of it.
     * `silent` never answers, so an implementation that waited for the device
     * would not reach this line — it would sit until vitest gave up, and
     * vitest's message would say nothing about a disk.
     *
     * A third assertion used to stand here reading the wall clock:
     * `Date.now() - started < 5_000`. It measured a channel this test does not
     * own. It had already failed once — **MEASURED AT 1283 ms on 2026-08-28,
     * when a dozen workspaces ran at once, against a bound of 1_000** — and the
     * repair then was to raise the number to 5_000, which is the move this
     * repository's own #46–#49 warns about: a measurement taken to explain a
     * load problem is subject to the load, so the next loaded machine simply
     * moves the goalposts again.
     *
     * Its own comment admitted what it was worth — *what this line adds is only
     * that the deadline is a deadline rather than some enormous number*. That
     * claim is about the CODE, not about how busy the machine is, so it is made
     * where it can be made exactly: `within` is driven on a clock the test owns,
     * below. **A property proved on a fake clock is proved; the same property
     * sampled off a loaded one is a bet.**
     */
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

describe('what is written comes back to be read', () => {
  /**
   * The app kept a path and showed none of it. `writingsOn` was written, was
   * exported, and had no caller on any screen — the same shape the bot was
   * found in, where reports were written into SQLite, stored correctly, and
   * never read back, so a player's own account of the squares they had stood on
   * was a record the game was not producing.
   *
   * Found by an audit that had to be widened to see it: uses are counted by
   * name across every package, and the mini app has a `writingsOn` of its own,
   * so one live caller there covered the dead one here.
   *
   * The assertion is the round trip a player actually makes — write, close the
   * app, come back, stand on the square again — because each half of it passed
   * on its own while the whole was broken.
   */
  it('is there when the player stands on that square again, after a restart', async () => {
    const keeper = kept();
    const written = record(EMPTY_PATH, 41, 'What the human plane asked of me.', 1);

    expect(await keep(keeper, written)).toBe(true);

    // A new run of the app: nothing in memory, everything from the device.
    const afterRestart = (await loadKept(keeper)).journal;

    expect(writingsOn(afterRestart, 41).map((entry) => entry.text)).toEqual([
      'What the human plane asked of me.',
    ]);
  });

  it('is not shown under a square it was not written about', () => {
    const written = record(record(EMPTY_PATH, 6, 'about six', 1), 41, 'about forty-one', 2);

    expect(writingsOn(written, 6).map((entry) => entry.text)).toEqual(['about six']);
    expect(writingsOn(written, 40), 'and nothing under a square never stood on').toEqual([]);
  });

  it('shows every account of a square somebody keeps returning to', async () => {
    // The case the whole record exists for. A player who lands on 41 three
    // times has three things to compare, and showing the last one only would
    // hide the thing worth seeing.
    const keeper = kept();
    let journal = EMPTY_PATH;
    for (const [at, text] of [
      [1, 'the first time'],
      [2, 'the second time'],
      [3, 'the third time'],
    ] as Array<[number, string]>) {
      journal = record(journal, 41, text, at);
    }

    await keep(keeper, journal);

    expect(writingsOn((await loadKept(keeper)).journal, 41).map((entry) => entry.text)).toEqual([
      'the first time',
      'the second time',
      'the third time',
    ]);
  });
});

/**
 * The deadline itself, on a clock this test owns.
 *
 * `within` is the primitive every keeper call is wrapped in, and until now it
 * had **no direct test at all** — it was exercised only sideways, through
 * `keep` and `loadKept`, by a case that then sampled the wall clock to decide
 * whether the deadline had fired. That sample was the flake: it failed once at
 * 1283 ms against a 1-second bound when twelve workspaces ran at once, and was
 * repaired by raising the bound.
 *
 * Fake timers make the claim exact instead. The question *does the deadline
 * fire at the time it was given* has a precise answer, and asking it on a
 * controlled clock gets that answer on a loaded machine and an idle one alike.
 */
describe('the deadline every keeper call is wrapped in', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('DOES NOT FIRE EARLY — nothing at all happens before the time it was given', async () => {
    vi.useFakeTimers();
    let settled: string | null = null;
    const never = new Promise<string>(() => {});

    void within(never, 20, 'gave up').then((answer) => {
      settled = answer;
    });

    await vi.advanceTimersByTimeAsync(19);
    expect(settled, 'settled a millisecond early').toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(settled, 'did not settle at the deadline').toBe('gave up');
  });

  it('lets the real answer win when it arrives first, deadline or no deadline', async () => {
    // The other half, and the reason a deadline is not simply a refusal: a
    // device that answers must be heard. `waits for a device that is merely
    // slow` above says the same thing through `keep`; this says it of the
    // primitive, where the number is exact.
    vi.useFakeTimers();
    let settled: string | null = null;

    void within(Promise.resolve('the device answered'), 20, 'gave up').then((answer) => {
      settled = answer;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe('the device answered');
  });

  it('CLEARS ITS TIMER when the answer wins, so a settled call holds nothing open', async () => {
    /*
     * Not tidiness. React Native keeps a process alive for a pending timer, and
     * a keeper called on every write would leave one per keystroke. The `finally`
     * in `within` is what stops that, and nothing had ever disagreed with it.
     */
    vi.useFakeTimers();

    await within(Promise.resolve('answered'), 20_000, 'gave up');

    expect(vi.getTimerCount(), 'a timer outlived the call that made it').toBe(0);
  });

  it('lets a rejection through rather than turning it into the fallback', async () => {
    // `keep` and `loadKept` each wrap this in their own `catch`, and they can
    // only do that if the rejection reaches them. Swallowing it here would make
    // a thrown device indistinguishable from a slow one.
    vi.useFakeTimers();

    await expect(within(Promise.reject(new Error('the disk refused')), 20, 'gave up')).rejects.toThrow(
      'the disk refused',
    );
  });

  it('is the deadline the app actually ships with, not a number this test chose', () => {
    // A test that only ever passes its own 20 says nothing about what a player
    // meets. `KEEP_TIMEOUT_MS` is the default every caller takes.
    expect(KEEP_TIMEOUT_MS).toBeGreaterThan(0);
    expect(Number.isFinite(KEEP_TIMEOUT_MS)).toBe(true);
  });
});
