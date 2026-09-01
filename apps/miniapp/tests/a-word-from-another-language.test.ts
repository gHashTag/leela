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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { LANGUAGES, answeredIn, messageFor } from '@leela/content';
// The audits' comment stripper: a claim about source text is made about code.
import { blank } from '../../../scripts/lib/source.mjs';
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
    <section id="board" aria-label="The board, 72 plans"></section>
    <textarea id="writer-text" placeholder="What happened here?"></textarea>
    <dialog id="reader"><form method="dialog"><button>Close</button></form></dialog>
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

  it('marks every element it puts a word into, not only the ones with an id', () => {
    // The first version of this marked two of the five ways a word reaches the
    // page and left three: the board's own name, the placeholder in the writing
    // box, and the Close on every dialog. Marking at each call site is a rule
    // that has to be remembered five times and it was remembered twice, so the
    // word and the mark come from one call now.
    applyChrome(document, 'ja');

    const board = document.getElementById('board');
    const writing = document.getElementById('writer-text');
    const close = document.querySelector('dialog form[method="dialog"] button');

    expect(board?.getAttribute('lang')).toBe('en');
    expect(writing?.getAttribute('lang')).toBe('en');
    expect(close?.getAttribute('lang')).toBe('en');
  });

  it('asks the catalogue in one place, so a sixth way cannot forget', () => {
    // The guard on the funnel rather than on its callers. `said` is the only
    // thing in the file that may ask for a word; anything else asking directly
    // would be a word on the page with nothing saying what language it is in.
    // Stripped, because this file's own comments name the funnel and a count
    // of `messageFor(` that included prose would be a count of the prose.
    const source = blank(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'chrome.ts'), 'utf8'),
    );

    const asks = [...source.matchAll(/messageFor\(/g)].length;

    expect(asks).toBe(1);
    expect(source).toMatch(/const said = \(/);
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

/**
 * The one line a player who cannot see the board is read.
 *
 * `#say` is `role="status" aria-live="polite"`, so it is announced when it
 * changes; `plan-title` holds the square's name too and changes **silently**. A
 * blind player learns where a throw put them from this sentence or from
 * nothing — which is why `where-a-player-now-is.test.ts` in `@leela/content`
 * holds every move announcement to naming the square.
 *
 * That rule rests on this markup. If the live region moved or lost its role,
 * the rule would still pass and the reason for it would be gone.
 */
describe('the sentence after a throw', () => {
  it('is the one the page announces', () => {
    // Blanked as a document: `aria-live=` inside an HTML comment counts to a
    // regular expression exactly like the one on the page.
    const markup = blank(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8'),
      'html',
    );

    const say = /<section[^>]*id="say"[^>]*>/.exec(markup)?.[0] ?? '';

    expect(say).toContain('role="status"');
    expect(say).toContain('aria-live="polite"');
  });

  it('is the only thing that announces, so the square is named in it', () => {
    // `plan-title` must stay silent: two live regions changing together make a
    // screen reader read the square's name twice, and the announcement is the
    // sentence rather than the label.
    // Blanked as a document: `aria-live=` inside an HTML comment counts to a
    // regular expression exactly like the one on the page.
    const markup = blank(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8'),
      'html',
    );

    const title = /<[a-z]+[^>]*id="plan-title"[^>]*>/.exec(markup)?.[0] ?? '';

    expect(title).not.toContain('aria-live');
    expect([...markup.matchAll(/aria-live=/g)]).toHaveLength(1);
  });
});
