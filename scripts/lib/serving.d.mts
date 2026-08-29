/**
 * Types for `serving.mjs`, so a check can import it without a directive.
 *
 * The scripts here are plain JavaScript — they run under `node` and `bun`
 * without a build — and the tests that share them are TypeScript. One
 * declaration beside the module is quieter than a `@ts-expect-error` in every
 * file that imports it, and unlike a directive it says what the shapes are.
 */

/** Must match `SERVING_HEADER` in `apps/bot/src/serving.ts`. */
export const SERVING_HEADER: string;

/** Twelve lowercase hex characters, and nothing else. */
export const FINGERPRINT: RegExp;

/**
 * The three states a guard over a remote process can be in.
 *
 * `unknown` is not a courtesy: a bot that is down, a bot too old to answer at
 * all, and a network that dropped the request are none of them agreement, and
 * none of them disagreement. It is a state in the type so that folding it into
 * one of the other two has to be written down rather than happen by default.
 */
export type ServingState = 'serving' | 'stale' | 'unknown';

export interface Verdict {
  state: ServingState;
  /** One sentence, for a person reading a terminal. */
  why: string;
}

/**
 * The fingerprint a response carries, or null.
 *
 * @param headers anything with a `get` — a `Headers`, or a map in a test.
 *   Null for a header that is absent, and null too for one whose value is not
 *   a fingerprint: an unrecognised string is *cannot tell*, never *stale*.
 */
export function fingerprintFrom(headers: { get?: (name: string) => string | null | undefined } | null | undefined): string | null;

/**
 * @param expected the repository's fingerprint, or null if it could not be computed
 * @param served what the live bot said, or null if it said nothing usable
 */
export function verdict(expected: string | null, served: string | null): Verdict;

/** 0 serving, **1 stale, 2 unknown** — *no* and *no answer* are different. */
export function exitCodeFor(state: ServingState): 0 | 1 | 2;
