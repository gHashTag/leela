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

import { newEntries, parseDocument, parseSquare, takeSquare, type Report } from '@leela/journal';
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
  | {
      kind: 'took';
      added: Report[];
      /**
       * The question the writing was an answer to, when whatever brought it
       * carried one.
       *
       * Handed up rather than acted on here: whether it may be adopted depends
       * on where it came from, and only the route knows that. A square a friend
       * pasted carries their frame; the same square handed over by the player's
       * own mini app carries theirs.
       */
      intention?: string;
    }
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

  // The entries alone. A file may carry the question the player was playing
  // for, and this bot has nowhere to keep one — a chat has no profile — so it
  // takes what it can hold and says nothing about the rest.
  const added = newEntries(existing, incoming.entries);
  if (added.length === 0) return { kind: 'nothing-new' };

  return { kind: 'took', added, ...(incoming.intention ? { intention: incoming.intention } : {}) };
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

/**
 * Read one square, sent as the words it was shared as.
 *
 * A file is a path and this is a square: the thing people actually pass on,
 * *this is where I landed and this is what it asked of me*. The mini app could
 * write one and, until the pass before this, nothing could read one. Both
 * surfaces read it the same way now, because the format is `@leela/journal`'s.
 *
 * The difference from a file is the whole of the care here. A square carries no
 * time, so it is stamped on arrival — and that means the file's sameness rule
 * cannot apply: `newEntries` tells one import from a second by the moment each
 * report was written, and two pastes of one square are an hour apart. A doubled
 * square is worse than untidy: it invents a return to a square nobody returned
 * to, and the returns are what this bot's `/returns` is reading.
 *
 * @param at  The moment it arrived. Passed in so this stays pure.
 */
export function decideSquare(
  text: string,
  existing: ReadonlyArray<Report> | null,
  at: number,
): Outcome {
  if (existing === null) return { kind: 'not-kept' };

  const square = parseSquare(text);
  if (square === null) return { kind: 'unreadable' };

  const after = takeSquare(existing, square, at);
  if (after.length === existing.length) return { kind: 'nothing-new' };

  return {
    kind: 'took',
    added: [{ plan: square.plan, text: square.text.trim(), at }],
    ...(square.intention ? { intention: square.intention } : {}),
  };
}
