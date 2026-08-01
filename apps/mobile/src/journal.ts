/**
 * What the player writes, on a phone.
 *
 * The app shipped without this and had a button saying **Write a report** that
 * wrote nothing. It called `submitReport`, which opens the gate, and kept no
 * account at all — so the one thing the game exists to produce was the one
 * thing the surface did not do, under a label promising it did.
 *
 * That is the gate's whole purpose read backwards. A player reflects before
 * they move; a button that clears the requirement without taking the reflection
 * removes the reflection and keeps the ceremony.
 *
 * The format is `@leela/journal`, the same one the bot writes to a file and the
 * mini app keeps in a browser, so a path written here is a path either of them
 * can read. The bounds are that package's too — `MAX_REPORT_CHARS`,
 * `MAX_REPORTS` — because a bound declared twice is a bound that will disagree.
 */

import { CLASSIC, countsAsReport, type RuleSet } from '@leela/engine';
import {
  MAX_REPORTS,
  MAX_REPORT_CHARS,
  fileName,
  isIntention,
  isReport,
  newEntries,
  order,
  parseDocument,
  parseSquare,
  squareText,
  takeSquare as takeSquareInto,
  toDocument,
  type Report,
} from '@leela/journal';

export { isIntention };

/**
 * Somewhere to keep it.
 *
 * The same two methods the mini app asks of a browser, so that one contract
 * covers both and neither surface invents its own idea of storage. A phone has
 * no `localStorage`; what implements this on a device is a decision the app
 * makes at its edge, and every test here hands in one of its own.
 */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const REPORTS_KEY = 'leela.reports.v1';

/** A path, as it is held while the app runs. */
export interface Journal {
  entries: Report[];
}

export const EMPTY: Journal = { entries: [] };

/**
 * Add one account to a path.
 *
 * Blank is not an account: a gate cleared by an empty string is the same defect
 * as a gate cleared by a button, one keystroke further along.
 *
 * **How much is enough is the variant's question, not this file's.** It used to
 * be `length === 0` written here, which is `classic`'s answer spelled out by
 * hand — and the published app refuses fewer than a hundred characters
 * (`yup.string().trim().min(100)` in `CreatePost`), which `legacy-mobile` and
 * `online` carry as `minReportChars`. Three surfaces asked this and only the
 * bot asked the engine; the other two each wrote the same literal twice, and a
 * rule outside `@leela/engine` has already drifted or will.
 */
export function record(
  journal: Journal,
  plan: number,
  text: string,
  at: number,
  rules: RuleSet = CLASSIC,
): Journal {
  if (!countsAsReport(text, rules)) return journal;

  const written = text.trim().slice(0, MAX_REPORT_CHARS);

  return { entries: order([...journal.entries, { plan, text: written, at }]).slice(-MAX_REPORTS) };
}

/**
 * Keep it, and say whether it was kept.
 *
 * The contract every writer in this repository answers, and it took the mini
 * app four passes to get all seven of its own to answer the same question. A
 * refusal and an absence are different reasons and the same outcome — the words
 * are not there next time — so they get the same answer, and the caller decides
 * what to say about it.
 */
export function save(store: Store | undefined, journal: Journal): boolean {
  if (!store) return false;

  try {
    store.setItem(REPORTS_KEY, JSON.stringify(journal));
    return true;
  } catch {
    return false;
  }
}

/** Read one back, or start with nothing. A store that throws has nothing. */
export function load(store: Store | undefined): Journal {
  try {
    const raw = store?.getItem(REPORTS_KEY);
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;

    const entries = (parsed as { entries?: unknown }).entries;
    if (!Array.isArray(entries)) return EMPTY;

    // The format's own question, not a second copy of it written here. The
    // first draft of this file had one, and it let `plan: 900` through — a
    // square nobody has stood on, in a repository that keeps an audit for
    // exactly this shape.
    return { entries: order(entries.filter(isReport)) };
  } catch {
    return EMPTY;
  }
}

