/**
 * Types for `spillover.mjs`, so a check can import it without a directive.
 *
 * Same reason as `source.d.mts`: the scripts are plain JavaScript so `node` and
 * `bun` can both run them without a build, and the tests that share them are
 * TypeScript.
 */

/** One plan whose text runs into the next one's. */
export interface Spillover {
  language: string;
  plan: number;
  /** The plan whose opening this one carries. */
  into: number;
  /** Where it starts, as an index into the body. */
  at: number;
}

export const LONG_ENOUGH: number;
export const RECORDED: readonly string[];

export function spilloverAt(body: string, next: string): number | null;
export function withoutSpillover(body: string, next: string): string;
export function spilloversIn(
  plans: ReadonlyArray<{ plan: number; body?: string }>,
  language: string,
): Spillover[];
export function nameOf(finding: Spillover): string;

export function against(findings: readonly Spillover[]): {
  fresh: Spillover[];
  rotted: string[];
};
