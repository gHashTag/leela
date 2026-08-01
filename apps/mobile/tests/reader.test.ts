import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank as code } from '../../../scripts/lib/source.mjs';
import { FALLBACK_LANGUAGE, LANGUAGES, directionOf, resolveLanguage } from '@leela/content';

/**
 * What language the reader is in, asked rather than declared.
 *
 * `App.tsx` said `resolveLanguage(undefined)` — a literal — so the fallback was
 * the answer and a game published in twenty-two languages showed **English to
 * everybody**, on a device that has known its own language since it was
 * switched on.
 *
 * Every other surface asks. The bot reads `ctx.from?.language_code`, the mini
 * app reads Telegram's user language and then `navigator.language`, and the app
 * this one replaces read `RNLocalize.getLocales()[0].languageCode` and served
 * ten languages from it (`src/i18n.ts` in `leela`, which also falls back to
 * Russian rather than English for a Russian device). Only the phone declared —
 * and it declared the fallback, which is the one wrong answer that looks right
 * from an English desk.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const APP = readFileSync(join(SRC, 'App.tsx'), 'utf8');
const DEVICE = readFileSync(join(SRC, 'device.ts'), 'utf8');

/**
 * The file with what it says about itself taken out.
 *
 * A comment naming the defect reads exactly like the defect to a regular
 * expression, and this test failed on its own explanation the first time it
 * ran: `App.tsx` documents that it used to say `resolveLanguage(undefined)`.
 * `no-rules.test.ts` next door strips the stylesheet for the same reason — a
 * check that cries wolf on prose is one somebody deletes rather than obeys.
 */

