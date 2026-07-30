/**
 * Giving a player their path back as a file.
 *
 * Last pass the bridge went one way: the mini app saved a file and the bot took
 * it in. So a player who plays mostly in a chat could not get what they had
 * written out at all — not to another device, not into the mini app, not into a
 * notes app. Half a bridge is a worse thing to have built than none, because it
 * looks finished.
 *
 * `@leela/journal` is the format on both sides, so what this writes is what the
 * mini app already reads. The decision of *what* to offer is here and pure; the
 * sending is the transport's.
 */

import { toDocument, type JournalDocument } from '@leela/journal';
import { asReport } from './take-in';
import type { StoredReport } from './store';

export type Offer =
  | { kind: 'file'; document: JournalDocument; name: string; count: number }
  /** Nothing has been written, which is not a failure and not a file. */
  | { kind: 'nothing' }
  /** The store keeps nothing, so there is nothing to hand back. */
  | { kind: 'not-kept' };

/**
 * What to give back.
 *
 * @param existing  What the store has, or null when it keeps nothing. The two
 *                  are different answers: "you have written nothing" and "this
 *                  bot does not keep what you write" — the same distinction
 *                  `/path` has made since it was written.
 * @param stamp     A date for the file name, passed in rather than read from a
 *                  clock so the name is a decision and not a surprise.
 */
export function offer(existing: ReadonlyArray<StoredReport> | null, stamp: string): Offer {
  if (existing === null) return { kind: 'not-kept' };
  if (existing.length === 0) return { kind: 'nothing' };

  const document = toDocument(existing.map(asReport));

  return {
    kind: 'file',
    document,
    name: fileNameFor(stamp),
    count: document.entries.length,
  };
}

/**
 * The name the file carries into a chat.
 *
 * `@leela/journal` names the mini app's; this one says where it came from, so a
 * player with both in a downloads folder can tell them apart.
 */
export function fileNameFor(stamp: string): string {
  return `leela-path-bot-${stamp}.json`;
}

/** The bytes to send. Indented, because a person may well open it. */
export function serialise(document: JournalDocument): string {
  return JSON.stringify(document, null, 2);
}
