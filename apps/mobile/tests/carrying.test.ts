import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, parseDocument } from '@leela/journal';
import { EMPTY, record, shareName, toShare } from '../src/journal';

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

const path = record(record(EMPTY, 6, 'the first square', 1), 41, 'and the human plane', 2);

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
    const back = parseDocument(JSON.stringify(toShare(EMPTY, 'to see it through')));

    expect(back?.entries, 'an empty path is still a path').toEqual([]);
    expect(back?.intention, 'and the question survives an empty one').toBe('to see it through');
  });
});
