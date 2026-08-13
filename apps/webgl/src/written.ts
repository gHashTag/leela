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

import {
  INTENTION_KEY,
  MAX_REPORTS,
  type Merged,
  REPORTS_KEY,
  type Report,
  asIntention,
  isReport,
  merged,
  order,
  parseDocument,
  toDocument,
} from '@leela/journal';

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

/**
 * What the player is playing for.
 *
 * Not a profile field. `apps/miniapp/src/state.ts` argues this out and is
 * right: in Leela the intention is *the question the game answers*, and the
 * reports accumulating on the squares are the answer. A path exported without
 * it is a year of answers with the question missing.
 *
 * `asIntention` is the rule and it lives in `@leela/journal` because there were
 * three copies of it and a fourth about to be written. Nothing is re-checked
 * here: it refuses what is too short to be meant and too long to be held, and
 * it *drops* rather than shortens, because a question cut in half is a
 * different question.
 */
export function readIntention(store: Store | null): string | null {
  if (!store) return null;
  try {
    return asIntention(store.getItem(INTENTION_KEY));
  } catch {
    return null;
  }
}

/**
 * Keeps it, and says whether it took.
 *
 * False both when the storage refused and when the question was not one the
 * game holds — the caller has a player in front of it and can say which.
 */
export function writeIntention(store: Store | null, text: string): boolean {
  const asked = asIntention(text);
  if (asked === null) return false;
  if (!store) return false;
  try {
    store.setItem(INTENTION_KEY, asked);
    return true;
  } catch {
    return false;
  }
}

/**
 * The whole path as a file, question included.
 *
 * `toDocument` applies the same rule to the intention that the reader will, so
 * a file never carries a question that reads back as a different one.
 */
export const asFile = (store: Store | null): string =>
  JSON.stringify(toDocument(readAll(store), readIntention(store) ?? undefined), null, 2);

/**
 * Brings a file back, and says what it cost.
 *
 * `merged` is `@leela/journal`'s, and its comment is worth the read: both
 * surfaces that came before told the player how many entries *arrived* while
 * the bound had just thrown that many of their oldest away. `added` is what is
 * actually there and `dropped` is what it cost, so the caller can say both.
 *
 * A file with a question in it does not overwrite one already set: the player
 * asked something here, and a file is not a reason to change what they are
 * playing for. It fills an empty one, which is the case that helps.
 */
export function takeIn(store: Store | null, text: string): Merged | null {
  const document = parseDocument(text);
  if (!document) return null;

  const outcome = merged(readAll(store), document.entries);
  if (store) {
    try {
      store.setItem(REPORTS_KEY, JSON.stringify(outcome.entries));
    } catch {
      /* Nothing brought in, and the caller is told by `added` being what it is. */
    }
  }
  if (document.intention && readIntention(store) === null) {
    writeIntention(store, document.intention);
  }
  return outcome;
}
