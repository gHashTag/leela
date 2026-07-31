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

import { MAX_REPORTS, MAX_REPORT_CHARS, isReport, order, type Report } from '@leela/journal';

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
 */
export function record(journal: Journal, plan: number, text: string, at: number): Journal {
  const written = text.trim().slice(0, MAX_REPORT_CHARS);
  if (written.length === 0) return journal;

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
): Taken {
  const after = record(journal, plan, draft, at);
  if (after === journal) {
    return { journal, written: false, kept: false, gateOpens: false };
  }

  return { journal: after, written: true, kept: save(store, after), gateOpens: true };
}

/** Everything written about one square, oldest first. */
export function writingsOn(journal: Journal, plan: number): Report[] {
  return journal.entries.filter((entry) => entry.plan === plan);
}
