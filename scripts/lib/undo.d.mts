/**
 * Types for `undo.mjs`, so a check can import it without a directive.
 *
 * Same reason as `source.d.mts`: the scripts are plain JavaScript so `node` and
 * `bun` can both run them without a build, and the tests that share them are
 * TypeScript.
 */

export function remember(notePath: string, filePath: string, original: string): void;
export function putItBack(notePath: string): string | null;
