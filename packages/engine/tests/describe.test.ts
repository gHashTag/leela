import { describe as group, expect, it } from 'vitest';

import { ARROWS, SNAKES, START_LOKA, TOTAL_PLANS, WIN_LOKA, rulesText, type BoardInWords } from '../src';

/**
 * The board in words, held to the board.
 *
 * This paragraph is what both companions are told before a player says
 * anything, and it existed twice — once in `apps/bot/src/bot.ts` and once in
 * `apps/webgl/src/ask.ts`, eight sentences each, word for word. The bot's copy
 * carried a comment saying the two could not describe different games because
 * every number came from the engine. That was true of the bot's copy and false
 * of the board's, which wrote `plan 54 leads straight to it` with the number
 * typed in.
 *
 * So these tests are about the DERIVATION, not about today's numbers. Every
 * case below hands `rulesText` a board that is not this one and requires the
 * sentence to describe that board — which is the only arrangement that can tell
 * a derived number from one that agrees by luck. Asserting `54` here would have
 * passed against the defect.
 */
const variant: BoardInWords = {
  plans: 40,
  start: 3,
  win: 37,
  arrows: { 5: 20, 31: 37 },
  snakes: { 22: 9 },
};

group('the sentence describes the board it is given', () => {
  it('names that board’s numbers and not this one’s', () => {
    const said = rulesText(variant);

    expect(said).toContain('The board has 40 plans.');
    expect(said).toContain('places them on plan 3.');
    expect(said).toContain('Reaching plan 37 completes the game');
    expect(said).toContain('would pass plan 40 does not move');

    // The engine's own figures must be absent, or the test proves nothing about
    // a function that ignores its argument.
    expect(said).not.toContain(String(TOTAL_PLANS));
    expect(said).not.toContain(`plan ${START_LOKA}.`);
  });

  it('finds the arrow that ends the game instead of being told it', () => {
    // The defect, exactly: the board's copy said `plan 54` — right for this
    // board, and wrong for any other. Here the winner arrives from 31.
    expect(rulesText(variant)).toContain('plan 31 leads straight to it.');
  });

  it('does not promise a straight-in arrow to a board that has none', () => {
    // The board's copy promised one unconditionally. A board with no arrow to
    // the winning plan would have been described as having one.
    const noShortcut: BoardInWords = { ...variant, arrows: { 5: 20 } };
    const said = rulesText(noShortcut);

    expect(said).toContain('Reaching plan 37 completes the game.');
    expect(said).not.toContain('leads straight to it');
  });

  it('lists every jump of the board it was handed, both ways', () => {
    const said = rulesText(variant);

    expect(said).toContain('Arrows lift: 5->20, 31->37.');
    expect(said).toContain('Snakes drop: 22->9.');
  });
});

group('and by default it describes this one', () => {
  it('reads the engine when it is told nothing', () => {
    const said = rulesText();
    const straightIn = Object.entries(ARROWS).find(([, to]) => to === WIN_LOKA)?.[0];

    expect(said).toContain(`The board has ${TOTAL_PLANS} plans.`);
    expect(said).toContain(`Reaching plan ${WIN_LOKA} completes the game`);
    // Derived here too, so this cannot drift into asserting a literal either.
    expect(said).toContain(`plan ${straightIn} leads straight to it.`);
    expect(said).toContain(`Snakes drop: ${Object.entries(SNAKES)[0]?.join('->')}`);
  });
});
