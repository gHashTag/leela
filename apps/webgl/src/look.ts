import { PAPER, SPACE, type Palette } from './theme';

/**
 * Light or dark, chosen the way the language is chosen.
 *
 * Three questions, kept apart because they have three different answers:
 *
 *   - **What has the reader asked for**, if anything. A stored choice outranks
 *     everything: somebody who turned the lights on meant it.
 *   - **What does their system say**, when they have not asked. `prefers-
 *     color-scheme` is the answer they already gave to every other app.
 *   - **What does the board look like** in that light, which is `theme.ts`'s
 *     business and not this file's.
 *
 * The board is not only chrome. A light page around a black starfield is two
 * decisions in one screen, so the choice reaches the scene as well: `SPACE` is
 * the void, `PAPER` is the board on a table.
 */

export type Look = 'dark' | 'light';

/**
 * The one every reader gets when nothing else is known.
 *
 * Named for what it falls back to. `tongue.ts` has a `FALLBACK` of its own
 * meaning `'en'`, and `audit-doubles` put the two side by side the moment this
 * one existed - one name, two modules, two different things by it.
 */
export const FALLBACK_LOOK: Look = 'dark';

/** Storage, as this needs it. Structural, so a test can be one. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Where the choice is kept. */
export const LOOK_KEY = 'leela.look';

const isLook = (value: unknown): value is Look => value === 'dark' || value === 'light';

/**
 * What the reader has asked for, or nothing.
 *
 * Wrapped, because storage is allowed to refuse: a browser with cookies denied
 * throws on the *read*, and a board that will not draw because of a preference
 * is worse than a board in the wrong colours.
 */
export const stored = (store: Store | null): Look | null => {
  try {
    const held = store?.getItem(LOOK_KEY) ?? null;
    return isLook(held) ? held : null;
  } catch {
    return null;
  }
};

/** What the system says, or nothing when it will not say. */
export const preferred = (matches: ((query: string) => boolean) | null): Look | null => {
  if (!matches) return null;
  try {
    if (matches('(prefers-color-scheme: light)')) return 'light';
    if (matches('(prefers-color-scheme: dark)')) return 'dark';
    return null;
  } catch {
    return null;
  }
};

/**
 * The light to draw in.
 *
 * @param asked what is in storage, which outranks the system.
 * @param system what the system prefers, used only when nothing was asked.
 */
export const lookFor = (asked: Look | null, system: Look | null): Look =>
  asked ?? system ?? FALLBACK_LOOK;

/** The other one, which is what a toggle is for. */
export const other = (look: Look): Look => (look === 'dark' ? 'light' : 'dark');

/** How the board is painted in this light. */
export const paletteFor = (look: Look): Palette => (look === 'light' ? PAPER : SPACE);

/**
 * Keep the choice, and say whether it was kept.
 *
 * Not silent: a preference that did not survive the reload is a control that
 * did nothing, and the caller is the only one that can decide whether to say
 * so.
 */
export const remember = (store: Store | null, look: Look): boolean => {
  try {
    store?.setItem(LOOK_KEY, look);
    return store !== null;
  } catch {
    return false;
  }
};
