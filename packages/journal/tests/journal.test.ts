import { describe, expect, it } from 'vitest';
import {
  MAX_REPORTS,
  SCHEMA_VERSION,
  fileName,
  isReport,
  keyOf,
  merge,
  newEntries,
  order,
  parseDocument,
  toDocument,
  type Report,
} from '../src';

/**
 * The format two surfaces have to agree about.
 *
 * The mini app writes a path to a file and the bot reads one in. They are a
 * browser bundle and a Bun process, they store reports in entirely different
 * things, and if each described the format for itself they would describe it
 * differently — which is the mistake this whole repository was assembled to
 * undo. So the format is one package with no dependencies, and these are the
 * rules it keeps.
 */

const report = (plan: number, text: string, at: number): Report => ({ plan, text, at });

/** A path of the shape a played game produces. */
function path(count: number, from = 0): Report[] {
  return Array.from({ length: count }, (_, n) =>
    report(((n + from) % 72) + 1, `written at ${n + from}`, (n + from) * 1000),
  );
}

describe('what is a report', () => {
  it('is a plan on the board, something written, and a moment', () => {
    expect(isReport(report(41, 'a word', 1))).toBe(true);
  });

  it('is not any of the things a file might contain instead', () => {
    const notReports: unknown[] = [
      null,
      42,
      'text',
      {},
      { plan: 41, text: 'x' },
      { plan: 0, text: 'x', at: 1 },
      { plan: 73, text: 'x', at: 1 },
      { plan: 41.5, text: 'x', at: 1 },
      { plan: 41, text: '', at: 1 },
      { plan: 41, text: 'x', at: NaN },
      { plan: 41, text: 'x', at: 'yesterday' },
      { plan: '41', text: 'x', at: 1 },
    ];

    for (const value of notReports) {
      expect(isReport(value), JSON.stringify(value) ?? 'undefined').toBe(false);
    }
  });
});

describe('a file comes back as it went out', () => {
  it('round-trips a whole path', () => {
    const entries = path(120);
    expect(parseDocument(JSON.stringify(toDocument(entries)))).toEqual(order(entries));
  });

  it('says what wrote it and what shape it is', () => {
    const document = toDocument(path(3));
    expect(document.app).toBe('leela');
    expect(document.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('is named something a downloads folder can keep', () => {
    expect(fileName('2026-07-30')).toBe('leela-path-2026-07-30.json');
  });
});

describe('a file is the least trustworthy thing either surface handles', () => {
  it.each([
    ['not JSON', 'half a write{'],
    ['a number', '42'],
    ['nothing', 'null'],
    ['from something else', '{"app":"snakes","schemaVersion":1,"entries":[]}'],
    ['with no version', '{"app":"leela","entries":[]}'],
    ['with a version that is text', '{"app":"leela","schemaVersion":"1","entries":[]}'],
    ['with no entries', '{"app":"leela","schemaVersion":1}'],
    ['with entries that are not a list', '{"app":"leela","schemaVersion":1,"entries":{}}'],
    [
      'with one bad entry among good ones',
      '{"app":"leela","schemaVersion":1,"entries":[{"plan":5,"text":"x","at":1},{"plan":900,"text":"y","at":2}]}',
    ],
  ])('refuses one %s', (_what, text) => {
    expect(parseDocument(text)).toBeNull();
  });

  it('refuses a newer shape and reads an older one', () => {
    const document = toDocument(path(2));
    expect(parseDocument(JSON.stringify({ ...document, schemaVersion: SCHEMA_VERSION + 1 }))).toBeNull();
    expect(parseDocument(JSON.stringify({ ...document, schemaVersion: 0 }))).not.toBeNull();
  });

  it('takes all of a file or none of it', () => {
    // Half a path is worse than no path: the player would not know which half.
    const half = '{"app":"leela","schemaVersion":1,"entries":[{"plan":5,"text":"x","at":1},7]}';
    expect(parseDocument(half)).toBeNull();
  });
});

describe('taking a file in loses nothing', () => {
  it('keeps everything that was already there', () => {
    const mine = path(60);
    const theirs = path(60, 500);
    const merged = merge(mine, theirs);

    for (const entry of mine) expect(merged).toContainEqual(entry);
  });

  it('adds nothing the second time', () => {
    // People do send the same file twice, and a path that doubles is a path
    // nobody trusts.
    const mine = path(40);
    const theirs = path(40, 500);

    const once = merge(mine, theirs);
    expect(merge(once, theirs)).toEqual(once);
    expect(newEntries(once, theirs)).toEqual([]);
  });

  it('adds nothing when a file repeats itself', () => {
    const twice = [...path(10), ...path(10)];
    expect(newEntries([], twice)).toHaveLength(10);
  });

  it('is oldest first, whatever order the file was in', () => {
    const scrambled = [report(41, 'c', 300), report(6, 'a', 100), report(23, 'b', 200)];
    expect(merge([], scrambled).map((e) => e.text)).toEqual(['a', 'b', 'c']);
  });

  it('stays bounded, so a file cannot fill a store', () => {
    expect(merge([], path(MAX_REPORTS * 2))).toHaveLength(MAX_REPORTS);
  });

  it('tells apart two reports that differ only in when', () => {
    // The same words on the same plan, written twice, are two reports — a
    // player who returns to a plan writes about it again.
    const a = report(41, 'the same words', 1);
    const b = report(41, 'the same words', 2);
    expect(keyOf(a)).not.toBe(keyOf(b));
    expect(newEntries([a], [b])).toEqual([b]);
  });

  it('does not mutate what it was given', () => {
    const mine = path(5);
    const before = JSON.stringify(mine);
    merge(mine, path(5, 100));
    expect(JSON.stringify(mine)).toBe(before);
  });
});
