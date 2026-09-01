import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe as group, expect, it } from 'vitest';

import { blank } from '../../../scripts/lib/source.mjs';

/**
 * The row of buttons under every sheet, and where it sits.
 *
 * FOUND BY OPENING THE CLASSIC BOARD ON A PHONE. The first thing a new player
 * meets is *"What are you playing for?"*, and its Save button stood flush
 * against the sheet's left edge while the question above it was inset — a
 * rounded pill touching the corner. Measured at 375 CSS pixels on 2026-08-29:
 * the article's content began at 37 and the buttons at 19, **in all five
 * dialogs, off by exactly 18 — the article's own padding.**
 *
 * `.sheet-controls` is a SIBLING of `<article>`, which is deliberate: the
 * article scrolls and the buttons must not. The cost is that it does not
 * inherit the inset, and nothing had ever told it.
 *
 * Geometry cannot be measured here — there is no layout engine in this suite,
 * which is exactly why the defect survived. What CAN be held is the rule the
 * geometry follows: **one declared inset, used by both.** A number written
 * twice is the shape this repository keeps finding, and here one of the two
 * copies was simply absent.
 */

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STYLE = blank(readFileSync(resolve(PACKAGE, 'src/style.css'), 'utf8'), 'css');
const PAGE = blank(readFileSync(resolve(PACKAGE, 'index.html'), 'utf8'), 'html');

/** One rule's body, by selector. */
const bodyOf = (selector: string): string => {
  const found = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 's').exec(
    STYLE,
  );

  return found?.[1] ?? '';
};

group('the buttons under a sheet', () => {
  it('is inset by the same declaration as the words above it', () => {
    /*
     * Not "by the same NUMBER" — by the same declaration. Two rules agreeing
     * on 18 today is how they come to disagree tomorrow, and the version of
     * this defect that shipped was one rule at 18 and one at nothing.
     */
    expect(bodyOf('.reader article'), 'the article').toMatch(/padding:\s*var\(--sheet-pad\)/);
    expect(bodyOf('.sheet-controls'), 'the buttons').toMatch(/padding:[^;]*var\(--sheet-pad\)/);
  });

  it('declares that inset once, and it is a real length', () => {
    const declared = /--sheet-pad:\s*([^;]+);/.exec(STYLE);

    expect(declared, 'declared at all').not.toBeNull();
    expect(declared?.[1]?.trim()).toMatch(/^\d+px$/);
    expect(STYLE.match(/--sheet-pad:/g), 'declared once').toHaveLength(1);
  });

  it('keeps the row out of the scrolling article, which is why it needs telling', () => {
    /*
     * The structural fact the whole thing rests on. If somebody moves the
     * footer inside the article the padding above becomes a double inset, and
     * this says so before the screen does.
     */
    for (const dialog of PAGE.matchAll(/<dialog\b[\s\S]*?<\/dialog>/g)) {
      const markup = dialog[0];
      if (!markup.includes('sheet-controls')) continue;

      const article = markup.indexOf('</article>');
      const controls = markup.indexOf('sheet-controls');

      expect(article, 'the sheet has an article').toBeGreaterThan(-1);
      expect(controls, 'the buttons come after it, not inside it').toBeGreaterThan(article);
    }
  });

  it('lets a form-wrapped button be a button, so a hidden one takes no room', () => {
    /*
     * `<form method="dialog"><button>Close</button></form>` is how a sheet
     * closes without script, and as a flex item that wrapper took a share of
     * the row. In `intention` — where `main.ts` hides the BUTTON so a player
     * who has not said what they are playing for cannot leave — the empty form
     * went on holding 28 pixels, measured: Save came out 28 short with a gap
     * beside it, on the very first screen of the game.
     *
     * `hidden` hides the button. It does not hide the element around it.
     */
    expect(bodyOf('.sheet-controls form')).toMatch(/display:\s*contents/);
  });

  it('is a real arrangement, not a rule about nothing', () => {
    /*
     * The sweep that keeps the three above honest. Every one of them reads a
     * selector out of the stylesheet, and a renamed class would turn all four
     * green over an empty string — the vacuous-guard shape this repository has
     * been caught by before.
     */
    const sheets = [...PAGE.matchAll(/class="sheet-controls"/g)];

    expect(sheets.length, 'sheets that carry a button row').toBeGreaterThanOrEqual(5);
    expect(bodyOf('.sheet-controls'), 'the rule is found').not.toBe('');
    expect(bodyOf('.reader article'), 'the article rule is found').not.toBe('');
    expect(PAGE, 'a form-wrapped close still exists to be un-boxed').toMatch(
      /<form method="dialog">\s*<button/,
    );
  });
});
