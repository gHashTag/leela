import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  MAX_ROLL,
  TOTAL_PLANS,
  applyRoll,
  initialState,
  seededRoller,
  type GameState,
} from '@leela/engine';
import { STORAGE_KEY, isSavedGame, loadState, saveState, type GameStorage } from '../src/state';

/**
 * What is allowed back out of storage.
 *
 * The old check read one field — that `loka` was a square — and handed the
 * rest to the engine untouched. `localStorage` is writable from the console,
 * by an older version of this app, and by a write that was interrupted.
 *
 * The rule asserted here is not a list of fields. It is that a saved game must
 * be one the engine could have produced: every state a real game reaches is
 * accepted, and a state no game could reach is not.
 */

/** A storage that is just a Map, so a test is not a browser. */
function memory(initial?: string): GameStorage & { written: () => string | null } {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    written: () => value,
  };
}

/** Every state a real game passes through, from a deterministic die. */
function statesFromRealGames(games = 40, throws = 120): GameState[] {
  const seen: GameState[] = [];
  for (let game = 0; game < games; game += 1) {
    const die = seededRoller(game * 7 + 1);
    let state = initialState();
    seen.push(state);
    for (let round = 0; round < throws; round += 1) {
      state = applyRoll(state, die(), CLASSIC).state;
      seen.push(state);
    }
  }
  return seen;
}

describe('a saved game is one the engine could have produced', () => {
  it('accepts every state a real game reaches', () => {
    const states = statesFromRealGames();
    expect(states.length).toBeGreaterThan(1000);
    for (const state of states) {
      expect(isSavedGame(state), JSON.stringify(state)).toBe(true);
    }
  });

  it('survives the round trip through storage for all of them', () => {
    for (const state of statesFromRealGames(8, 60)) {
      const storage = memory();
      saveState(storage, state);
      expect(loadState(storage)).toEqual(state);
    }
  });

  it('rejects a state no game could reach', () => {
    // Each of these has a plausible `loka`, which is all the old check looked
    // at. The engine would take every one of them and do something quietly
    // wrong with it.
    const playing: GameState = {
      loka: 41,
      previous_loka: 38,
      direction: 'step 🚶🏼',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
    };

    const impossible: Array<[string, unknown]> = [
      ['finished somewhere other than the win square', { ...playing, is_finished: true }],
      ['a run of sixes that would have reset', { ...playing, consecutive_sixes: 3 }],
      ['a negative run of sixes', { ...playing, consecutive_sixes: -1 }],
      ['a run of sixes as a string', { ...playing, consecutive_sixes: '2' }],
      ['a square off the end of the board', { ...playing, loka: TOTAL_PLANS + 1 }],
      ['a square before the first', { ...playing, loka: 0 }],
      ['half a square', { ...playing, loka: 41.5 }],
      ['a previous square off the board', { ...playing, previous_loka: 999 }],
      ['a fallback square off the board', { ...playing, position_before_three_sixes: -3 }],
      ['a direction the engine never writes', { ...playing, direction: 'sideways' }],
      ['a finished flag that is not a boolean', { ...playing, is_finished: 'yes' }],
      ['nothing at all', null],
      ['a number', 41],
      ['an array', []],
      ['an empty object', {}],
    ];

    for (const [what, value] of impossible) {
      expect(isSavedGame(value), what).toBe(false);
    }
  });

  it('rejects a state with any single field removed', () => {
    // Not a list of fields: whatever the shape becomes, dropping part of it
    // must not produce something the engine is handed.
    const state = applyRoll(initialState(), MAX_ROLL, CLASSIC).state;
    for (const field of Object.keys(state)) {
      const missing = { ...state } as Record<string, unknown>;
      delete missing[field];
      expect(isSavedGame(missing), `without ${field}`).toBe(false);
    }
  });
});

describe('reading a saved game', () => {
  it('starts a new game when there is nothing stored', () => {
    expect(loadState(memory())).toEqual(initialState());
  });

  it('starts a new game rather than trusting a broken one', () => {
    expect(loadState(memory('{"loka":41,"is_finished":true}'))).toEqual(initialState());
  });

  it('starts a new game rather than crashing on text that is not JSON', () => {
    expect(loadState(memory('half a write{'))).toEqual(initialState());
  });

  it('plays without storage at all', () => {
    // A private window with storage blocked throws on access. The game should
    // be playable and merely forgetful.
    const hostile: GameStorage = {
      getItem() {
        throw new Error('storage is disabled');
      },
      setItem() {
        throw new Error('storage is disabled');
      },
    };
    expect(loadState(hostile)).toEqual(initialState());
    expect(() => saveState(hostile, initialState())).not.toThrow();
    expect(loadState(undefined)).toEqual(initialState());
    expect(() => saveState(undefined, initialState())).not.toThrow();
  });

  it('writes under a versioned key, so a shape change cannot read the old one', () => {
    const storage = memory();
    let key = '';
    saveState(
      {
        getItem: () => null,
        setItem: (k, v) => {
          key = k;
          storage.setItem(k, v);
        },
      },
      initialState(),
    );
    expect(key).toBe(STORAGE_KEY);
    expect(key).toMatch(/\.v\d+$/);
  });
});
