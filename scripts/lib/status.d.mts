/**
 * Types for `status.mjs`, so a check can import it without a directive.
 *
 * The scripts here are plain JavaScript — they run under `node` and `bun`
 * without a build — and the tests that share them are TypeScript. One
 * declaration beside the module is quieter than a `@ts-expect-error` in every
 * file that imports it, and unlike a directive it says what the shapes are.
 */

/**
 * One line of the report, and what kind of line it is — stated by the probe
 * that made it, never inferred from the shape of its text.
 *
 * `unasked` is not a failure. A machine without an App Store Connect key has
 * not found a problem, and the first version of this dashboard could not tell
 * the two apart.
 */
export interface Finding {
  surface: string;
  name: string;
  value: string;
  note: string;
  kind: 'fine' | 'wrong' | 'unasked';
}

export interface Verdict {
  wrong: Finding[];
  unasked: Finding[];
  /** Non-zero only for `wrong`. */
  code: 0 | 1;
}

export function verdict(findings: Finding[]): Verdict;

export function describe(findings: Finding[], stamp: string): string;

/** The entry the page names, or null when it names none of its own. */
export function entryFrom(html: string): string | null;

/**
 * The release line only code from 2026-08-23 onward prints, without its
 * trailing full stop. Null means the line was absent, which dates the release.
 */
export function releaseFrom(logText: string): string | null;

export function listeningIn(logText: string): boolean;

export function testFlightFrom(ascText: string): { build: string; state: string } | null;

/** The version in `PREPARE_FOR_SUBMISSION`, which means nobody has pressed. */
export function stagedFrom(ascText: string): string | null;

export function deployFrom(listText: string): { id: string; state: string; when: string } | null;
