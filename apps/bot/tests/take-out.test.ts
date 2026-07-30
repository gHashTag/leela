import { describe, expect, it } from 'vitest';
import { parseDocument } from '@leela/journal';
import { asReport, decide } from '../src/take-in';
import { fileNameFor, offer, serialise } from '../src/take-out';
import type { StoredReport } from '../src/store';

/**
 * The other half of the bridge.
 *
 * The mini app has saved a path to a file since it learned to, and the bot took
 * one in last pass. A player who plays mostly in a chat could not get what they
 * had written *out* at all — not to another device, not into the mini app, not
 * into a notes app. Half a bridge is worse than none, because it looks
 * finished.
 *
 * The assertion that matters is the round trip: what the bot writes is what the
 * mini app reads, by construction, because both are `@leela/journal`.
 */

const stored = (plan: number, text: string, at: number): StoredReport => ({
  plan,
  text,
  createdAt: new Date(at),
});

/**
 * The offer, insisted upon.
 *
 * Narrowing at the call site rather than reaching past the union: the first
 * version of these tests wrote `entriesOf(o).length ? o.document : {} as never`,
 * which typechecks nowhere and says nothing.
 */
function fileFrom(existing: StoredReport[] | null, stamp = '2026-07-30') {
  const offered = offer(existing, stamp);
  if (offered.kind !== 'file') throw new Error(`expected a file, got ${offered.kind}`);
  return offered;
}

/** A path of the shape a played game leaves in the store, newest first. */
function history(count: number): StoredReport[] {
  return Array.from({ length: count }, (_, n) =>
    stored(((n * 7) % 72) + 1, `written at ${n}`, 1_700_000_000_000 + n * 60_000),
  ).reverse();
}

describe('what is offered', () => {
  it('is a file when there is something to give', () => {
    const offered = offer(history(3), '2026-07-30');
    expect(offered.kind).toBe('file');
    if (offered.kind === 'file') {
      expect(offered.count).toBe(3);
      expect(offered.name).toBe('leela-path-bot-2026-07-30.json');
    }
  });

  it('is not a file when nothing has been written', () => {
    // Not a failure and not an empty document: an empty file in a chat is a
    // thing a person has to open to find out it is empty.
    expect(offer([], '2026-07-30').kind).toBe('nothing');
  });

  it('says the store keeps nothing, which is a different answer', () => {
    // The distinction `/path` has made since it was written: "you have written
    // nothing" and "this bot does not keep what you write" are not the same
    // sentence, and only one of them is about the player.
    expect(offer(null, '2026-07-30').kind).toBe('not-kept');
  });

  it('has an answer for every store, so a command always replies', () => {
    for (const existing of [null, [], history(1), history(500)]) {
      const offered = offer(existing, '2026-07-30');
      expect(['file', 'nothing', 'not-kept']).toContain(offered.kind);
    }
  });

  it('names the file so two paths can be told apart in one folder', () => {
    // The mini app writes `leela-path-<date>.json`; a player with both wants to
    // know which is which.
    expect(fileNameFor('2026-07-30')).toContain('bot');
    expect(fileNameFor('2026-07-30')).not.toBe('leela-path-2026-07-30.json');
    expect(fileNameFor('2026-07-30')).toMatch(/\.json$/);
  });
});

describe('what the bot writes is what the mini app reads', () => {
  it('round-trips a whole path through the file', () => {
    const kept = history(120);
    const back = parseDocument(serialise(fileFrom(kept).document));

    expect(back).not.toBeNull();
    expect(back).toHaveLength(kept.length);
  });

  it('writes it oldest first, whatever order the store returned', () => {
    // The store hands back newest first. A path is read in the order it was
    // walked, and the file is what somebody reads.
    const entries = fileFrom(history(20)).document.entries;

    for (let i = 1; i < entries.length; i += 1) {
      expect((entries[i]?.at ?? 0) >= (entries[i - 1]?.at ?? 0)).toBe(true);
    }
  });

  it('is recognised as already known when sent straight back', () => {
    // The whole bridge, in one assertion: a path taken out and put back adds
    // nothing. If these two sides ever describe the format differently, this
    // is what fails.
    const kept = history(40);
    const file = serialise(fileFrom(kept).document);

    const outcome = decide(file, file.length, kept.map(asReport));
    expect(outcome.kind).toBe('nothing-new');
  });

  it('is readable by a person who opens it', () => {
    // Indented on purpose: a file in a chat gets opened, and one long line is
    // not a path anyone can read.
    expect(serialise(fileFrom(history(3)).document)).toContain('\n  ');
  });
});
