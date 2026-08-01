import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { LANGUAGES, messageFor, type MessageKey } from '@leela/content';
import { applyChrome } from '../src/chrome';

/**
 * Every name a person reads or hears comes from the catalogue.
 *
 * The markup has to say something before the script runs, so it says it in
 * English — `chrome.ts` opens with that, and `applyChrome` is what replaces it.
 * It replaced eleven of the fifteen. The three buttons along the top — the
 * rules, the players, the list of all seventy-two plans — and the Save in the
 * dialog that asks the question kept the English in the file, in every one of
 * the twenty-two languages.
 *
 * For an icon button that English is the **only** name it has: the button shows
 * an emoji, and `aria-label` and `title` are all a screen reader and a tooltip
 * have to go on. So a player reading the game in Russian heard *Players*. The
 * die beside them was named correctly, with the reason written down.
 *
 * **How it was found, and the method worth keeping.** `app.players` is in the
 * catalogue in both complete languages and was said by nobody. A key nothing
 * says is either dead text or a capability nobody wired up — that reading has
 * now found three things in three passes, and this is the first time it found
 * four at once.
 */

const HERE = resolve(__dirname, '..');
const HTML = blank(readFileSync(resolve(HERE, 'index.html'), 'utf8'));
const SOURCES = ['chrome.ts', 'main.ts', 'view.ts'].map((file) =>
  blank(readFileSync(resolve(HERE, 'src', file), 'utf8')),
);

/** An id as `main.ts` holds it: `path-export` is `el.pathExport`. */
const handleOf = (id: string) => id.replace(/-(\w)/g, (_dash, letter) => letter.toUpperCase());

/**
 * Whether anything gives this element a name out of the catalogue.
 *
 * By the statement rather than by proximity: the first version of this asked
 * whether `messageFor` appeared within three hundred characters of the id, and
 * called four controls translated that were not — an event listener registered
 * next to a line that happened to translate something else.
 */
function namedFromTheCatalogue(id: string): boolean {
  if (SOURCES.some((source) => source.includes(`set('${id}'`) || source.includes(`name('${id}'`))) {
    return true;
  }

  return SOURCES.some((source) => {
    /**
     * Every way this element is held: `el.plans`, the call itself, and any
     * local bound from it — `const board = document.getElementById('board')`
     * is named two statements later, and a rule about one statement calls that
     * untranslated.
     */
    const bound = [...source.matchAll(new RegExp(`const (\\w+) = document\\.getElementById\\('${id}'\\)`, 'g'))]
      .map(([, local]) => local)
      .filter((local): local is string => local !== undefined);

    const holders = [`el.${handleOf(id)}`, `getElementById('${id}')`, ...bound.map((one) => `${one}.`)];

    return holders.some((holder) =>
      [...source.matchAll(new RegExp(holder.replace(/[.$()'\\[\\]]/g, '\\\\$&'), 'g'))].some((at) => {
        // The statement it stands in, from this reference to the next semicolon.
        const from = at.index ?? 0;
        const end = source.indexOf(';', from);
        return source.slice(from, end === -1 ? source.length : end).includes('messageFor');
      }),
    );
  });
}

/** Every element in the markup whose name a person reads or hears. */
const spoken = [...HTML.matchAll(/<(button|section|span|input|textarea)([^>]*)>([^<]*)/g)]
  .map(([, tag = '', attrs = '', text = '']) => ({
    tag,
    id: /id="([\w-]+)"/.exec(attrs)?.[1] ?? '',
    named: ['aria-label', 'title', 'placeholder'].flatMap(
      (attribute) => new RegExp(`${attribute}="([^"]*)"`).exec(attrs)?.slice(1) ?? [],
    ),
    words: /[A-Za-z]{3}/.test(text) ? text.trim() : '',
  }))
  .filter((element) => element.id !== '' && (element.named.length > 0 || element.words !== ''));

describe('the markup speaks English until the script runs', () => {
  it('has controls to speak for, or this check proves nothing', () => {
    // An empty list would make every assertion below vacuously true — the shape
    // this repository has been caught by before, where a check iterated nothing
    // and reported a pass.
    expect(spoken.length).toBeGreaterThan(10);
  });

  it.each(spoken.map((element) => [element.id, element] as const))(
    '#%s is named from the catalogue',
    (id) => {
      expect(namedFromTheCatalogue(id), `#${id} keeps the English in the markup`).toBe(true);
    },
  );

  it('names the ones that show a picture instead of a word', () => {
    /**
     * The case that has no fallback. A button with text renders the English and
     * a reader at least sees *something*; an icon button renders an emoji, and
     * `aria-label` and `title` are the whole of what it says.
     */
    for (const id of ['roll', 'rules', 'players', 'plans']) {
      const element = spoken.find((one) => one.id === id);

      expect(element, `#${id} is in the markup`).toBeTruthy();
      expect(element?.words, `#${id} shows a picture, not a word`).toBe('');
      expect(namedFromTheCatalogue(id), `#${id}`).toBe(true);
    }
  });
});

describe('applyChrome, run over the real markup', () => {
  /**
   * The document itself rather than a stub, because the defect was a control
   * the function never mentioned — and a stub built from the function's own
   * list of ids would have had exactly the same hole in it.
   */
  function chromed(language: (typeof LANGUAGES)[number]) {
    const document = {
      documentElement: {} as Record<string, string>,
      elements: new Map<string, { text: string | null; attributes: Map<string, string> }>(),
      getElementById(id: string) {
        if (!HTML.includes(`id="${id}"`)) return null;
        const held = this.elements.get(id) ?? { text: null, attributes: new Map<string, string>() };
        this.elements.set(id, held);
        return {
          set textContent(value: string) {
            held.text = value;
          },
          setAttribute(attribute: string, value: string) {
            held.attributes.set(attribute, value);
          },
        };
      },
      querySelector() {
        return null;
      },
    };

    applyChrome(document as unknown as Document, language);
    return document.elements;
  }

  it('gives every icon button a name in the reader\'s language', () => {
    // Over every language the game is published in: a name that is right in
    // English and missing in Japanese is the defect with one case fixed.
    for (const language of LANGUAGES) {
      const named = chromed(language);

      for (const [id, key] of [
        ['roll', 'app.roll'],
        ['rules', 'app.rules'],
        ['players', 'app.players'],
        ['plans', 'app.plans'],
      ] as ReadonlyArray<[string, MessageKey]>) {
        const element = named.get(id);
        const said = messageFor(language, key);

        expect(element?.attributes.get('aria-label'), `${language} #${id}`).toBe(said);
        expect(element?.attributes.get('title'), `${language} #${id}`).toBe(said);
      }
    }
  });

  it('says it in the language, not in English, wherever there is a translation', () => {
    // The guard against a wiring that resolves every language to the fallback:
    // Russian is the other complete catalogue, so these four must differ there.
    const english = chromed('en');
    const russian = chromed('ru');

    for (const id of ['roll', 'rules', 'players', 'plans']) {
      expect(russian.get(id)?.attributes.get('aria-label'), `#${id}`).not.toBe(
        english.get(id)?.attributes.get('aria-label'),
      );
    }
  });

  it('names the Save in the dialog that asks the question', () => {
    expect(chromed('ru').get('intention-save')?.text).toBe(messageFor('ru', 'app.reportSave'));
  });
});
