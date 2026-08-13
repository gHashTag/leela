import { describe, expect, it } from 'vitest';
import { LEGACY_MOBILE, WIN_LOKA, applyRoll, initialState } from '@leela/engine';

import { KEPT_KEY, forget, read, write, type Store } from '../src/kept';
import { pathOf } from '../src/path';

/**
 * A saved game is a thing another program wrote — an older build of this one,
 * usually — so every assertion here is about what happens when what comes back
 * is not what was put in. The shape of the defect is *a bad record stopping the
 * game opening*, or worse, *a bad record being played*.
 */

const fakeStore = (start: Record<string, string> = {}): Store & { held: Record<string, string> } => ({
  held: { ...start },
  getItem(key) {
    return this.held[key] ?? null;
  },
  setItem(key, value) {
    this.held[key] = value;
  },
  removeItem(key) {
    delete this.held[key];
  },
});

/** A storage that is present and refuses everything, as Safari's private mode did. */
const refusing = (): Store => ({
  getItem() {
    throw new Error('storage is disabled');
  },
  setItem() {
    throw new Error('storage is disabled');
  },
  removeItem() {
    throw new Error('storage is disabled');
  },
});

const NOTHING = { state: null, deity: null, rolls: [], why: null };

/** A game a few moves in, built by the engine rather than by hand. */
const THROWS = [6, 3, 4, 2];
const played = () => {
  let state = initialState();
  for (const roll of THROWS) state = applyRoll(state, roll, LEGACY_MOBILE).state;
  return state;
};

const stored = (record: unknown): Store => fakeStore({ [KEPT_KEY]: JSON.stringify(record) });

describe('coming back to a game', () => {
  it('returns the game that was saved', () => {
    const store = fakeStore();
    const state = played();
    write(store, { state, deity: 'durga', rolls: THROWS });

    const reading = read(store);
    expect(reading.why).toBeNull();
    expect(reading.state).toEqual(state);
    expect(reading.deity).toBe('durga');
    expect(reading.rolls).toEqual(THROWS);
  });

  /**
   * Nothing stored and something unreadable are different events, and the
   * difference is what the player is told. A reason returned for an empty
   * storage would make the app apologise on its first ever launch.
   */
  it('says nothing when nothing was ever saved', () => {
    expect(read(fakeStore())).toEqual(NOTHING);
  });

  it('gives a reason when there was something and it could not be used', () => {
    for (const bad of ['{', 'null', '"a string"', '{"state":null}', '[]']) {
      const reading = read(fakeStore({ [KEPT_KEY]: bad }));
      expect(reading.state, `${bad} was accepted`).toBeNull();
      expect(reading.why, `${bad} was refused without saying why`).not.toBeNull();
    }
  });

  /**
   * The engine owns what a game is. These are states it could not have
   * produced, and each must be refused *and named* — a plan off the board and a
   * game finished somewhere that is not the winning square.
   */
  it('refuses a state the engine would not have produced, and names it', () => {
    const offBoard = read(stored({ state: { ...played(), loka: 99 }, deity: 'shiva' }));
    expect(offBoard.state).toBeNull();
    expect(offBoard.why).toContain('99');

    const wrong = read(
      stored({ state: { ...played(), is_finished: true, loka: 41 }, deity: 'shiva' }),
    );
    expect(wrong.state).toBeNull();
    expect(wrong.why).toContain('41');
  });

  /**
   * The defect this was written for, found by seeding a corrupt board and
   * reloading: the deity went with it. The player was put back on Vishnu while
   * the screen said the game had begun again and *nothing else had been
   * touched*. Who you are playing as and where you are standing are two facts,
   * and one of them being unreadable is not a reason to forget the other.
   */
  it('keeps who was playing even when the game itself is refused', () => {
    const reading = read(stored({ state: { ...played(), loka: 99 }, deity: 'agni' }));
    expect(reading.state).toBeNull();
    expect(reading.why).not.toBeNull();
    expect(reading.deity).toBe('agni');
  });

  it('keeps a game whose deity this build no longer offers', () => {
    // A roster that changes between releases should cost a preference, not a
    // game. `deityFor` does the falling back; this must not throw the game out.
    const state = played();
    const reading = read(stored({ state, deity: 'ganesha' }));
    expect(reading.why).toBeNull();
    expect(reading.state).toEqual(state);
    expect(reading.deity).toBe('ganesha');
  });

  it('survives a record with no deity at all', () => {
    const state = played();
    const reading = read(stored({ state }));
    expect(reading.state).toEqual(state);
    expect(reading.deity).toBeNull();
  });

  /** A player who has not entered yet is a real game, and a resumable one. */
  it('keeps a game that has not begun', () => {
    const store = fakeStore();
    write(store, { state: initialState(), deity: 'vishnu', rolls: [] });
    const reading = read(store);
    expect(reading.state?.loka).toBe(WIN_LOKA);
    expect(reading.state?.is_finished).toBe(true);
  });

  /** Round trip: what the engine produces must survive being written and read. */
  it('returns a game the engine can go on playing', () => {
    const store = fakeStore();
    write(store, { state: played(), deity: 'indra', rolls: [] });
    const resumed = read(store).state;
    expect(resumed).not.toBeNull();
    const next = applyRoll(resumed as NonNullable<typeof resumed>, 3, LEGACY_MOBILE);
    expect(next.state.loka).toBeGreaterThan(0);
  });
});

