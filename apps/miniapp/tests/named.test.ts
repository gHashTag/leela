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
const MAIN = blank(readFileSync(resolve(HERE, 'src', 'main.ts'), 'utf8'));

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

  /**
   * A way out of a dialog, named as a group.
   *
   * They carry no `id` of their own — a Close does not need one to be read by a
   * person — and `applyChrome` names all four with one selector. The rule is
   * still *named from the catalogue*; what changes is that a group can satisfy
   * it, which is why this asks the markup whether the control is one of them
   * rather than trusting the name.
   */
  const inADialogForm = new RegExp(
    `<form method="dialog"><button[^>]*id="${id}"`,
  ).test(HTML);
  if (inADialogForm && SOURCES.some((source) => source.includes(`form[method="dialog"] button`))) {
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
    /**
     * The ways out, which `applyChrome` names as a group.
     *
     * They carry no `id` — a Close does not need one to be read by a person —
     * so this stub answers by the shape of the markup, from the same
     * `index.html` the check reads.
     */
    querySelectorAll(selector: string) {
      if (selector !== 'dialog form[method="dialog"] button') return [];

      const held = this.elements;
      return [...HTML.matchAll(/<dialog id="([\w-]+)"[\s\S]*?<\/dialog>/g)]
        .filter(([body]) => /<form method="dialog">/.test(body))
        .map(([, id]) => {
          const found = held.get(`close:${id}`) ?? {
            text: null,
            attributes: new Map<string, string>(),
          };
          held.set(`close:${id}`, found);
          return {
            set textContent(value: string) {
              found.text = value;
            },
          };
        });
    },
  };

  applyChrome(document as unknown as Document, language);
  return document.elements;
}

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

/**
 * Every dialog offers a way out, except while asking a question never answered.
 *
 * Found by using the app rather than reading it: with the language set to
 * Russian on the running page, the four Close buttons read back as *Закрыть*,
 * *Close*, *Close*, *Close* — `applyChrome` named `#reader form button` and
 * there are four of them. And the question's dialog had **no way out at all**.
 *
 * That is right the first time: the published app blocks the back gesture for a
 * player who has none — `blockGoBack: true` — and the `cancel` handler here
 * refuses the same gesture for the same reason. It is wrong every time after,
 * and this is a phone: no Escape key, Telegram's own back button unwired, Save
 * refusing two characters. A player who tapped *Change it* and cleared the box
 * had nothing left to press.
 */
describe('a dialog can be left', () => {
  const dialogs = [...HTML.matchAll(/<dialog id="([\w-]+)"([\s\S]*?)<\/dialog>/g)].map(
    ([, id = '', body = '']) => ({ id, body }),
  );

  it('finds the dialogs, or this proves nothing', () => {
    expect(dialogs.length).toBeGreaterThan(3);
  });

  it('gives every one of them a control that closes it', () => {
    // `form method="dialog"` is how a button closes one without a listener,
    // and it is the idiom four of the five already used.
    for (const dialog of dialogs) {
      expect(
        /<form method="dialog">\s*<button/.test(dialog.body),
        `#${dialog.id} cannot be left`,
      ).toBe(true);
    }
  });

  it('hides the question\'s until there is an answer to go back to', () => {
    // The one that must not be walked past. Hidden in the markup, and shown by
    // `askIntention` through a named decision rather than a comparison written
    // into the handler.
    const question = dialogs.find((dialog) => dialog.id === 'intention');

    expect(question?.body).toMatch(/id="intention-close"[^>]*hidden/);
    expect(MAIN).toContain('el.intentionClose.hidden = !mayLeaveTheQuestion(intention)');
  });

  it('says so in the reader\'s language, all four of them', () => {
    // Three of the four kept the English in the markup, in every one of the
    // twenty-two languages, because the selector named one.
    const named = chromed('ru');

    for (const dialog of dialogs) {
      expect(named.get(`close:${dialog.id}`)?.text, `#${dialog.id}`).toBe(
        messageFor('ru', 'app.close'),
      );
    }
  });
});

/**
 * Three doors into a journal, and each one says whose it opens onto.
 *
 * The path view shows a section per seat under the heading *The paths at this
 * table*, and its footer carries three controls that read or write one player's
 * journal. Two of them were named when an unnamed one wrote the wrong file:
 * *Save Player 1's copy*, and a paste dialog that opens as *Player 3 · Paste a
 * square somebody sent you*.
 *
 * **The third said only *Bring one back*** — while merging a whole path, and
 * the question it was written under, into whichever seat happened to hold the
 * turn. Found by playing: three seated, a file brought back from a section
 * headed *Player 1*, and it landed in Player 3's journal with a confirmation
 * that named a count and no seat.
 */
describe('every door into a journal says whose', () => {
  const doors = [
    ['the way out', 'app.pathExportSeat'],
    ['the way in from a file', 'app.pathImportSeat'],
    ['a square somebody sent', 'app.seatTurn'],
  ] as const;

  it.each(doors)('%s names a seat', (_what, key) => {
    // `{seat}` rather than a fixed number: the sentence has to be about a
    // player, and a key without the placeholder cannot be.
    expect(messageFor('en', key, { seat: 3 }), key).toMatch(/\b3\b/);
    expect(messageFor('ru', key, { seat: 3 }), `${key} in Russian`).toMatch(/\b3\b/);
  });

  it('names one on the control, not only in the dialog behind it', () => {
    // The export's label is set per section and the import's was not, so the
    // one that carries a whole path was the one with no name on it.
    expect(MAIN).toContain("messageFor(language, 'app.pathImportSeat', { seat: seatNumberOf(session) })");
    expect(MAIN).toContain("messageFor(language, 'app.pathExportSeat', { seat: section.seat })");
  });

  it('says nothing about a seat when there is only one', () => {
    // A player alone does not need to be told which of themselves it is.
    expect(MAIN).toContain("alone\n    ? messageFor(language, 'app.pathImport')");
  });

  it('counts the seat once, in one place', () => {
    /**
     * `session.players.indexOf(currentPlayer(session)) + 1` was written out in
     * the paste dialog, and the import needed the same number. Two copies of a
     * counting rule is how a table comes to disagree with itself about which
     * player it is talking about.
     */
    expect(MAIN).toContain('function seatNumberOf(');
    expect(
      [...MAIN.matchAll(/players\.indexOf\(currentPlayer\([^)]*\)\) \+ 1/g)].length,
      'the seat is counted in one place',
    ).toBe(1);
  });

  it('tells the player which seat a path came back into', () => {
    // Before the act for a square, after it for a file — a file is chosen in
    // the operating system's own dialog, where this app cannot put a title.
    // The seat and the count in one sentence, rather than the exact expression
    // that built it: this asserted a literal and broke when the count stopped
    // being `added` and started being what the path actually took.
    expect(MAIN).toMatch(
      /messageFor\(language, 'app\.seatTurn', \{ seat \}\)\} · \$\{messageFor\(language, 'app\.pathImported'/,
    );
  });
});
