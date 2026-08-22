import { describe, expect, it } from 'vitest';

import {
  FALLBACK_LOOK,
  LOOK_KEY,
  lookFor,
  other,
  paletteFor,
  preferred,
  remember,
  stored,
  type Look,
  type Store,
} from '../src/look';
import { PAPER, SPACE } from '../src/theme';

/**
 * Light or dark, and who gets to decide.
 *
 * The same order the language follows: what the reader asked for outranks what
 * their system prefers, and the fallback is only for a reader nobody can ask.
 */

const holding = (held: Record<string, string>): Store => ({
  getItem: (key) => held[key] ?? null,
  setItem: (key, value) => void (held[key] = value),
});

const refusing = (): Store => ({
  getItem: () => {
    throw new Error('storage is disabled');
  },
  setItem: () => {
    throw new Error('storage is disabled');
  },
});

describe('what the reader asked for', () => {
  it('is read back', () => {
    expect(stored(holding({ [LOOK_KEY]: 'light' }))).toBe('light');
    expect(stored(holding({ [LOOK_KEY]: 'dark' }))).toBe('dark');
  });

  it('is nothing when nothing was asked, or when what is there is not a look', () => {
    // A value from storage is a string that was on the disk. Trusting it puts
    // `data-look="chartreuse"` on the document and every rule stops matching.
    expect(stored(holding({}))).toBeNull();
    expect(stored(holding({ [LOOK_KEY]: 'chartreuse' }))).toBeNull();
    expect(stored(holding({ [LOOK_KEY]: '' }))).toBeNull();
    expect(stored(null)).toBeNull();
  });

  it('is nothing, rather than an error, when storage refuses to be read', () => {
    // A browser with cookies denied throws on the read itself. A board that
    // will not draw because of a preference is worse than a board in the wrong
    // colours.
    expect(() => stored(refusing())).not.toThrow();
    expect(stored(refusing())).toBeNull();
  });
});

describe('what the system prefers', () => {
  it('is read from the query the reader already answered elsewhere', () => {
    expect(preferred((q) => q.includes('light'))).toBe('light');
    expect(preferred((q) => q.includes('dark'))).toBe('dark');
  });

  it('is nothing when the system will not say, or cannot be asked', () => {
    expect(preferred(() => false)).toBeNull();
    expect(preferred(null)).toBeNull();
  });

  it('is nothing, rather than an error, when asking throws', () => {
    expect(
      preferred(() => {
        throw new Error('no matchMedia');
      }),
    ).toBeNull();
  });
});

describe('the light the board is drawn in', () => {
  it('is what the reader asked for, over what their system prefers', () => {
    // Somebody who turned the lights on meant it, and meant it more recently
    // than whoever set up their laptop.
    expect(lookFor('light', 'dark')).toBe('light');
    expect(lookFor('dark', 'light')).toBe('dark');
  });

  it('is the system when nothing was asked', () => {
    expect(lookFor(null, 'light')).toBe('light');
    expect(lookFor(null, 'dark')).toBe('dark');
  });

  it('is the fallback only when nobody can be asked', () => {
    expect(lookFor(null, null)).toBe(FALLBACK_LOOK);
  });
});

describe('the toggle', () => {
  it('names the other one', () => {
    expect(other('dark')).toBe('light');
    expect(other('light')).toBe('dark');
  });

  it('comes back to where it started in two presses', () => {
    for (const look of ['dark', 'light'] as Look[]) {
      expect(other(other(look))).toBe(look);
    }
  });
});

describe('how the board is painted', () => {
  it('is the void in the dark and the table in the light', () => {
    expect(paletteFor('dark')).toBe(SPACE);
    expect(paletteFor('light')).toBe(PAPER);
  });

  it('puts stars over the void and none over the table', () => {
    // A starfield behind a lit table is the void showing through the cloth.
    expect(paletteFor('dark').stars).toBe(true);
    expect(paletteFor('light').stars).toBe(false);
  });

  it('measures each ground for itself rather than inverting the other', () => {
    // Both mistakes this repository has already made: a violet label measured
    // against paper went near-black on black, and a hairline border colour used
    // to draw a motif came out invisible against paper. So the two palettes
    // must not simply be each other upside down.
    expect(PAPER.label).not.toBe(SPACE.label);
    expect(PAPER.border).not.toBe(SPACE.border);
    expect(PAPER.thread).not.toBe(SPACE.thread);
    // And the room is lit differently, not just recoloured.
    expect(PAPER.ambient).toBeGreaterThan(SPACE.ambient);
  });
});

describe('keeping the choice', () => {
  it('is kept where it will be read back', () => {
    const held: Record<string, string> = {};
    expect(remember(holding(held), 'light')).toBe(true);
    expect(held[LOOK_KEY]).toBe('light');
    expect(stored(holding(held))).toBe('light');
  });

  it('says no rather than throwing when storage refuses', () => {
    // A preference that did not survive the reload is a control that did
    // nothing, and only the caller can decide whether to say so.
    expect(() => remember(refusing(), 'light')).not.toThrow();
    expect(remember(refusing(), 'light')).toBe(false);
    expect(remember(null, 'light')).toBe(false);
  });
});
