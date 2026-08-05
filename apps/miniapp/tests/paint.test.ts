// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { blank } from '../../../scripts/lib/source.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { boardFor, paintBoard, type ImageLoader } from '../src/paint';

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
    // As a variable: the stylesheet draws the art in a layer of its own,
    // lifted off the grid the way the published app lifts it.
    expect(board.style.getPropertyValue('--board-art')).toContain('/art.webp');
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
    expect(board.style.getPropertyValue('--board-art')).toBe('');
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
  // As a stylesheet. Commented out whole, `.cell.win { color: transparent }`
  // still satisfied the assertion below -- so the rule that keeps the Flower
  // of Life from having a number painted over it could be deleted in place.
  const style = blank(readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8'), 'css');

  it('keeps the numbers on both boards, because the painting has none', () => {
    // The published app writes every number itself over art that carries only
    // the snakes and the arrows. The first attempt used the rules-screen
    // illustration, which has the numbers baked in, and hid the app's own.
    const plain = style.match(/\n\.cell \{[^}]*\}/)?.[0] ?? '';
    expect(plain).toMatch(/^\s*color: var\(--hint\)/m);
    expect(style).not.toMatch(/\.board\.painted \.cell \{[^}]*color: transparent/);

    // Two squares are deliberately blank: the one the player stands on, where
    // the gem goes, and 68, where the Flower of Life is already painted.
    expect(style).toMatch(/\.board \.cell\.here \{[^}]*color: transparent/);
    expect(style).toMatch(/\.cell\.win \{[^}]*color: transparent/);
  });

  it('paints the background only when told', () => {
    // No `url(...)` in the stylesheet at all: the image is set from paint.ts,
    // so the load that decides the class is the load the board displays.
    expect(style).not.toMatch(/background[^;]*url\(/);
  });
});

describe('which of the two boards', () => {
  // The published app carries the snakes on white and the same snakes on black
  // behind Leela herself, and picks by colour scheme. The assertion is that
  // the choice follows the scheme, not that a particular file is named.
  const art = { light: '/light.webp', dark: '/dark.webp' };

  it('follows the scheme', () => {
    expect(boardFor('light', art)).toBe(art.light);
    expect(boardFor('dark', art)).toBe(art.dark);
  });

  it('never returns nothing, whatever it is handed', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(boardFor(scheme, art).length).toBeGreaterThan(0);
    }
  });
});
