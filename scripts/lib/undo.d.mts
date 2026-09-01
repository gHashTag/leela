/**
 * Types for `undo.mjs`, so a check can import it without a directive.
 *
 * Same reason as `source.d.mts`: the scripts are plain JavaScript so `node` and
 * `bun` can both run them without a build, and the tests that share them are
 * TypeScript.
 *
 * **A declaration that describes only some of a module is worse than none.** It
 * declared `remember` and `putItBack` and stopped there, while `pendingMutation`
 * — exported from `undo.mjs` and imported by `build-content.mjs`, the first step
 * of `bun run verify` — was missing. The cost was not a missing type; it was a
 * `@ts-expect-error` in `packages/content/tests/undo.test.ts` that made the
 * whole import `any`, so every assertion about the shape it returned was
 * checked by nothing. The way that reads on the page is a well-typed test.
 */

/**
 * What `putItBack` did, when there was a note at all.
 *
 * Three cases rather than two, and the union is where that is enforced: no note
 * is `null`, a file put back has a `restored` path, and a note that could not be
 * read has `restored: null` and a `recovery` a person can perform by hand. A
 * caller that only checks for `null` gets a type error the moment it reads
 * `restored` as a string, which is the mistake this shape exists to make loud.
 */
export type PutBack =
  | { restored: string; note: string; recovery: null }
  | { restored: null; note: string; recovery: string };

/** Where a mutation is, for a caller that only wants to know — and to refuse. */
export type Pending = { path: string | null; recovery: string };

export const RECOVERY: string;
export const UNREADABLE_RECOVERY: string;

export function remember(notePath: string, filePath: string, original: string): void;
export function putItBack(notePath: string): PutBack | null;
export function pendingMutation(notePath: string): Pending | null;
