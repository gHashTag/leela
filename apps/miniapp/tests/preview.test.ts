import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe as group, expect, it } from 'vitest';
// One blanker, not five: a claim about source text has to be made about code.
import { blank } from '../../../scripts/lib/source.mjs';
// Shared with `scripts/audit-preview.mjs`, which is plain JavaScript. The rule
// lives in one place and both the gate and this file read it from there.
import {
  CARD,
  CARD_SIZE,
  ICON,
  ICON_SIZE,
  MUST_AGREE,
  checkPicture,
  disagreementsBetween,
  missingFrom,
  previewOf,
  sizeOfPng,
  sizeOfWebp,
} from '../../../scripts/lib/preview.mjs';

/**
 * What a chat is given when somebody sends a link to the game.
 *
 * `audit-preview.mjs` is the gate; this is the check on the gate. Everything
 * here feeds it something wrong and requires it to say so, because an audit
 * that has only ever been shown correct input has not been shown to work — and
 * this repository has caught three of its own guards failing to fail.
 *
 * The audit reads the two real heads. This file reads made-up ones, so that
 * fixing a page cannot quietly turn a rule off.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** A head with everything, as the two real ones now have it. */
const WHOLE = `
  <meta name="description" content="The game of self-knowledge — 72 plans, in 22 languages." />
  <link rel="canonical" href="https://t27.ai/leela/" />
  <meta property="og:site_name" content="Leela" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Leela" />
  <meta property="og:description" content="The game of self-knowledge — 72 plans, in 22 languages." />
  <meta property="og:url" content="https://t27.ai/leela/" />
  <meta property="og:image" content="https://t27.ai/leela/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="The board's snakes and arrows." />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="https://t27.ai/leela/icon.png" />
  <link rel="apple-touch-icon" href="https://t27.ai/leela/icon.png" />
`;

group('reading a head', () => {
  it('finds a tag however its attributes are ordered', () => {
    // Both orders are the same tag to a scraper. A reader that knows only the
    // first would report a page as missing something it plainly carries, and
    // the fix for that false alarm would be to delete the check.
    const backwards = '<meta content="website" property="og:type" />';

    expect(previewOf(backwards)['og:type']).toBe('website');
    expect(previewOf('<meta property="og:type" content="website" />')['og:type']).toBe('website');
  });

  it('finds a link however its attributes are ordered', () => {
    expect(previewOf('<link href="/i.png" rel="icon" />').icon).toBe('/i.png');
    expect(previewOf('<link rel="icon" href="/i.png" />').icon).toBe('/i.png');
  });

  it('reports an absent tag as null rather than leaving the key out', () => {
    // The audit compares two heads field by field. "Both are null" has to be a
    // comparison that happens, not two lookups that both quietly find nothing.
    expect(previewOf('')['og:image']).toBeNull();
    expect('og:image' in previewOf('')).toBe(true);
  });
});

group('a head that is not ready to be shared', () => {
  it('is content with the whole set', () => {
    expect(missingFrom(previewOf(WHOLE))).toEqual([]);
  });

  it('names the picture when it is gone, one tag at a time', () => {
    const without = WHOLE.replace(/<meta property="og:image" content="[^"]*" \/>/, '');

    expect(missingFrom(previewOf(without))).toEqual(['og:image']);
  });

  it('names the icon when it is gone', () => {
    const without = WHOLE.replace(/<link rel="icon"[^>]*>/, '');

    expect(missingFrom(previewOf(without))).toEqual(['icon']);
  });

  it('counts an empty content as absent, because a chat cannot show it', () => {
    const empty = WHOLE.replace('content="summary_large_image"', 'content=""');

    expect(missingFrom(previewOf(empty))).toEqual(['twitter:card']);
  });
});

group('two pages of one game', () => {
  it('is content when they name the same files and places', () => {
    expect(disagreementsBetween(previewOf(WHOLE), previewOf(WHOLE))).toEqual([]);
  });

  it('catches two pages pointing at two pictures', () => {
    // THE DEFECT THIS WHOLE FILE EXISTS FOR. Nothing about a page naming
    // `og2.png` looks wrong on that page; it is only wrong beside the other
    // one, and only a check holding both at once can see it.
    const other = previewOf(WHOLE.replace('leela/og.png', 'leela/og2.png'));
    const found = disagreementsBetween(previewOf(WHOLE), other);

    expect(found).toHaveLength(1);
    expect(found[0].tag).toBe('og:image');
    expect(found[0].andSaid).toBe('https://t27.ai/leela/og2.png');
  });

  it('catches a page that simply has none of it', () => {
    expect(disagreementsBetween(previewOf(WHOLE), previewOf('')).length).toBe(MUST_AGREE.length);
  });

  it('lets the two titles differ, because one is the board in three dimensions', () => {
    /*
     * A rule that titles must agree would be a rule against ever telling the
     * two boards apart, and it would have to be broken on the day it was
     * written — the 3D page's title says so in words. What must not differ is
     * everything naming a FILE or a PLACE.
     */
    const renamed = previewOf(
      WHOLE.replace(
        '<meta property="og:title" content="Leela" />',
        '<meta property="og:title" content="Leela — the board in three dimensions" />',
      ),
    );

    expect(disagreementsBetween(previewOf(WHOLE), renamed)).toEqual([]);
    expect(MUST_AGREE).not.toContain('og:title');
    expect(MUST_AGREE).not.toContain('og:description');
  });
});

