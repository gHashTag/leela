import { describe, expect, it } from 'vitest';
import { toDocument, type Report } from '@leela/journal';
import { MAX_FILE_BYTES, asReport, decide, keep } from '../src/take-in';
import { MemoryReportSink, type StoredReport } from '../src/store';

/**
 * A path arriving as a file.
 *
 * A player who uses both surfaces had half a path in the mini app and half in
 * the bot, and a whole one in neither. Sharing them properly needs a server and
 * a shared identity — `specs/001-shared-reports`, which is a deployment
 * decision. A file needs neither.
 *
 * These are about the bot's half of it: what it decides, and that nothing a
 * stranger can send is a reason to break their chat.
 */

const report = (plan: number, text: string, at: number): Report => ({ plan, text, at });
const stored = (plan: number, text: string, at: number): StoredReport => ({
  plan,
  text,
  createdAt: new Date(at),
});

const fileOf = (entries: Report[]) => JSON.stringify(toDocument(entries));

describe('what it decides', () => {
  it('takes what is new', () => {
    const file = fileOf([report(6, 'first', 1000), report(41, 'second', 2000)]);
    const outcome = decide(file, file.length, [asReport(stored(6, 'first', 1000))]);

    expect(outcome.kind).toBe('took');
    if (outcome.kind === 'took') {
      expect(outcome.added).toEqual([report(41, 'second', 2000)]);
    }
  });

  it('says so when there is nothing new, rather than saying nothing', () => {
    const entries = [report(6, 'first', 1000)];
    const file = fileOf(entries);
    expect(decide(file, file.length, entries).kind).toBe('nothing-new');
  });

  it('refuses a file it cannot vouch for', () => {
    for (const text of ['', 'not json', '{"app":"snakes","schemaVersion":1,"entries":[]}']) {
      expect(decide(text, text.length, []).kind, text).toBe('unreadable');
    }
  });

  it('refuses a file too large to be a path, without reading it', () => {
    // Asked on the size Telegram reports, before anything is downloaded: there
    // is no reason to fetch a hundred megabytes to find out it is not a path.
    const outcome = decide('', MAX_FILE_BYTES + 1, []);
    expect(outcome.kind).toBe('too-big');
  });

  it('says there is nowhere to put it when the store keeps nothing', () => {
    // The distinction the `/path` command already makes: "you have written
    // nothing" and "this bot keeps nothing" are different statements.
    const file = fileOf([report(6, 'first', 1000)]);
    expect(decide(file, file.length, null).kind).toBe('not-kept');
  });

  it('has an answer for every file, because a file is a thing a stranger sends', () => {
    // The shape: `decide` is total. Anything that arrives produces an outcome
    // the caller can say out loud, and nothing throws.
    const inputs: Array<[string, number, Report[] | null]> = [
      ['', 0, []],
      ['{}', 2, []],
      ['null', 4, []],
      ['[]', 2, []],
      ['{"app":"leela","schemaVersion":99,"entries":[]}', 40, []],
      [fileOf([]), 30, []],
      [fileOf([report(1, 'x', 1)]), 60, null],
      ['x'.repeat(100), MAX_FILE_BYTES * 2, []],
    ];

    for (const [text, bytes, existing] of inputs) {
      expect(() => decide(text, bytes, existing), text.slice(0, 20)).not.toThrow();
      expect(decide(text, bytes, existing).kind).toBeTruthy();
    }
  });

  it('treats an empty file as nothing new rather than as a failure', () => {
    const file = fileOf([]);
    expect(decide(file, file.length, []).kind).toBe('nothing-new');
  });
});

describe('what it keeps', () => {
  it('writes every report the file brought', async () => {
    const sink = new MemoryReportSink();
    await keep(sink, 'a', [report(6, 'first', 1000), report(41, 'second', 2000)]);

    // Newest first, which is the sink's own order — `pathFor` sorts for
    // reading and does not assume one.
    const kept = await sink.history?.('a');
    expect(kept?.map((entry) => entry.text)).toEqual(['second', 'first']);
  });

  it('writes nothing when the file brought nothing', async () => {
    const sink = new MemoryReportSink();
    await keep(sink, 'a', []);
    expect(await sink.history?.('a')).toEqual([]);
  });
});

describe('a stored report and a report in a file are the same moment', () => {
  it('converts between them without losing it', () => {
    const at = 1_700_000_000_000;
    expect(asReport(stored(41, 'a word', at))).toEqual(report(41, 'a word', at));
  });

  it('round-trips through a file', async () => {
    // The whole point: what the bot has can be written out, and what is written
    // out can be recognised as already there.
    const sink = new MemoryReportSink();
    await keep(sink, 'a', [report(6, 'first', 1000)]);
    const existing = (await sink.history?.('a')) ?? [];

    const file = fileOf(existing.map(asReport));
    expect(decide(file, file.length, existing.map(asReport)).kind).toBe('nothing-new');
  });
});
