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
  merge as mergeEntries,
  parseDocument,
  toDocument as toJournalDocument,
  type Report,
} from '@leela/journal';
import { path, type Journal } from './reports';

export { fileName, parseDocument, SCHEMA_VERSION } from '@leela/journal';
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

/** The path as something to bring back. */
export function toDocument(journal: Journal) {
  return toJournalDocument(journal.entries);
}

/**
 * Take in a file without losing anything.
 *
 * `reported` is the current journal's and is never taken from the file. A
 * report about some other plan, written on some other device, is not a reason
 * to open this player's gate.
 */
export function merge(journal: Journal, incoming: ReadonlyArray<Report>): Journal {
  return {
    reported: journal.reported,
    entries: mergeEntries(journal.entries, incoming).slice(-MAX_REPORTS),
  };
}

/**
 * One square, in words somebody can send to a friend.
 *
 * The path leaves this app as a file — the whole year of it, for coming back
 * to. What people actually pass on is a single square: *this is where I landed
 * and this is what it asked of me*. `Lila Game`, the freshest of the competing
 * apps (updated May 2026), leads its listing with sharing results; this one
 * could export everything and share nothing.
 *
 * The intention comes last and only if there is one, because it is the frame
 * and not the news. Nothing else of the player's is included: a share is one
 * square, and a path is a file.
 */
export function shareTextFor(
  plan: number,
  title: string,
  written: string,
  intention: string,
): string {
  const said = written.trim();
  const lines = [`${plan}. ${title}`];

  if (said.length > 0) lines.push('', said);
  if (intention.trim().length > 0) lines.push('', `— ${intention.trim()}`);

  return lines.join('\n');
}
