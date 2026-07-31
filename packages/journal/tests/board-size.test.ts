import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import { isReport, parseSquare, squareText } from '../src';

/**
 * The board, counted twice, held to one number.
 *
 * `@leela/engine` exports `TOTAL_PLANS`, and this format declares its own
 * because it has no dependencies at all — deliberately, so that a browser
 * bundle and a Bun process can both hold it, and so that nothing it imports is
 * imported into both. The copy cannot be removed. What it can be is checked.
 *
 * Everything else about this repository's duplicated numbers applies here: they
 * agree on the day they are made, and nothing goes wrong until one of them
 * changes. A board that grew to eighty in the engine would leave the format
 * refusing every square above seventy-two — reports thrown away as "not a plan"
 * on squares a player had genuinely stood on.
 *
 * Asked through the behaviour rather than the constant, because the constant is
 * private and should stay private. A test that reached inside would be a third
 * copy of the same knowledge.
 */
describe('the format and the engine mean the same board', () => {
  const at = 1_700_000_000_000;

  it('accepts the last square of the engine’s board', () => {
    expect(isReport({ plan: TOTAL_PLANS, text: 'the last one', at })).toBe(true);
    expect(parseSquare(squareText(TOTAL_PLANS, 'The last', 'Standing here.', ''))?.plan).toBe(
      TOTAL_PLANS,
    );
  });

  it('refuses the square after it', () => {
    expect(isReport({ plan: TOTAL_PLANS + 1, text: 'nowhere', at })).toBe(false);
    expect(parseSquare(squareText(TOTAL_PLANS + 1, 'Nowhere', 'Standing here.', ''))).toBeNull();
  });

  it('accepts the square a game is won on', () => {
    // Named separately because it is the one square the whole game aims at, and
    // a format that refused it would refuse the last thing anybody writes.
    expect(isReport({ plan: WIN_LOKA, text: 'arrived', at })).toBe(true);
  });
});
