import { hostOf, type Host } from './hosted';

/**
 * Chat connection diagnostics belong to the browser/Mini App, not the native
 * application. Host presence only chooses presentation; it grants no access.
 * Clear the text as well as hiding it so stale status is not accessible either.
 */
export const showChatStatus = (
  target: Pick<HTMLElement, 'textContent' | 'hidden'>,
  text: string,
  host: Host | null = hostOf(),
): void => {
  target.textContent = host === null ? text : '';
  target.hidden = host !== null;
};
