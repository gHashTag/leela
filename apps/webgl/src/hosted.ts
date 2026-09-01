import type { Report } from '@leela/journal';

import type { Kept } from './kept';

/**
 * This page, when it is running inside the phone app.
 *
 * `apps/mobile` embeds this board in a `WebView` and hands it the player's game
 * on load. That is half a handoff. Without this half the player climbs in 3D,
 * writes about the squares they land on, closes the board, and finds the flat
 * one standing where they left it with none of the writing — two positions and
 * two records in a game about one.
 *
 * Two kinds of thing travel back, because two kinds of thing change here and
 * they change at different moments. The **board** changes on a throw; the
 * **path** changes when the player writes. Sending one message for both would
 * mean every throw re-sent the whole path and every account re-sent the board,
 * and the receiver could not tell which of the two it was being told about.
 *
 * A `WebView` puts `ReactNativeWebView` on `window`. In an ordinary browser
 * there is none, and that is not a failure: the page is the game there, and
 * `localStorage` is where the game lives. Everything here answers *no host*
 * rather than throwing, so the board behaves identically at `localhost:4173`
 * and inside the app.
 */

/** What a host offers: somewhere to post a string. Structural, so a test is one. */
export interface Host {
  readonly postMessage: (message: string) => void;
}

/**
 * What goes over the wire.
 *
 * Named and versioned. The first pass sent a bare `Kept`, which worked and was
 * a dead end: the moment a second kind of news existed there was nothing in the
 * message saying which kind it was, and a reader had to guess from the fields
 * it happened to find.
 */
export interface Told {
  /** The envelope's version, so a newer board can talk to an older app. */
  readonly leela: 1;
  readonly what: 'game' | 'path' | 'subscribe';
  readonly game?: Kept;
  readonly path?: readonly Report[];
}

/**
 * The host, if there is one.
 *
 * Wrapped, because reading `window` is not always allowed — a sandboxed frame
 * throws on the access itself, and a board that will not draw because nobody
 * embedded it is worse than a board that saves only to disk.
 */
export const hostOf = (): Host | null => {
  try {
    const found = (globalThis as { ReactNativeWebView?: unknown }).ReactNativeWebView;
    if (typeof found !== 'object' || found === null) return null;
    const post = (found as { postMessage?: unknown }).postMessage;
    return typeof post === 'function' ? (found as Host) : null;
  } catch {
    return null;
  }
};

const tell = (told: Told, host: Host | null): boolean => {
  if (!host) return false;
  try {
    host.postMessage(JSON.stringify(told));
    return true;
  } catch {
    // A host that refuses a message is not a game that stopped. Everything is
    // saved to `localStorage` either way; what is lost is the flat board
    // learning about it, and the player is still playing.
    return false;
  }
};

/**
 * Tell the app where the player is now standing.
 *
 * The whole record goes, not just the square: the app reads it with a parser
 * that doubts every field, and sending the same shape that was sent in means
 * neither side has a second format to maintain.
 *
 * @returns whether anything was told - false when nothing is hosting this page,
 *   which is the ordinary case in a browser.
 */
export const announce = (kept: Kept, host: Host | null = hostOf()): boolean =>
  tell({ leela: 1, what: 'game', game: kept }, host);

/**
 * Tell the app what the player has written.
 *
 * The record the game exists to produce. This board keeps it under
 * `leela.reports.v1` as a bare array; the phone keeps it under the same key
 * wrapped in `{ entries }`. Same key, two shapes, each surface silently reading
 * nothing of the other's - which is why the path travels as a message rather
 * than being left for the other side to find in storage.
 */
export const announcePath = (
  path: readonly Report[],
  host: Host | null = hostOf(),
): boolean => tell({ leela: 1, what: 'path', path }, host);

/**
 * Ask the app to open its paywall.
 *
 * The board cannot sell anything: a receipt is a native affair, and a page
 * inside a web view has no store to talk to. What it can do is say that the
 * player has asked — the app owns the screen and the transaction.
 *
 * Nothing is sent when nothing is hosting, and the board says so on screen
 * rather than opening a dialog that goes nowhere: see `toll.ts`, which never
 * charges a page that cannot be paid on.
 */
export const askToSubscribe = (host: Host | null = hostOf()): boolean =>
  tell({ leela: 1, what: 'subscribe' }, host);

/**
 * Whether the host says this player holds a subscription.
 *
 * Set by the app before the page loads and again whenever it changes — see
 * `BoardScreen`. A global rather than a message because it has to be true
 * *before* the first frame: a board that starts unentitled and is corrected a
 * moment later shows a paywall to a paying player.
 *
 * Read strictly. Anything that is not exactly `true` is not a receipt: an
 * absent global, a string, a truthy object left by something else.
 */
export const entitled = (): boolean => {
  try {
    return (globalThis as { __leelaPro?: unknown }).__leelaPro === true;
  } catch {
    return false;
  }
};

/** The event the app fires after it has changed the global. */
export const ENTITLEMENT_CHANGED = 'leela:entitlement';
