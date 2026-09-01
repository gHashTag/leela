/**
 * Types for `rivals.mjs`, beside the module for the reason `status.d.mts`
 * gives: the scripts run under `node` without a build, the tests that share
 * them are TypeScript, and one declaration says what the shapes are where a
 * directive would only say to stop asking.
 */

/** What the absence of a needle is allowed to mean. */
export const ABSENCE: { readonly refuted: 'refuted'; readonly unknown: 'unknown' };

export interface Claim {
  says: string;
  needle: RegExp;
  absence: 'refuted' | 'unknown';
}

export interface Rival {
  name: string;
  /** The half `NOTES.md` never recorded, and why nobody could re-check a row. */
  at: string;
  shape: string;
  /** Must match if the fetch reached the right page. Never one of the claims. */
  calibration: RegExp;
  claims: Claim[];
}

export interface Checked {
  says: string;
  found: boolean;
  verdict: 'holds' | 'GONE' | 'not shown here';
}

export interface Reading {
  name: string;
  /** False for a dead host AND for a page that answered and was the wrong one. */
  reached: boolean;
  why: string;
  claims: Checked[];
}

export interface Unreachable {
  name: string;
  why: string;
}

export const RIVALS: Rival[];
export const WITHOUT_AN_ADDRESS: Unreachable[];

/** `html` null is a failed fetch, and is never a refutation of a claim. */
export function readClaims(rival: Rival, html: string | null | undefined): Reading;

export function describeRivals(rows: Reading[], missing: Unreachable[], stamp: string): string;
