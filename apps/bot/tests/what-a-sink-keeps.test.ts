import { describe, expect, it } from 'vitest';
import { SqliteRoomQueries, sqliteReportSink } from '../src/sqlite';
import { MemoryReportSink, discardReports, type ReportSink } from '../src/store';
import { pathFor, returnsFor } from '../src/commands';

/**
 * Whatever a sink keeps, it can give back.
 *
 * `ReportSink.history` is optional on purpose: a sink that discards reports has
 * nothing to return, and the caller must say *"this bot is not keeping
 * reports"* rather than showing an empty list that reads as "you never wrote
 * anything". The distinction is deliberate and it is load-bearing.
 *
 * Which is exactly why its absence is dangerous. The SQLite sink — the durable
 * configuration, the one the README tells an operator to run with a volume
 * mounted so that nothing is lost — had `record` and no `history`. It wrote
 * every report into the database and then told anybody who asked that it kept
 * nothing: `/path` and `/returns` said so, `/save` had nowhere to write a file,
 * and every square handed over by the mini app was refused because there was
 * nothing to merge it into.
 *
 * `reportsFor` was written and tested and called by nobody. `audit-unread`
 * cannot see that: it is a method on a class rather than an export.
 *
 * Found by playing a whole game through the database — thirty-eight reports
 * filed, and a path that said nothing had ever been written.
 *
 * So the rule is stated over *every* sink the bot can be built with, and a new
 * one has to decide the same question: **either you keep reports and can read
 * them back, or you keep none and say so.**
 */

const NOW = new Date(1_700_000_000_000);

interface Candidate {
  what: string;
  sink: ReportSink;
  keeps: boolean;
}

function candidates(): Candidate[] {
  return [
    { what: 'in memory', sink: new MemoryReportSink(), keeps: true },
    {
      what: 'in sqlite',
      sink: sqliteReportSink(new SqliteRoomQueries({ path: ':memory:' })),
      keeps: true,
    },
    { what: 'nowhere', sink: discardReports, keeps: false },
  ];
}

describe('every sink the bot can be built with', () => {
  it('gives back what it kept, or keeps nothing at all', () => {
    // The whole rule in one line. A sink that takes a report and cannot return
    // it is a sink that loses what the game exists to produce.
    for (const candidate of candidates()) {
      expect(typeof candidate.sink.history === 'function', candidate.what).toBe(candidate.keeps);
    }
  });

  it('returns the reports it was given', async () => {
    for (const candidate of candidates()) {
      if (!candidate.keeps) continue;

      await candidate.sink.record({ userId: 'u1', plan: 41, text: 'The first.', at: NOW });
      await candidate.sink.record({ userId: 'u1', plan: 41, text: 'The second.', at: NOW });
      await candidate.sink.record({ userId: 'u2', plan: 6, text: 'Somebody else.', at: NOW });

      const mine = await candidate.sink.history?.('u1');
      expect(mine?.length, candidate.what).toBe(2);
      expect(
        mine?.map((entry) => entry.text).sort(),
        candidate.what,
      ).toEqual(['The first.', 'The second.']);
    }
  });

  it('keeps one player’s writing away from another’s', async () => {
    for (const candidate of candidates()) {
      if (!candidate.keeps) continue;

      await candidate.sink.record({ userId: 'u1', plan: 41, text: 'Mine.', at: NOW });
      await candidate.sink.record({ userId: 'u2', plan: 41, text: 'Theirs.', at: NOW });

      expect(
        (await candidate.sink.history?.('u1'))?.map((entry) => entry.text),
        candidate.what,
      ).toEqual(['Mine.']);
    }
  });

  it('lets the bot tell the truth about itself', async () => {
    // The sentence a player actually meets. A bot that keeps reports must never
    // answer `/path` with "this bot is not keeping reports", and one that keeps
    // none must never answer with an empty list — those are different facts and
    // only one of them is ever true.
    for (const candidate of candidates()) {
      await candidate.sink.record({ userId: 'u1', plan: 41, text: 'Something.', at: NOW });

      const kept = candidate.sink.history ? await candidate.sink.history('u1') : null;
      const said = pathFor('en', kept ?? null)
        .map((reply) => reply.text)
        .join(' ');

      if (candidate.keeps) {
        expect(said, candidate.what).toContain('Something.');
        expect(said, candidate.what).not.toMatch(/not keeping reports/i);
      } else {
        expect(said, candidate.what).toMatch(/not keeping reports/i);
      }
    }
  });

  it('lets the returns be read from the durable store too', async () => {
    // The feature that is entirely about reading back: a square counts as
    // returned to when more than one thing was written about it, which nothing
    // can know from a store it cannot read.
    const sink = sqliteReportSink(new SqliteRoomQueries({ path: ':memory:' }));

    await sink.record({ userId: 'u1', plan: 41, text: 'February.', at: new Date(1) });
    await sink.record({ userId: 'u1', plan: 12, text: 'Elsewhere.', at: new Date(2) });
    await sink.record({ userId: 'u1', plan: 41, text: 'June.', at: new Date(3) });

    const kept = await sink.history('u1');
    const said = returnsFor('en', kept)
      .map((reply) => reply.text)
      .join(' ');

    expect(said).toContain('February.');
    expect(said).toContain('June.');
    expect(said).not.toContain('Elsewhere.');
  });
});
