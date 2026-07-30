// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { paintBoard, type ImageLoader } from '../src/paint';

/**
 * A board nobody can read is worse than a plain one.
 *
 * The painting carries the numbers, so once it arrived the squares' own text
 * was hidden. That is right while the image is there, and leaves a blank white
 * rectangle with 72 invisible buttons when it is not — a 147 kB image on a
 * phone on a train is not a certainty.
 *
 * The assertion is not "handle a 404". It is that the plain board is the
 * default and the painting is an upgrade: whatever happens to the image, the
 * squares are readable unless the paint is actually on the board.
 */

const ARRIVES: ImageLoader = async () => true;
const NEVER: ImageLoader = async () => false;

function page(): HTMLElement {
  document.body.innerHTML = '<section id="board"><div class="squares"></div></section>';
  return document.getElementById('board') as HTMLElement;
}

let board: HTMLElement;
beforeEach(() => {
  board = page();
});

describe('when the painting arrives', () => {
  it('goes on the board', async () => {
    await paintBoard(document, '/art.webp', ARRIVES);
    expect(board.style.backgroundImage).toContain('/art.webp');
  });

  it('says so, which is what the stylesheet keys off', async () => {
    expect(await paintBoard(document, '/art.webp', ARRIVES)).toBe(true);
    expect(board.classList.contains('painted')).toBe(true);
  });
});

describe('when it does not', () => {
  it('leaves the board plain rather than blank', async () => {
    expect(await paintBoard(document, '/art.webp', NEVER)).toBe(false);
    expect(board.classList.contains('painted')).toBe(false);
    expect(board.style.backgroundImage).toBe('');
  });

  it('is the state the board starts in, so a slow load is not a blank board', () => {
    // Nothing has been called yet. This is what a player sees for the first
    // few hundred milliseconds, and it has to be a board.
    expect(board.classList.contains('painted')).toBe(false);
  });

  it('does not throw when there is no board to paint', async () => {
    document.body.innerHTML = '';
    await expect(paintBoard(document, '/art.webp', ARRIVES)).resolves.toBe(false);
  });

  it('does not mark the board painted when the loader throws', async () => {
    const angry: ImageLoader = async () => {
      throw new Error('network');
    };
    await expect(paintBoard(document, '/art.webp', angry)).rejects.toThrow();
    expect(board.classList.contains('painted')).toBe(false);
  });
});

describe('the stylesheet keeps its side of it', () => {
  // The class is only worth setting if the CSS reads it. These assert the two
  // rules that make the difference between a readable board and a blank one.
  //
  // Read from the working directory rather than from `import.meta.url`: under
  // happy-dom that is an http URL and `readFileSync` will not take it.
  const style = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');

  it('hides the numbers only on a painted board', () => {
    expect(style).toMatch(/\.board\.painted \.cell \{[^}]*color: transparent/);
    // And the unqualified rule must not, or the default board is unreadable.
    // Matched on the declaration rather than the substring: the same block
    // sets `-webkit-tap-highlight-color: transparent`, which is a different
    // property and a perfectly good one.
    const plain = style.match(/\n\.cell \{[^}]*\}/)?.[0] ?? '';
    expect(plain).not.toMatch(/^\s*color: transparent/m);
    expect(plain).toMatch(/^\s*color: var\(--hint\)/m);
  });

  it('paints the background only when told', () => {
    // No `url(...)` in the stylesheet at all: the image is set from paint.ts,
    // so the load that decides the class is the load the board displays.
    expect(style).not.toMatch(/background[^;]*url\(/);
  });
});
