import { describe, expect, it } from 'vitest';
import { CLASSIC, applyRoll, initialState, owesReport, seededRoller } from '@leela/engine';
import {
  SCHEMA_VERSION,
  fileName,
  merge,
  parseDocument,
  toDocument,
  toText, shareTextFor} from '../src/journal-file';
import { EMPTY, MAX_REPORTS, arrived, record, type Journal } from '../src/reports';

/**
 * Getting what you wrote off the device.
 *
 * The reports are the record the game is played to produce, and they lived in
 * one browser's storage with no way out: clear the site data, change phone,
 * and a year of writing is gone. The published app had Firebase and the bot
 * has SQLite; the mini app has a file.
 *
 * The assertions are about what a file must never do — lose something, or be
 * trusted — rather than about a particular document.
 */

const titleOf = (plan: number) => `Plan ${plan}`;

/** A journal from a real game, so the tests are about real paths. */
function played(rounds = 120, seed = 5): Journal {
  const die = seededRoller(seed);
  let state = initialState();
  let journal = EMPTY;

  for (let round = 0; round < rounds; round += 1) {
    if (owesReport(state) && !journal.reported) {
      journal = record(journal, state.loka, `standing on ${state.loka}`, round);
    }
    state = applyRoll(state, die(), CLASSIC).state;
    if (owesReport(state)) journal = arrived(journal);
  }

  return journal;
}

