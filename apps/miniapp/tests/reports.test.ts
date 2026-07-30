import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  MAX_ROLL,
  applyRoll,
  initialState,
  owesReport,
  seededRoller,
  type GameState,
} from '@leela/engine';
import {
  EMPTY,
  MAX_REPORTS,
  MAX_REPORT_CHARS,
  REPORTS_KEY,
  arrived,
  isJournal,
  loadJournal,
  needsReport,
  path,
  record,
  saveJournal,
  type Journal,
  hintFor,
  WARN_WITHIN_CHARS,
} from '../src/reports';
import type { GameStorage } from '../src/state';

/**
 * The rule the game is played for.
 *
 * `require(..., 'You must create a report before rolling the dice.')` is in the
 * deployed contract; the published app carried it as `isReported` on every
 * player; the bot has had it since it was written. The mini app let anyone
 * throw for ever without once saying what a plan brought up, which is the game
 * with its point removed.
 */

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

/** Play a real game, reporting whenever one is owed. */
function play(rounds: number, seed = 3) {
  const die = seededRoller(seed);
  let state = initialState();
  let journal: Journal = EMPTY;
  const refusals: boolean[] = [];

  for (let round = 0; round < rounds; round += 1) {
    // The gate, asked before every throw exactly as the app asks it.
    refusals.push(needsReport(state, journal));
    if (needsReport(state, journal)) {
      journal = record(journal, state.loka, `on ${state.loka}`, round);
    }

    state = applyRoll(state, die(), CLASSIC).state;
    if (owesReport(state)) journal = arrived(journal);
  }

  return { state, journal, refusals };
}

describe('the gate', () => {
  it('is shut exactly when the engine says a report is owed and none is written', () => {
    // Not a list of situations: over a played-out game, the gate must agree
    // with `owesReport` and the journal at every single step.
    const die = seededRoller(11);
    let state = initialState();
    let journal: Journal = EMPTY;

    for (let round = 0; round < 200; round += 1) {
      expect(needsReport(state, journal)).toBe(owesReport(state) && !journal.reported);

      if (needsReport(state, journal)) journal = record(journal, state.loka, 'a word', round);
      state = applyRoll(state, die(), CLASSIC).state;
      if (owesReport(state)) journal = arrived(journal);
    }
  });

  it('never asks a player who has not entered the game', () => {
    // Waiting on 68 for a six is not an arrival, and there is nothing to
    // reflect on. Every failing throw from the start must stay open.
    let state = initialState();
    for (let roll = 1; roll < MAX_ROLL; roll += 1) {
      state = applyRoll(state, roll, CLASSIC).state;
      expect(needsReport(state, EMPTY), `after ${roll}`).toBe(false);
    }
  });

  it('asks once per arrival, not once per square', () => {
    // A player who comes back to a plan they have written about owes another
    // report. That is why the journal keeps a boolean and not a plan number —
    // `isReported` in the published app was a boolean for the same reason.
    const on41: GameState = {
      loka: 41,
      previous_loka: 38,
      direction: 'step 🚶🏼',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
    };

    let journal = record(arrived(EMPTY), 41, 'the first time', 1);
    expect(needsReport(on41, journal)).toBe(false);

    journal = arrived(journal);
    expect(needsReport(on41, journal)).toBe(true);
  });

  it('shuts at least once in a real game, so passing means something', () => {
    const { refusals } = play(60);
    expect(refusals.filter(Boolean).length).toBeGreaterThan(5);
  });
});

