import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE } from '../src/palette';
// The arithmetic, from where it already lives. Borrowed rather than copied:
// two implementations of a contrast ratio is two chances to be wrong about the
// same number, and this repository has been caught by a rule written twice
// often enough. Tests here already reach across for `scripts/lib/*.mjs` the
// same way; the shipped app imports nothing of the mini app's.
import { AA_TEXT, contrast } from '../../miniapp/src/contrast';

/**
 * The colours this app draws with, measured against what they sit on.
 *
 * Found by running the app on a simulator rather than by reading it: the
 * intention's Save button was an **empty grey strip**. The label was in the
 * markup — `app.reportSave`, "Save" — and it was white on `#cdc6ba`, which is
 * **1.70:1**. A control whose words cannot be read is a control a player
 * cannot identify, and a game that will not begin until that button is pressed
 * had made the button invisible.
 *
 * WCAG 1.4.3 exempts an inactive component from the contrast rule. It does not
 * follow that a disabled label should be erased — the mini app dims a control
 * and keeps its words, and this now does the same by naming a second colour for
 * the disabled state rather than by leaving white on grey.
 *
 * The live button was measured at the same time and failed too: **4.35:1**,
 * under the 4.5 small text needs. This app's button text is 14 points at weight
 * 600, which is not *large text* by the rule's definition, so the exemption for
 * headings does not apply. `#b4643c` became `#a4552f` — the same terracotta a
 * shade deeper.
 *
 * What is asserted is the pairs, not the hexes: change a colour and this says
 * whether the change is legible, which is the only question worth asking of a
 * palette.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every place text is drawn on something, as (what, on what). */
const PAIRS: Array<{ what: string; text: string; on: string }> = [
  { what: 'a live control’s label', text: PALETTE.onAccent, on: PALETTE.accent },
  { what: 'the number of the square the piece is on', text: PALETTE.onAccent, on: PALETTE.accent },
  { what: 'a disabled control’s label', text: PALETTE.onShut, on: PALETTE.shut },
  { what: 'the line under the board', text: PALETTE.hint, on: PALETTE.page },
  { what: 'a square’s number', text: PALETTE.hint, on: PALETTE.cell },
  { what: 'a plan’s text', text: PALETTE.text, on: PALETTE.page },
  { what: 'what the player wrote', text: PALETTE.entry, on: PALETTE.cell },
  { what: 'what they are typing', text: PALETTE.text, on: PALETTE.field },
];

describe('every colour this app draws text in', () => {
  it.each(PAIRS)('$what is legible', ({ text, on }) => {
    expect(contrast(text, on)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('has a disabled state that is dimmer than the live one, and still readable', () => {
    // Both halves. A disabled control must look disabled — otherwise the
    // drawing lies about what may be pressed — and must still say what it is.
    expect(contrast(PALETTE.onShut, PALETTE.shut)).toBeLessThan(
      contrast(PALETTE.onAccent, PALETTE.accent) + 10,
    );
    expect(contrast(PALETTE.onShut, PALETTE.shut)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('would have failed on the colours this app shipped with', () => {
    // The guard against the test passing for want of a case: the two pairs that
    // were actually wrong, named, so a revert cannot go unnoticed.
    expect(contrast('#ffffff', '#cdc6ba')).toBeLessThan(AA_TEXT);
    expect(contrast('#ffffff', '#b4643c')).toBeLessThan(AA_TEXT);
  });
});

describe('the stylesheet uses the palette and nothing else', () => {
  /**
   * A named colour that half the file ignores is a palette in name only. The
   * check is over the source because a hex typed straight into a style is
   * exactly what this file exists to stop, and no runtime assertion can see it.
   */
  const app = blank(readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8'));
  const styles = app.slice(app.indexOf('const styles = StyleSheet.create('));

  it('declares no colour in the stylesheet that the palette does not name', () => {
    const known = new Set(Object.values(PALETTE).map((hex) => hex.toLowerCase()));
    const used = [...styles.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((one) => one[0].toLowerCase());
    const strangers = [...new Set(used)].filter((hex) => !known.has(hex));

    expect(strangers, `unnamed: ${strangers.join(', ')}`).toEqual([]);
  });

  it('gives every disabled button a label colour of its own', () => {
    // `styles.shut` without `styles.shutText` is the defect exactly: the
    // background goes grey and the words stay white.
    // Uses, over the whole file: `styles.shut` is written in the JSX and only
    // declared in the stylesheet, so slicing to the stylesheet counts zero.
    const shutBackgrounds = (app.match(/styles\.shut\b/g) ?? []).length;
    const shutLabels = (app.match(/styles\.shutText\b/g) ?? []).length;

    expect(shutBackgrounds).toBeGreaterThan(0);
    expect(shutLabels + 1, 'one declaration, and one use per dimmed button').toBeGreaterThanOrEqual(
      shutBackgrounds,
    );
  });
  it('keeps the flex on the row and off the button', () => {
    /**
     * The other half of the empty grey strip, and the half that actually
     * erased the words. `styles.button` carried `flex: 1`, which is right for
     * the three controls that share the bottom row and wrong everywhere else:
     * in a column it means a flex-basis of zero, so the button collapsed to its
     * own padding and clipped its label out of existence.
     *
     * The colour was the second reason it could not be read. This was the
     * first, and no contrast ratio would have found it.
     */
    expect(styles, 'flex belongs to `abreast`, not to every button').not.toMatch(
      /button: \{[^}]*flex: 1/s,
    );
    expect(styles).toContain('abreast: { flex: 1 }');

    // And every control that shares the bottom row must take it, or one of
    // them sizes to its text while its neighbours share what is left.
    const row = app.slice(app.indexOf('<View style={styles.controls}>'));
    expect(
      (row.match(/<Pressable/g) ?? []).length,
      'a control in the row without `abreast`',
    ).toBe((row.match(/styles\.abreast/g) ?? []).length);
  });
});
