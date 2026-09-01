/**
 * The public doors around a Telegram Stars purchase.
 *
 * These are not new terms or a new support promise. The docs application has
 * published the Terms in English and Russian since before the Stars rail, and
 * both the Terms and Privacy Policy name the same contact address. This module
 * gives the bot one typed way to point at those existing sources.
 */

import type { Language } from '@leela/content';
import type { TierId } from './stars';

const DOCS_ROOT = 'https://t27.ai/leela/docs';
const ACCEPT_PREFIX = 'pay:';

/** The destination already named by the repository's legal documents. */
export const PAYMENT_SUPPORT_EMAIL = 'raoffonom@icloud.com';

/**
 * Only Russian has a translated legal document. Every other language gets the
 * English original, matching `apps/docs` rather than labelling English prose
 * as another language.
 */
export function termsUrl(language: Language): string {
  const writtenIn = language === 'ru' ? 'ru' : 'en';
  return `${DOCS_ROOT}/${writtenIn}/legal/eula.html`;
}

/** Callback data stays well below Telegram's 64-byte limit. */
export function acceptanceAction(tier: TierId): `pay:${TierId}` {
  return `${ACCEPT_PREFIX}${tier}`;
}

/**
 * Decode only this feature's exact shape. Whether the named tier is currently
 * sold is deliberately answered later by `tierOf(stars, ...)`, from the live
 * offer captured at process start.
 */
export function tierAskedByAcceptance(action: string): string | null {
  const match = /^pay:([a-z]+)$/.exec(action);
  return match?.[1] ?? null;
}
