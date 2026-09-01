/**
 * Types for `serving.mjs`, so a check can import it without a directive.
 *
 * The scripts here are plain JavaScript — they run under `node` and `bun`
 * without a build — and the tests that share them are TypeScript. One
 * declaration beside the module is quieter than a `@ts-expect-error` in every
 * file that imports it, and unlike a directive it says what the shapes are.
 */

/** Must match `SERVING_HEADER` and `CODE_HEADER` in `apps/bot/src/serving.ts`. */
export const SERVING_HEADER: string;
export const CODE_HEADER: string;

/** Twelve lowercase hex characters, and nothing else. */
export const FINGERPRINT: RegExp;

/**
 * The two halves of the question, named once.
 *
 * A `Pair` has both because a pass needs both: the first version of this guard
 * asked only about the texts while its sentence claimed the whole deployment,
 * and an edit to the bot's own source went unnoticed by it entirely.
 */
export interface Pair {
  /** The dataset the bot serves — `packages/content/data`. */
  texts: string | null;
  /** The TypeScript it runs — `apps/bot/src` and every `packages/<name>/src`. */
  code: string | null;
}

export const HALVES: ReadonlyArray<{ key: keyof Pair; header: string; what: string }>;

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

type HeaderBag = { get?: (name: string) => string | null | undefined } | null | undefined;

/**
 * One fingerprint a response carries, or null.
 *
 * Null for a header that is absent, and null too for one whose value is not a
 * fingerprint: an unrecognised string is *cannot tell*, never *stale*.
 */
export function fingerprintFrom(headers: HeaderBag, name?: string): string | null;

/** Both of them, by the names {@link HALVES} gives. */
export function fingerprintsFrom(headers: HeaderBag): Pair;

/**
 * @param expected this checkout's pair; a null half means unreadable
 * @param served what the live bot said; a null half means it did not say
 */
export function verdict(expected: Pair | null, served: Pair | null): Verdict;

/** 0 serving, **1 stale, 2 unknown** — *no* and *no answer* are different. */
export function exitCodeFor(state: ServingState): 0 | 1 | 2;
