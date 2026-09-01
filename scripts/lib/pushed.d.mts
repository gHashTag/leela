/**
 * Types for `pushed.mjs`, so a check can import it without a directive.
 */

/** How far from the scheduled hour a send may be and still be the schedule's. */
export const ON_TIME_MINUTES: number;

/** One line of the sender's log. */
export interface Entry {
  /** The date the line was WRITTEN. */
  at: string;
  /** Minutes past midnight, local to the sender. */
  minutes: number;
  /** SENT, SKIP, DRY, ERROR. */
  kind: string;
  /** The day the send was FOR — a catch-up makes this differ from `at`. */
  forDay: string;
  quote: string;
}

/**
 * What the log says about one day.
 *
 * `unscheduled` is a send that happened off the hour — somebody's hand rather
 * than the schedule, and every subscriber was pushed to for it. `unknown` is a
 * day before the log begins, which is not a day the push was missed.
 */
export type PushState = 'sent' | 'missed' | 'unscheduled' | 'unknown';

export function entryIn(line: unknown): Entry | null;
export function entriesIn(log: unknown): Entry[];
export function dayOf(
  entries: Entry[],
  day: string,
  expectedMinutes?: number,
): { state: PushState; why: string };
/** 0 sent, 1 it did not happen as asked, 2 no answer. */
export function exitCodeFor(state: PushState): 0 | 1 | 2;
