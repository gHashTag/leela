/**
 * Types for `untranslated.mjs`, so a check can import it without a directive.
 *
 * Same reason as `source.d.mts`: the scripts are plain JavaScript so `node` and
 * `bun` can both run them without a build, and the tests that share them are
 * TypeScript.
 */

/** One part of one plan with none of its language's script in it. */
export interface Untranslated {
  language: string;
  plan: number;
  /** `title`, or `paragraph N` counting from one. */
  part: string;
  text: string;
}

export const BLIND_TO: string;
export const RECORDED: readonly string[];

// Generic in the language tag so the caller's own `Language` union goes in
// unchanged — a `string` parameter here would refuse the real `writtenIn`.
export function untranslatedIn<L extends string>(
  plans: ReadonlyArray<{ plan: number; title?: string; body?: string }>,
  language: L,
  writtenIn: (language: L, text: string) => boolean,
): Untranslated[];

export function nameOf(finding: Untranslated): string;

export function against(findings: readonly Untranslated[]): {
  fresh: Untranslated[];
  rotted: string[];
};
