/**
 * Types for `timing.mjs`, so a check can import it without a directive.
 *
 * The scripts here are plain JavaScript — they run under `node` and `bun`
 * without a build — and the tests that share them are TypeScript.
 */

/** One assertion that bounds elapsed wall-clock time. */
export interface WallClockBound {
  /** The statement, whitespace collapsed, for printing. */
  statement: string;
  /**
   * True for a CEILING — *it finished within N* — which a slow machine
   * falsifies without saying anything about the code. False for a FLOOR, which
   * a slow machine only makes more true, and which therefore cannot flake this
   * way and is never required to be declared.
   */
  upper: boolean;
}

/**
 * @param source blanked source: comments gone, strings kept. A bound quoted in
 *   a comment explaining this rule is not a bound. Null and undefined are
 *   answered with an empty list rather than a throw — a caller reading a file
 *   it could not read should get *no bounds found*, not a crash inside a check.
 */
export function wallClockBounds(source: string | null | undefined): WallClockBound[];

/** The ceilings this repository still has, each with its measured margin. */
export const DECLARED: ReadonlyArray<{ file: string; bounds: number; because: string }>;
