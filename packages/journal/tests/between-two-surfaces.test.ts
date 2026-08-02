/**
 * The one place a player's record moves between two shipped applications.
 *
 * The mini app writes a file and the phone reads it; the phone writes one and
 * the mini app reads it. Both sides are tested — each in its own package, each
 * against a document it built itself. **The crossing is not**, and a crossing is
 * where this repository has found its defects: two surfaces agreeing about a
 * format on the day it was written, and one of them changing.
 *
 * These assert it in both directions, at the edges where a loss would hide: the
 * bound on how many accounts a path holds, the bound on how long one may be,
 * the question the path was written under, and a file arriving twice.
 *
 * Written after a probe of mine claimed the two disagreed about a long report —
 * the phone taking 4,000 characters where the mini app took 4,500. They do not.
 * The probe had handed the mini app `JSON.parse(...).entries` while the app
 * itself reads through `parseDocument`, which is what clamps. The measurement
 * was wrong and the code was right, which is the argument for asserting the
 * crossing the way the applications actually make it.
 */

import { describe, expect, it } from 'vitest';
import { MAX_REPORTS, MAX_REPORT_CHARS, parseDocument, type Report } from '../src/index';
// The two surfaces, imported the way only a test of the crossing can. Neither
// package depends on the other, and neither should: what they share is the
// format, which is this package.
import { toDocument as fromMiniApp, taking } from '../../../apps/miniapp/src/journal-file';
import { toShare as fromPhone, takeIn } from '../../../apps/mobile/src/journal';

const account = (n: number): Report => ({
  plan: (n % 72) + 1,
  text: `something written about the ${n}th square stood on`,
  at: 1_700_000_000_000 + n,
});

const ASKED = 'to understand why I put off what matters';

/** A file as each application writes one. */
const files = {
  'the mini app': (entries: Report[], intention = ASKED) =>
    JSON.stringify(fromMiniApp({ reported: true, entries }, intention)),
  'the phone': (entries: Report[], intention = ASKED) =>
    JSON.stringify(fromPhone({ entries }, intention)),
};

/** Taking a file in, as each application does it. */
const readers = {
  'the mini app': (held: Report[], text: string) => {
    // Exactly `importPath` in the mini app's `main.ts`: the format parses, and
    // `taking` is handed what came back.
    const incoming = parseDocument(text);
    if (incoming === null) return null;

    const took = taking({ reported: true, entries: held }, incoming.entries);
    return {
      entries: took.journal.entries,
      added: took.added,
      dropped: took.dropped,
      intention: incoming.intention ?? null,
    };
  },
  'the phone': (held: Report[], text: string) => {
    const took = takeIn({ entries: held }, text, '');
    if (!took.readable) return null;

    return {
      entries: took.journal.entries,
      added: took.added,
      dropped: took.dropped,
      intention: took.intention,
    };
  },
};

const both = Object.keys(files) as Array<keyof typeof files>;

/** Every direction the record can travel, including a surface to itself. */
const crossings = both.flatMap((wrote) => both.map((reads) => ({ wrote, reads })));

describe('a path carried from one application to the other', () => {
  it('arrives whole, whichever wrote it and whichever reads it', () => {
    const lost: string[] = [];

    for (const { wrote, reads } of crossings) {
      const entries = [account(1), account(2), account(3)];
      const took = readers[reads]([], files[wrote](entries));

      if (!took) {
        lost.push(`${wrote} → ${reads}: unreadable`);
        continue;
      }
      if (took.entries.length !== entries.length || took.added !== entries.length) {
        lost.push(`${wrote} → ${reads}: ${took.added} of ${entries.length}`);
      }
    }

    expect(lost).toEqual([]);
  });

  it('carries the question the path was written under', () => {
    // It is in the format, both write it, and a player who moves surfaces
    // should not have to be asked again what they are playing for.
    for (const { wrote, reads } of crossings) {
      const took = readers[reads]([], files[wrote]([account(1)]));

      expect({ wrote, reads, intention: took?.intention }).toEqual({
        wrote,
        reads,
        intention: ASKED,
      });
    }
  });

  it('adds nothing the second time', () => {
    // Keyed by the square and the moment, so a file handed over twice — which
    // is what happens when somebody is not sure the first one landed — is not
    // a path with everything in it twice.
    for (const { wrote, reads } of crossings) {
      const entries = [account(1), account(2)];
      const text = files[wrote](entries);

      const once = readers[reads]([], text);
      const twice = readers[reads](once?.entries ?? [], text);

      expect({ wrote, reads, added: twice?.added, held: twice?.entries.length }).toEqual({
        wrote,
        reads,
        added: 0,
        held: entries.length,
      });
    }
  });

  it('cuts a long account to the same length on both sides', () => {
    // The format clamps at `MAX_REPORT_CHARS`, and each application reads
    // through it. A surface that clamped for itself would make one file mean
    // two things.
    const long = [{ plan: 1, text: 'x'.repeat(MAX_REPORT_CHARS + 500), at: 1 }];
    const lengths = new Set<number>();

    for (const { wrote, reads } of crossings) {
      const took = readers[reads]([], files[wrote](long));
      lengths.add(took?.entries[0]?.text.length ?? -1);
    }

    expect([...lengths]).toEqual([MAX_REPORT_CHARS]);
  });

  it('drops the same accounts at the bound, and counts them the same way', () => {
    // At `MAX_REPORTS` the path does not grow, so *what arrived* and *what is
    // there now* stop being the same number. Both surfaces ask the format.
    const held = Array.from({ length: MAX_REPORTS }, (_, n) => account(n));
    const arriving = Array.from({ length: 10 }, (_, n) => account(MAX_REPORTS + n));
    const answers = new Set<string>();

    for (const { wrote, reads } of crossings) {
      const took = readers[reads](held, files[wrote](arriving));
      answers.add(`${took?.entries.length}/${took?.added}/${took?.dropped}`);
    }

    expect([...answers]).toEqual([`${MAX_REPORTS}/${arriving.length}/${arriving.length}`]);
  });

  it('is refused by both when it is not a path at all', () => {
    // The other half: a file neither wrote must be refused by both, and refused
    // the same way, or one application opens what the other calls rubbish.
    for (const raw of ['', 'not json', '42', '{}', '{"entries":[]}', '{"schemaVersion":99,"entries":[]}']) {
      const answers = both.map((reads) => readers[reads]([], raw) === null);

      expect({ raw, answers }).toEqual({ raw, answers: [true, true] });
    }
  });

  it('writes the same document for the same path', () => {
    // Not required by anything above — a format can be read compatibly and
    // written differently — and worth holding: the day the two documents differ
    // is the day one of them has a field the other will quietly drop.
    const entries = [account(1), account(2)];

    expect(Object.keys(JSON.parse(files['the mini app'](entries))).sort()).toEqual(
      Object.keys(JSON.parse(files['the phone'](entries))).sort(),
    );
  });
});
