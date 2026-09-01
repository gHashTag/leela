/**
 * Types for `prose.mjs`, beside the module for the reason `status.d.mts`
 * gives: the scripts run under `node` without a build, the tests that share
 * them are TypeScript, and one declaration says what the shapes are where a
 * directive would only say to stop asking.
 */

/** One shape of markup, as the class it really takes rather than its spelling. */
export interface Markup {
  what: string;
  reader: RegExp;
}

/** A plan as the dataset holds it, in the fields this reads. */
export interface Readable {
  language: string;
  plan: number;
  title?: string | null;
  description?: string | null;
  body?: string | null;
}

export const MARKUP: Markup[];
export const ENDS_A_SENTENCE: RegExp;

export function markupIn(text: string | null | undefined): string[];
export function endsProperly(body: string | null | undefined): boolean;
export function proseProblems(plan: Readable): string[];
