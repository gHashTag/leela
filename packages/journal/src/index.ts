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

/**
 * The largest board this format describes.
 *
 * A second count of one board, and it has to be: `@leela/engine` exports this
 * number, and this package has no dependencies on purpose — a browser bundle
 * and a Bun process both hold it, and anything it pulled in would be pulled
 * into both. The copy is the price of that, and the price is paid honestly
 * rather than quietly: `board-size.test.ts` asks the engine what the board is
 * and asks this format what it will accept, so the two cannot drift without a
 * test going red. Tests may depend on the engine; the shipped package may not.
 */
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
  /**
   * What the player was playing for.
   *
   * The one piece of their own writing the file did not carry. A path left the
   * app as a year of answers with the question missing — and the question is
   * the frame every one of those answers was written inside: the reports are
   * the answer accumulating, and an answer without its question is a stack of
   * paragraphs about squares.
   *
   * Optional, and old files simply do not have it. Adding a field rather than
   * bumping `schemaVersion` on purpose: a reader that has never heard of it
   * ignores it and loses nothing it had, which is what a version is for
   * refusing — a *newer* schema may mean something different by a field that
   * already exists, and this changes the meaning of none.
   */
  intention?: string;
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
    // A moment, not merely a number. `Number.isFinite` let through `1.5` and
    // `-1`, which are not times anything wrote, and a file is the least
    // trustworthy thing either surface handles.
    //
    // A date in the future is still accepted, and that is deliberate rather
    // than overlooked: this cannot know what "now" is without being told, a
    // player's clock is genuinely allowed to be wrong, and an entry read as
    // newer than it is sorts oddly, while an entry refused is writing thrown
    // away. Ordering is the smaller harm.
    Number.isInteger(entry.at) &&
    (entry.at as number) >= 0
  );
}

/** The path as something to carry: a document, ready to be serialised. */
export function toDocument(
  entries: ReadonlyArray<Report>,
  intention?: string,
): JournalDocument {
  const asked = (intention ?? '').trim();
  const document: JournalDocument = {
    schemaVersion: SCHEMA_VERSION,
    app: 'leela',
    entries: order(entries),
  };

  // Absent rather than empty: a file that carries `""` says the player was
  // asked and answered nothing, and that is not what happened.
  return asked.length > 0 ? { ...document, intention: asked } : document;
}

/**
 * Read a file back.
 *
 * Returns null rather than throwing, and refuses anything it cannot vouch for:
 * a newer schema, a document from something else, entries no surface could have
 * written. A file is the least trustworthy thing either surface handles — it
 * has been out of the app, through a chat, and possibly through an editor.
 */
export function parseDocument(text: string): JournalDocument | null {
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

  // The whole document rather than its entries. It used to hand back the list
  // alone, which is why the question could not travel with the answers: there
  // was nowhere in the return value to put it.
  const asked = typeof document.intention === 'string' ? document.intention.trim() : '';

  // Bounded on the way in, as the intention below is and for the reason stated
  // there: a file has been out of the app and through an editor. It used to be
  // bounded only where the app *writes* one, so a hand-edited entry of any
  // length went into the store and into every rendering of the path from then
  // on.
  //
  // Clamped rather than refused, which sits against this file's other rule —
  // all of a file or none of it, because half a path is worse than no path.
  // The two are about different things. A plan of 900 is not a square anybody
  // stood on, so a file containing one is not a path; a report of five thousand
  // characters is ordinary writing that is longer than the store will hold.
  // Refusing the whole path over that would throw away a year of somebody's
  // writing to enforce a limit on one entry of it.
  const entries = (document.entries as Report[]).map((entry) =>
    entry.text.length > MAX_REPORT_CHARS
      ? { ...entry, text: entry.text.slice(0, MAX_REPORT_CHARS) }
      : entry,
  );

  return {
    schemaVersion: document.schemaVersion,
    app: 'leela',
    entries,
    ...(asked.length > 0 && asked.length <= MAX_INTENTION_CHARS ? { intention: asked } : {}),
  };
}

/**
 * How long an intention a file may carry.
 *
 * The published app's own bound — `yup.string().min(2).max(800)` in
 * `ChangeIntention` — and the mini app's. A file has been out of the app and
 * through an editor, so the bound is applied on the way in as well as out.
 */
export const MAX_INTENTION_CHARS = 800;

/**
 * The shortest question the game will hold.
 *
 * The published app's other bound — `yup.string().min(2)` in `ChangeIntention`.
 * Two characters is a guard against an empty field rather than a standard: what
 * somebody is playing for is theirs to phrase, and a length is a poor judge of
 * whether they meant it.
 */
