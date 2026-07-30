import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('a file the mini app actually wrote', () => {
  /**
   * The bridge, held to an artefact rather than to a document this test built.
   *
   * Every other test here constructs its input with `toDocument` — the same
   * function the mini app calls — so the round trip is true by construction and
   * proves nothing about the other surface. `tests/fixtures/miniapp-export.json`
   * is not constructed: it is the bytes captured from the mini app's own
   * download, intercepted at `URL.createObjectURL` in a browser, so what is
   * parsed here is what a player's file holds.
   *
   * If either side changes the format, this fails on the other one.
   */
  const recorded = readFileSync(join(__dirname, 'fixtures/miniapp-export.json'), 'utf8');

  it('is taken whole', () => {
    const outcome = decide(recorded, recorded.length, []);

    expect(outcome.kind).toBe('took');
    if (outcome.kind === 'took') {
      expect(outcome.added.map((entry) => entry.plan)).toEqual([6, 41]);
      expect(outcome.added[0]?.text.length).toBeGreaterThan(0);
      expect(outcome.added[0]?.at).toBeGreaterThan(0);
    }
  });

  it('adds nothing the second time, which is what a player will do', () => {
    const first = decide(recorded, recorded.length, []);
    const existing = first.kind === 'took' ? first.added : [];

    expect(decide(recorded, recorded.length, existing).kind).toBe('nothing-new');
  });

  it('is a file a person can read, because a file in a chat gets opened', () => {
    // Indented and named: the mini app writes it for a human as much as for
    // this parser.
    expect(recorded).toContain('\n  ');
    expect(JSON.parse(recorded).app).toBe('leela');
    expect(JSON.parse(recorded).schemaVersion).toBe(1);
  });

  it('merges with what the bot already has, keeping both paths', () => {
    // The case the bridge exists for: a player who has written in both places.
    const inBot = [{ plan: 12, text: 'written in a chat', at: 1785000300000 }];
    const outcome = decide(recorded, recorded.length, inBot);

    expect(outcome.kind).toBe('took');
    if (outcome.kind === 'took') {
      expect(outcome.added.map((entry) => entry.plan).sort((a, b) => a - b)).toEqual([6, 41]);
    }
  });
});

describe('the moment a report was written', () => {
  /**
   * `keep` recorded a plan and a text and nothing else, so the store stamped
   * the moment of the *import*. Two things followed, and the second is the bad
   * one:
   *
   * - a player who brought in a year of writing got a journal where every
   *   entry happened today, and exporting it again wrote those wrong dates
   *   back into the file;
   * - the same file arrived as **new** every time, because what distinguishes
   *   one report from another includes when it was written. Sending a path
   *   twice duplicated it; three times, tripled it.
   *
   * Found by testing the receiving path for the first time — it had never run,
   * because the fetch behind it always failed in tests.
   */

  it('is the moment in the file, not the moment it arrived', async () => {
    const written = 1_700_000_000_000;
    const sink = new MemoryReportSink(() => 1_900_000_000_000);

    await keep(sink, 'a', [report(6, 'written long ago', written)]);

    const kept = await sink.history?.('a');
    expect(kept?.[0]?.createdAt.getTime()).toBe(written);
  });

  it('makes the same path arrive as nothing new the second time', async () => {
    // The whole bridge in one assertion, through the store rather than around
    // it: this is what failed, and it failed silently by adding duplicates.
    const sink = new MemoryReportSink(() => 1_900_000_000_000);
    const entries = [report(6, 'first', 1000), report(41, 'second', 2000)];

    await keep(sink, 'a', entries);
    const existing = (await sink.history?.('a')) ?? [];

    const file = fileOf(entries);
    expect(decide(file, file.length, existing.map(asReport)).kind).toBe('nothing-new');
  });

  it('keeps a path the same however many times it is sent', async () => {
    const sink = new MemoryReportSink(() => 1_900_000_000_000);
    const entries = [report(6, 'first', 1000), report(41, 'second', 2000)];
    const file = fileOf(entries);

    for (let send = 0; send < 3; send += 1) {
      const existing = (await sink.history?.('a')) ?? [];
      const outcome = decide(file, file.length, existing.map(asReport));
      if (outcome.kind === 'took') await keep(sink, 'a', outcome.added);
    }

    expect((await sink.history?.('a'))?.length).toBe(2);
  });

  it('still stamps now for a report written here and now', () => {
    // A report typed into a chat has no earlier moment to carry, and the
    // store is right to date it.
    const sink = new MemoryReportSink(() => 1_900_000_000_000);
    return sink.record({ userId: 'a', plan: 6, text: 'typed just now' }).then(async () => {
      const kept = await sink.history?.('a');
      expect(kept?.[0]?.createdAt.getTime()).toBe(1_900_000_000_000);
    });
  });
});
