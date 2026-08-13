import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  MAX_SEATS,
  NEUROLEELA,
  createSession,
  currentPlayer,
  ONLINE,
  WIN_LOKA,
  applyRoll,
  initialState,
  type RuleSet,
} from '@leela/engine';

import { KEPT_KEY, forget, read, write, type Store } from '../src/kept';
import { pathOf, stateAfter } from '../src/path';
import { DEITIES } from '../src/deities';

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

const NOTHING = { seats: [], turnIndex: 0, lastThrower: null, deity: null, why: null };

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
    write(store, { turnIndex: 0, lastThrower: null, seats: [{ id: 'p1', deity: 'durga', state, rolls: THROWS }] });

    const reading = read(store, LEGACY_MOBILE);
    expect(reading.why).toBeNull();
    expect(reading.seats).toHaveLength(1);
    expect(reading.seats[0]?.state).toEqual(state);
    expect(reading.seats[0]?.deity).toBe('durga');
    expect(reading.seats[0]?.rolls).toEqual(THROWS);
  });

  /**
   * Nothing stored and something unreadable are different events, and the
   * difference is what the player is told. A reason returned for an empty
   * storage would make the app apologise on its first ever launch.
   */
  it('says nothing when nothing was ever saved', () => {
    expect(read(fakeStore(), LEGACY_MOBILE)).toEqual(NOTHING);
  });

  it('gives a reason when there was something and it could not be used', () => {
    for (const bad of ['{', 'null', '"a string"', '{"state":null}', '[]']) {
      const reading = read(fakeStore({ [KEPT_KEY]: bad }), LEGACY_MOBILE);
      expect(reading.seats, `${bad} was accepted`).toEqual([]);
      expect(reading.why, `${bad} was refused without saying why`).not.toBeNull();
    }
  });

  /**
   * The engine owns what a game is. These are states it could not have
   * produced, and each must be refused *and named* — a plan off the board and a
   * game finished somewhere that is not the winning square.
   */
  it('refuses a state the engine would not have produced, and names it', () => {
    const offBoard = read(stored({ state: { ...played(), loka: 99 }, deity: 'shiva' }), LEGACY_MOBILE);
    expect(offBoard.seats).toEqual([]);
    expect(offBoard.why).toContain('99');

    const wrong = read(
      stored({ state: { ...played(), is_finished: true, loka: 41 }, deity: 'shiva' }),
      LEGACY_MOBILE,
    );
    expect(wrong.seats).toEqual([]);
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
    const reading = read(stored({ state: { ...played(), loka: 99 }, deity: 'agni' }), LEGACY_MOBILE);
    expect(reading.seats).toEqual([]);
    expect(reading.why).not.toBeNull();
    expect(reading.deity).toBe('agni');
  });

  it('keeps a game whose deity this build no longer offers', () => {
    // A roster that changes between releases should cost a preference, not a
    // game. `deityFor` does the falling back; this must not throw the game out.
    const state = played();
    const reading = read(stored({ state, deity: 'ganesha' }), LEGACY_MOBILE);
    expect(reading.why).toBeNull();
    expect(reading.seats[0]?.state).toEqual(state);
    expect(reading.seats[0]?.deity).toBe('ganesha');
  });

  it('survives a record with no deity at all', () => {
    const state = played();
    const reading = read(stored({ state }), LEGACY_MOBILE);
    expect(reading.seats[0]?.state).toEqual(state);
    expect(reading.deity).toBeNull();
  });

  /** A player who has not entered yet is a real game, and a resumable one. */
  it('keeps a game that has not begun', () => {
    const store = fakeStore();
    write(store, { turnIndex: 0, lastThrower: null, seats: [{ id: 'p1', deity: 'vishnu', state: initialState(), rolls: [] }] });
    const reading = read(store, LEGACY_MOBILE);
    expect(reading.seats[0]?.state.loka).toBe(WIN_LOKA);
    expect(reading.seats[0]?.state.is_finished).toBe(true);
  });

  /** Round trip: what the engine produces must survive being written and read. */
  it('returns a game the engine can go on playing', () => {
    const store = fakeStore();
    write(store, { turnIndex: 0, lastThrower: null, seats: [{ id: 'p1', deity: 'indra', state: played(), rolls: [] }] });
    const resumed = read(store, LEGACY_MOBILE).seats[0]?.state ?? null;
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
    const reading = read(stored({ state: played(), deity: 'agni', rolls: [1, 1, 1] }), LEGACY_MOBILE);
    expect(reading.seats).toHaveLength(1);
    expect(reading.seats[0]?.rolls).toEqual([]);
    expect(reading.why).toContain('history');
  });

  it('drops a history that is not a list of throws, and keeps the game', () => {
    for (const bad of [[0], [7], ['3'], [1.5], 'nope', { a: 1 }]) {
      const reading = read(stored({ state: played(), deity: 'agni', rolls: bad }), LEGACY_MOBILE);
      expect(reading.seats, `${JSON.stringify(bad)} lost the game`).toHaveLength(1);
      expect(reading.seats[0]?.rolls, `${JSON.stringify(bad)} was accepted`).toEqual([]);
    }
  });

  it('accepts a history that does lead there', () => {
    const reading = read(stored({ state: played(), deity: 'agni', rolls: THROWS }), LEGACY_MOBILE);
    expect(reading.seats[0]?.rolls).toEqual(THROWS);
    expect(reading.why).toBeNull();
  });
});