describe('the reader is asked, not assumed', () => {
  it('never hands the resolver a literal', () => {
    /**
     * The shape, not the one call site. A literal argument means the language
     * was decided in the source, and a source cannot know what phone it is
     * running on. `undefined` is the worst of them: it typechecks, it is the
     * documented way to say *I have no locale*, and it silently answers
     * English.
     */
    const calls = [...code(APP).matchAll(/resolveLanguage\(([^)]*)\)/g)].map(([, argument]) => argument);

    expect(calls.length, 'the screen resolves a language at all').toBeGreaterThan(0);
    for (const argument of calls) {
      expect(argument.trim(), 'resolveLanguage argument').not.toMatch(/^(undefined|null|'|")/);
    }
  });

  it('asks the one file that knows what a phone is', () => {
    // Not `Intl` inline in the screen: the app's rule is that everything except
    // `device.ts` is testable without a simulator, and `no-rules.test.ts`
    // enforces it. This is the reason that rule has to hold for reading too and
    // not only for writing.
    expect(code(APP)).toContain('deviceLocale');
    expect(code(DEVICE)).toContain('export function deviceLocale');
  });

  it('answers nothing rather than a guess when the phone will not say', () => {
    // Off a device — under vitest, with no `NativeModules` and whatever `Intl`
    // node happens to have — the honest answer is that we do not know. A locale
    // invented here would be indistinguishable from a phone really set to it.
    expect(code(DEVICE)).toContain('return undefined');
    expect(code(DEVICE), 'no invented default').not.toMatch(/return\s+'[a-z]{2}(-[A-Za-z]+)?'/);
  });
});

describe('every language the game is published in can be reached from a phone', () => {
  /**
   * The point of asking. A resolver that answered English to twenty of the
   * twenty-two would pass "the screen calls `deviceLocale`" and leave the
   * defect exactly where it was.
   */
  it('resolves each one from the tag a device reports', () => {
    for (const language of LANGUAGES) {
      expect(resolveLanguage(language), language).toBe(language);
      expect(resolveLanguage(`${language}-IN`), `${language}-IN`).toBe(language);
      expect(resolveLanguage(`${language}_IN`), `${language}_IN`).toBe(language);
    }
  });

  it('reaches more than the one it used to answer', () => {
    // The guard against a resolver that collapses: if this ever equals one,
    // asking the phone has stopped meaning anything.
    const reachable = new Set(LANGUAGES.map((language) => resolveLanguage(`${language}-XX`)));
    expect(reachable.size).toBe(LANGUAGES.length);
  });
});

describe('the forms a phone actually hands over', () => {
  /**
   * Each of these is a shape some real source produces, named. A test that
   * listed locales would say nothing about the next one; these say that the
   * *kinds* of tag a platform emits all arrive somewhere sensible.
   */
  const forms: Array<[string, string, string]> = [
    ['Intl, on a Russian phone', 'ru-RU', 'ru'],
    ['Intl, with a calendar extension', 'en-US-u-ca-gregory', 'en'],
    ['Intl, with a script subtag', 'zh-Hans-CN', 'zh'],
    ['iOS AppleLocale, underscored', 'ru_RU', 'ru'],
    ['Android localeIdentifier', 'ar_EG', 'ar'],
    ['a bare language', 'ja', 'ja'],
    ['a language the book has not been translated into', 'nb-NO', FALLBACK_LANGUAGE],
    ['undetermined', 'und', FALLBACK_LANGUAGE],
    ['an empty string, which is a phone that answered nothing', '', FALLBACK_LANGUAGE],
  ];

  it.each(forms)('%s', (_name, tag, expected) => {
    expect(resolveLanguage(tag)).toBe(expected);
  });

  it('treats a phone that would not answer as English, and says so once', () => {
    expect(resolveLanguage(undefined)).toBe(FALLBACK_LANGUAGE);
  });
});

describe('the board is the game\'s direction, the text is the reader\'s', () => {
  /**
   * `BOARD_ROWS` is the path itself — eight rows of nine, counted from the
   * bottom and alternating direction — so which side a row begins on is
   * geometry, not typography. React Native reverses `flexDirection: 'row'`
   * under a right-to-left layout, which would mirror every row and put the
   * snakes and arrows on the wrong side.
   *
   * It cannot happen today: the app declares no right-to-left localisation, so
   * `I18nManager.isRTL` is false on an Arabic phone too. It becomes possible
   * the moment somebody adds one — which is what *the app now speaks Arabic*
   * invites. The guard belongs with the change that invites it.
   */
  /**
   * One entry of the stylesheet, and only that one.
   *
   * By brace matching rather than by looking for the next `}`: `board` and
   * `row` are written on one line each, so a slice to the next closing brace
   * runs on through `cell` and every assertion below would pass for a property
   * declared three entries away.
   */
  const style = (name: string) => {
    const open = APP.indexOf(`  ${name}: {`);
    expect(open, `no style named ${name}`).toBeGreaterThan(-1);

    let depth = 0;
    for (let at = APP.indexOf('{', open); at < APP.length; at += 1) {
      if (APP[at] === '{') depth += 1;
      if (APP[at] === '}') {
        depth -= 1;
        if (depth === 0) return APP.slice(open, at + 1);
      }
    }

    throw new Error(`${name} is never closed`);
  };

  it('pins the board to one direction', () => {
    expect(style('board')).toContain("direction: 'ltr'");
  });

  it('does not lay the rows out in the reader\'s direction', () => {
    expect(style('row')).toContain("flexDirection: 'row'");
    expect(style('row'), 'derived from the reader').not.toContain('reading_direction');
  });

  it('does lay the prose out in it', () => {
    // The other half of the same rule, and the reason this is not simply "no
    // right-to-left anywhere": Arabic and Urdu are two of the twenty-two.
    expect(code(APP)).toContain("directionOf(language)");
    expect(code(APP)).toContain("reading_direction === 'rtl' ? styles.rightToLeft : null");
  });

  it('has a direction for every language a phone can now ask for', () => {
    const directions = new Set(LANGUAGES.map((language) => directionOf(language)));
    expect(directions, 'both, or the rule is untested').toEqual(new Set(['ltr', 'rtl']));
  });
});

/**
 * Prose follows the reader; geometry does not.
 *
 * The sentence is the mini app's, written down in `chrome.ts` a hundred passes
 * ago, and it sets `dir` on the whole document so that every word it shows
 * obeys it. This app obeyed **only the second clause**: the board was pinned to
 * one direction, and the reader's direction reached the three boxes the player
 * types into and not one word the game says.
 *
 * So the 72 plans and the entire rules book, in Arabic and Urdu, were laid out
 * left to right — the teaching this app exists to deliver, ragged down the
 * wrong margin, with each sentence's full stop on the wrong side of it. The
 * comment written here one pass ago said *the fields already carry it* as
 * though the fields were the text. They are where the player answers; the plan
 * is what they are answering. Seventh sighting of a sentence naming the wrong
 * thing, and the first that was mine.
 *
 * A screen has no `dir` to set, so this is the check that stands in for one.
 */
describe('every text on the screen answers whether it follows the reader', () => {
  /** Each `<Text …>…</Text>`, opening tag and children. React Native's, not nested. */
  const texts = [...code(APP).matchAll(/<Text\b([^>]*)>([\s\S]*?)<\/Text>/g)].map(
    ([whole, open = '', children = '']) => ({ whole, open, children }),
  );

  it('finds the texts at all, or the rest of this proves nothing', () => {
    // A regular expression that matched nothing would make every assertion
    // below vacuously true — the shape this repository has been caught by
    // before, where a check iterated an empty list and reported a pass.
    expect(texts.length).toBeGreaterThan(10);
  });

  it('gives each one a direction, taken or declined', () => {
    /**
     * Three answers, and one of them must be present:
     *
     *   - `prose`  — a paragraph: the reader's margin and base direction;
     *   - `label`  — a centred control: the base direction only, since
     *                `textAlign: 'right'` would push *Roll* off its own button;
     *   - `geometry` — a number in the grid, which is not prose and says so.
     *
     * Named rather than omitted, because an omission and a decision look
     * identical in a stylesheet. `audit-drawings` made the same requirement of
     * every disabled control for the same reason, after three passes in which a
     * control was drawn shut and refused nothing.
     */
    for (const text of texts) {
      const answered = /\b(prose|label|styles\.geometry)\b/.test(text.open);
      expect(answered, `undecided: ${text.whole.replace(/\s+/g, ' ').slice(0, 90)}`).toBe(true);
    }
  });

  it('gives the reader\'s own to everything written in the reader\'s language', () => {
    /**
     * The half that catches a wrong answer rather than a missing one. Anything
     * whose words come from `@leela/content` — a plan, a chapter, an account,
     * a message — is prose in the reader's language, and `geometry` on it would
     * pass the check above while laying Arabic out left to right.
     */
    const reads = /messageFor\(|plan\.(title|body)|chapter\.(title|body)|entry\.text|\{line\}/;
    const inReadersLanguage = texts.filter((text) => reads.test(text.children));

    expect(inReadersLanguage.length, 'the screen shows content at all').toBeGreaterThan(5);
    for (const text of inReadersLanguage) {
      expect(
        /\b(prose|label)\b/.test(text.open),
        `not the reader's: ${text.whole.replace(/\s+/g, ' ').slice(0, 90)}`,
      ).toBe(true);
    }
  });

  it('keeps the board out of it', () => {
    /**
     * The other direction of the same rule, and the reason `geometry` is a name
     * and not an absence: a square's number belongs to the grid, and the grid
     * is the path itself.
     *
     * A cell is a text that is **nothing but** the number. Matching anything
     * containing `{square}` caught the plan's heading too — `{square}. {plan
     * .title}`, which is a number and then prose, and is prose.
     */
    const cells = texts.filter((text) => text.children.trim() === '{square}');

    expect(cells.length, 'the board draws its numbers').toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.open).toContain('styles.geometry');
      expect(cell.open, 'a number is not prose').not.toMatch(/\bprose\b/);
    }
  });
});