describe('the file comes back', () => {
  it('carries every report a real game wrote', () => {
    const journal = played();
    expect(journal.entries.length).toBeGreaterThan(5);

    const back = parseDocument(JSON.stringify(toDocument(journal)));
    expect(back).toEqual(journal.entries);
  });

  it('says what wrote it and what shape it is', () => {
    const document = toDocument(played());
    expect(document.app).toBe('leela');
    expect(document.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('is named something a downloads folder can keep', () => {
    expect(fileName('2026-07-30')).toBe('leela-path-2026-07-30.json');
    expect(fileName('2026-07-30')).toMatch(/\.json$/);
  });
});

describe('a file is the least trustworthy thing here', () => {
  // It has been out of the app, through a chat, and possibly through an
  // editor. Each of these is refused rather than half-read.
  const journal = played(40);
  const good = JSON.stringify(toDocument(journal));

  it('reads the one it wrote', () => {
    expect(parseDocument(good)).not.toBeNull();
  });

  it.each([
    ['not JSON at all', 'half a write{'],
    ['not an object', '42'],
    ['nothing', 'null'],
    ['from something else', '{"app":"snakes","schemaVersion":1,"entries":[]}'],
    ['with no version', '{"app":"leela","entries":[]}'],
    ['with a version that is not one', '{"app":"leela","schemaVersion":"1","entries":[]}'],
    ['with no entries', '{"app":"leela","schemaVersion":1}'],
    ['with entries that are not a list', '{"app":"leela","schemaVersion":1,"entries":{}}'],
    [
      'with a plan off the board',
      '{"app":"leela","schemaVersion":1,"entries":[{"plan":900,"text":"x","at":1}]}',
    ],
    [
      'with an empty report',
      '{"app":"leela","schemaVersion":1,"entries":[{"plan":5,"text":"","at":1}]}',
    ],
  ])('refuses one %s', (_what, text) => {
    expect(parseDocument(text)).toBeNull();
  });

  it('refuses a shape from a newer build, rather than guessing at it', () => {
    // Older is readable; newer may mean something different by the same field.
    const newer = JSON.stringify({ ...toDocument(journal), schemaVersion: SCHEMA_VERSION + 1 });
    expect(parseDocument(newer)).toBeNull();

    const older = JSON.stringify({ ...toDocument(journal), schemaVersion: 0 });
    expect(parseDocument(older)).not.toBeNull();
  });
});

describe('bringing one back loses nothing', () => {
  it('keeps everything that was already here', () => {
    const mine = played(60, 1);
    const theirs = played(60, 2);

    const merged = merge(mine, theirs.entries);

    for (const entry of mine.entries) {
      expect(merged.entries).toContainEqual(entry);
    }
    expect(merged.entries.length).toBeGreaterThan(mine.entries.length);
  });

  it('changes nothing the second time', () => {
    // Importing the same file twice is a thing people do, and a path that
    // doubles every time is a path nobody trusts.
    const mine = played(60, 1);
    const theirs = played(60, 2).entries;

    const once = merge(mine, theirs);
    const twice = merge(once, theirs);

    expect(twice).toEqual(once);
  });

  it('keeps the order a path is read in', () => {
    const merged = merge(played(60, 1), played(60, 2).entries);
    for (let i = 1; i < merged.entries.length; i += 1) {
      expect((merged.entries[i]?.at ?? 0) >= (merged.entries[i - 1]?.at ?? 0)).toBe(true);
    }
  });

  it('never opens the gate', () => {
    // A report written on another device, about another plan, is not a reason
    // to let this player throw. `reported` is the journal's own, always.
    const owing: Journal = { ...arrived(played(40)), reported: false };
    const merged = merge(owing, played(40, 9).entries);
    expect(merged.reported).toBe(false);

    const settled: Journal = { ...played(40), reported: true };
    expect(merge(settled, played(40, 9).entries).reported).toBe(true);
  });

  it('stays bounded, so a file cannot fill the storage', () => {
    const many = Array.from({ length: MAX_REPORTS * 2 }, (_, n) => ({
      plan: (n % 72) + 1,
      text: `report ${n}`,
      at: n,
    }));
    expect(merge(EMPTY, many).entries).toHaveLength(MAX_REPORTS);
  });
});

describe('the path as something to read', () => {
  it('names each plan and quotes what was written', () => {
    const journal = record(arrived(EMPTY), 41, 'what it brought up', 1);
    const text = toText(journal, titleOf);
    expect(text).toContain('41. Plan 41');
    expect(text).toContain('what it brought up');
  });

  it('is empty when nothing is written, rather than a lonely separator', () => {
    expect(toText(EMPTY, titleOf)).toBe('');
  });

  it('separates entries so two reports do not read as one', () => {
    let journal = record(arrived(EMPTY), 6, 'first', 1);
    journal = record(arrived(journal), 41, 'second', 2);
    const text = toText(journal, titleOf);
    expect(text.split('---')).toHaveLength(2);
    expect(text.indexOf('first')).toBeLessThan(text.indexOf('second'));
  });
});

describe('one square, handed to somebody else', () => {
  /**
   * The path leaves this app as a file — a year of it, for coming back to.
   * What people actually pass on is a single square: *this is where I landed
   * and this is what it asked*. `Lila Game`, the freshest of the competing
   * apps (updated May 2026), leads its store listing with sharing results;
   * this app could export everything and share nothing.
   *
   * The rule asserted is what a share is allowed to contain — one square, the
   * player's own words, and the intention only as a frame — rather than the
   * exact shape of today's sentence.
   */

  it('names the square and carries what was written about it', () => {
    const text = shareTextFor(41, 'The human plane', 'It asked me to stay put.', '');

    expect(text).toContain('41');
    expect(text).toContain('The human plane');
    expect(text).toContain('It asked me to stay put.');
  });

  it('is the square alone when nothing has been written yet', () => {
    const text = shareTextFor(41, 'The human plane', '   ', '');

    expect(text).toBe('41. The human plane');
  });

  it('adds the intention last, and only when there is one', () => {
    // It is the frame, not the news.
    const framed = shareTextFor(6, 'Delusion', 'What I keep avoiding.', 'To stop circling.');
    const bare = shareTextFor(6, 'Delusion', 'What I keep avoiding.', '  ');

    expect(framed.trim().endsWith('To stop circling.')).toBe(true);
    expect(bare).not.toContain('—');
  });

  it('carries nothing else the player has written', () => {
    // A share is one square; a path is a file. Somebody handing a friend a
    // sentence has not handed them a year.
    const text = shareTextFor(41, 'The human plane', 'only this one', 'and this');

    expect(text).not.toContain('written on another square');
    expect(text.split('\n').filter(Boolean)).toHaveLength(3);
  });

  it('is text a person can read, not a format a program parses', () => {
    // The file is the format. This is prose, and it must not turn into JSON
    // the day somebody reaches for `toDocument` here.
    const text = shareTextFor(41, 'The human plane', 'a sentence', '');

    expect(text.startsWith('{')).toBe(false);
    expect(text).not.toContain('schemaVersion');
  });
});
