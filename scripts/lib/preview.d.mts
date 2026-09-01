/**
 * Types for `preview.mjs`, beside the module for the reason `status.d.mts`
 * gives: the scripts run under `node` without a build, the tests that share
 * them are TypeScript, and one declaration says what the shapes are where a
 * directive would only say to stop asking.
 */

/** Everything a page says about how it should be previewed. Null is absent. */
export interface Preview {
  description: string | null;
  'og:site_name': string | null;
  'og:type': string | null;
  'og:title': string | null;
  'og:description': string | null;
  'og:url': string | null;
  'og:image': string | null;
  'og:image:width': string | null;
  'og:image:height': string | null;
  'og:image:alt': string | null;
  'twitter:card': string | null;
  icon: string | null;
  'apple-touch-icon': string | null;
  canonical: string | null;
}

/** A field where the two pages of one game do not say the same thing. */
export interface Disagreement {
  tag: string;
  said: string | null;
  andSaid: string | null;
}

export const PUBLIC: string;
export const PUBLISHED_AT: string;
export const CARD: string;
export const ICON: string;
export const CARD_SIZE: { readonly width: number; readonly height: number };
export const ICON_SIZE: number;

export function contentOf(html: string, attribute: string, value: string): string | null;
export function hrefOf(html: string, rel: string): string | null;
export function previewOf(html: string): Preview;

export const REQUIRED: readonly (keyof Preview)[];
export const MUST_AGREE: readonly (keyof Preview)[];

export function missingFrom(preview: Preview): (keyof Preview)[];
export function disagreementsBetween(one: Preview, other: Preview): Disagreement[];

export function sizeOfPng(bytes: Buffer | null): { width: number; height: number } | null;
export function sizeOfWebp(bytes: Buffer | null): { width: number; height: number } | null;

export function checkPicture(
  promise: { said: string; width: string | null; height: string | null },
  bytes: Buffer | null,
): string[];
