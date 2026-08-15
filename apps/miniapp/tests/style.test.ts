import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blank } from '../../../scripts/lib/source.mjs';

/**
 * This package's root, taken from this file's own location rather than from the
 * working directory.
 *
 * Seven suites in this directory used to read their fixtures through
 * `process.cwd()`. That works while Vitest is started inside `apps/miniapp` and
 * throws ENOENT the moment the same file is collected from anywhere else — a
 * repository-root run, a coverage pass over all ten workspaces — and the
 * measured symptom was `ENOENT /Users/playra/leela/src/state.ts`. Both reads
 * below are at module scope, so this file did not fail from the root: it
 * reported no cases at all. The long version is at the top of
 * `partly-written.test.ts`, which is also where the guard against it lives.
 */
const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * What a phone does to a field it thinks is too small to read.
 *
 * iOS Safari zooms the whole page in when a field is focused whose text is
 * under sixteen pixels. The stylesheet had no `textarea` rule at all, so both
 * writers used the browser's default — and on an iPhone the report dialog has
 * been magnifying the board and clipping itself off the right-hand edge since
 * the day it was written.
 *
 * It does not happen in a desktop browser. Weeks of looking at this app in one
 * never showed it; a screenshot from a simulator did, in a second.
 */

// Comments out first: `[^{}]+` before a `{` otherwise swallows the paragraph
// above the rule, and a selector with an essay in front of it matches nothing.
// Through the shared blanker rather than a fourth stripper written here -- and
// blanked rather than removed, so an index into this is an index into the file.
const STYLE = blank(readFileSync(resolve(PACKAGE, 'src/style.css'), 'utf8'), 'css');
// As a document. A selector named only inside an HTML comment is not on the
// page, and this file's whole question is which of them are.
const HTML = blank(readFileSync(resolve(PACKAGE, 'index.html'), 'utf8'), 'html');

/** Every selector's declarations, as text. */
function rulesFor(selector: string): string[] {
  const found: string[] = [];
  for (const [, selectors, body] of STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const names = selectors.split(',').map((name) => name.trim());
    if (names.some((name) => name === selector || name.endsWith(` ${selector}`))) {
      found.push(body);
    }
  }
  return found;
}

const fontSizeIn = (body: string): number | null => {
  const match = body.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : null;
};

describe('fields a person types into', () => {
  /** The threshold iOS Safari zooms below. */
  const NO_ZOOM_PX = 16;

  it('exist in the markup, so this test has a subject', () => {
    // The check is worth nothing if the app stops having fields and nobody
    // notices this quietly passing.
    expect(HTML).toMatch(/<textarea/);
  });

  it('are styled at all, rather than left to the browser', () => {
    expect(rulesFor('textarea').length).toBeGreaterThan(0);
  });

  it('ask for a size a phone will not zoom in on', () => {
    // The rule, over every kind of field: whatever is styled, it is at least
    // the threshold. An `input` added later has to clear the same bar.
    for (const selector of ['textarea', 'input']) {
      for (const body of rulesFor(selector)) {
        const size = fontSizeIn(body);
        if (size === null) continue;
        expect(size, `${selector}: ${size}px`).toBeGreaterThanOrEqual(NO_ZOOM_PX);
      }
    }
  });

  it('do not lose it to a later rule that shrinks the text', () => {
    // A rule further down wins. If one ever sets a smaller size on a field,
    // the page zooms again and nothing else in this file would notice.
    const shrinking = [...STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors, body]) => {
      const size = fontSizeIn(body);
      return (
        size !== null &&
        size < NO_ZOOM_PX &&
        /\b(textarea|input)\b/.test(selectors)
      );
    });

    expect(shrinking.map(([, selectors]) => selectors.trim())).toEqual([]);
  });
});
