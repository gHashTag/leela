/**
 * Getting what you wrote off the device.
 *
 * The reports are the record the game is played to produce, and they lived in
 * one browser's `localStorage` with no way out: clear the site data, change
 * phone, and a year of writing is gone. The published app kept them in Firebase
 * and the bot keeps them in SQLite; the mini app has a file.
 *
 * The format itself is `@leela/journal`, because the bot reads these files too
 * and two surfaces that describe a format separately describe it differently.
 * What is left here is the part that is the mini app's own: turning a path into
 * something to *read*, and merging a file into this app's journal shape.
 */

import {
  MAX_REPORTS,
  merged,
  parseDocument,
  toDocument as toJournalDocument,
  type Report,
} from '@leela/journal';
import { path, type Journal } from './reports';

export {
  fileName,
  parseDocument,
  parseSquare,
  SCHEMA_VERSION,
  squareText as shareTextFor,
  takeSquare,
} from '@leela/journal';
export type { JournalDocument, Report } from '@leela/journal';

/** Look up a plan's title. Injected so this stays free of the content loader. */
export type TitleOf = (plan: number) => string;

/**
 * The path as something to read.
 *
 * Plain text rather than markdown: this is going into a notes app, a message,
 * or a printer, and a heading that reads `## 41.` in all of them is worse than
 * a blank line.
 */
export function toText(journal: Journal, titleOf: TitleOf): string {
  const written = path(journal);
  if (written.length === 0) return '';

  return written
    .map((entry) => `${entry.plan}. ${titleOf(entry.plan)}\n\n${entry.text}`)
    .join('\n\n---\n\n');
}

/** The path as something to bring back, with the question it was written for. */
export function toDocument(journal: Journal, intention?: string) {
  return toJournalDocument(journal.entries, intention);
}

/**
 * Take in a file without losing anything.
 *
 * `reported` is the current journal's and is never taken from the file. A
 * report about some other plan, written on some other device, is not a reason
 * to open this player's gate.
 */
export function merge(journal: Journal, incoming: ReadonlyArray<Report>): Journal {
  return taking(journal, incoming).journal;
}

/** A journal, and what taking a file into it cost. */
export interface Taking {
  journal: Journal;
  /** How many of the file's accounts are in it now. */
  added: number;
  /** How many of the oldest the bound pushed out. They are gone. */
  dropped: number;
}

/**
 * Take a file in, and be able to say what happened.
 *
 * The screen worked its count out as `entries.length - before`, which is the
 * growth of the path and not the number of accounts it took. At the bound the
 * path does not grow at all — every arrival costs one of the oldest — so a
 * player near five hundred was told *nothing new in that file* about a file
 * whose accounts had all landed, and the ones they lost were never mentioned.
 *
 * The phone had the other half of the same hole: it said `newEntries(...)`,
 * which counts what was new rather than what is there. One question, asked in
 * `@leela/journal` now, so neither surface answers it for itself again.
 */
export function taking(journal: Journal, incoming: ReadonlyArray<Report>): Taking {
  const union = merged(journal.entries, incoming);

  return {
    journal: { reported: journal.reported, entries: union.entries },
    added: union.added,
    dropped: union.dropped,
  };
}
