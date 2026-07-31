import { describe, expect, it } from 'vitest';
import { MAX_INTENTION_CHARS, MIN_INTENTION_CHARS } from '@leela/journal';
import { isIntention, loadIntention, saveIntention, type Store } from '../src/journal';

/**
 * One question, one answer.
 *
 * *Is this a question the game can hold* had three: the mini app's
 * `isIntention`, the bot's `said.length < 2 || said.length > MAX_INTENTION_CHARS`
 * written inline with the two as a literal, and this app about to write a
 * fourth. Each carried a comment saying it was the published app's bound —
 * `yup.string().min(2).max(800)` — and each was a separate place for that to
 * stop being true.
 *
 * It lives in `@leela/journal` now, which is the one package all three can
 * reach: no dependencies at all, on purpose, so a browser bundle, a Bun process
 * and a phone can each hold it.
 *
 * What is asserted here is the *separation*, not the numbers. Whether words are
 * a question is one question; whether a device kept them is another; and the
 * mini app spent four passes with a writer that answered both at once, so a
 * browser that refused the write told the player their sentence was too short.
 */

const keeps = (): Store & { held: Map<string, string> } => {
  const held = new Map<string, string>();
  return {
    held,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
  };
};

const refuses: Store = {
  getItem: () => null,
  setItem: () => {
    throw new Error('no room');
  },
};

describe('what counts as a question', () => {
  it('is the format’s answer, at the bounds the format states', () => {
    // Against the constants rather than their values.
    expect(isIntention('x'.repeat(MIN_INTENTION_CHARS))).toBe(true);
    expect(isIntention('x'.repeat(MIN_INTENTION_CHARS - 1))).toBe(false);
    expect(isIntention('x'.repeat(MAX_INTENTION_CHARS))).toBe(true);
    expect(isIntention('x'.repeat(MAX_INTENTION_CHARS + 1))).toBe(false);
  });

  it('ignores the space around it, since a player does', () => {
    expect(isIntention('   to see it through   ')).toBe(true);
    expect(isIntention('   \n\t  ')).toBe(false);
  });
});

describe('whether it was kept is a different question', () => {
  it('says kept when it was, and gives it back', () => {
    const store = keeps();

    expect(saveIntention(store, 'to see what I keep avoiding')).toBe(true);
    expect(loadIntention(store)).toBe('to see what I keep avoiding');
  });

  it('says not kept when the device refuses', () => {
    expect(saveIntention(refuses, 'to see it through')).toBe(false);
  });

  it('says not kept when there is no store at all', () => {
    expect(saveIntention(undefined, 'to see it through')).toBe(false);
  });

  it('never confuses the two, which is the defect this is written from', () => {
    // A valid question the device refused is *valid* and *not kept*. The mini
    // app answered both with one boolean and told the player, in the one dialog
    // the game will not start without, that their sentence was too short.
    const said = 'to see what I keep avoiding';

    expect(isIntention(said), 'the words are fine').toBe(true);
    expect(saveIntention(refuses, said), 'the device is not').toBe(false);
  });
});

describe('what comes back when nothing is there', () => {
  it('is empty rather than a crash, whatever the store does', () => {
    const blind: Store = {
      getItem: () => {
        throw new Error('storage is disabled');
      },
      setItem: () => undefined,
    };

    expect(loadIntention(keeps())).toBe('');
    expect(loadIntention(undefined)).toBe('');
    expect(loadIntention(blind)).toBe('');
  });
});
