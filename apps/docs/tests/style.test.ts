import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { STYLE } from '../src/style';

/**
 * A stylesheet written in left and right is written for half the readers.
 *
 * Two of the twenty-two languages here read right to left. The pages have
 * declared `dir` since they were written, which reorders the layout — and then
 * `text-align: right` on the plan numbers put them against the far edge of an
 * Arabic page with the gap in the middle, because a physical direction does
 * not follow `dir`.
 *
 * The assertion is the rule, not the two places that broke it: a physical
 * direction in a stylesheet is a claim that the reader's script is Latin.
 */

/**
 * Properties whose physical form ignores `dir`.
 *
 * `inset` is here because it was not, and the mini app used it the week after
 * this audit was written. Its four-value form is top/right/bottom/left — as
 * physical as the four properties it stands for, and invisible to a check that
 * only looked for their names.
 */
const PHYSICAL =
  /(?:^|[;{\s])(text-align\s*:\s*(?:left|right)|(?:margin|padding|border)-(?:left|right)\b|inset\s*:|(?:^|\s)(?:left|right)\s*:)/;

/** Every rule in a stylesheet, as `selector { body }`. */
function rulesOf(css: string): { selector: string; body: string }[] {
  // Comments first: `/* ... right ... */` is prose, not a property.
  // The shared blanker: it keeps the offsets and guards a `//` inside a URL,
  // and it is the one this repository writes down once rather than five times.
  const withoutComments = blank(css);
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim().replace(/\s+/g, ' '),
    body: match[2].trim(),
  }));
}

describe('the stylesheet does not assume which way the page reads', () => {
  it('uses no physical direction outside a rule that names one', () => {
    // A rule already scoped to `[dir='rtl']` or `[dir='ltr']` has said which
    // direction it is for, so a physical value in it is deliberate.
    const offenders = rulesOf(STYLE)
      .filter((rule) => !rule.selector.includes('[dir='))
      .filter((rule) => PHYSICAL.test(rule.body))
      .map((rule) => `${rule.selector} { ${rule.body.replace(/\s+/g, ' ')} }`);

    expect(offenders).toEqual([]);
  });

  it('finds one when there is one, so an empty list means something', () => {
    // The check above passes on the shipped stylesheet. A check that has only
    // ever been asked about a passing case has not been shown to fail.
    const bad = 'ol.plans .n { text-align: right; }';
    expect(rulesOf(bad).filter((rule) => PHYSICAL.test(rule.body))).toHaveLength(1);

    for (const property of [
      '.a { margin-left: 1px; }',
      '.a { padding-right: 1px; }',
      '.a { border-left: 1px solid; }',
      '.a { position: absolute; left: 0; }',
      '.a { text-align: left; }',
      '.a { inset: 1% 2% 3% 4%; }',
    ]) {
      expect(rulesOf(property).filter((r) => PHYSICAL.test(r.body)), property).toHaveLength(1);
    }
  });

  it('does not mistake a logical value for a physical one', () => {
    for (const good of [
      '.a { text-align: start; }',
      '.a { text-align: end; }',
      '.a { margin-inline-start: 1px; }',
      '.a { padding-inline-end: 1px; }',
      '.a { inset-inline-start: 0; }',
      '.a { inset-block: 0; }',
      '.a { text-align: center; }',
    ]) {
      expect(rulesOf(good).filter((r) => PHYSICAL.test(r.body)), good).toHaveLength(0);
    }
  });

  it('does not read a comment as a property', () => {
    const commented = '/* aligned right, once */\n.a { text-align: end; }';
    expect(rulesOf(commented).filter((r) => PHYSICAL.test(r.body))).toHaveLength(0);
  });
});

describe('the mini app is held to the same rule', () => {
  // Read from disk rather than imported: it is a real stylesheet, and a copy
  // in a test would be the thing under test lying about itself.
  const css = blank(readFileSync(new URL('../../miniapp/src/style.css', import.meta.url), 'utf8'), 'css');

  /**
   * One exception, with a reason.
   *
   * The board is pinned `dir="ltr"` — it is a diagram, and mirroring it moves
   * plan 1 to the other corner — so inside it, physical *is* logical.
   * `.squares` is the grid of hit targets inset over the painting, and
   * `.cell .mark` the snake or arrow glyph in a square's corner.
   */
  const INSIDE_THE_BOARD = /(^|\s|,)\.(cell|squares)\b/;

  it('uses no physical direction outside the board', () => {
    const offenders = rulesOf(css)
      .filter((rule) => !rule.selector.includes('[dir='))
      .filter((rule) => !INSIDE_THE_BOARD.test(rule.selector))
      .filter((rule) => PHYSICAL.test(rule.body))
      .map((rule) => rule.selector);

    expect(offenders).toEqual([]);
  });

  it('still has the one inside the board, so the exception is not stale', () => {
    // If this ever fails, the exception above has outlived its reason and
    // should go rather than sit there excusing nothing.
    const inside = rulesOf(css)
      .filter((rule) => INSIDE_THE_BOARD.test(rule.selector))
      .filter((rule) => PHYSICAL.test(rule.body));
    expect(inside.length).toBeGreaterThan(0);
  });
});
