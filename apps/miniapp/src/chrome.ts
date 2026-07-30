/**
 * The parts of the page that are written in the HTML rather than drawn.
 *
 * The markup has to say something before the script runs, so it says it in
 * English. This replaces it once the language is known — and sets the two
 * attributes that decide how the page is read at all.
 *
 * Its own file, and taking a `Document`, because it was a closure inside
 * `main.ts` and therefore ran only in a browser and was asserted nowhere. The
 * direction of a page is not something to find out from a player.
 */

import { directionOf, messageFor, type Language } from '@leela/content';

export function applyChrome(document: Document, language: Language): void {
  document.documentElement.lang = language;
  document.documentElement.dir = directionOf(language);

  const set = (id: string, key: Parameters<typeof messageFor>[1]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = messageFor(language, key);
  };

  set('roll', 'app.roll');
  set('read', 'app.read');
  set('say', 'app.opening');
  set('plan-title', 'app.waiting');

  const board = document.getElementById('board');
  if (board) {
    board.setAttribute('aria-label', messageFor(language, 'app.boardLabel'));

    // The board is a diagram, not a sentence, so it keeps its own direction.
    // Under `dir="rtl"` the grid mirrors: plan 1 moves to the bottom right and
    // every snake descends the other way. That is a different board drawn from
    // the same data. Prose follows the reader; geometry does not.
    board.setAttribute('dir', 'ltr');
  }

  const close = document.querySelector('#reader form button');
  if (close) close.textContent = messageFor(language, 'app.close');
}
