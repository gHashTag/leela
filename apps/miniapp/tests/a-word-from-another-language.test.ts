/**
 * A button whose word is not in the language the page declares.
 *
 * `applyChrome` sets `lang` on the document from the reader's language, and the
 * message catalogue falls back to English **one key at a time** — which is what
 * lets half a translation be useful the day it is started. Together they make a
 * page that declares `lang="ja"` and puts English on every control. A screen
 * reader takes the page at its word and reads *Read this plan* and *Save* with
 * Japanese phonetics, in twenty of the twenty-two languages.
 *
 * The book was in the same state and was repaired the pass before, with
 * `answeredIn` — which language a sentence actually came back in. Here the mark
 * goes on the element rather than in a `<span>`, because these are buttons: the
 * name of an element is read in that element's own language, so marking the
 * button marks the word it is called by, and the four icon controls have no
 * text of their own to affect.
 *
 * **What this does not cover, said plainly.** Fifty-odd strings in `main.ts`
 * are composed into sentences or handed to `announce` already built, and a text
 * node cannot carry a language. Those are still unmarked; the static chrome —
 * the part a reader walks past on every screen — is what one funnel could
 * honestly close.
 */

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { LANGUAGES, answeredIn, messageFor } from '@leela/content';
import { applyChrome } from '../src/chrome';

/** The controls `applyChrome` names, with the key each is named by. */
const NAMED = [
  ['read', 'app.read'],
  ['report', 'app.reportWrite'],
  ['path', 'app.path'],
  ['roll', 'app.roll'],
  ['rules', 'app.rules'],
  ['players', 'app.players'],
  ['plans', 'app.plans'],
] as const;

beforeEach(() => {
  document.documentElement.lang = 'en';
  document.body.innerHTML = `
    <button id="roll" aria-label="Roll"></button>
    <button id="rules"></button>
    <button id="players"></button>
    <button id="plans"></button>
    <button id="read">Read this plan</button>
    <button id="report">Write</button>
    <button id="path">Path</button>
  `;
});

describe('a control the catalogue could not translate', () => {
  it('says which language its word is in, in every language that falls back', () => {
    const unmarked: string[] = [];

    for (const language of LANGUAGES) {
      applyChrome(document, language);

      for (const [id, key] of NAMED) {
        const answered = answeredIn(language, key);
        if (answered === language) continue;

        const marked = document.getElementById(id)?.getAttribute('lang');
        if (marked !== answered) unmarked.push(`${language}/${id}: ${marked ?? 'nothing'}`);
      }
    }

    expect(unmarked).toEqual([]);
  });

  it('says nothing where the reader has the word in their own language', () => {
    // The other half, and the one that is easy to lose by being thorough:
    // marking a Russian button as English tells a screen reader to say Russian
    // with an English mouth.
    for (const language of ['en', 'ru'] as const) {
      applyChrome(document, language);

      for (const [id] of NAMED) {
        expect({ language, id, lang: document.getElementById(id)?.getAttribute('lang') }).toEqual({
          language,
          id,
          lang: null,
        });
      }
    }
  });

  it('takes the mark off again when the language changes under it', () => {
    // `applyChrome` runs whenever the seat changes, and a button that kept an
    // old `lang` would be a page that had been right once.
    applyChrome(document, 'ja');
    expect(document.getElementById('read')?.getAttribute('lang')).toBe('en');

    applyChrome(document, 'ru');
    expect(document.getElementById('read')?.getAttribute('lang')).toBeNull();
  });

  it('has something to mark, so this is a rule about a real state', () => {
    // Twenty of the twenty-two. If the catalogue is ever completed this falls
    // to zero and the file should go — which is a thing to notice rather than
    // a silent pass.
    const falling = LANGUAGES.filter((language) =>
      NAMED.some(([, key]) => answeredIn(language, key) !== language),
    );

    expect(falling.length).toBeGreaterThan(15);
  });

  it('marks the word it actually put there', () => {
    // The mark and the text must agree: a button marked English holding a
    // Russian word would be worse than one marked nothing.
    applyChrome(document, 'ja');

    const read = document.getElementById('read');
    expect(read?.textContent).toBe(messageFor('en', 'app.read'));
    expect(read?.getAttribute('lang')).toBe('en');
  });
});
