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
import {
  DRAFT_KEY,
  INTENTION_KEY,
  MAX_INTENTION_CHARS,
  MIN_INTENTION_CHARS,
  isIntention,
  loadIntention,
  saveIntention,
  RESTING_FACE,
  clearDraft,
  loadDraft,
  saveDraft,
  STORAGE_KEY,
  isSavedGame,
  loadLastRoll,
  loadState,
  saveLastRoll,
  type GameStorage,
} from '../src/state';

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

  it('is read back unchanged for all of them', () => {
    // Written straight into storage, because nothing writes this key any
    // more: the app keeps a table of seats now, and this is the reader that
    // turns a game from before there were seats into the first one.
    for (const state of statesFromRealGames(8, 60)) {
      expect(loadState(memory(JSON.stringify(state)))).toEqual(state);
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
    // A reader that throws answers with a fresh game, which is the only honest
    // answer: nothing was found, as against nothing being there.
    //
    // `saveIntention` is the one write here that reports nothing, and that is
    // deliberate: its boolean means "this is a question worth keeping", not
    // "it was kept", and the two are different answers to different questions.
    // A refused intention is handled a layer up, by holding it for the session
    // and asking again next launch, which `assembled` covers.
    expect(loadState(hostile)).toEqual(initialState());
    expect(loadState(undefined)).toEqual(initialState());
    expect(saveIntention(hostile, 'to see this through'), 'valid, whatever the store did').toBe(
      true,
    );
  });

  it('reads a versioned key, so a shape change cannot read the old one', () => {
    // The seats file follows the same rule for the same reason.
    expect(STORAGE_KEY).toMatch(/\.v\d+$/);
  });
});

describe('the throw the die is showing', () => {
  /**
   * The die was set to `1` on every load, by a hard-coded call. A player who
   * threw a six to move from 5 to 11, closed the app and came back was shown a
   * one over a board that had plainly moved by six — the app contradicting
   * itself about the only event in the game.
   *
   * The published app persists `DiceStore.count` and starts it at 6, which is
   * both the throw a player needs to begin and the reason the resting face is
   * not 1.
   *
   * The rule asserted is not a list of the wrong values seen so far: anything
   * that is not a face this die has is not restored, whatever shape it arrives
   * in.
   */

  /** A storage that can be handed any string, including ones no code wrote. */
  const holding = (raw: string | null): GameStorage => ({
    getItem: () => raw,
    setItem: () => {},
  });

  it('is the throw that was made', () => {
    for (const value of [1, 2, 3, 4, 5, 6]) {
      const store = memory();
      saveLastRoll(store, value);
      expect(loadLastRoll(store), `threw ${value}`).toBe(value);
    }
  });

  it('survives a reload, which is the whole point', () => {
    const store = memory();
    saveLastRoll(store, 6);
    // A second reader over the same storage is what a reopened app is.
    expect(loadLastRoll(memory(store.written() ?? undefined))).toBe(6);
  });

  it('is the resting face when nothing has been thrown', () => {
    expect(loadLastRoll(memory())).toBe(RESTING_FACE);
    expect(RESTING_FACE).toBe(6);
  });

  it('is the resting face for anything that is not a face this die has', () => {
    // A half-written string, a zero from an older shape, a seven from another
    // game, a float, a negative, a number too large to be anything. One rule,
    // not six cases: if it is not 1-6, it was not thrown here.
    for (const raw of ['', '0', '7', '2.5', '-3', '1e9', 'six', '{}', 'null', ' ']) {
      expect(loadLastRoll(holding(raw)), JSON.stringify(raw)).toBe(RESTING_FACE);
    }
  });

  it('never throws, whatever storage does', () => {
    // Same rule as the game itself: a window with storage disabled still
    // plays, and a die that cannot be remembered is a worse face rather than a
    // broken app.
    const hostile: GameStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => loadLastRoll(hostile)).not.toThrow();
    expect(loadLastRoll(hostile)).toBe(RESTING_FACE);
    expect(() => saveLastRoll(hostile, 4)).not.toThrow();
  });

  it('is kept apart from the game, so an old save still loads', () => {
    // Put inside the saved game, this value would make `isSavedGame` reject
    // every existing save: a player's whole path dropped to remember a die.
    const store = memory();
    saveLastRoll(store, 3);
    expect(store.written()).not.toContain('loka');
  });
});

