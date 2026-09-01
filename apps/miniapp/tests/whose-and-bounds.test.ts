import { describe, expect, it } from 'vitest';
import { MAX_REPORT_CHARS, squareText } from '@leela/journal';
import { fitsHandOver, handOverExcess, HAND_OVER_BYTES } from '../src/view';

/**
 * Two bounds and one question, all three of which the app got wrong quietly.
 *
 * The quiet is the point. A refused write says so; a wrong seat and a byte
 * limit say nothing at all — the player presses a button and the game does not
 * react, or reacts about somebody else. Neither leaves a mark anyone can find
 * later, which is why they lasted.
 */

describe('what Telegram will carry in one hand-over', () => {
  /**
   * `sendData` throws above 4096 **bytes**, and every bound this app states is
   * in characters: `maxlength="4000"` on the box, `MAX_REPORT_CHARS = 4000` in
   * the format. In Latin those nearly agree, which is why nobody noticed. In
   * Cyrillic a character costs two bytes and in Devanagari three.
   *
   * So the shape is: **the limit is not where the app says it is, and how far
   * off depends on the alphabet.** Asserted over three scripts rather than over
   * the one case somebody hit.
   */
  const square = (body: string) => squareText(41, 'Ignorance (avidya)', body, '');

  it('measures bytes, not characters', () => {
    // The same count of characters, three alphabets, three answers. A check on
    // `length` gives one answer for all three and is wrong for two of them.
    // Chosen so Latin fits and two bytes a character does not: the crossover
    // is a shade over 2048, which is where a Russian account crosses a limit
    // the writing box still says is 4000 away.
    const many = 2100;
    const latin = square('a'.repeat(many));
    const cyrillic = square('я'.repeat(many));
    const devanagari = square('अ'.repeat(many));

    expect(fitsHandOver(latin), 'one byte a character').toBe(true);
    expect(fitsHandOver(cyrillic), 'two bytes a character').toBe(false);
    expect(fitsHandOver(devanagari), 'three bytes a character').toBe(false);
  });

  it('lets a report the format accepts be one the bridge refuses', () => {
    // The gap itself, stated: the writing box will take this and the hand-over
    // will not, and the player is inside every bound the app has shown them.
    const legal = 'я'.repeat(Math.floor(MAX_REPORT_CHARS * 0.6));

    expect(legal.length).toBeLessThanOrEqual(MAX_REPORT_CHARS);
    expect(fitsHandOver(square(legal))).toBe(false);
  });

  it('says how far over, so the player can be told in characters', () => {
    const over = handOverExcess(square('я'.repeat(2100)));

    expect(over).toBeGreaterThan(0);
    // Room enough for the square's own title and framing, and no more.
    expect(handOverExcess(square(''))).toBe(0);
  });

  it('counts the whole payload, not the words that were typed', () => {
    // The square carries its number, its title and sometimes the player's own
    // question. A bound on the draft alone is a bound on the wrong string.
    const body = 'a'.repeat(HAND_OVER_BYTES - 40);

    expect(body.length).toBeLessThan(HAND_OVER_BYTES);
    expect(fitsHandOver(squareText(41, 'Ignorance (avidya)', body, 'What am I holding on to?'))).toBe(
      false,
    );
  });

  it('is a limit and not a preference', () => {
    // Telegram's number, quoted where it is used rather than inlined at the
    // call site — the value is the platform's and changing it is a decision.
    expect(HAND_OVER_BYTES).toBe(4096);
  });
});
