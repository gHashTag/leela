/**
 * The reports, which are what the game is played to produce.
 *
 * This is the rule the deployed contract enforces —
 * `require(..., 'You must create a report before rolling the dice.')` — and the
 * one the published app carried as `isReported` on every player. The bot has
 * had it since it was written. The mini app has been letting people throw
 * forever without ever stopping to say what a plan brought up, which is the
 * game with its point removed.
 *
 * Kept under its own storage key rather than added to the saved game, so a game
 * already in progress is not thrown away by an upgrade: `isSavedGame` demands a
 * state the engine could have produced, and a state with a field it has never
 * heard of is not one.
 *
 * What is *not* here, and cannot be without a server: anyone else's reports.
 * The published app posted them to a Firebase collection with comments, likes
 * and moderation. On a static site a report is yours and stays on your phone.
 * The bot is where reports are shared, because the bot has a database.
 */

import { owesReport, type GameState } from '@leela/engine';
import type { GameStorage } from './state';

export const REPORTS_KEY = 'leela.reports.v1';

/** One thing a player wrote, on the plan they wrote it about. */
export interface Report {
  plan: number;
  text: string;
  /** Epoch milliseconds. Passed in rather than read from a clock here. */
  at: number;
}

export interface Journal {
  /**
   * Whether the plan the player is standing on has been written about.
   *
   * A boolean, as `isReported` was: a report is owed per arrival, not per
   * square, so landing on a plan a second time owes a second report.
   */
  reported: boolean;
  entries: Report[];
}

export const EMPTY: Journal = { reported: true, entries: [] };

/** The longest report kept. Enough for a page; a bound, because storage is one. */
export const MAX_REPORT_CHARS = 4000;

/** The most reports kept, oldest dropped first. */
export const MAX_REPORTS = 500;

function isReport(value: unknown): value is Report {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    Number.isInteger(entry.plan) &&
    (entry.plan as number) >= 1 &&
    (entry.plan as number) <= 72 &&
    typeof entry.text === 'string' &&
    entry.text.length > 0 &&
    Number.isFinite(entry.at)
  );
}

/**
 * Whether this could have been written by this app.
 *
 * The same rule the saved game is held to. A journal that cannot be read is
 * replaced rather than trusted — losing what someone wrote is bad, and handing
 * the game a report about plan 900 is worse.
 */
export function isJournal(value: unknown): value is Journal {
  if (typeof value !== 'object' || value === null) return false;
  const journal = value as Record<string, unknown>;
  return (
    typeof journal.reported === 'boolean' &&
    Array.isArray(journal.entries) &&
    journal.entries.every(isReport)
  );
}

export function loadJournal(storage: GameStorage | undefined): Journal {
  try {
    const raw = storage?.getItem(REPORTS_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return isJournal(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveJournal(storage: GameStorage | undefined, journal: Journal): void {
  try {
    storage?.setItem(REPORTS_KEY, JSON.stringify(journal));
  } catch {
    // Storage disabled: the game still plays, and still asks for a report. It
    // simply forgets them, which is the same bargain the board already makes.
  }
}

/**
 * Whether a throw is refused.
 *
 * `owesReport` is the engine's — the plan changed and the player is on the
 * board — and the journal says whether that arrival has been written about.
 * Both, because a player who has not entered the game owes nothing.
 *
 * One function rather than a pair: a `mayRoll` that only ever returned
 * `!needsReport` was two names for one idea, and the second had no caller.
 */
export function needsReport(state: GameState, journal: Journal): boolean {
  return owesReport(state) && !journal.reported;
}

/** A new arrival: whatever was written about the last plan is not about this one. */
export function arrived(journal: Journal): Journal {
  return { ...journal, reported: false };
}

/**
 * File a report on the plan the player is standing on.
 *
 * Empty text is not a report and does not open the gate: the rule is that
 * something was written, and a blank line is the rule with its point removed.
 * Returns the journal unchanged in that case, so the caller cannot accidentally
 * mark a plan reported by asking twice.
 */
export function record(journal: Journal, plan: number, text: string, at: number): Journal {
  const trimmed = text.trim().slice(0, MAX_REPORT_CHARS);
  if (trimmed.length === 0) return journal;

  const entries = [...journal.entries, { plan, text: trimmed, at }];
  return {
    reported: true,
    // Oldest first, so the tail that is dropped is the oldest.
    entries: entries.slice(-MAX_REPORTS),
  };
}

/** What the player has written, oldest first — their path through the board. */
export function path(journal: Journal): Report[] {
  return [...journal.entries].sort((a, b) => a.at - b.at || a.plan - b.plan);
}
