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

import { CLASSIC, owesReport, type GameState } from '@leela/engine';
import { messageFor, type Language } from '@leela/content';
import {
  revisited as revisitedEntries,
  writingsOn as writingsOnEntries,
  type Revisit,
} from '@leela/journal';
import type { GameStorage } from './state';

export type { Revisit } from '@leela/journal';

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

/**
 * Where each player's writing lives, once there is more than one player.
 *
 * The published app keeps `histories[]` per seat offline, and it has to: two
 * people playing from one phone are two paths, and merging them would make the
 * record the game exists to produce meaningless.
 *
 * The first seat keeps the original key. Weeks of games were played before
 * there were seats, and moving that writing to a new name to add a feature
 * would be a feature that costs somebody their path.
 */
export function journalKeyFor(playerId: string): string {
  return playerId === 'p1' ? REPORTS_KEY : `${REPORTS_KEY}.${playerId}`;
}

export function loadJournalFor(storage: GameStorage | undefined, playerId: string): Journal {
  return loadJournal(storage, journalKeyFor(playerId));
}

export function saveJournalFor(
  storage: GameStorage | undefined,
  playerId: string,
  journal: Journal,
): void {
  saveJournal(storage, journal, journalKeyFor(playerId));
}

export function loadJournal(storage: GameStorage | undefined, key = REPORTS_KEY): Journal {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return isJournal(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveJournal(
  storage: GameStorage | undefined,
  journal: Journal,
  key = REPORTS_KEY,
): void {
  try {
    storage?.setItem(key, JSON.stringify(journal));
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
  // `CLASSIC` named rather than defaulted: the mini app plays the traditional
  // rules, where every arrival is an arrival — including a six. The published
  // app's variants say otherwise, and a default is a poor place to learn that.
  return owesReport(state, CLASSIC) && !journal.reported;
}

/**
 * Whether this seat owes a report.
 *
 * The engine's answer, which is the only one now. The gate was recorded twice —
 * here as `Journal.reported` and in the engine as `SeatedPlayer.reportSubmitted`
 * — and while one player had one journal the two could not disagree. Seats made
 * them able to: a second player owed a report the engine knew about, their
 * journal did not exist yet, and a journal that does not exist reads as
 * "nothing owed". The die was open and the writing button was disabled, so they
 * could neither be stopped nor write.
 *
 * `Journal.reported` stays in the stored shape, because saves carry it, and is
 * no longer asked about anything.
 */
export function seatOwesReport(player: { state: GameState; reportSubmitted: boolean }): boolean {
  return owesReport(player.state, CLASSIC) && !player.reportSubmitted;
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
/**
 * When the writer starts warning about room.
 *
 * Only near the end: a counter that is always on screen is furniture, and a
 * player counting characters is not reflecting.
 */
export const WARN_WITHIN_CHARS = 200;

/**
 * What to say under the writing box, or nothing.
 *
 * Both limits here used to be silent. `record` cut a report at
 * `MAX_REPORT_CHARS` and dropped the oldest entry past `MAX_REPORTS`, and the
 * player was told neither — a thousand words could go without a word about it.
 * The published app has no maximum at all; ours exists because `localStorage`
 * is bounded, and a bound nobody is shown is indistinguishable from a bug.
 *
 * The dialog has carried an empty `#writer-hint` since it was written, which is
 * where this goes.
 */
export function hintFor(journal: Journal, length: number, language: Language): string {
  const left = MAX_REPORT_CHARS - length;

  // The immediate concern first: running out of room in this box beats a
  // standing fact about the path.
  if (left <= 0) return messageFor(language, 'writer.full');
  if (left <= WARN_WITHIN_CHARS) return messageFor(language, 'writer.left', { count: left });

  if (journal.entries.length >= MAX_REPORTS) return messageFor(language, 'writer.pathFull');

  return '';
}

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

/**
 * What this player has written about one square, oldest first, and the squares
 * they keep returning to.
 *
 * The answers come from `@leela/journal`, which is where anything both surfaces
 * need to agree about lives. The bot keeps its reports in SQLite and this app
 * keeps them in `localStorage`; a player returning to plan 41 is the same fact
 * in both, and two implementations of it would be two answers.
 */
export function writingsOn(journal: Journal, plan: number): Report[] {
  return writingsOnEntries(journal.entries, plan);
}

export function revisited(journal: Journal): Revisit[] {
  return revisitedEntries(journal.entries);
}

/** One seat's share of the path view. */
export interface PathSection {
  /** Seat number as a player counts them, from 1. */
  seat: number;
  playerId: string;
  /**
   * What this player is playing for.
   *
   * Carried per section for the reason the key is per seat: the view showed one
   * intention at the top, under the word "you", and then everybody's writing
   * below it. At a shared table that top line belonged to whoever happened to
   * hold the turn.
   */
  intention: string;
  /** The squares that came back to *this* player, most-returned first. */
  returns: Revisit[];
  /** Everything they wrote, oldest first. */
  entries: Report[];
}

/**
 * What the path view shows, seat by seat.
 *
 * Extracted from the view because the thing that can go wrong here is not
 * rendering: it is whose. Every journal in this app is per seat, and the one
 * defect this shape keeps producing is a screen that computes one player's
 * summary and draws it under another player's name. A function that takes the
 * journals and returns the sections can be asked that question directly.
 */
export function pathSections(
  seats: ReadonlyArray<{ id: string; journal: Journal; intention?: string }>,
): PathSection[] {
  return seats.map((seat, index) => ({
    seat: index + 1,
    playerId: seat.id,
    intention: seat.intention ?? '',
    returns: revisited(seat.journal),
    entries: path(seat.journal),
  }));
}

/**
 * The seat that owes a report, if any.
 *
 * The writer used to belong to whoever held the turn, which is the same seat
 * almost always — and not at the one moment that matters most. A player who
 * reaches Cosmic Consciousness owes an account of it (`reportOnWinningSquare`,
 * because 68 is the square a whole game was played to reach) and the turn
 * leaves them on the same throw. So the last report of a game, at a shared
 * table, could not be written at all: the button belonged to somebody else and
 * the winner never held the turn again.
 *
 * The turn holder comes first, because in every other moment they are the one
 * being asked, and a table where two seats owe at once should ask the player
 * whose turn it is.
 */
export function owingSeat<T extends { id: string; state: GameState; reportSubmitted: boolean }>(
  players: ReadonlyArray<T>,
  turnIndex: number,
): T | null {
  const holder = players[turnIndex];
  if (holder && seatOwesReport(holder)) return holder;

  return players.find((seat) => seatOwesReport(seat)) ?? null;
}