export const MIN_INTENTION_CHARS = 2;

/**
 * Whether this is a question the game can hold.
 *
 * One question, one answer. It was three: the mini app's `isIntention`, the
 * bot's `said.length < 2 || said.length > MAX_INTENTION_CHARS` written inline
 * with the two as a literal, and a fourth about to be written for the phone.
 * Each carried a comment saying it was the published app's bound, and each was
 * a separate place for that to stop being true.
 *
 * Here because this package is the one all three can reach: it has no
 * dependencies at all, on purpose, so that a browser bundle, a Bun process and
 * a phone can each hold it.
 */
export function isIntention(text: string): boolean {
  const written = text.trim();
  return written.length >= MIN_INTENTION_CHARS && written.length <= MAX_INTENTION_CHARS;
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
  return merged(existing, incoming).entries;
}

/** A union, and what making it cost. */
export interface Merged {
  /** Everything that fits, oldest first. */
  entries: Report[];
  /** How many of the incoming are in it — not how many were new. */
  added: number;
  /**
   * How many accounts the bound pushed out, oldest first, and they are gone.
   *
   * Zero on every ordinary import. It is not zero for a player near five
   * hundred, which is a player who has been writing for a long time.
   */
  dropped: number;
}

/**
 * The union, bounded, saying what it did.
 *
 * `merge` cuts to `MAX_REPORTS` and says nothing, and both surfaces that call
 * it told the player `newEntries(...).length` — *twelve plans brought back* —
 * while the cut had just thrown twelve of their oldest away. Four hundred and
 * ninety plus fifty is five hundred, and the sentence said fifty.
 *
 * The comment above `takeIn` on the phone says **Nothing is lost** in as many
 * words. It is the same untruth the mini app already caught itself telling
 * about a report a disk had refused, one function along: *saying twelve
 * accounts brought in over a store that took none is the untruth this surface
 * told.*
 *
 * So the count is of what is *there* — an entry that arrived and was then cut
 * was not brought back — and what the bound cost is a number the caller can
 * say out loud rather than one it has to work out by subtracting.
 */
export function merged(
  existing: ReadonlyArray<Report>,
  incoming: ReadonlyArray<Report>,
): Merged {
  const fresh = newEntries(existing, incoming);
  const whole = order([...existing, ...fresh]);
  const entries = whole.slice(-MAX_REPORTS);

  // By key, because the cut takes the oldest and some of those may be the ones
  // that just arrived — a file of old accounts brought into a full path adds
  // nothing at all, and the count has to be able to say so.
  const kept = new Set(entries.map(keyOf));
  const added = fresh.filter((entry) => kept.has(keyOf(entry))).length;

  return { entries, added, dropped: whole.length - entries.length };
}

/**
 * When a writing box starts warning about room.
 *
 * Only near the end: a counter that is always on screen is furniture, and a
 * player counting characters is not reflecting.
 */
export const WARN_WITHIN_CHARS = 200;

/** What a surface should say under a writing box, or null when nothing. */
export interface WriterHint {
  /** A key in `@leela/content`'s catalogue. The words are not this package's. */
  key: 'writer.full' | 'writer.left' | 'writer.pathFull';
  /** The number the sentence needs, where it needs one. */
  count?: number;
}

/**
 * The two bounds on writing, as the thing to say about them.
 *
 * Both were silent everywhere once: `record` cuts a report at
 * `MAX_REPORT_CHARS` and drops the oldest entry past `MAX_REPORTS`, and a
 * thousand words could go without a word about it. The mini app wrote that
 * sentence down and answered it for itself — *a bound nobody is shown is
 * indistinguishable from a bug* — and the phone, which cuts by the same two
 * numbers in the same two ways, still said nothing at all.
 *
 * Here rather than in either, and as a key rather than a sentence: this package
 * knows the bounds and `@leela/content` knows the words. The same split
 * `view.ts` already uses for the line under the mini app's board.
 *
 * @param kept How many accounts the path already holds.
 * @param length How long what is being written is, in characters.
 */
export function writerHint(kept: number, length: number): WriterHint | null {
  const left = MAX_REPORT_CHARS - length;

  // The immediate concern first: running out of room in this box beats a
  // standing fact about the path.
  if (left <= 0) return { key: 'writer.full' };
  if (left <= WARN_WITHIN_CHARS) return { key: 'writer.left', count: left };

  if (kept >= MAX_REPORTS) return { key: 'writer.pathFull' };

  return null;
}