/**
 * Take an account, keep it, and say what follows.
 *
 * A decision rather than a handler, because the handler was where the defect
 * lived: the screen cleared the gate and kept nothing, and no test of this
 * module could see it — a component is not a function anybody can ask.
 *
 * `gateOpens` is the answer to *has this square been written about*, and it is
 * false for a blank draft. The keeping is a separate answer: a device that will
 * not hold the words is not the player's doing, so the gate they earned opens
 * either way and they are told which happened.
 */
export interface Taken {
  journal: Journal;
  /** Whether there was anything to take. */
  written: boolean;
  /**
   * Why nothing was taken, when nothing was.
   *
   * Two refusals, because they are two different things to be told: *nothing
   * was written* and *not enough was*. One boolean would leave a player who
   * typed ninety characters under `legacy-mobile` staring at a control that
   * refuses without saying what it wants — which is the app ending somebody's
   * turn without telling them, the shape this surface has now been caught by
   * three times.
   */
  refusal: 'empty' | 'too-short' | null;
  /** Whether the store held it. False when it refused, and when there is none. */
  kept: boolean;
  /** Whether the throw may now happen. */
  gateOpens: boolean;
}

export function takeAccount(
  journal: Journal,
  plan: number,
  draft: string,
  at: number,
  store: Store | undefined,
  rules: RuleSet = CLASSIC,
): Taken {
  const after = record(journal, plan, draft, at, rules);
  if (after === journal) {
    return {
      journal,
      written: false,
      kept: false,
      gateOpens: false,
      refusal: draft.trim().length === 0 ? 'empty' : 'too-short',
    };
  }

  return { journal: after, written: true, kept: save(store, after), gateOpens: true, refusal: null };
}

/** Everything written about one square, oldest first. */
export function writingsOn(journal: Journal, plan: number): Report[] {
  return journal.entries.filter((entry) => entry.plan === plan);
}

/**
 * Somewhere that survives the app closing.
 *
 * A phone's real store is asynchronous — `AsyncStorage` is what the published
 * app used, and every alternative on a device is a promise too — so it is a
 * second interface rather than a stricter version of `Store`. The synchronous
 * one above is the session's own copy, which is what the screen draws from; a
 * keeper is where that copy goes so it is still there tomorrow.
 *
 * Two methods, and `write` answers rather than throwing, for the reason every
 * writer in this repository answers: a caller that cannot ask whether the words
 * landed will say they did.
 */
export interface Keeper {
  read(): Promise<string | null>;
  write(value: string): Promise<boolean>;
}

/**
 * How long a device may take to keep a path.
 *
 * `Keeper` is an injection point, and nothing in its type says it ever returns.
 * A promise with no clock is the failure a `catch` cannot see — `@leela/ai`
 * met it with a model that never answered, and `apps/bot` with a download that
 * never arrived — and here it would be worse than either: the write happens
 * while a player is looking at their own words, and a screen that waits forever
 * for a disk is a screen that has eaten them.
 */
export const KEEP_TIMEOUT_MS = 5_000;

/** Whatever it is, settled within `ms`. */
async function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the path back at startup.
 *
 * Anything a keeper cannot give is an empty path rather than a crash: a device
 * store has been on a disk between two runs of the app, and half a write is
 * what a process killed mid-save leaves behind.
 */
export async function loadKept(
  keeper: Keeper | undefined,
  timeoutMs = KEEP_TIMEOUT_MS,
): Promise<Journal> {
  if (!keeper) return EMPTY;

  try {
    const raw = await within(keeper.read(), timeoutMs, null);
    if (raw === null) return EMPTY;

    return load({ getItem: () => raw, setItem: () => undefined });
  } catch {
    return EMPTY;
  }
}

/**
 * The question, kept on the device rather than for the session.
 *
 * `loadIntention` and `saveIntention` were right and were handed the wrong
 * store: `forTheSession()` is a `Map` made fresh at every launch, so what the
 * player is playing for was asked again every single time. The journal went to
 * the device and survived; the question that frames it did not.
 *
 * Invisible to a unit test, which passes whatever store it likes and gets the
 * right answer. Found by relaunching the app and being asked the question
 * again, with a year of answers to it sitting underneath.
 */
