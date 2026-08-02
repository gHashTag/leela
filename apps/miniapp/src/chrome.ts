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

import { answeredIn, directionOf, messageFor, type Language } from '@leela/content';

export function applyChrome(document: Document, language: Language): void {
  document.documentElement.lang = language;
  document.documentElement.dir = directionOf(language);

  /**
   * A word, and the language it turned out to be in.
   *
   * The catalogue falls back to English one key at a time, so this page can
   * declare `lang="ja"` two lines up and put English on every button. A screen
   * reader takes the page at its word and reads *Play* and *Save* with Japanese
   * phonetics, in twenty of the twenty-two languages.
   *
   * `answeredIn` says which language actually came back, and an element that
   * holds a word from another one says so.
   */
  const mark = (element: Element, key: Parameters<typeof messageFor>[1]) => {
    const answered = answeredIn(language, key);
    if (answered === language) element.removeAttribute('lang');
    else element.setAttribute('lang', answered);
  };

  const set = (id: string, key: Parameters<typeof messageFor>[1]) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = messageFor(language, key);
    mark(element, key);
  };

  /**
   * A control that shows a picture instead of a word.
   *
   * Its name is for a screen reader and for the tooltip, and printing it would
   * put "Roll" across the pips. Four controls are drawn this way and this was
   * written for one of them: the die was named, and the three buttons along the
   * top — the rules, the players, the list of all seventy-two plans — kept the
   * English in the markup, in every one of the twenty-two languages. For an
   * icon button that English is the **only** name it has, so a player reading
   * the game in Russian heard "Players".
   *
   * Every key existed already. `app.rules`, `app.plans` and `app.players` are
   * in the catalogue in both complete languages and were said by nobody, which
   * is how this was found.
   */
  const name = (id: string, key: Parameters<typeof messageFor>[1]) => {
    const element = document.getElementById(id);
    if (!element) return;

    const said = messageFor(language, key);
    element.setAttribute('aria-label', said);
    element.setAttribute('title', said);
    // An attribute cannot carry a `lang`, and it does not have to: the name of
    // an element is read in the element's own language, so marking the button
    // marks the word it is called by. These four have no text of their own —
    // they are icons — so nothing else on them is affected.
    mark(element, key);
  };

  name('roll', 'app.roll');
  name('rules', 'app.rules');
  name('players', 'app.players');
  name('plans', 'app.plans');

  set('read', 'app.read');
  set('report', 'app.reportWrite');
  set('path', 'app.path');
  set('writer-save', 'app.reportSave');
  // The other Save, in the dialog that asks the question. Same word, same key,
  // and it was the one button in the markup that nothing ever touched.
  set('intention-save', 'app.reportSave');
  set('path-export', 'app.pathExport');
  set('path-import', 'app.pathImport');
  set('path-paste', 'app.paste');
  set('writer-ask', 'app.ask');
  set('writer-hint', 'app.pathLocal');

  const writing = document.getElementById('writer-text');
  if (writing) writing.setAttribute('placeholder', messageFor(language, 'app.reportPlaceholder'));
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

  /**
   * Every way out, not the reader's.
   *
   * This named `#reader form button` and there are four of them: the plans
   * list, the paste dialog and the writer kept the English in the markup, in
   * every one of the twenty-two languages. None of them carries an `id`, which
   * is how they slipped past the check that holds every named control to the
   * catalogue — the check reads ids, and a way out of a dialog does not need
   * one to be read by a person.
   *
   * Found by setting the language to Russian on the running page and reading
   * the four buttons back: one said *Закрыть* and three said *Close*.
   */
  for (const close of document.querySelectorAll('dialog form[method="dialog"] button')) {
    close.textContent = messageFor(language, 'app.close');
  }
}