describe('a storage that refuses', () => {
  it('opens the game rather than throwing, in every direction', () => {
    expect(() => read(refusing(), LEGACY_MOBILE)).not.toThrow();
    expect(read(refusing(), LEGACY_MOBILE)).toEqual(NOTHING);
    expect(() => write(refusing(), { turnIndex: 0, lastThrower: null, seats: [{ id: 'p1', deity: 'agni', state: played(), rolls: [] }] })).not.toThrow();
    expect(() => forget(refusing())).not.toThrow();
  });

  it('opens the game when there is no storage at all', () => {
    expect(read(null, LEGACY_MOBILE)).toEqual(NOTHING);
    expect(() => write(null, { turnIndex: 0, lastThrower: null, seats: [{ id: 'p1', deity: 'agni', state: played(), rolls: [] }] })).not.toThrow();
    expect(() => forget(null)).not.toThrow();
  });
});

describe('forgetting', () => {
  it('leaves nothing to come back to', () => {
    const store = fakeStore();
    write(store, { turnIndex: 0, lastThrower: null, seats: [{ id: 'p1', deity: 'indra', state: played(), rolls: [] }] });
    forget(store);
    expect(read(store, LEGACY_MOBILE)).toEqual(NOTHING);
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

describe('a table of several', () => {
  const table = (count: number) => ({
    turnIndex: 1,
    seats: Array.from({ length: count }, (_, at) => ({
      id: `p${at + 1}`,
      deity: DEITIES[at]!.id,
      state: played(),
      rolls: THROWS,
    })),
  });

  it('comes back with every seat, in order', () => {
    const reading = read(stored(table(4)), LEGACY_MOBILE);
    expect(reading.seats.map((s) => s.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(reading.turnIndex).toBe(1);
  });

  /**
   * A turn index past the end is a table nobody can play, and it is one
   * arithmetic slip in another version of this app away.
   */
  it('refuses to point the turn at a seat that is not there', () => {
    for (const turnIndex of [4, -1, 1.5, 'two', null]) {
      const reading = read(stored({ ...table(2), turnIndex }), LEGACY_MOBILE);
      expect(reading.turnIndex, JSON.stringify(turnIndex)).toBe(0);
    }
  });

  it('keeps the seats it can read and drops only the ones it cannot', () => {
    const mixed = table(3);
    const seats = [...mixed.seats];
    seats[1] = { ...seats[1]!, state: { ...played(), loka: 99 } };
    const reading = read(stored({ ...mixed, seats }), LEGACY_MOBILE);
    expect(reading.seats).toHaveLength(2);
    expect(reading.why).toContain('99');
  });

  /**
   * The migration, and the reason it is a branch rather than a version bump:
   * a record written before seating has one `state` at the top and no seats,
   * and a player forty squares in should not lose them to a shape change.
   */
  it('reads a record written before seating as a table of one', () => {
    const reading = read(stored({ state: played(), deity: 'durga', rolls: THROWS }), LEGACY_MOBILE);
    expect(reading.seats).toHaveLength(1);
    expect(reading.seats[0]?.id).toBe('p1');
    expect(reading.seats[0]?.deity).toBe('durga');
    expect(reading.seats[0]?.state).toEqual(played());
    expect(reading.seats[0]?.rolls).toEqual(THROWS);
    expect(reading.turnIndex).toBe(0);
    expect(reading.why).toBeNull();
  });

  it('gives an unnamed seat a name rather than an empty one', () => {
    const reading = read(stored({ turnIndex: 0, lastThrower: null, seats: [{ state: played(), rolls: [] }] }), LEGACY_MOBILE);
    expect(reading.seats[0]?.id).toBe('p1');
  });
});

/**
 * The check that a saved history leads to the saved square must replay it under
 * the rules it was played under.
 *
 * It did not. `stateAfter` takes `DEFAULT_RULESET` when nobody names one, and
 * this was the only call site in the app that did not name one — every other
 * replay passes `LEGACY_MOBILE` explicitly. So a history played under the rules
 * this surface plays was checked against `NEUROLEELA`, which differs from it in
 * nine fields, `extraTurnOnSix` and `rerollOnRepeat` among them. Measured over
 * five thousand random forty-throw games, 46.9 per cent of them land on a
 * different square under the two — and every one of those came back from a
 * reload standing on its square with an empty path and nothing said, because a
 * refused history is dropped while the seat is kept.
 *
 * The fixture that existed could not see it: `THROWS` is four throws long and
 * lands in the same place under both. So this asserts the shape instead — for
 * every ruleset, a history played under it survives being read back under it.
 */
describe('a saved history is checked under the rules it was played under', () => {
  const RULESETS: ReadonlyArray<readonly [string, RuleSet]> = [
    ['legacy-mobile', LEGACY_MOBILE],
    ['neuroleela', NEUROLEELA],
    ['classic', CLASSIC],
    ['online', ONLINE],
  ];

  /**
   * Found by search rather than chosen: the shortest script on which any two of
   * these rulesets disagree is `[6, 6, 6, 6]` — 32 under `LEGACY_MOBILE`, 6
   * under `NEUROLEELA`, because one resets a run of three sixes and the other
   * does not. The tail is there to make it a journey rather than an opening.
   */
  const SCRIPT = [6, 6, 6, 6, 4, 2, 5, 1, 3];

  const savedUnder = (rules: RuleSet) => {
    const state = stateAfter(SCRIPT, rules);
    return stored({ turnIndex: 0, lastThrower: null, seats: [{ id: 'p1', deity: 'durga', state, rolls: SCRIPT }] });
  };

  for (const [name, rules] of RULESETS) {
    it(`keeps a history played under ${name}`, () => {
      const reading = read(savedUnder(rules), rules);
      expect(reading.why).toBeNull();
      expect(reading.seats[0]?.rolls).toEqual(SCRIPT);
    });
  }

  /**
   * The converse, or the test above would pass just as well against a check
   * that had been deleted. At least one pair of rulesets must disagree about
   * this script, and the wrong-ruleset read must refuse it.
   */
  it('still refuses a history that leads somewhere else under the rules given', () => {
    const disagreeing = RULESETS.filter(
      ([, rules]) => stateAfter(SCRIPT, rules).loka !== stateAfter(SCRIPT, LEGACY_MOBILE).loka,
    );
    expect(disagreeing.length).toBeGreaterThan(0);

    for (const [, other] of disagreeing) {
      const reading = read(savedUnder(LEGACY_MOBILE), other);
      expect(reading.seats[0]?.rolls).toEqual([]);
      expect(reading.why).toContain('does not lead');
      // The square itself survives: losing where you have been is a loss,
      // losing the game as well is two.
      expect(reading.seats[0]?.state.loka).toBe(stateAfter(SCRIPT, LEGACY_MOBILE).loka);
    }
  });
});

/**
 * Who threw last, which is the one fact the die needs and the one the storage
 * did not have.
 *
 * The tempting rule was "the die shows the last throw of the seat holding the
 * turn". It is false five throws in six: `advance` rotates on anything but a
 * six, so by the time the game is saved the holder is somebody who has not
 * thrown yet. That is the same one-rotation-off defect this app already paid
 * for once, in the one widget with no sentence beside it to say whose number it
 * is. So it is stored, and what is stored is validated.
 */
describe('who threw last', () => {
  const table = (lastThrower: unknown) =>
    stored({
      turnIndex: 0,
      lastThrower,
      seats: [
        { id: 'p1', deity: 'durga', state: played(), rolls: THROWS },
        { id: 'p2', deity: 'krishna', state: played(), rolls: THROWS },
      ],
    });

  it('comes back as it went in', () => {
    expect(read(table(1), LEGACY_MOBILE).lastThrower).toBe(1);
    expect(read(table(0), LEGACY_MOBILE).lastThrower).toBe(0);
  });

  /**
   * Refused to null, never clamped to zero. `turnIndex` clamps because somebody
   * must hold the turn; a throw need not have happened at all, and seat one's
   * number on the die would be a throw this surface invented.
   */
  it('refuses anything that is not a seat, and refuses it to nobody', () => {
    for (const bad of [2, 7, -1, 1.5, '1', null, undefined, NaN, Infinity, {}, []]) {
      expect(read(table(bad), LEGACY_MOBILE).lastThrower).toBeNull();
    }
  });

  /** A record written before this field existed. */
  it('reads a record that never had one as nobody', () => {
    const before = stored({
      turnIndex: 0,
      seats: [{ id: 'p1', deity: 'durga', state: played(), rolls: THROWS }],
    });
    expect(read(before, LEGACY_MOBILE).lastThrower).toBeNull();
  });

  it('is nobody when there is no table at all', () => {
    expect(read(fakeStore(), LEGACY_MOBILE).lastThrower).toBeNull();
  });

  /**
   * The case that makes "blank" mean "no throw to show" rather than "never
   * thrown": a seat named as last thrower whose history was refused keeps its
   * square and loses its rolls, so there is no number to put on the die.
   */
  it('names a seat whose history was dropped, and that seat has no throws left', () => {
    const wrong = stored({
      turnIndex: 0,
      lastThrower: 0,
      seats: [{ id: 'p1', deity: 'durga', state: played(), rolls: [1, 1, 1] }],
    });
    const reading = read(wrong, LEGACY_MOBILE);
    expect(reading.lastThrower).toBe(0);
    expect(reading.seats[0]?.rolls).toEqual([]);
  });
});

/**
 * A reading must describe a table the engine can actually seat.
 *
 * `read` clamped `turnIndex` against the seats it had *read*, and `seatTable`
 * caps the table at `MAX_SEATS`. A record carrying more seats than that — from
 * another version, or a hand edit — therefore produced a turn belonging to a
 * seat nobody is sitting in. `currentPlayer` throws rather than returning
 * undefined, so the page died before it drew a frame: not a wrong readout, a
 * blank screen.
 */
describe('a table bigger than the game allows', () => {
  const many = (count: number, turnIndex: number) =>
    stored({
      turnIndex,
      lastThrower: null,
      seats: Array.from({ length: count }, (_, at) => ({
        id: `p${at + 1}`,
        deity: 'durga',
        state: played(),
        rolls: THROWS,
      })),
    });

  it('never reports more seats than the engine seats', () => {
    for (const count of [MAX_SEATS + 1, MAX_SEATS + 2, 12, 40]) {
      expect(read(many(count, 0), LEGACY_MOBILE).seats.length).toBe(MAX_SEATS);
    }
  });

  it('never reports a turn that the table it reports cannot hold', () => {
    for (const count of [1, 2, MAX_SEATS, MAX_SEATS + 1, 12, 40]) {
      for (const turn of [0, 1, MAX_SEATS - 1, MAX_SEATS, count - 1, count, 99]) {
        const reading = read(many(count, turn), LEGACY_MOBILE);
        expect(reading.turnIndex).toBeGreaterThanOrEqual(0);
        expect(reading.turnIndex).toBeLessThan(reading.seats.length);
      }
    }
  });

  /**
   * Why this is a blank screen and not a wrong number: the engine refuses a
   * turn its table cannot hold, and refuses it by throwing. A reading that
   * reports eight seats when six will be seated hands exactly this session to
   * the boot.
   */
  it('would crash the engine if a reading escaped with such a turn', () => {
    const table = createSession(
      'probe',
      Array.from({ length: MAX_SEATS }, (_, at) => ({ id: `p${at + 1}` })),
      LEGACY_MOBILE,
    );
    expect(() => currentPlayer({ ...table, turnIndex: MAX_SEATS + 1 })).toThrow();
    // And the reading never produces one.
    const reading = read(many(MAX_SEATS + 2, MAX_SEATS + 1), LEGACY_MOBILE);
    expect(() =>
      currentPlayer({ ...table, turnIndex: reading.turnIndex }),
    ).not.toThrow();
  });

  it('says the reading cost something when seats were dropped', () => {
    expect(read(many(MAX_SEATS + 1, 0), LEGACY_MOBILE).why).not.toBeNull();
    expect(read(many(MAX_SEATS, 0), LEGACY_MOBILE).why).toBeNull();
  });

  /** The same bound applies to who threw last. */
  it('never names a last thrower outside the table it reports', () => {
    const reading = read(many(12, 0), LEGACY_MOBILE);
    expect(reading.lastThrower).toBeNull();
    const inside = read(
      stored({
        turnIndex: 0,
        lastThrower: 7,
        seats: Array.from({ length: 12 }, (_, at) => ({
          id: `p${at + 1}`,
          deity: 'durga',
          state: played(),
          rolls: THROWS,
        })),
      }),
      LEGACY_MOBILE,
    );
    expect(inside.lastThrower).toBeNull();
  });
});