/** A name a file can carry into a chat or a downloads folder. */
export function fileName(stamp: string): string {
  return `leela-path-${stamp}.json`;
}

/**
 * Coming back to a square, which is what the game is about.
 *
 * Leela's teaching is that the same states arrive again: 41 in February and 41
 * again in September, and what was written the first time is the measure of
 * what has changed. Both surfaces keep every one of those returns and neither
 * could show two of them together — the mini app had a path and the bot has
 * `/path`, and both are one flat run of text oldest-first.
 *
 * It lives here for the reason this package exists at all: the mini app worked
 * it out first, and a second surface working it out again is two surfaces
 * describing one thing differently. The bot's rows carry `createdAt` where the
 * file format carries `at`, so what is shared is stated over the least either
 * of them can supply.
 */

/**
 * The path minus the one entry a companion is about to answer.
 *
 * Both surfaces that ask the companion anything built this by hand, and both
 * built it the same wrong way: `entry.plan !== plan || entry.text !== text`,
 * which is not *this entry* but *every entry that says what this one says*.
 *
 * Two of them is the case the game is about. The prompt says so in its own
 * words — *returning is what this game is about: the same state arrives again,
 * and what changed between the tellings is the thing worth noticing* — and when
 * nothing changed between the tellings, when a player came back to plan 41 and
 * wrote the same sentence they wrote the first time, both entries were dropped
 * and the companion was told there had been no return at all. A return told in
 * different words was reported; the same return told in the same words was
 * invisible, which is the loudest signal this record can carry.
 *
 * One occurrence, and the newest of them, because the entry being answered is
 * the one just written. Order-independent: the bot hands its rows newest-first
 * and a file is oldest-first, and neither has to say which.
 *
 * The moment is asked for rather than read, for the reason stated above this
 * whole section: the bot's rows carry `createdAt` where the file format carries
 * `at`, so the rule is written over the least either of them can supply.
 *
 * @param momentOf  When an entry was written, as a number to compare.
 */
export function withoutOne<T extends { plan: number; text: string }>(
  entries: ReadonlyArray<T>,
  one: { plan: number; text: string },
  momentOf: (entry: T) => number = (entry) => Number((entry as { at?: unknown }).at ?? 0),
): T[] {
  let found = -1;

  for (const [index, entry] of entries.entries()) {
    if (entry.plan !== one.plan || entry.text !== one.text) continue;
    if (found === -1 || momentOf(entry) > momentOf(entries[found] as T)) found = index;
  }

  return found === -1 ? [...entries] : entries.filter((_, index) => index !== found);
}

/** One square somebody keeps returning to. */
export interface Revisit {
  plan: number;
  times: number;
}

/**
 * The squares written about more than once, most-returned first.
 *
 * Ties keep board order rather than whatever order the entries arrived in: a
 * list that reorders itself between two identical journals is a list nobody can
 * read twice. Takes only `plan`, so a bot row and a file entry are both it.
 */
export function revisited(entries: ReadonlyArray<{ plan: number }>): Revisit[] {
  const times = new Map<number, number>();
  for (const entry of entries) times.set(entry.plan, (times.get(entry.plan) ?? 0) + 1);

  return [...times.entries()]
    .filter(([, count]) => count > 1)
    .map(([plan, count]) => ({ plan, times: count }))
    .sort((a, b) => b.times - a.times || a.plan - b.plan);
}

/**
 * Everything written about one square, oldest first.
 *
 * The ordering is `order`'s, so a square read on one surface is the same square
 * read on the other.
 */
export function writingsOn(entries: ReadonlyArray<Report>, plan: number): Report[] {
  return order(entries).filter((entry) => entry.plan === plan);
}

/**
 * One square, in words somebody can send to a friend.
 *
 * A path leaves this app as a file — a whole year of it, for coming back to.
 * What people actually pass on is a single square: *this is where I landed and
 * this is what it asked of me*.
 *
 * The intention comes last and only if there is one, because it is the frame
 * and not the news. Nothing else of the player's is included: a share is one
 * square, and a path is a file.
 *
 * It lives here, beside `toDocument`, because it is the other thing this app
 * writes that something has to read back — and a format written on one surface
 * and parsed on another is exactly what this package exists to prevent.
 */
