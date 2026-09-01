import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blank } from '../../../scripts/lib/source.mjs';
import { resize, saveSeats, sessionFrom } from '../src/seats';
import { clearDraft, saveDraft, saveIntention, saveLastRoll } from '../src/state';
import {
  CLASSIC,
  MAX_ROLL,
  applyRoll,
  initialState,
  owesReport,
  seededRoller,
  type GameState,
  advance,
  submitReport,
  isSessionOver,
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
  journalKeyFor,
  loadJournalFor,
  saveJournalFor,
  seatOwesReport,
} from '../src/reports';
import type { GameStorage } from '../src/state';

/**
 * This package's root, taken from this file's own location rather than from the
 * working directory.
 *
 * Seven suites in this directory used to read their fixtures through
 * `process.cwd()`. That works while Vitest is started inside `apps/miniapp` and
 * throws ENOENT the moment the same file is collected from anywhere else — a
 * repository-root run, a coverage pass over all ten workspaces — and the
 * measured symptom was `ENOENT /Users/playra/leela/src/state.ts`, which is this
 * file's read. The long version, with the whole measurement, is at the top of
 * `partly-written.test.ts`, which is also where the guard against it lives.
 */
const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A fresh table of `count` seats, which is `resize` from none. */
function seatsOf(count: number) {
  return resize({ turnIndex: 0, players: [] }, count).seats;
}


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
    // Not that it survives — it always survived, and behind that assertion the
    // app answered "Written. You may throw." with the writing gone. What it
    // reports back is the thing a caller can act on.
    expect(loadJournal(hostile)).toEqual(EMPTY);
    const kept = saveJournal(hostile, EMPTY);
    expect(kept, 'a refusal is reported rather than swallowed').toBe(false);
    expect(saveJournal(undefined, EMPTY), 'and so is having nowhere to write').toBe(false);
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

describe('a journal that belongs to one seat', () => {
  /**
   * `OfflineProfileScreen` in the published app is a sectioned list — "Player
   * 1", "Player 2", … sliced to the number seated — because two people on one
   * phone are two paths. This app kept one journal under one key, which was
   * right while there was one player and wrong the moment a second sat down.
   *
   * The first seat keeps the original key: weeks of writing were done before
   * there were seats, and moving it to a new name to add a feature would be a
   * feature that costs somebody their path.
   */

  const memory = () => {
    const held: Record<string, string> = {};
    return {
      storage: {
        getItem: (key: string) => held[key] ?? null,
        setItem: (key: string, value: string) => {
          held[key] = value;
        },
      } as GameStorage,
      keys: () => Object.keys(held),
    };
  };

  it('leaves the first seat where the writing already was', () => {
    expect(journalKeyFor('p1')).toBe(REPORTS_KEY);
  });

  it('gives every other seat a key of its own', () => {
    const keys = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(journalKeyFor);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps what one seat writes out of another seat path", () => {
    // The rule: what a player wrote is theirs. A shared device is not a
    // shared journal.
    const { storage } = memory();
    saveJournalFor(storage, 'p1', { reported: true, entries: [{ plan: 6, text: 'mine', at: 1 }] });
    saveJournalFor(storage, 'p2', { reported: true, entries: [{ plan: 9, text: 'yours', at: 2 }] });

    expect(loadJournalFor(storage, 'p1').entries.map((e) => e.text)).toEqual(['mine']);
    expect(loadJournalFor(storage, 'p2').entries.map((e) => e.text)).toEqual(['yours']);
  });

  it('is empty for a seat that has not written, rather than borrowed', () => {
    const { storage } = memory();
    saveJournalFor(storage, 'p1', { reported: true, entries: [{ plan: 6, text: 'mine', at: 1 }] });

    expect(loadJournalFor(storage, 'p3').entries).toEqual([]);
  });

  it('finds the writing that was there before there were seats', () => {
    // A single-player journal is seat one's, without being moved.
    const { storage } = memory();
    storage.setItem(REPORTS_KEY, JSON.stringify({ reported: true, entries: [{ plan: 41, text: 'from before', at: 3 }] }));

    expect(loadJournalFor(storage, 'p1').entries.map((e) => e.text)).toEqual(['from before']);
  });
});

describe('the gate, which was recorded twice', () => {
  /**
   * "Does this player owe a report" lived in two places: `Journal.reported`
   * here and `SeatedPlayer.reportSubmitted` in the engine. One player with one
   * journal could not tell them apart; seats could.
   *
   * A second player owed a report the engine knew about, their journal did not
   * exist yet, and a journal that does not exist reads as *nothing owed*. The
   * die was open and the writing button was disabled — they could neither be
   * stopped nor write.
   *
   * The engine owns it now. The rule asserted is that agreement, over every
   * state a real game reaches, rather than the one shape it was caught in.
   */

  const seatOf = (state: GameState, reportSubmitted: boolean) => ({ state, reportSubmitted });

  it('agrees with the engine on every state a game reaches', () => {
    let session = sessionFrom(seatsOf(2));
    const die = seededRoller(11);

    for (let turn = 0; turn < 120; turn += 1) {
      const moved = advance(session, die(), 1_700_000_000_000 + turn);
      session = moved.session;

      for (const player of session.players) {
        expect(seatOwesReport(player), `${player.id} at turn ${turn}`).toBe(
          owesReport(player.state, CLASSIC) && !player.reportSubmitted,
        );
      }

      if (moved.owesReport) session = submitReport(session, moved.playerId, 1);
      if (isSessionOver(session)) break;
    }
  });

  it('says a seat owes one when the engine says it does', () => {
    const arrived = applyRoll(initialState(), 6, CLASSIC).state;
    expect(seatOwesReport(seatOf(arrived, false))).toBe(true);
  });

  it('says nothing is owed once it has been written', () => {
    const arrived = applyRoll(initialState(), 6, CLASSIC).state;
    expect(seatOwesReport(seatOf(arrived, true))).toBe(false);
  });

  it('does not ask a player who has not entered', () => {
    expect(seatOwesReport(seatOf(initialState(), false))).toBe(false);
  });

  it('does not depend on a journal existing', () => {
    // The defect exactly: a seat with no journal yet is a seat that still
    // owes what the engine says it owes.
    const arrived = applyRoll(initialState(), 6, CLASSIC).state;
    const storage = { getItem: () => null, setItem: () => {} };

    expect(loadJournalFor(storage, 'p2').entries).toEqual([]);
    expect(seatOwesReport(seatOf(arrived, false))).toBe(true);
  });
});

