import { describe, expect, it } from 'vitest';
import { MAX_REPORTS, SCHEMA_VERSION, parseDocument } from '@leela/journal';
import { EMPTY_PATH, record, shareName, takeIn, toShare } from '../src/journal';

/**
 * A path that can leave the phone, and be read where it lands.
 *
 * The phone wrote a path with no way out at all: a player who had answered on
 * it could not bring what they had written to a table, and the record the game
 * exists to produce lived exactly one reinstall. The bot reads this format from
 * a file and the mini app writes one — the format is the whole reason
 * `@leela/journal` has no dependencies.
 *
 * So what is asserted is the round trip, not the shape of a JSON object: what
 * this surface hands out is what the format's own reader takes back. A test
 * that checked the fields would pass while the reader refused the file.
 */

const path = record(record(EMPTY_PATH, 6, 'the first square', 1), 41, 'and the human plane', 2);

describe('what the phone hands out', () => {
  it('comes back through the format’s own reader', () => {
    const back = parseDocument(JSON.stringify(toShare(path, 'to see what I keep avoiding')));

    expect(back, 'the reader accepted it').not.toBeNull();
    expect(back?.entries.map((entry) => entry.text)).toEqual([
      'the first square',
      'and the human plane',
    ]);
  });

  it('carries the question the answers were written for', () => {
    // A file without one is a year of answers with the question missing, which
    // is what the mini app's export was until it was given the same argument.
    const back = parseDocument(JSON.stringify(toShare(path, 'to see what I keep avoiding')));

    expect(back?.intention).toBe('to see what I keep avoiding');
  });

  it('leaves it out rather than empty when there is none', () => {
    // `""` says the player was asked and answered nothing, and that is not what
    // happened.
    const back = parseDocument(JSON.stringify(toShare(path, '')));

    expect(back?.intention).toBeUndefined();
    expect(back?.entries, 'and the writing still travels').toHaveLength(2);
  });

  it('says which version of the format it is, so an older reader can refuse', () => {
    expect(toShare(path, '').schemaVersion).toBe(SCHEMA_VERSION);
    expect(toShare(path, '').app).toBe('leela');
  });

  it('names the file the way every other surface names it', () => {
    // From the format rather than beside it: a second naming scheme is a second
    // thing to keep in step, and this repository has met four of those.
    expect(shareName('2026-07-31')).toBe('leela-path-2026-07-31.json');
  });

  it('hands out nothing readable when nothing was written', () => {
    const back = parseDocument(JSON.stringify(toShare(EMPTY_PATH, 'to see it through')));

    expect(back?.entries, 'an empty path is still a path').toEqual([]);
    expect(back?.intention, 'and the question survives an empty one').toBe('to see it through');
  });
});

describe('what the phone takes back', () => {
  /**
   * The phone could hand a path out and not take one back, so a player who
   * began in the mini app or at a table could not carry it here. A format
   * exists so that a path is one thing across three surfaces; a one-way door
   * makes it two.
   *
   * The three decisions below are not new. Each is one the mini app was taught
   * by a defect of its own, and this asks the same questions of the same format
   * rather than answering them again — which is the point of the format having
   * no dependencies at all.
   */
  const mine = record(EMPTY_PATH, 41, 'what I wrote here', 10);
  const theirs = JSON.stringify(
    toShare(record(record(EMPTY_PATH, 6, 'from the table', 1), 23, 'and heaven', 2), 'to stop hurrying'),
  );

  it('adds what is new and keeps what was here', () => {
    const taken = takeIn(mine, theirs, 'to see it through');

    expect(taken.readable).toBe(true);
    expect(taken.added).toBe(2);
    expect(taken.journal.entries.map((entry) => entry.text)).toEqual([
      'from the table',
      'and heaven',
      'what I wrote here',
    ]);
  });

  it('adds nothing the second time the same file arrives', () => {
    // Keyed by the square and the moment, so a player who taps twice does not
    // find their path doubled — and `revisited` does not count a square they
    // never returned to.
    const once = takeIn(mine, theirs, '').journal;
    const twice = takeIn(once, theirs, '');

    expect(twice.added).toBe(0);
    expect(twice.journal.entries).toHaveLength(once.entries.length);
  });

  it('takes the question only where this player has none', () => {
    // What somebody is playing for is theirs, and a file's is not allowed to
    // replace it.
    expect(takeIn(mine, theirs, '').intention).toBe('to stop hurrying');
    expect(takeIn(mine, theirs, 'to see it through').intention, 'already answered').toBeNull();
  });

  it('says so, and changes nothing, when the text is not a path', () => {
    for (const rubbish of ['', 'half a write{', '[]', '{"app":"snakes","schemaVersion":1,"entries":[]}']) {
      const taken = takeIn(mine, rubbish, '');

      expect(taken.readable, rubbish).toBe(false);
      expect(taken.journal, 'and the path is untouched').toBe(mine);
      expect(taken.added).toBe(0);
    }
  });

  it('never opens the gate, because a file is somebody else’s writing', () => {
    // The one thing an import must not do. Whether *this* player owes an
    // account for the square they are standing on is the engine's business and
    // this game's; a report written elsewhere, about another square, is not a
    // reason to let them throw.
    const taken = takeIn(mine, theirs, '');

    expect(Object.keys(taken.journal)).toEqual(['entries']);
    expect(JSON.stringify(taken.journal)).not.toContain('reported');
  });

  it('holds the joined path to the bound the format states', () => {
    let big = EMPTY_PATH;
    for (let index = 0; index < MAX_REPORTS; index += 1) {
      big = record(big, (index % 72) + 1, `mine ${index}`, index + 1);
    }

    const taken = takeIn(big, theirs, '');

    expect(taken.journal.entries).toHaveLength(MAX_REPORTS);

    /**
     * What is *there*, not what was new. This asserted two — the number
     * `newEntries` gives — over a path that had just cut two of the oldest to
     * make room, and said nothing about the cut. The file's accounts are newer
     * than the five hundred already held, so both do land; the sentence the
     * player reads now carries the other half as well.
     */
    /**
     * One of the file's two, and this is the defect in miniature: its accounts
     * are stamped 1 and 2, older than every one of the five hundred already
     * held, so the cut takes one of them along with the oldest of mine. The
     * player was told *2 plans brought back* and would have found one.
     */
    expect(taken.added, 'what is in the path, not what was new').toBe(1);
    expect(taken.dropped, 'and what the bound pushed out to fit it').toBe(2);
  });
});
