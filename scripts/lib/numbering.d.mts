/**
 * Types for `numbering.mjs`, beside the module for the reason `status.d.mts`
 * gives: the scripts run under `node` without a build, the tests that share
 * them are TypeScript, and one declaration says what the shapes are where a
 * directive would only say to stop asking.
 */

/** What a decimal digit is worth, in any script. Null if it is not a digit. */
export function digitValue(character: string): number | null;

/** A run of digits as the number it spells. Null if any character is not one. */
export function numberIn(digits: string): number | null;

/** A title without its leading plan number, or unchanged. Null in, null out. */
export function stripNumbering(title: string | null | undefined, plan: number): string | null;