describe('a report typed and not yet filed', () => {
  /**
   * The game will not let a player throw until they have written about the
   * square they are on, and that writing lived in a `<textarea>` and nowhere
   * else. A phone discards a backgrounded tab — not hypothetically: a *throw*
   * was lost the same way two passes ago, and found by watching it happen — so
   * a notification arriving mid-sentence took the sentence with it. The one
   * thing this game asks a player to produce was the one thing it did not keep.
   *
   * The published app does not keep a draft either; this is not a port, it is a
   * loss neither of them should have.
   */

  const holding = (raw: string | null): GameStorage => ({
    getItem: () => raw,
    setItem: () => {},
  });

  it('comes back as it was typed, whatever was typed', () => {
    // Any text, not a remembered one: a report is prose, and prose contains
    // quotes, newlines, emoji and the odd brace.
    for (const text of [
      'a sentence',
      'two\n\nparagraphs, with "quotes" and a — dash',
      '{"looks":"like json"}',
      'ॐ 🕉 неведение',
      'x'.repeat(4000),
    ]) {
      const store = memory();
      saveDraft(store, 'p1', 41, text);
      expect(loadDraft(memory(store.written() ?? undefined), 'p1', 41), text.slice(0, 20)).toBe(text);
    }
  });

  it('belongs to the plan it was written about', () => {
    // Offering a draft about the human plane to somebody standing on Delusion
    // would be worse than offering nothing.
    const store = memory();
    saveDraft(store, 'p1', 41, 'about the human plane');

    expect(loadDraft(memory(store.written() ?? undefined), 'p1', 6)).toBe('');
  });

  it('is nothing when nothing was typed', () => {
    expect(loadDraft(memory(), 'p1', 41)).toBe('');
  });

  it('is cleared by blank, so a stale plan cannot linger', () => {
    const store = memory();
    saveDraft(store, 'p1', 41, 'something');
    saveDraft(store, 'p1', 41, '   ');

    expect(loadDraft(memory(store.written() ?? undefined), 'p1', 41)).toBe('');
  });

  it('is cleared outright when the report is filed', () => {
    const store = memory();
    saveDraft(store, 'p1', 41, 'filed now');
    clearDraft(store);

    expect(loadDraft(memory(store.written() ?? undefined), 'p1', 41)).toBe('');
  });

  it('is nothing for anything that is not a draft this app wrote', () => {
    // The rule rather than a list: a half-written value, another shape, a
    // string where an object belongs. None of it restores.
    for (const raw of ['', 'not json', 'null', '[]', '{}', '{"plan":41}', '{"text":"no plan"}', '3']) {
      expect(loadDraft(holding(raw), 'p1', 41), JSON.stringify(raw)).toBe('');
    }
  });

  it('never throws, whatever storage does', () => {
    const hostile: GameStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };

    expect(() => loadDraft(hostile, 'p1', 41)).not.toThrow();
    expect(loadDraft(hostile, 'p1', 41)).toBe('');
    expect(() => saveDraft(hostile, 'p1', 41, 'words')).not.toThrow();
    expect(() => clearDraft(hostile)).not.toThrow();
  });

  it('is kept apart from the game and the journal', () => {
    // Inside the saved game it would make `isSavedGame` reject every existing
    // save — a player's whole path dropped to remember half a sentence.
    const store = memory();
    saveDraft(store, 'p1', 41, 'words');

    expect(DRAFT_KEY).not.toBe(STORAGE_KEY);
    expect(store.written()).not.toContain('loka');
  });
});