describe('a report is something written', () => {
  it('does not count an empty one', () => {
    for (const nothing of ['', '   ', '\n\t  \n']) {
      const journal = record(arrived(EMPTY), 41, nothing, 1);
      expect(journal.reported, JSON.stringify(nothing)).toBe(false);
      expect(journal.entries).toHaveLength(0);
    }
  });

  it('opens the gate when there is', () => {
    const journal = record(arrived(EMPTY), 41, '  something  ', 1);
    expect(journal.reported).toBe(true);
    expect(journal.entries[0]?.text).toBe('something');
  });

  it('is bounded, because storage is', () => {
    let journal = EMPTY;
    for (let n = 0; n < MAX_REPORTS + 25; n += 1) {
      journal = record(journal, 41, `report ${n}`, n);
    }
    expect(journal.entries).toHaveLength(MAX_REPORTS);
    // The oldest go, not the newest: what someone wrote last is what they are
    // most likely to want back.
    expect(journal.entries.at(-1)?.text).toBe(`report ${MAX_REPORTS + 24}`);

    const long = record(EMPTY, 41, 'x'.repeat(MAX_REPORT_CHARS * 2), 1);
    expect(long.entries[0]?.text).toHaveLength(MAX_REPORT_CHARS);
  });
});

describe('what comes back out of storage', () => {
  it('is everything a real game put in', () => {
    const { journal } = play(120);
    expect(journal.entries.length).toBeGreaterThan(5);

    const storage = memory();
    saveJournal(storage, journal);
    expect(loadJournal(storage)).toEqual(journal);
  });

  it('is not a journal this app could not have written', () => {
    const good = record(arrived(EMPTY), 41, 'a word', 1);
    const broken: Array<[string, unknown]> = [
      ['nothing', null],
      ['an array', []],
      ['no flag', { entries: [] }],
      ['a flag that is not one', { reported: 'yes', entries: [] }],
      ['entries that are not a list', { reported: true, entries: {} }],
      ['a plan off the board', { reported: true, entries: [{ plan: 900, text: 'x', at: 1 }] }],
      ['a plan that is not one', { reported: true, entries: [{ plan: 1.5, text: 'x', at: 1 }] }],
      ['an empty report', { reported: true, entries: [{ plan: 5, text: '', at: 1 }] }],
      ['a time that is not one', { reported: true, entries: [{ plan: 5, text: 'x', at: NaN }] }],
    ];

    expect(isJournal(good)).toBe(true);
    for (const [what, value] of broken) {
      expect(isJournal(value), what).toBe(false);
    }
  });

  it('starts over rather than trusting a broken one', () => {
    expect(loadJournal(memory('{"reported":true,"entries":[{"plan":900}]}'))).toEqual(EMPTY);
    expect(loadJournal(memory('half a write{'))).toEqual(EMPTY);
    expect(loadJournal(memory())).toEqual(EMPTY);
  });

  it('leaves a game already saved alone', () => {
    // Its own key, so a journal arriving for the first time cannot make an
    // older saved game fail the validator that guards it.
    const storage = memory();
    saveJournal(storage, record(EMPTY, 5, 'a word', 1));
    expect(storage.written()).toContain('plan');
    expect(REPORTS_KEY).not.toBe('leela.game.v1');
  });

  it('plays without storage at all', () => {
    const hostile: GameStorage = {
      getItem() {
        throw new Error('storage is disabled');
      },
      setItem() {
        throw new Error('storage is disabled');
      },
    };
    expect(loadJournal(hostile)).toEqual(EMPTY);
    expect(() => saveJournal(hostile, EMPTY)).not.toThrow();
    expect(() => saveJournal(undefined, EMPTY)).not.toThrow();
  });
});

describe('the path', () => {
  it('is oldest first, whatever order it was stored in', () => {
    const journal: Journal = {
      reported: true,
      entries: [
        { plan: 41, text: 'third', at: 300 },
        { plan: 6, text: 'first', at: 100 },
        { plan: 23, text: 'second', at: 200 },
      ],
    };
    expect(path(journal).map((entry) => entry.text)).toEqual(['first', 'second', 'third']);
  });

  it('does not mutate the journal it was given', () => {
    const journal: Journal = {
      reported: true,
      entries: [
        { plan: 41, text: 'b', at: 2 },
        { plan: 6, text: 'a', at: 1 },
      ],
    };
    path(journal);
    expect(journal.entries[0]?.text).toBe('b');
  });

  it('holds a whole game of reports', () => {
    const { journal } = play(200);
    const written = path(journal);
    expect(written.length).toBe(journal.entries.length);
    for (let i = 1; i < written.length; i += 1) {
      expect((written[i]?.at ?? 0) >= (written[i - 1]?.at ?? 0)).toBe(true);
    }
  });
});

