/**
 * @leela/journal — the path a player writes, as a file.
 *
 * The reports are the record the game is played to produce, and a player who
 * plays both surfaces writes into two places that cannot see each other: the
 * mini app keeps them in `localStorage`, the bot in SQLite. Sharing them
 * properly needs a server and a shared identity, which is
 * `specs/001-shared-reports` and a deployment decision.
 *
 * A file needs neither. The mini app writes one, the player sends it to the
 * bot, and the bot takes in whatever is new. One-way, manual, and real.
 *
 * This package is the format itself, so the two surfaces cannot disagree about
 * it. No dependencies at all: it is imported by a browser bundle and by a Bun
 * process, and anything it pulled in would be pulled into both.
 */

/** Bumped when the shape changes. A reader that meets a newer one must refuse. */
export const SCHEMA_VERSION = 1;

/** The longest report kept. A bound, because storage is one. */
export const MAX_REPORT_CHARS = 4000;

/** The most reports kept, oldest dropped first. */
export const MAX_REPORTS = 500;

/** The largest board this format describes. Matches the engine's 72. */
const TOTAL_PLANS = 72;

/** One thing a player wrote, on the plan they wrote it about. */
export interface Report {
  plan: number;
  text: string;
  /** Epoch milliseconds. */
  at: number;
}

export interface JournalDocument {
  schemaVersion: number;
  /** What wrote it, for a person opening the file in a year. */
  app: 'leela';
  entries: Report[];
}

export function isReport(value: unknown): value is Report {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;

  return (
    Number.isInteger(entry.plan) &&
    (entry.plan as number) >= 1 &&
    (entry.plan as number) <= TOTAL_PLANS &&
    typeof entry.text === 'string' &&
    entry.text.length > 0 &&
    Number.isFinite(entry.at)
  );
}

/** The path as something to carry: a document, ready to be serialised. */
export function toDocument(entries: ReadonlyArray<Report>): JournalDocument {
  return { schemaVersion: SCHEMA_VERSION, app: 'leela', entries: order(entries) };
}

/**
 * Read a file back.
 *
 * Returns null rather than throwing, and refuses anything it cannot vouch for:
 * a newer schema, a document from something else, entries no surface could have
 * written. A file is the least trustworthy thing either surface handles — it
 * has been out of the app, through a chat, and possibly through an editor.
 */
export function parseDocument(text: string): Report[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const document = parsed as Record<string, unknown>;

  if (document.app !== 'leela') return null;
  // Older is readable, newer is not: a version this build has never seen may
  // mean something different by the same field.
  if (typeof document.schemaVersion !== 'number') return null;
  if (document.schemaVersion > SCHEMA_VERSION) return null;

  if (!Array.isArray(document.entries)) return null;
  if (!document.entries.every(isReport)) return null;

  return document.entries as Report[];
}

/** Two reports are the same when the same words were written at the same moment. */
export function keyOf(entry: Report): string {
  return `${entry.at} ${entry.plan} ${entry.text}`;
}

/** Oldest first, which is the order a path is read in. */
export function order(entries: ReadonlyArray<Report>): Report[] {
  return [...entries].sort((a, b) => a.at - b.at || a.plan - b.plan);
}

/**
 * What is in the file and not already here.
 *
 * The whole of the merge rule, and the reason it is one function used by both
 * surfaces: taking a path in must never delete what is already there, and
 * taking the same file in twice must add nothing the second time. People do
 * import the same file twice, and a path that doubles is a path nobody trusts.
 */
export function newEntries(
  existing: ReadonlyArray<Report>,
  incoming: ReadonlyArray<Report>,
): Report[] {
  const seen = new Set(existing.map(keyOf));
  const added: Report[] = [];

  for (const entry of incoming) {
    const key = keyOf(entry);
    // Against what has been taken as well as what was here: a file may repeat
    // itself.
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(entry);
  }

  return order(added);
}

/** Everything, oldest first, bounded — the union of a path and a file. */
export function merge(
  existing: ReadonlyArray<Report>,
  incoming: ReadonlyArray<Report>,
): Report[] {
  return order([...existing, ...newEntries(existing, incoming)]).slice(-MAX_REPORTS);
}

/** A name a file can carry into a chat or a downloads folder. */
export function fileName(stamp: string): string {
  return `leela-path-${stamp}.json`;
}
