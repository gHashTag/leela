import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { blank } from '../../../scripts/lib/source.mjs';

import { LOOK_KEY } from '../src/look';

/**
 * The three settings, in the header, exactly once each.
 *
 * They stood in the row with the die — three controls a player touches once,
 * between the two they touch every turn — and moving them up was a cut and a
 * paste. The cut ran second and matched the text the paste had just written, so
 * it took the lotus and the language out of *both* places: the page shipped
 * with neither, and `main.ts` throws on the first `need('#lotus')`, which is a
 * blank screen rather than a missing button.
 *
 * Read from the markup rather than rendered, because that is where the mistake
 * was and no runtime was needed to make it.
 */

/**
 * Comments stripped, and stripped *as HTML*.
 *
 * The rule `source.test.ts` enforces across the repository, and it has already
 * been earned here twice: a check that a dialog had a way out was satisfied by
 * a way out written in a comment. A settings block described in prose reads
 * exactly like a settings block.
 */
const PAGE = blank(readFileSync(join(__dirname, '..', 'index.html'), 'utf8'), 'html');

/** The header, from its opening tag to its close. */
const header = (): string => {
  const from = PAGE.indexOf('<header');
  const to = PAGE.indexOf('</header>');
  return from === -1 || to === -1 ? '' : PAGE.slice(from, to);
};

/** Every control `main.ts` insists on finding, by the id it looks for. */
const SETTINGS = ['lotus', 'tongue', 'look'] as const;

/** The one mark they are all behind. */
const GEAR = 'gear';

describe('the settings', () => {
  it('reads a header, so the checks below are about something', () => {
    // The reader itself can go wrong: a renamed tag would make every assertion
    // pass on an empty string.
    expect(header().length).toBeGreaterThan(0);
    expect(header()).toContain('plan-number');
  });

  it('are in the header, where they were moved to', () => {
    for (const id of [...SETTINGS, GEAR]) {
      expect(header(), `#${id} belongs in the header`).toContain(`id="${id}"`);
    }
  });

  it('are behind one mark, which says what it opens', () => {
    // Three pills across the top competed with the plan's own name for a line
    // already truncated on a phone. One mark, and the rest behind it - and the
    // mark has to name the panel, or a reader who cannot see it is told there
    // is a menu and not where it went.
    expect(header()).toMatch(/id="gear"[\s\S]*?aria-controls="settings"/);
    expect(header()).toMatch(/id="settings"[^>]*hidden/);

    const from = PAGE.indexOf('id="settings"');
    const menu = PAGE.slice(from, PAGE.indexOf('</div>', PAGE.indexOf('id="look"')));
    for (const id of SETTINGS) {
      expect(menu, `#${id} lives inside the menu`).toContain(`id="${id}"`);
    }
  });

  it('exist once each, so the page cannot ship with none of them', () => {
    // `main.ts` calls `need('#lotus')` and throws when it finds nothing, which
    // is a blank page. Two would be worse than none: `querySelector` takes the
    // first and the second is a dead control nobody can explain.
    for (const id of SETTINGS) {
      const found = PAGE.match(new RegExp(`id="${id}"`, 'g')) ?? [];
      expect(found.length, `#${id}`).toBe(1);
    }
  });

  it('are out of the row with the die, which is the point of moving them', () => {
    const from = PAGE.indexOf('<div class="play">');
    const to = PAGE.indexOf('</div>', from);
    const play = from === -1 ? '' : PAGE.slice(from, to);

    expect(play).toContain('id="die"');
    for (const id of SETTINGS) {
      expect(play, `#${id} left the die's row`).not.toContain(`id="${id}"`);
    }
  });
});

describe('the light, before the first paint', () => {
  it('is decided in the head, not after the bundle', () => {
    // The stylesheet's defaults are the dark tokens and `main.ts` sets
    // `data-look` when it runs, so a light reader met a black page for as long
    // as the bundle took to parse. Anything deferred is after the paint this
    // exists to fix.
    const head = PAGE.slice(0, PAGE.indexOf('</head>'));
    // `dataset.look`, which is how the attribute is written from a script -
    // the first version of this asserted the CSS spelling `data-look` and
    // failed on a page that was doing exactly the right thing.
    expect(head).toContain('dataset.look');
    expect(head).toContain('prefers-color-scheme');
    // And the promise the browser paints from before any rule is read: `dark`
    // alone fills the first frame with the user agent's dark background.
    expect(head).toContain('content="light dark"');
  });

  it('reads the key `look.ts` writes', () => {
    // The one thing that can drift between the inline script and the module:
    // a different string here is a page that ignores the choice the settings
    // menu just saved.
    expect(PAGE).toContain(`'${LOOK_KEY}'`);
  });
});

describe('the reasoning, as it is shown', () => {
  const CSS = blank(readFileSync(join(__dirname, '..', 'src', 'style.css'), 'utf8'), 'css');

  /** One rule's body, by selector. */
  const ruleFor = (selector: string): string => {
    const at = CSS.indexOf(`${selector} {`);
    return at === -1 ? '' : CSS.slice(at, CSS.indexOf('}', at));
  };

  it('reads top to bottom', () => {
    // `flex-direction: column-reverse` is the trick that pins the newest line
    // without a script, and it was the wrong tool twice: it reverses the order
    // its children are *painted* in, so a reasoning appended in order came out
    // bottom to top - and it takes the choice away from a reader who wants to
    // scroll up. `follow.ts` decides instead.
    expect(ruleFor('.thinking-text')).not.toContain('column-reverse');
  });

  it('is a scroller with a ceiling, so it cannot push the answer off screen', () => {
    const rule = ruleFor('.thinking-text');
    expect(rule).toContain('overflow-y: auto');
    expect(rule).toMatch(/max-height:\s*\d+dvh/);
  });

  it('does not share a class name with the waiting dots', () => {
    // `.thinking` was already the three dots shown before the first token. A
    // second rule under one name is not a style, it is a collision waiting for
    // whichever loads last - and the two inherited each other's padding.
    const dots = ruleFor('.thinking');
    expect(dots).toContain('gap');
    expect(CSS).toContain('.reasoning {');
  });
});
