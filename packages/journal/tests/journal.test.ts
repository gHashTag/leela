import { describe, expect, it } from 'vitest';
import {
  MAX_REPORTS,
  MAX_REPORT_CHARS,
  SCHEMA_VERSION,
  fileName,
  isReport,
  keyOf,
  merge,
  merged,
  newEntries,
  order,
  MAX_INTENTION_CHARS,
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
    // The plan and the moment are both numbers with the same kind of rule —
    // whole, in range — so the wrong values for them are generated rather than
    // remembered. The list they replace had `NaN` and `'yesterday'` for the
    // moment and stopped there, and `1.5` and `-1` went through: neither is a
    // time anything wrote, and a file has been through an editor.
    const notNumbers = [NaN, Infinity, -Infinity, 1.5, '1', null, undefined, {}];

    const notReports: unknown[] = [
      null,
      42,
      'text',
      {},
      { plan: 41, text: 'x' },
      { plan: 0, text: 'x', at: 1 },
      { plan: 73, text: 'x', at: 1 },
      { plan: 41, text: '', at: 1 },
      ...notNumbers.map((plan) => ({ plan, text: 'x', at: 1 })),
      ...notNumbers.map((at) => ({ plan: 41, text: 'x', at })),
      { plan: 41, text: 'x', at: -1 },
    ];

    for (const value of notReports) {
      expect(isReport(value), JSON.stringify(value) ?? 'undefined').toBe(false);
    }
  });
});

describe('a file comes back as it went out', () => {
  it('round-trips a whole path', () => {
    const entries = path(120);
    // The whole document now: the question travels with the answers, so there
    // has to be somewhere in the return value to put it.
    expect(parseDocument(JSON.stringify(toDocument(entries)))?.entries).toEqual(order(entries));
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

describe('the question the answers were written for', () => {
  /**
   * A path left the app as a year of writing with the frame it was written
   * inside missing. The reports are the answer accumulating; the intention is
   * what they are answering. Somebody who changed phone arrived with everything
   * they had said and nothing they had asked.
   *
   * It is added as a field rather than a new `schemaVersion` on purpose. A
   * version exists so that a reader refuses a file whose *existing* fields may
   * mean something else; this changes the meaning of none, and a reader that
   * has never heard of it loses nothing it had.
   */
  const entries: Report[] = [{ plan: 41, text: 'What it asked of me.', at: 1_700_000_000_000 }];

  it('travels with them', () => {
    const back = parseDocument(JSON.stringify(toDocument(entries, 'to stop hurrying')));

    expect(back?.intention).toBe('to stop hurrying');
    expect(back?.entries).toEqual(entries);
  });

  it('is absent rather than empty when there is none', () => {
    // A file carrying `""` says the player was asked and answered nothing,
    // which is not what happened.
    expect(toDocument(entries)).not.toHaveProperty('intention');
    expect(toDocument(entries, '   ')).not.toHaveProperty('intention');
    expect(parseDocument(JSON.stringify(toDocument(entries)))?.intention).toBeUndefined();
  });

  it('is read back from a file that has one and ignored where it has not', () => {
    const withOne = JSON.stringify({ schemaVersion: 1, app: 'leela', entries, intention: 'to see' });
    const without = JSON.stringify({ schemaVersion: 1, app: 'leela', entries });

    expect(parseDocument(withOne)?.intention).toBe('to see');
    expect(parseDocument(without)?.intention).toBeUndefined();
  });

  it('does not let a file through on the strength of one', () => {
    // The entries are still the thing being vouched for. A document with a
    // lovely intention and a broken report is a broken document.
    const broken = JSON.stringify({
      schemaVersion: 1,
      app: 'leela',
      entries: [{ plan: 99, text: 'off the board', at: 1 }],
      intention: 'to see',
    });

    expect(parseDocument(broken)).toBeNull();
  });

  it('refuses one no player could have written', () => {
    // A file has been out of the app and possibly through an editor, so the
    // published app's own bound applies on the way in as well as out.
    const huge = JSON.stringify({
      schemaVersion: 1,
      app: 'leela',
      entries,
      intention: 'x'.repeat(MAX_INTENTION_CHARS + 1),
    });

    expect(parseDocument(huge)).not.toBeNull();
    expect(parseDocument(huge)?.intention, 'the path survives; the oversized question does not')
      .toBeUndefined();
  });

  it('is not something a wrong type can smuggle in', () => {
    for (const intention of [42, {}, [], null, true]) {
      const text = JSON.stringify({ schemaVersion: 1, app: 'leela', entries, intention });
      expect(parseDocument(text)?.intention, JSON.stringify(intention)).toBeUndefined();
    }
  });
});

describe('what a file may carry is what the app may write', () => {
  /**
   * Every bound this format declares is applied where a path is *written* —
   * the writer stops a report at `MAX_REPORT_CHARS`, the merge drops past
   * `MAX_REPORTS`, the intention is refused over `MAX_INTENTION_CHARS`. Only
   * two of the three were applied where a path is *read*.
   *
   * A file is the one thing here that has been out of the app: through a chat,
   * onto a disk, possibly through an editor. The comment on the intention's
   * bound says exactly that and draws exactly that conclusion — and the report
   * text beside it was bounded on the way out only, so an entry of any length
   * at all went into the store and into every rendering of the path from then
   * on.
   *
   * Stated against the constants rather than against their values: raising a
   * bound must not leave this asserting the old number.
   */
  const overLong = (chars: number) => 'x'.repeat(chars);

  it('shortens a report longer than the format allows, and keeps the rest', () => {
    const file = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      app: 'leela',
      entries: [
        { plan: 5, text: 'a short one', at: 1 },
        { plan: 41, text: overLong(MAX_REPORT_CHARS + 1_000), at: 2 },
        { plan: 12, text: 'another short one', at: 3 },
      ],
    });

    const back = parseDocument(file);

    expect(back?.entries).toHaveLength(3);
    expect(back?.entries[1]?.text.length, 'inside the bound').toBe(MAX_REPORT_CHARS);
    expect(back?.entries[0]?.text, 'and the others untouched').toBe('a short one');
    expect(back?.entries[2]?.text).toBe('another short one');
  });

  it('leaves a report of exactly the bound alone', () => {
    // The edge, which is the case a clamp gets wrong in the other direction.
    const file = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      app: 'leela',
      entries: [{ plan: 5, text: overLong(MAX_REPORT_CHARS), at: 1 }],
    });

    expect(parseDocument(file)?.entries[0]?.text.length).toBe(MAX_REPORT_CHARS);
  });

  it('refuses an intention longer than the format allows', () => {
    // Dropped rather than shortened, which is the older decision and stays: a
    // question cut in half is a different question, and a report cut short is
    // still most of what was said.
    const file = JSON.stringify({
      ...toDocument(path(1)),
      intention: overLong(MAX_INTENTION_CHARS + 1),
    });

    expect(parseDocument(file)?.intention).toBeUndefined();
  });

  it('keeps a path down to the most it may hold, however long the file is', () => {
    // The count, which is enforced where paths are joined rather than where one
    // is read — so it is asserted there, at the place that does it.
    const many = Array.from({ length: MAX_REPORTS + 50 }, (_, index) =>
      report(((index % 72) + 1), `entry ${index}`, index + 1),
    );

    expect(merge([], many).length).toBe(MAX_REPORTS);
  });
});

