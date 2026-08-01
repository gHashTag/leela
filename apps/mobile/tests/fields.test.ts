import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { directionOf, LANGUAGES } from '@leela/content';
import { MAX_INTENTION_CHARS, MAX_REPORT_CHARS } from '@leela/journal';
import { PALETTE } from '../src/palette';
import { AA_TEXT, contrast } from '../../miniapp/src/contrast';

/**
 * What each field is for, said to the keyboard rather than left to it.
 *
 * Three `TextInput`s, and every one of them declared `multiline` and a
 * placeholder and nothing else — so iOS guessed. It guessed the same way for a
 * paragraph of reflection and for a pasted machine-readable square, and one of
 * those guesses corrupts the thing being pasted.
 *
 * Read over `App.tsx` because these are facts about the screen: a prop that is
 * absent renders exactly like a prop that is present and correct, until
 * somebody types.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8');

/** One `<TextInput …>` opening tag, by the handle it carries. */
function field(handle: string): string {
  const at = APP.indexOf(`testID={HANDLE.${handle}}`);
  expect(at, `no field carries HANDLE.${handle}`).toBeGreaterThan(-1);
  const open = APP.lastIndexOf('<TextInput', at);
  return APP.slice(open, APP.indexOf('/>', open));
}

describe('a field that takes prose', () => {
  const prose = ['intention', 'report'];

  it('holds no more than the format will keep', () => {
    /**
     * The mini app met this exactly: `record` cut a report at 4,000 characters
     * and told the player nothing — worse once a draft survived a reload,
     * because the text could be typed across two sittings and cut on save. The
     * phone had no bound at all, so the same loss was waiting here.
     *
     * Against the constants rather than their values: raising one must not
     * leave this asserting the old number.
     */
    expect(field('intention')).toContain(`maxLength={MAX_INTENTION_CHARS}`);
    expect(field('report')).toContain(`maxLength={MAX_REPORT_CHARS}`);
    expect(MAX_INTENTION_CHARS).toBeLessThan(MAX_REPORT_CHARS);
  });

  it('is treated as sentences somebody is writing', () => {
    for (const handle of prose) {
      expect(field(handle), handle).toContain('autoCapitalize="sentences"');
      expect(field(handle), handle).toContain('autoCorrect');
    }
  });

  it('asks iOS to suggest nothing', () => {
    // Without `textContentType`, iOS offers a name, an address, a one-time
    // code — over a box asking what somebody is playing for.
    for (const handle of prose) {
      expect(field(handle), handle).toContain('textContentType="none"');
    }
  });
});

describe('the field that takes a square or a path', () => {
  /**
   * Not prose. `takeSquare` reads a format — a number, a title, the words, and
   * sometimes a dash-led question — and iOS's helpfulness is destructive here:
   * autocapitalisation changes the first letter of a pasted account, and
   * autocorrect rewrites words it does not know, which in a shared square are
   * the transliterated Sanskrit terms the format is mostly made of.
   */
  it('turns off every correction', () => {
    const paste = field('paste');

    expect(paste).toContain('autoCapitalize="none"');
    expect(paste).toContain('autoCorrect={false}');
    expect(paste).toContain('spellCheck={false}');
  });

  it('is the only one that does', () => {
    // The guard against the settings spreading: prose wants the help.
    expect(field('intention')).not.toContain('autoCorrect={false}');
    expect(field('report')).not.toContain('autoCorrect={false}');
  });
});

describe('every field, whatever it takes', () => {
  it('says which way its language reads', () => {
    /**
     * Arabic and Urdu are two of the twenty-two. A field left at the default
     * puts their text against the wrong margin with the caret in the wrong
     * corner — and `directionOf` has been in `@leela/content` since the docs
     * needed it.
     */
    for (const handle of ['intention', 'report', 'paste']) {
      expect(field(handle), handle).toContain('styles.rightToLeft');
    }

    expect(APP).toContain('directionOf(language)');
    expect(APP, 'the direction is derived, not listed').not.toMatch(/language === 'ar'/);
  });

  it('names the colour its placeholder is drawn in', () => {
    // Left unset, a placeholder takes the platform's grey — a colour this app
    // has never measured, on a field whose background it chose.
    for (const handle of ['intention', 'report', 'paste']) {
      expect(field(handle), handle).toContain('placeholderTextColor={PALETTE.hint}');
    }
  });

  it('draws it in a colour that can be read', () => {
    // A placeholder is the only instruction some of these fields carry.
    expect(contrast(PALETTE.hint, PALETTE.field)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('the direction comes from the language, not from a list', () => {
  it('answers for every language the game is played in', () => {
    for (const language of LANGUAGES) {
      expect(['ltr', 'rtl'], language).toContain(directionOf(language));
    }
  });

  it('has at least one of each, or the rule is untested', () => {
    const directions = new Set(LANGUAGES.map((language) => directionOf(language)));
    expect(directions).toEqual(new Set(['ltr', 'rtl']));
  });
});
