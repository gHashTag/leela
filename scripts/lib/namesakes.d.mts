/**
 * Types for `namesakes.mjs`, beside the module for the reason `status.d.mts`
 * gives: the scripts run under `node` without a build, the tests that share
 * them are TypeScript, and one declaration says what the shapes are where a
 * directive would only say to stop asking.
 */

/** A plan as the dataset holds it, in the two fields this reads. */
export interface Named {
  plan: number;
  title: string;
}

/** Two plans of one board that a language calls by the same name. */
export interface Namesake {
  /** The pair, in the order they were met. The audit sorts by number. */
  plans: [number, number];
  name: string;
}

/** A pair left alone, with the languages it happens in and why. */
export interface Record_ {
  plans: [number, number];
  languages: string[];
  because: string;
}

export const nameOf: (title: string | null | undefined) => string;
export function namesakesIn(plans: Named[]): Namesake[];
export const lineOf: (language: string, finding: Namesake) => string;

export const RECORDED: Record_[];
export const recordedLines: () => string[];

export function against(findings: string[]): { fresh: string[]; rotted: string[] };