describe('the history', () => {
  /**
   * The state is what the engine last produced and the rolls are what produced
   * it. When replaying the rolls does not land on the stored square, one of
   * them is from a different game, and playing on from a state whose history
   * says something else is how a path silently becomes fiction.
   */
  it('drops a history that does not lead to the saved square, and keeps the game', () => {
    const reading = read(stored({ state: played(), deity: 'agni', rolls: [1, 1, 1] }));
    expect(reading.state).not.toBeNull();
    expect(reading.rolls).toEqual([]);
    expect(reading.why).toContain('history');
  });

  it('drops a history that is not a list of throws, and keeps the game', () => {
    for (const bad of [[0], [7], ['3'], [1.5], 'nope', { a: 1 }]) {
      const reading = read(stored({ state: played(), deity: 'agni', rolls: bad }));
      expect(reading.state, `${JSON.stringify(bad)} lost the game`).not.toBeNull();
      expect(reading.rolls, `${JSON.stringify(bad)} was accepted`).toEqual([]);
    }
  });

  it('accepts a history that does lead there', () => {
    const reading = read(stored({ state: played(), deity: 'agni', rolls: THROWS }));
    expect(reading.rolls).toEqual(THROWS);
    expect(reading.why).toBeNull();
  });
});

describe('a storage that refuses', () => {
  it('opens the game rather than throwing, in every direction', () => {
    expect(() => read(refusing())).not.toThrow();
    expect(read(refusing())).toEqual(NOTHING);
    expect(() => write(refusing(), { state: played(), deity: 'agni', rolls: [] })).not.toThrow();
    expect(() => forget(refusing())).not.toThrow();
  });

  it('opens the game when there is no storage at all', () => {
    expect(read(null)).toEqual(NOTHING);
    expect(() => write(null, { state: played(), deity: 'agni', rolls: [] })).not.toThrow();
    expect(() => forget(null)).not.toThrow();
  });
});

describe('forgetting', () => {
  it('leaves nothing to come back to', () => {
    const store = fakeStore();
    write(store, { state: played(), deity: 'indra', rolls: [] });
    forget(store);
    expect(read(store)).toEqual(NOTHING);
  });
});

describe('the path a history describes', () => {
  /**
   * Every throw is a step, including the ones that moved nobody. Three refused
   * throws in a row are three throws, and a history that silently drops them
   * tells the player they threw fewer times than they did.
   */
  it('has one step per throw, refusals included', () => {
    const refused = [1, 2, 3, 4, 5];
    const steps = pathOf(refused, LEGACY_MOBILE);
    expect(steps).toHaveLength(refused.length);
    expect(steps.every((step) => !step.moved)).toBe(true);
    expect(steps.map((step) => step.roll)).toEqual(refused);
  });

  it('numbers the steps from one, in the order thrown', () => {
    const steps = pathOf(THROWS, LEGACY_MOBILE);
    expect(steps.map((step) => step.ordinal)).toEqual([1, 2, 3, 4]);
  });

  /** The path is derived, so its last square is the engine's answer. */
  it('ends where the engine says the game ended', () => {
    const steps = pathOf(THROWS, LEGACY_MOBILE);
    expect(steps.at(-1)?.to).toBe(played().loka);
  });

  it('joins up: each step starts where the last one left off', () => {
    const steps = pathOf([6, 3, 4, 2, 5, 1, 6, 2], LEGACY_MOBILE);
    for (const [at, step] of steps.entries()) {
      if (at === 0) continue;
      expect(step.from, `step ${step.ordinal} does not follow step ${at}`).toBe(
        steps[at - 1]?.to,
      );
    }
  });

  it('is nothing at all before the first throw', () => {
    expect(pathOf([], LEGACY_MOBILE)).toEqual([]);
  });
});