group('the picture a head promises', () => {
  const promise = { said: CARD, width: '1200', height: '630' };

  it('reads a real PNG\'s size out of its own header', () => {
    // The committed card, not a fixture: an invented PNG header would prove
    // this function reads invented PNG headers.
    expect(sizeOfPng(readFileSync(join(ROOT, CARD)))).toEqual(CARD_SIZE);
  });

  it('refuses an error page saved under a picture\'s name', () => {
    /*
     * What a broken deploy actually leaves behind, and the reason this reads
     * bytes instead of trusting a file extension. `null` rather than a guess.
     */
    expect(sizeOfPng(Buffer.from('<html>404</html>'))).toBeNull();
    expect(checkPicture(promise, Buffer.from('<html>404</html>'))[0]).toMatch(/not a PNG/);
  });

  it('refuses a file too short to hold a header', () => {
    expect(sizeOfPng(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  it('complains when the picture is not there at all', () => {
    // A DEAD LINK IS WORSE THAN NO LINK: no `og:image` gets a plain text
    // preview, while an `og:image` that 404s gets a card with a broken picture
    // in it — and every scraper caches that.
    expect(checkPicture(promise, null)[0]).toMatch(/not on disk/);
  });

  it('complains when the head claims a size the file does not have', () => {
    const lying = { said: CARD, width: '1200', height: '600' };

    expect(checkPicture(lying, readFileSync(join(ROOT, CARD)))[0]).toMatch(/says 1200×600/);
  });

  it('is content with the committed card', () => {
    expect(checkPicture(promise, readFileSync(join(ROOT, CARD)))).toEqual([]);
  });
});

group('the files themselves', () => {
  it('draws the card at the size every scraper crops to', () => {
    expect(sizeOfPng(readFileSync(join(ROOT, CARD)))).toEqual({ width: 1200, height: 630 });
  });

  it('draws the icon square, at the apple-touch size', () => {
    expect(sizeOfPng(readFileSync(join(ROOT, ICON)))).toEqual({
      width: ICON_SIZE,
      height: ICON_SIZE,
    });
  });

  it('is drawn on the painting that is still that shape', () => {
    /*
     * `make-card.mjs` places the fade at 714 − 200 because the painting is
     * 714 wide, and lays it at native size because it is 630 tall — exactly the
     * card's height. Repainted at another size the fade would land in the wrong
     * column and the card would come out with a hard edge down it, which is
     * what the first draft looked like and took a pixel sample to name.
     *
     * THE FIRST VERSION OF THIS ASSERTED A BYTE LENGTH, AND THE NUMBER WAS
     * INVENTED — 190,082 against a file of 40,294. It would have been the wrong
     * test even had the number been right: what the card depends on is the
     * painting's shape, and a byte count goes red on a re-encode that changes
     * nothing and stays green on a crop that changes everything.
     */
    const painting = readFileSync(join(ROOT, 'apps/miniapp/src/board-dark.webp'));

    expect(sizeOfWebp(painting)).toEqual({ width: 714, height: 630 });
  });

  it('keeps the card\'s colours the ones the board uses', () => {
    /*
     * The card is drawn by a script that cannot import a stylesheet, so three
     * hex strings are written out in it by hand. This is the thing that holds
     * them in step: `make-card.mjs` says so in a comment, and a comment
     * claiming a test exists is worth nothing unless the test does.
     *
     * `--bg` is deliberately NOT among them — the card's ground is the
     * painting's `#1c1c1c`, and the script says at length why.
     */
    // BLANKED, and not as a formality: `#1c1c1c` and `#000000` both appear in
    // that script's comments, where they are being explained rather than used.
    // Unblanked, this would pass on a prose mention of a colour nothing draws.
    const card = blank(readFileSync(join(ROOT, 'scripts/make-card.mjs'), 'utf8'), 'js');
    const style = blank(readFileSync(join(ROOT, 'apps/webgl/src/style.css'), 'utf8'), 'css');

    for (const [token, hex] of [
      ['--text', '#ffffff'],
      ['--hint', '#888888'],
      ['--golden', '#ffd700'],
    ]) {
      expect(style, `${token} in the stylesheet`).toContain(`${token}: ${hex};`);
      expect(card, `${hex} on the card`).toContain(`'${hex}'`);
    }
  });
});