describe('what the player is playing for', () => {
  /**
   * The published app asks before it lets anyone near the board —
   * `if (!prof.intention) navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true })`
   * — validates `min(2).max(800)`, and keeps it where it can be changed. The
   * column exists in this repository's own schema (`players.intention`) and no
   * surface had ever asked for one.
   *
   * In Leela the intention is not a profile field: it is the question the game
   * is played to answer, and the reports are the answer accumulating.
   */

  const holding = (raw: string | null): GameStorage => ({
    getItem: () => raw,
    setItem: () => {},
  });

  it('is held as it was written', () => {
    const store = memory();
    saveIntention(store, 'To find out what I keep avoiding.');

    expect(loadIntention(memory(store.written() ?? undefined))).toBe(
      'To find out what I keep avoiding.',
    );
  });

  it('is nothing before anyone has answered', () => {
    expect(loadIntention(memory())).toBe('');
  });

  it('refuses what the app refuses, at both ends', () => {
    // The app's own bounds, not invented ones.
    expect(isIntention('x'.repeat(MIN_INTENTION_CHARS - 1))).toBe(false);
    expect(isIntention('x'.repeat(MIN_INTENTION_CHARS))).toBe(true);
    expect(isIntention('x'.repeat(MAX_INTENTION_CHARS))).toBe(true);
    expect(isIntention('x'.repeat(MAX_INTENTION_CHARS + 1))).toBe(false);
  });

  it('is not blank space dressed as an answer', () => {
    for (const blank of ['', ' ', '\n\n', '\t  ']) {
      expect(isIntention(blank), JSON.stringify(blank)).toBe(false);
    }
  });

  it('keeps nothing it refuses, and says it kept nothing', () => {
    // The dialog stays open on a `false`, so a refusal that quietly returned
    // true would leave a player looking at their own unsaved words.
    const store = memory();
    expect(saveIntention(store, ' ')).toBe(false);
    expect(store.written()).toBeNull();
  });

  it('is trimmed, so the bounds mean what they say', () => {
    const store = memory();
    saveIntention(store, '   To see it through.   ');

    expect(loadIntention(memory(store.written() ?? undefined))).toBe('To see it through.');
  });

  it('never throws, whatever storage does', () => {
    const hostile: GameStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };

    expect(() => loadIntention(hostile)).not.toThrow();
    expect(loadIntention(hostile)).toBe('');
    // A window that cannot store still plays; the question is asked again.
    expect(saveIntention(hostile, 'To begin.')).toBe(true);
  });

  it('is kept apart from the game and the journal', () => {
    const store = memory();
    saveIntention(store, 'To begin.');

    expect(INTENTION_KEY).not.toBe(STORAGE_KEY);
    expect(store.written()).not.toContain('loka');
  });

  it('is nothing for a stored value that is not one', () => {
    expect(loadIntention(holding(''))).toBe('');
    expect(loadIntention(holding(null))).toBe('');
  });
});

describe('a draft belongs to whoever is writing it', () => {
  /**
   * The draft was keyed by plan alone, which was exact while one person
   * played. Two people sharing a device stand on the same square all the
   * time — and one of them opening the writing box to find the other's
   * unfinished sentence in it is the worst thing this app could do with
   * writing.
   */

  it('is offered to the player who wrote it', () => {
    const store = memory();
    saveDraft(store, 'p1', 6, 'Player one, mid-sentence.');

    expect(loadDraft(memory(store.written() ?? undefined), 'p1', 6)).toBe(
      'Player one, mid-sentence.',
    );
  });

  it('is not offered to anybody else, on the same square', () => {
    // The square is the same; the writing is not.
    const store = memory();
    saveDraft(store, 'p1', 6, 'Player one, mid-sentence about something private.');

    for (const other of ['p2', 'p3', 'p6']) {
      expect(loadDraft(memory(store.written() ?? undefined), other, 6), other).toBe('');
    }
  });

  it('belongs to a plan and a player at once', () => {
    // Either one differing is enough to withhold it.
    const store = memory();
    saveDraft(store, 'p2', 41, 'about the human plane');
    const written = memory(store.written() ?? undefined);

    expect(loadDraft(written, 'p2', 41)).not.toBe('');
    expect(loadDraft(written, 'p2', 6)).toBe('');
    expect(loadDraft(written, 'p1', 41)).toBe('');
  });

  it('gives a draft from before there were seats to the first player', () => {
    // Written when the app had one player and no seat ids. It is theirs.
    const older = JSON.stringify({ plan: 6, text: 'from before there were seats' });

    expect(loadDraft(memory(older), 'p1', 6)).toBe('from before there were seats');
    expect(loadDraft(memory(older), 'p2', 6)).toBe('');
  });
});