export async function keepIntention(
  keeper: Keeper | undefined,
  text: string,
  timeoutMs = KEEP_TIMEOUT_MS,
): Promise<boolean> {
  if (!keeper) return false;

  try {
    return await within(keeper.write(text), timeoutMs, false);
  } catch {
    return false;
  }
}

/** What they were playing for, from the last time, or nothing. */
export async function loadKeptIntention(
  keeper: Keeper | undefined,
  timeoutMs = KEEP_TIMEOUT_MS,
): Promise<string> {
  if (!keeper) return '';

  try {
    const raw = await within(keeper.read(), timeoutMs, null);
    // The same bound the format states, applied on the way in: a device holds
    // whatever was written to it, including by a version of this app that
    // asked for less.
    return raw !== null && isIntention(raw) ? raw.trim() : '';
  } catch {
    return '';
  }
}

/** Keep the path, and say whether it was kept. */
export async function keep(
  keeper: Keeper | undefined,
  journal: Journal,
  timeoutMs = KEEP_TIMEOUT_MS,
): Promise<boolean> {
  if (!keeper) return false;

  try {
    return await within(keeper.write(JSON.stringify(journal)), timeoutMs, false);
  } catch {
    return false;
  }
}

export const INTENTION_KEY = 'leela.intention.v1';

/**
 * What the player is playing for.
 *
 * Not a profile field. It is the question the game is being played to answer,
 * and every account is written inside it — which is why a path exported without
 * it left the app as a year of answers with the question missing, and why the
 * companion is handed it before anything else.
 *
 * Kept apart from the path so that neither can make the other unreadable: the
 * mini app learned that when a half-written game file took the writing down
 * with it.
 */
