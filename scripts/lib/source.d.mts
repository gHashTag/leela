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
export function callsTo(source: string, name: string): Call[];