describe('the union says what it cost', () => {
  /**
   * `merge` cuts to `MAX_REPORTS` and said nothing, and both surfaces that call
   * it told the player `newEntries(...).length` — *twelve plans brought back* —
   * while the cut had just thrown twelve of their oldest away. Four hundred and
   * ninety plus fifty is five hundred, and the sentence said fifty. The comment
   * above `takeIn` on the phone says **Nothing is lost** in as many words.
   *
   * Found by probing the format at its bound rather than in the middle.
   */
  const many = (count: number, from = 0): Report[] =>
    Array.from({ length: count }, (_, index) => ({
      plan: ((from + index) % 72) + 1,
      text: `account number ${from + index}, long enough to be one`,
      at: 1_700_000_000_000 + (from + index) * 1_000,
    }));

  it('counts what is there, not what was new', () => {
    const mine = many(MAX_REPORTS - 10);
    const theirs = many(50, 10_000);
    const union = merged(mine, theirs);

    expect(union.entries).toHaveLength(MAX_REPORTS);
    expect(union.added, 'only what fits was brought back').toBe(50);
    expect(union.dropped, 'and this many of the oldest went').toBe(40);
  });

  it('never claims more than it holds, at any size', () => {
    // The shape rather than one pair of numbers: whatever goes in, the count
    // is of entries a reader can find in the result.
    for (const [mine, theirs] of [
      [0, 10],
      [10, 0],
      [MAX_REPORTS, 10],
      [MAX_REPORTS - 1, 1],
      [MAX_REPORTS + 200, 100],
      [200, MAX_REPORTS],
    ] as const) {
      const union = merged(many(mine), many(theirs, 100_000));
      const keys = new Set(union.entries.map(keyOf));

      expect(union.entries.length, `${mine}+${theirs}`).toBeLessThanOrEqual(MAX_REPORTS);
      expect(union.added, `${mine}+${theirs}`).toBe(
        many(theirs, 100_000).filter((entry) => keys.has(keyOf(entry))).length,
      );
    }
  });

  it('says nothing was brought back when nothing of it fits', () => {
    /**
     * A full path and a file of older accounts. Every one of them is new, and
     * every one is cut — so `newEntries` says fifty and a reader finds none.
     * This is the case that makes the count a different question from "how many
     * were new", rather than the same one with a rounding error.
     */
    const mine = many(MAX_REPORTS, 10_000);
    const older = many(50);

    const union = merged(mine, older);
    expect(newEntries(mine, older), 'all of them are new').toHaveLength(50);
    expect(union.added, 'and none of them is there').toBe(0);
    expect(union.dropped).toBe(50);
  });

  it('costs nothing on an ordinary import', () => {
    // The other half: a player nowhere near the bound must not be told anything
    // was let go of.
    const union = merged(many(20), many(5, 10_000));

    expect(union.added).toBe(5);
    expect(union.dropped).toBe(0);
    expect(union.entries).toHaveLength(25);
  });

  it('is what merge has always returned', () => {
    // `merge` is the same union; this only adds the two numbers beside it.
    const mine = many(30);
    const theirs = many(20, 10_000);

    expect(merge(mine, theirs)).toEqual(merged(mine, theirs).entries);
  });
});
