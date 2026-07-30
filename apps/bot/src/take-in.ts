/**
 * Taking a player's path in from a file.
 *
 * The mini app can save what someone has written; until now the bot could not
 * read it back, so a player who used both surfaces had half a path in each and
 * a whole one in neither. Sharing them properly needs a server and a shared
 * identity — `specs/001-shared-reports`, and a deployment decision. Sending a
 * file needs neither.
 *
 * The parsing and the merge rule are `@leela/journal`, used by both surfaces so
 * they cannot describe the format differently. What is here is the part that is
 * the bot's: deciding what to keep, and saying what happened.
 */

import { newEntries, parseDocument, type Report } from '@leela/journal';
import type { ReportSink, StoredReport } from './store';

/**
 * A stored report as the format describes one.
 *
 * The store keeps a `Date` and the file keeps epoch milliseconds — the same
 * moment, written twice. Converting here rather than in the format keeps the
 * format free of anything a browser and a database disagree about.
 */
export function asReport(stored: StoredReport): Report {
  return { plan: stored.plan, text: stored.text, at: stored.createdAt.getTime() };
}

/** The largest file worth reading. A path is text; anything bigger is not one. */
export const MAX_FILE_BYTES = 1024 * 1024;

export type Outcome =
  | { kind: 'took'; added: Report[] }
  | { kind: 'nothing-new' }
  | { kind: 'unreadable' }
  | { kind: 'too-big'; bytes: number }
  /** The store keeps nothing, so there is nowhere to put it. */
  | { kind: 'not-kept' };

/**
 * Read a file into a player's path.
 *
 * @param existing  What the store already has. Passed in rather than read here
 *                  so the decision can be tested without a database.
 * @returns what happened, in terms the caller can say out loud. Nothing throws:
 *          a file someone sent is not a reason to break their chat.
 */
export function decide(
  text: string,
  bytes: number,
  existing: ReadonlyArray<Report> | null,
): Outcome {
  if (bytes > MAX_FILE_BYTES) return { kind: 'too-big', bytes };
  if (existing === null) return { kind: 'not-kept' };

  const incoming = parseDocument(text);
  if (incoming === null) return { kind: 'unreadable' };

  const added = newEntries(existing, incoming);
  return added.length === 0 ? { kind: 'nothing-new' } : { kind: 'took', added };
}

/**
 * Keep what the file brought.
 *
 * One `record` per report, because that is the whole of `ReportSink` — it was
 * written for the report gate, which files them one at a time. A path of five
 * hundred is five hundred inserts and happens once.
 */
export async function keep(
  sink: ReportSink,
  userId: string,
  added: ReadonlyArray<Report>,
): Promise<void> {
  for (const entry of added) {
    // With the moment it was written. Without it the store stamps the import,
    // so a path taken in loses its dates — and arrives as new the next time it
    // is sent, duplicating everything the player has written.
    await sink.record({ userId, plan: entry.plan, text: entry.text, at: new Date(entry.at) });
  }
}
