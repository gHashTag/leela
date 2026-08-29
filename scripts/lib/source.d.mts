/**
 * Types for `source.mjs`, so a check can import it without a directive.
 *
 * The scripts here are plain JavaScript — they run under `node` and `bun`
 * without a build — and the tests that share them are TypeScript. One
 * declaration beside the module is quieter than a `@ts-expect-error` in every
 * file that imports it, and unlike a directive it says what the shapes are.
 */

/** One call, with its arguments, parentheses balanced. */
export interface Call {
  whole: string;
  args: string;
}

/**
 * @param syntax `js` for a module, `html` for a document, `css` for a
 *   stylesheet — one blanker and three comment syntaxes, rather than a second
 *   function nobody finds. The type is the list: a check that asks for a
 *   syntax the blanker does not have would otherwise get the module one back
 *   and read a stylesheet as code.
 */
export function blank(source: string, syntax?: 'js' | 'html' | 'css'): string;

/**
 * Whether {@link blank} read the source, or fell back to the cruder reader.
 *
 * `false` means the scan ended inside a string, a template or a pattern — it
 * lost its place, so its answer is discarded and the two regular expressions
 * this replaced are used instead. The fallback is otherwise silent, and a
 * silent fallback is the shape this repository keeps finding at the bottom of
 * its own defects; this is how it can be asked about.
 *
 * MEASURED over 478 files: one declines, `apps/mobile/src/App.tsx`, because
 * JSX is a different grammar. Always `true` for `html` and `css`, which are
 * matched rather than scanned.
 */
export function blankIsTrusted(source: string, syntax?: 'js' | 'html' | 'css'): boolean;
export function callsTo(source: string, name: string): Call[];

/**
 * Every `.ts`, `.mts` and `.tsx` under a directory, however deep.
 *
 * Absolute paths, in the order a sorted walk finds them. A directory that
 * cannot be read is empty rather than a throw, because the callers hand in a
 * `src` or `tests` path a workspace may not have.
 */
export function sourceFilesUnder(directory: string): string[];