export function loadIntention(store: Store | undefined): string {
  try {
    return store?.getItem(INTENTION_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

/**
 * Keep it, and say whether it was kept.
 *
 * Storage, and only storage. Whether the words are a question worth holding is
 * `isIntention`, which the format answers for every surface — the mini app's
 * writer conflated the two for four passes, so a browser that refused the write
 * told the player their sentence was too short.
 */
export function saveIntention(store: Store | undefined, text: string): boolean {
  if (!store) return false;

  try {
    store.setItem(INTENTION_KEY, text.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * The path as something to carry away.
 *
 * A path that cannot leave the device is a path locked in one. The bot reads
 * this format from a file, the mini app writes one, and the phone wrote a path
 * with no way out at all — so a player who had answered on their phone could
 * not bring it to a table, and the record the game exists to produce lived
 * exactly one reinstall.
 *
 * **The question goes with it.** `toDocument` takes an intention and this
 * passes it: a file without one is a year of answers with the question missing,
 * which is what the mini app's export was until it was given the same argument.
 * Absent rather than empty when there is none, because `""` says the player was
 * asked and answered nothing.
 */
export function toShare(journal: Journal, intention: string) {
  return toDocument(journal.entries, intention);
}

/** What to call it, from the format rather than beside it. */
export function shareName(stamp: string): string {
  return fileName(stamp);
}

/** What came of taking a path in. */
export interface TakenIn {
  journal: Journal;
  /** How many accounts were added. Zero when the file held nothing new. */
  added: number;
  /** The question the file carried, when this player has none of their own. */
  intention: string | null;
  /** False when the text was not a path this format can read. */
  readable: boolean;
}

/**
 * Take a path in without losing anything.
 *
 * The phone could hand a path out and not take one back, so a player who began
 * in the mini app or at a table could not carry it here — the format exists so
 * that a path is one thing across three surfaces, and a one-way door makes it
 * two.
 *
 * Three decisions, and none of them is new. They are the ones the mini app was
 * taught by its own defects, and this asks the same questions of the same
 * format rather than answering them again:
 *
 * - **Nothing is lost.** `newEntries` adds what is not already here, keyed by
 *   the square and the moment, so the same file arriving twice adds nothing the
 *   second time.
 * - **A file does not open the gate.** Whether *this* player owes an account
 *   for the square they are standing on is the engine's business and this
 *   game's; a report written elsewhere, about another square, is not a reason
 *   to let them throw.
 * - **The question is taken only where there is none.** What somebody is
 *   playing for is theirs, and a file's is not allowed to replace it.
 */
export function takeIn(journal: Journal, text: string, intention: string): TakenIn {
  const incoming = parseDocument(text);
  if (incoming === null) {
    return { journal, added: 0, intention: null, readable: false };
  }

  const added = newEntries(journal.entries, incoming.entries);
  const asked = (incoming.intention ?? '').trim();

  return {
    journal: { entries: order([...journal.entries, ...added]).slice(-MAX_REPORTS) },
    added: added.length,
    intention: intention.trim() === '' && asked !== '' ? asked : null,
    readable: true,
  };
}

/** One square, written the way a person reads it. */
export function shareSquare(plan: number, title: string, text: string, intention: string): string {
  return squareText(plan, title, text, intention);
}

/** What came of taking one square in. */
export interface SquareTaken {
  journal: Journal;
  /** True when the words were a square this format can read. */
  readable: boolean;
  /** False when the same square and the same words are already here. */
  added: boolean;
  /**
   * The square it was about — the sender's, not the reader's.
   *
   * Named because the sentence that follows names it, and the two are not the
   * same square: somebody standing on 6 can be sent 41. Saying "taken in on 6"
   * would be this surface reporting where the reader is instead of what
   * arrived, which is the shape this repository has now met five times.
   */
  plan: number | null;
}

/**
 * Take one square somebody sent.
 *
 * This is what people actually pass on. A whole path is a file and an
 * occasion; a square is a message — *this is where I am and this is what it
 * asked of me* — and the bot has had `/take` for it since the day it could
 * read one.
 *
 * **The frame is not adopted.** A shared square carries the sender's question
 * and this declines it, exactly as `/take` does: reading somebody's frame is
 * not taking it on, and what a player is playing for is not a thing a message
 * can set. The mini app's hand-over is the one route that may, because Telegram
 * delivers it from the player's *own* app — and this is not that route.
 *
 * **And it is stamped on arrival.** A shared square carries no time; inventing
 * one would put it at a place in the path where nothing happened, and `revisited`
 * would then say a player returned to a square they had not.
 */
export function takeSquare(journal: Journal, text: string, at: number): SquareTaken {
  const square = parseSquare(text);
  if (square === null) return { journal, readable: false, added: false, plan: null };

  const entries = takeSquareInto(journal.entries, square, at);
  return {
    journal: { entries },
    readable: true,
    added: entries.length > journal.entries.length,
    plan: square.plan,
  };
}

/**
 * An account being written, and what it is being written about.
 *
 * It used to be a bare string in the screen, tied to nothing — and a bare
 * string outlives the square it describes. Winning ends a game on 68 while
 * still owing an account of it, so the writing box and *Start over* are on
 * screen at the same moment; tapping the second with the box full carried the
 * words about Cosmic Consciousness into the next game, where they surfaced as
 * the opening of an account of whatever square the player first landed on. One
 * tap of Save filed them there, permanently, in the record this game exists to
 * produce.
 *
 * The mini app learned the same thing twice and answered it the same way: a
 * draft carries whose it is (`draftKeyFor`), and `resize` clears the drafts of
 * seats that are new. What is written here is written about **one square of one
 * game**, and it is shown only there.
 *
 * The seed is the game. It is already what a game is identified by — `throwDie`
 * says a game replays from `(seed, rollsTaken)` — and `startOver` will not hand
 * back the seed it was just given, so a draft can never survive into the game
 * that replaced it.
 */
export interface Draft {
  /** The game, by the seed its die was made from. */
  seed: number;
  /** The square it is about. */
  plan: number;
  text: string;
}

/**
 * Where the unfinished sentence waits between two runs of the app.
 *
 * The one thing the game asks a player to produce was the one thing this app
 * did not keep. The path is on the device, the board is on the device, what
 * they are playing for is on the device — and the account being written lived
 * in a `useState` and nowhere else, so an iPhone reclaiming a backgrounded app
 * took it, and the gate that will not open without it was still shut.
 *
 * The mini app lost the same words the same way and says so in `state.ts`. Its
 * fix is this one; the difference is that a browser discards a tab and a phone
 * discards an app, which it does far more readily. The published app loses it
 * too: `CreatePost` holds the text in `react-hook-form` and clears it with
 * `methods.reset()`, under a rule of `yup.string().trim().min(100)` — at least
 * a paragraph, held nowhere.
 */
export const DRAFT_KEY = 'leela.draft.v1';

/** Nothing being written, which is what a screen opens with. */
export const NOTHING_WRITTEN: Draft = { seed: 0, plan: 0, text: '' };

/** What belongs in the box on this square of this game — nothing, unless it is this draft's. */
export function draftFor(draft: Draft, seed: number, plan: number | null): string {
  return plan !== null && draft.seed === seed && draft.plan === plan ? draft.text : '';
}

/** What is now being written here. */
export function draftOn(seed: number, plan: number, text: string): Draft {
  return { seed, plan, text };
}

/**
 * Keep what is being written, and say whether it landed.
 *
 * Written on every keystroke, deliberately. A timer or a debounce would keep
 * the sentence *except* for the words typed in the last second or two — which
 * is exactly the window an app is killed in, since the moment before a player
 * switches away is the moment they stop typing. One key, last write wins, and
 * the store settles them in order.
 *
 * The answer is returned rather than swallowed, so a caller *can* say a device
 * refused it. The screen does not say it on every character: a warning that
 * appears mid-sentence and disappears on the next one is noise, and the moment
 * a player needs to be told is when they file. `takeAccount` tells them there.
 */
export async function keepDraft(
  keeper: Keeper | undefined,
  draft: Draft,
  timeoutMs = KEEP_TIMEOUT_MS,
): Promise<boolean> {
  if (!keeper) return false;

  try {
    const held = draft.text.trim().length === 0 ? '' : JSON.stringify(draft);
    return await within(keeper.write(held), timeoutMs, false);
  } catch {
    return false;
  }
}

/**
 * What was being written last time, or nothing.
 *
 * Nothing rather than a half-restored one, the choice `loadKept` and
 * `loadKeptGame` both make: a device store has been on a disk between two runs
 * and half a write is what a process killed mid-save leaves behind. Anything
 * that is not a whole draft is no draft.
 *
 * It does not have to ask whether the draft is still the right one. `draftFor`
 * answers that on every render — a draft is shown only on the square of the
 * game it was written in — so a draft belonging to a game that no longer exists
 * comes back and is never seen, which is what it should do.
 */
export async function loadKeptDraft(
  keeper: Keeper | undefined,
  timeoutMs = KEEP_TIMEOUT_MS,
): Promise<Draft> {
  if (!keeper) return NOTHING_WRITTEN;

  try {
    const raw = await within(keeper.read(), timeoutMs, null);
    if (!raw) return NOTHING_WRITTEN;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return NOTHING_WRITTEN;

    const { seed, plan, text } = parsed as Partial<Draft>;
    if (typeof seed !== 'number' || !Number.isFinite(seed)) return NOTHING_WRITTEN;
    if (typeof plan !== 'number' || !Number.isInteger(plan)) return NOTHING_WRITTEN;
    if (typeof text !== 'string' || text.trim().length === 0) return NOTHING_WRITTEN;

    // The bound is the format's, applied on the way in as well as on the way
    // out: a store can hold anything, and `record` would cut it anyway.
    return { seed, plan, text: text.slice(0, MAX_REPORT_CHARS) };
  } catch {
    return NOTHING_WRITTEN;
  }
}