export function squareText(
  plan: number,
  title: string,
  written: string,
  intention: string,
): string {
  const said = written.trim();
  const asked = intention.trim();
  const lines = [`${plan}. ${title}`];

  if (said.length > 0) lines.push('', said);
  if (asked.length > 0) {
    lines.push('', `— ${asked}`);
  } else if (endsLikeAnIntention(said)) {
    // A bare dash, meaning "the question is not here".
    //
    // Without it these two are the same bytes: an account ending in a
    // dash-led closing line, and a shorter account followed by a question.
    // A reader cannot tell them apart, and it used to guess wrong — the last
    // line of somebody's account was lifted out of it and installed as the
    // question the whole game is played to answer.
    //
    // A reader that has never heard of this line leaves it in the body, since
    // it wants a dash *and* something after it. That is a stray character in
    // an account rather than a missing line and a question nobody asked, which
    // is the trade this makes.
    lines.push('', '—');
  }

  return lines.join('\n');
}

/** Whether a body's own last line would be read as the closing question. */
function endsLikeAnIntention(said: string): boolean {
  const lines = said.split('\n');
  const last = (lines[lines.length - 1] ?? '').trim();
  const above = (lines[lines.length - 2] ?? '').trim();

  return INTENTION_LINE.test(last) && lines.length >= 2 && above.length === 0;
}

/** A closing question: a dash, then words. */
const INTENTION_LINE = /^[—–-]\s*\S/;

/**
 * A square taken back out of the words it was shared as.
 *
 * There is no time in it, and none is invented here: a share is written for a
 * person and a date would be furniture in it. What comes back is the square and
 * what was said, and the caller stamps it with the moment it arrived — which is
 * the truth about it, and the only one available.
 *
 * The intention comes back too, and what to do with it is the caller's.
 *
 * It used to be dropped here, on the grounds that a sender's frame is not the
 * reader's to adopt — true of a square a friend sent, and wrong at the one
 * border it also guards: the mini app handing its *own* player's square to the
 * bot. The question was theirs, and it was thrown away because the format could
 * not tell the two routes apart.
 *
 * A format cannot. A route can, and the routes know which they are, so the
 * policy went to them and the parser stopped deciding.
 */
export function parseSquare(
  text: string,
): { plan: number; text: string; intention?: string } | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const first = lines.shift()?.trim() ?? '';

  const heading = /^(\d{1,2})\.\s*\S/.exec(first);
  if (!heading) return null;

  const plan = Number(heading[1]);
  if (!Number.isInteger(plan) || plan < 1 || plan > TOTAL_PLANS) return null;

  // Everything under the heading, minus the closing intention line. The dash is
  // how `squareText` writes it and the only thing marking it: a line beginning
  // with one, last, after the words.
  const body = [...lines];
  while (body.length > 0 && (body[body.length - 1] ?? '').trim().length === 0) body.pop();

  // The blank line above is part of the mark, and so is having a body above
  // that. `squareText` has always written both; without requiring them, a
  // report whose own last line began with a dash had that line taken out of it
  // and adopted as the player's question — and a report that *was* one dash
  // line came back as nothing at all, so the whole account read as unreadable.
  let asked = '';
  const last = (body[body.length - 1] ?? '').trim();
  const above = (body[body.length - 2] ?? '').trim();
  const something = body.slice(0, -2).some((line) => line.trim().length > 0);

  if (body.length >= 2 && above.length === 0 && something) {
    if (INTENTION_LINE.test(last)) {
      asked = last.replace(/^[—–-]\s*/, '').trim().slice(0, MAX_INTENTION_CHARS);
      body.pop();
    } else if (/^[—–-]$/.test(last)) {
      // The bare dash `squareText` writes to say the question is not here.
      body.pop();
    }
  }

  const said = body.join('\n').trim().slice(0, MAX_REPORT_CHARS);
  if (said.length === 0) return null;

  return { plan, text: said, ...(asked.length > 0 ? { intention: asked } : {}) };
}

/**
 * Take one square in, without doubling a path.
 *
 * A file carries the moment each report was written, so `newEntries` can tell
 * one import from a second of the same file. A shared square carries no time at
 * all — it is stamped on arrival — so the same square pasted twice would be two
 * entries an hour apart, and the squares that "came back" would include one
 * nobody returned to. The record the game exists to produce would be saying
 * something that did not happen.
 *
 * So the sameness here is the square and the words, which is what a person
 * pasting twice means by "the same one".
 */
export function takeSquare(
  existing: ReadonlyArray<Report>,
  square: { plan: number; text: string },
  at: number,
): Report[] {
  const said = square.text.trim();
  if (said.length === 0) return [...existing];

  const already = existing.some((entry) => entry.plan === square.plan && entry.text === said);
  if (already) return [...existing];

  return order([...existing, { plan: square.plan, text: said, at }]).slice(-MAX_REPORTS);
}