describe('what the writer says about its limits', () => {
  /**
   * Both limits were silent. `record` cuts a report at `MAX_REPORT_CHARS` and
   * drops the oldest entry past `MAX_REPORTS`, and the player was told
   * neither — a thousand words could go without a word about it. The published
   * app has no maximum at all; ours exists because `localStorage` is bounded,
   * and a bound nobody is shown is indistinguishable from a bug.
   *
   * The dialog had carried an empty `#writer-hint` since it was written.
   *
   * The rule asserted is when something is said, not the sentences: silence
   * while there is room, the nearer limit first, and never silence at a
   * boundary where something is about to be lost.
   */

  const journalOf = (count: number): Journal => ({
    reported: false,
    entries: Array.from({ length: count }, (_, n) => ({
      plan: (n % 72) + 1,
      text: `entry ${n}`,
      at: 1_700_000_000_000 + n,
    })),
  });

  it('says nothing while there is room for both', () => {
    // A counter always on screen is furniture, and a player counting
    // characters is not reflecting.
    expect(hintFor(journalOf(0), 0, 'en')).toBe('');
    expect(hintFor(journalOf(10), 500, 'en')).toBe('');
  });

  it('never stays silent where something is about to be lost', () => {
    // The shape of the defect: at any point where saving would cut text or
    // drop an entry, there is something on screen.
    for (const length of [MAX_REPORT_CHARS - WARN_WITHIN_CHARS, MAX_REPORT_CHARS, 10_000]) {
      expect(hintFor(journalOf(0), length, 'en'), `length ${length}`).not.toBe('');
    }
    expect(hintFor(journalOf(MAX_REPORTS), 0, 'en')).not.toBe('');
    expect(hintFor(journalOf(MAX_REPORTS + 20), 0, 'en')).not.toBe('');
  });

  it('counts down the room that is left', () => {
    const left = 40;
    expect(hintFor(journalOf(0), MAX_REPORT_CHARS - left, 'en')).toContain(String(left));
  });

  it('says the box is full rather than counting to zero', () => {
    const full = hintFor(journalOf(0), MAX_REPORT_CHARS, 'en');
    expect(full).not.toMatch(/\b0\b/);
    expect(hintFor(journalOf(0), MAX_REPORT_CHARS + 500, 'en')).toBe(full);
  });

  it('puts the nearer limit first', () => {
    // A full path is a standing fact; running out of room in this box is
    // happening now, and only one line is on screen.
    const both = hintFor(journalOf(MAX_REPORTS), MAX_REPORT_CHARS, 'en');
    expect(both).toBe(hintFor(journalOf(0), MAX_REPORT_CHARS, 'en'));
  });

  it('warns before the path starts dropping, not after', () => {
    // At the cap the next save costs the oldest entry, so the warning belongs
    // at the cap and not one entry past it.
    expect(hintFor(journalOf(MAX_REPORTS - 1), 0, 'en')).toBe('');
    expect(hintFor(journalOf(MAX_REPORTS), 0, 'en')).not.toBe('');
  });

  it('speaks the language of the player', () => {
    expect(hintFor(journalOf(0), MAX_REPORT_CHARS, 'ru')).toMatch(/[А-Яа-я]/);
    expect(hintFor(journalOf(MAX_REPORTS), 0, 'ru')).toMatch(/[А-Яа-я]/);
  });
});