describe('a write says it was kept only when something kept it', () => {
  /**
   * Every writer in the mini app answers a boolean, and the whole point of that
   * boolean is a sentence the player reads: "Written" or "written, and this
   * browser will not keep it". A wrong `true` puts the first sentence under a
   * loss, which is the defect this app was found with.
   *
   * There are two ways to keep nothing and they were answered differently: a
   * store that refuses said `false`, and *no store at all* said `true`, because
   * `storage?.setItem` on nothing is a no-op that falls through to the happy
   * return. Different reasons, identical outcome — the words are not there next
   * time — so they get the same answer.
   *
   * Stated over the writers rather than about one of them: a fourth would have
   * to answer the same question, and the third had already got it wrong.
   */
  const refuses: GameStorage = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('quota', 'QuotaExceededError');
    },
  };

  const keeps = (): GameStorage => {
    const held = new Map<string, string>();
    return {
      getItem: (key) => held.get(key) ?? null,
      setItem: (key, value) => void held.set(key, value),
    };
  };

  const writers: Array<{ what: string; write: (storage: GameStorage | undefined) => boolean }> = [
    { what: 'saveJournal', write: (storage) => saveJournal(storage, EMPTY) },
    { what: 'saveJournalFor', write: (storage) => saveJournalFor(storage, 'p2', EMPTY) },
    {
      what: 'saveSeats',
      write: (storage) => saveSeats(storage, { turnIndex: 0, players: [] }),
    },
    // The fourth, which the pass before predicted would be asked the same
    // question. It answered a different one: `true` meant "worth keeping", so a
    // refused write reported success — and the dialog told the player their
    // sentence was too short when it was not.
    { what: 'saveIntention', write: (storage) => saveIntention(storage, 'To see this through.') },
    // The last two. Their silence had a reason attached — a lost draft or a
    // stale die face is a smaller loss than a lost account — but the reason was
    // an argument for the *caller* saying nothing, and it was being made by the
    // writer, where nobody could hear it. `saveDraft` is also the earliest
    // write of a session: somebody typing in a private window reaches it before
    // they have thrown anything.
    { what: 'saveDraft', write: (storage) => saveDraft(storage, 'p1', 41, 'half an account') },
    { what: 'clearDraft', write: (storage) => clearDraft(storage, 'p1') },
    { what: 'saveLastRoll', write: (storage) => saveLastRoll(storage, 4) },
  ];

  it('covers every writer there is, rather than the ones somebody remembered', () => {
    // The list above is kept by hand, and a list kept by hand beside the thing
    // it describes is the fourth of those to go wrong in this repository. So it
    // is checked against the source: an eighth writer fails here on the day it
    // is added, which is the day the question is worth asking.
    //
    // Through the shared blanker, which this read did without for as long as it
    // was spelled `resolve(process.cwd(), ...)`. `apps/mobile/tests/source.test.ts`
    // recognises a source read with `/readFileSync\([^)]*['"`][^'"`]*(src|...)/`,
    // and `[^)]*` cannot cross the `)` in `process.cwd()` — so the rule that
    // every check asserting over source must blank it first was blind to this
    // one by an accident of spelling. Anchoring the path to `import.meta.url`
    // removed the blindfold and the sweep named this file on the first
    // repository-wide run; that suite's own doc-comment predicted it would, and
    // said the repair belonged to whoever held this file. It matters here for
    // the reason it always did: `/^export function ((?:save|clear)\w*)\(/gm`
    // over unblanked text reads a line inside a doc-comment as a declaration,
    // and this list would then be held to a writer that does not exist.
    const declared = ['state.ts', 'reports.ts', 'seats.ts'].flatMap((file) =>
      [
        ...blank(readFileSync(resolve(PACKAGE, 'src', file), 'utf8')).matchAll(
          /^export function ((?:save|clear)\w*)\(/gm,
        ),
      ].map(([, name]) => name),
    );

    const covered = writers.map(({ what }) => what);
    expect(declared.filter((name) => !covered.includes(name))).toEqual([]);
  });

  for (const { what, write } of writers) {
    it(`${what} says kept when it was`, () => {
      expect(write(keeps())).toBe(true);
    });

    it(`${what} says not kept when the store refuses`, () => {
      expect(write(refuses), 'a full quota').toBe(false);
    });

    it(`${what} says not kept when there is no store`, () => {
      expect(write(undefined), 'nowhere to write is not a write').toBe(false);
    });
  }
});
