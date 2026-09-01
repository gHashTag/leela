/**
 * The phone cutting a chapter the way the format says.
 *
 * `piecesOf` in `@leela/content` decides what a paragraph is for all three
 * surfaces: it splits a heading away from the prose written under it on the
 * next line, drops a line that is only hashes, and hands back the heading's
 * words without them. Before it existed this app put the whole body of a
 * chapter into one block, so a reader met `## দ্বিতীয় চক্রে (স্বাধিষ্ঠান)`
 * with the marks still on it, in nineteen languages.
 *
 * That was repaired, and **nothing would notice it coming back**. Measured:
 * replacing `piecesOf(chapter.body)` with the raw body leaves all three hundred
 * and sixty-six of this package's tests passing. A rule that lives in a shared
 * package needs the surfaces' use of it asserted too, or reverting the use
 * proves nothing.
 *
 * The book proves the same thing by what it renders. This app cannot be
 * rendered here — `react-native` does not load under vitest without a preset —
 * so the claim is made about the source, and made the way this package makes
 * such claims: with the comments taken out first, so a line describing the
 * repair cannot stand in for the repair.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// The audits' comment stripper, so a claim about source text is about code.
import { blank } from '../../../scripts/lib/source.mjs';
import { piecesOf } from '@leela/content';

const APP = blank(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'App.tsx'), 'utf8'),
);

describe('the chapter a reader opens on the phone', () => {
  it('is cut by the format rather than by this file', () => {
    // Not *the import exists* — an import with no call is what the source-text
    // check that missed this would have accepted. The body has to go through
    // it.
    expect(APP).toMatch(/piecesOf\(\s*chapter\.body\s*\)/);
  });

  it('draws what comes back rather than the body it was handed', () => {
    // The other half of the same claim: whatever the format returns is what is
    // put on the screen. A file that called `piecesOf` and then rendered
    // `chapter.body` anyway would pass the assertion above.
    const chapterBody = [...APP.matchAll(/\{\s*chapter\.body\s*\}/g)];

    expect(chapterBody).toEqual([]);
  });

  it('is a rule about something the texts actually do', () => {
    // If no shipped chapter were written with a heading, every assertion here
    // would be about a case that never arrives.
    const glued = piecesOf('#### Первая чакра\nрасположена в основании');

    expect(glued).toHaveLength(2);
    expect(glued[0]?.heading?.level).toBe(4);
    expect(glued[0]?.text).toBe('Первая чакра');
    expect(glued[1]?.text).toBe('расположена в основании');
  });
});
