/**
 * What the player has written, kept.
 *
 * Until now the compose box fed the companion and nothing else: a reflection
 * written on plan 34 was gone when the tab was. That is the wrong thing to lose
 * in this particular game — the reports *are* the game, and the reason to come
 * back to a square is to find out what you said the last time you stood on it.
 *
 * The format is `@leela/journal`'s and so is the key. `REPORTS_KEY` is
 * `leela.reports.v1`, the same string the mini app and the phone write, which
 * means a player who opens both on one device sees one path rather than two.
 * That is the whole reason the key lives in a package neither of them owns —
 * and the reason nothing here re-checks what a report is: `isReport` already
 * refuses a blank one, a plan off the board, and a timestamp no clock produced.
 */

import { MAX_REPORTS, REPORTS_KEY, type Report, isReport, order } from '@leela/journal';

import type { Store } from './kept';

/**
 * Everything on this device, oldest first.
 *
 * A record that is not a list, or a list with rubbish in it, yields the entries
 * that *are* reports rather than nothing: one bad row in a file written by
 * another version of another app should cost that row, not a year of writing.
 */
export function readAll(store: Store | null): Report[] {
  if (!store) return [];

  let raw: string | null;
  try {
    raw = store.getItem(REPORTS_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  return Array.isArray(parsed) ? order(parsed.filter(isReport)) : [];
}

/**
 * Adds one, and returns the whole path as it now stands.
 *
 * Oldest dropped first at the bound, which is `@leela/journal`'s `MAX_REPORTS`.
 * A cap is not a preference: `localStorage` has a size and a surface that
 * writes without one eventually throws on a save and loses the entry it was
 * making, which is the newest and the one the player is watching.
 */
export function add(store: Store | null, entry: Report): Report[] {
  const kept = [...readAll(store), entry].slice(-MAX_REPORTS);
  if (!store) return kept;

  try {
    store.setItem(REPORTS_KEY, JSON.stringify(kept));
  } catch {
    /* Writing that cannot be saved is still writing that was done. */
  }
  return kept;
}
