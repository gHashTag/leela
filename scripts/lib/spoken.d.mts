/**
 * Types for `spoken.mjs`, beside the module for the reason `status.d.mts`
 * gives: the scripts run under `node` without a build and the tests that share
 * them are TypeScript.
 */

/** Where a sentence was typed into the source, and the words that gave it away. */
export interface Finding {
  /** 1-indexed, and it points at the code — comments are blanked, not removed. */
  line: number;
  said: string[];
}

/** The two ways this codebase hands a sentence to the page. */
export const SPOKEN: string[];

/** Comments blanked in place, so the lines after them do not move. */
export function withoutComments(source: string): string;

/** The string literals in a fragment, with `${…}` holes replaced by a space. */
export function literalsIn(fragment: string): string[];

export function unspokenIn(source: string): Finding[];
