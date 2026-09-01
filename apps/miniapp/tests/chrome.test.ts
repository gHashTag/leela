// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { LANGUAGES, directionOf, messageFor } from '@leela/content';
import { applyChrome } from '../src/chrome';

/**
 * The page was drawn left to right for everyone.
 *
 * `apps/docs` has set `dir` per language since it was written. The mini app —
 * the surface most people will actually play on — set `lang` and stopped
 * there, so Arabic and Urdu were rendered as though they read the other way.
 * The knowledge existed one directory over and was never asked for.
 *
 * The second half of this is the opposite rule, and it is the one that is easy
 * to get wrong by being thorough: the board must *not* follow the reader.
 */

/** The markup the app ships, reduced to the parts chrome touches. */
function page(): void {
  document.documentElement.lang = 'en';
  document.documentElement.dir = '';
  document.body.innerHTML = `
    <span class="plan-title" id="plan-title">Waiting for a six</span>
    <section class="board" id="board" aria-label="The board, 72 plans"></section>
    <section class="say" id="say">A six puts you on the board.</section>
    <button id="roll" aria-label="Roll"></button>
    <button id="read">Read this plan</button>
    <dialog id="reader"><form method="dialog"><button>Close</button></form></dialog>
  `;
}

beforeEach(page);

describe('the page says which way it is read', () => {
  it('marks a right-to-left language as one', () => {
    applyChrome(document, 'ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('sets a direction for every language, and the right one', () => {
    // Not a list of the two that are right-to-left: whatever the content
    // package says about a language, the page must say the same. A language
    // added later is covered by this without being named here.
    for (const language of LANGUAGES) {
      applyChrome(document, language);
      expect(document.documentElement.dir, language).toBe(directionOf(language));
      expect(document.documentElement.lang, language).toBe(language);
    }
  });
});

describe('the board keeps its own direction', () => {
  it('stays left to right even on a right-to-left page', () => {
    // Mirroring the grid moves plan 1 to the bottom right and sends every
    // snake the other way: a different board, from the same data.
    applyChrome(document, 'ur');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.getElementById('board')?.getAttribute('dir')).toBe('ltr');
  });

  it('is pinned in every language, so the geometry never depends on the reader', () => {
    for (const language of LANGUAGES) {
      applyChrome(document, language);
      expect(document.getElementById('board')?.getAttribute('dir'), language).toBe('ltr');
    }
  });
});

describe('the words the markup shipped with', () => {
  it('replaces every one of them', () => {
    applyChrome(document, 'ru');
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Roll');
    expect(text).not.toContain('Read this plan');
    expect(text).not.toContain('Waiting for a six');
    expect(text).not.toContain('Close');
  });

  it('names the die without writing on it', () => {
    // The die shows a face. A word printed across the pips is what happens
    // when a control's name and its appearance are assumed to be the same
    // thing.
    applyChrome(document, 'ru');
    const die = document.getElementById('roll');
    expect(die?.textContent).toBe('');
    expect(die?.getAttribute('aria-label')).toBe(messageFor('ru', 'app.roll'));
    expect(die?.getAttribute('title')).toBe(messageFor('ru', 'app.roll'));
  });

  it('names the board for a screen reader in the same language', () => {
    applyChrome(document, 'ru');
    expect(document.getElementById('board')?.getAttribute('aria-label')).toBe(
      messageFor('ru', 'app.boardLabel'),
    );
  });

  it('leaves English alone', () => {
    applyChrome(document, 'en');
    expect(document.getElementById('roll')?.getAttribute('aria-label')).toBe('Roll');
    expect(document.getElementById('read')?.textContent).toBe('Read this plan');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('does not fail on a page missing the element it wants', () => {
    // The dialog and the board are the two that are conditionally present in
    // tests and in a partially loaded page. A localiser that throws takes the
    // whole app with it before anything is drawn.
    document.body.innerHTML = '<button id="roll"></button>';
    expect(() => applyChrome(document, 'ar')).not.toThrow();
    expect(document.getElementById('roll')?.getAttribute('aria-label')).toBe(
      messageFor('ar', 'app.roll'),
    );
  });
});
