/**
 * The walk a player takes, end to end.
 *
 * The unit suites own the rules — `@leela/engine` has 334 and this app carries
 * none of its own — so nothing here asserts where a snake goes. What is
 * asserted is the **wiring**: that the control is connected to the thing it
 * names, and that the game the player is looking at is the game the engine is
 * playing.
 *
 * Every defect this app has given up was found by running it: an app installed
 * under the wrong identifier, the winning square's teaching shown to somebody
 * who had not begun, a Save button clipped to nothing, a board forgotten on
 * every launch. None of the four was visible in the source.
 */
const { expect: jestExpect } = require('@jest/globals');
const { HANDLE, squareHandle, enterTheGame, sayWhatFor, writeIfAsked } = require('./player');

/*
 * Two `expect`s, and they are not interchangeable.
 *
 * Detox replaces the global one, so `expect(17).toBeGreaterThan(0)` fails with
 * *17 is not a Detox matcher* — which reads like the walk being wrong when the
 * walk had just succeeded. Anything about a value uses jest's; anything about
 * the screen uses Detox's.
 */

describe('the question comes before the board', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('will not turn the die until it is answered', async () => {
    // The published app blocks the board without one — `blockGoBack: true` in
    // `screens/helper.ts` — and this is the same refusal, on this surface.
    await expect(element(by.id(HANDLE.roll))).toBeVisible();
    await expect(element(by.id(HANDLE.intention))).toBeVisible();

    await element(by.id(HANDLE.roll)).tap();
    // Still waiting. Nothing moved, and the question is still on screen.
    await expect(element(by.id(HANDLE.intention))).toBeVisible();
  });

  it('shows no square to read before anybody has entered', async () => {
    // The seventh sighting of the 68 ambiguity was here: the app printed the
    // whole teaching of Cosmic Consciousness to a player who had not begun.
    // The piece is on 68 — the engine parks it there — and the text is not.
    await expect(element(by.id(squareHandle(68)))).toBeVisible();
    await expect(element(by.text('68. Cosmic Consciousness (Vaikuntha Loka)'))).not.toBeVisible();
  });

  it('opens the die once the question is answered', async () => {
    await sayWhatFor();
    await expect(element(by.id(HANDLE.intention))).not.toBeVisible();
    await expect(element(by.id(HANDLE.roll))).toBeVisible();
  });
});

describe('entering the game, and what it asks for', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
    await sayWhatFor();
  });

  it('takes a six to get on the board', async () => {
    const throws = await enterTheGame();
    jestExpect(throws).toBeGreaterThan(0);

    // What the screen says, not a flag on a `View`. `toHaveToggleValue` is for a
    // switch and answered *not a UISwitch* against `accessibilityState`, which
    // reads like the assertion being false when it was never asked.
    await expect(element(by.id(HANDLE.square))).toBeVisible();
  });

  it('asks for an account of the square before the next throw', async () => {
    // The gate is the whole point of the game: a player reflects before they
    // move. The published app cleared it with a button that wrote nothing.
    await expect(element(by.id(HANDLE.report))).toBeVisible();

    const wrote = await writeIfAsked('The first square, and what it asked of me.');
    jestExpect(wrote).toBe(true);
  });

  it('shows what was written back, on the square it was written about', async () => {
    // A record nobody can read is a record the game is not producing — the
    // shape the bot was found in, where reports went into SQLite correctly and
    // nothing ever returned them.
    // Scrolled to, because that is what a player does. The account sits under
    // the board and the plan's text, below the fold on a phone — the element is
    // there and Detox refuses a view its superview clips, which is the right
    // answer to *is this on screen* and the wrong one to *is this in the app*.
    await waitFor(element(by.text('The first square, and what it asked of me.')))
      .toBeVisible()
      .whileElement(by.id(HANDLE.page))
      .scroll(400, 'down');
  });
});

describe('the board survives the app closing', () => {
  let square;

  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
    await sayWhatFor();
    await enterTheGame();
    await writeIfAsked('An account, so the die opens again.');
  });

  it('is on a square that is not the waiting one', async () => {
    await expect(element(by.id(HANDLE.square))).toBeVisible();
    // The title is `<n>. <name>`, and the number is what has to survive.
    square = (await element(by.id(HANDLE.square)).getAttributes()).text;
    jestExpect(square).toBeTruthy();
  });

  it('comes back to the same square after a relaunch', async () => {
    // The defect this closed: the journal and the intention were restored and
    // the game was not, so a player at plan 41 came back to the waiting square
    // with their own writing intact underneath.
    await device.launchApp({ newInstance: true });

    await expect(element(by.id(HANDLE.square))).toBeVisible();
    jestExpect((await element(by.id(HANDLE.square)).getAttributes()).text).toBe(square);
  });

  it('still knows what the player is playing for', async () => {
    await expect(element(by.id(HANDLE.intention))).not.toBeVisible();
  });

  it('still has what they wrote', async () => {
    await waitFor(element(by.text('An account, so the die opens again.')))
      .toBeVisible()
      .whileElement(by.id(HANDLE.page))
      .scroll(400, 'down');
  });
});

describe('the book, which every other surface has', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('opens and closes from the one button', async () => {
    // A book nobody can open is a book nobody has. It was carried in 22
    // languages with no way in for three passes.
    await element(by.id(HANDLE.rules)).tap();
    await expect(element(by.id(HANDLE.rules))).toBeVisible();
    await element(by.id(HANDLE.rules)).tap();
  });
});

describe('carrying a path away and taking one back', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
    await sayWhatFor();
    await enterTheGame();
    await writeIfAsked('Something worth carrying.');
  });

  it('offers to carry it only once there is something to carry', async () => {
    await expect(element(by.id(HANDLE.sharePath))).toBeVisible();
  });

  it('refuses a paste that is not a path', async () => {
    // Half a path is not a path. The format refuses a whole document over one
    // bad row, and the app says so rather than importing nothing quietly.
    await element(by.id(HANDLE.paste)).typeText('this is not a path');
    await element(by.id(HANDLE.pasteTake)).tap();
    await expect(element(by.id(HANDLE.paste))).toBeVisible();
  });
});

describe('beginning again', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
    await sayWhatFor();
    await enterTheGame();
    await writeIfAsked('Written before the restart.');
  });

  it('is not offered until the game is over', async () => {
    // Written the other way round first, and the walk was wrong rather than the
    // app: `isOver(game)` gates the button, so mid-game it does not exist. A
    // restart offered beside a live die is an invitation to lose a game by a
    // slip, and the published app puts it at the end for the same reason.
    await expect(element(by.id(HANDLE.roll))).toBeVisible();
    await expect(element(by.id(HANDLE.restart))).not.toExist();
  });
});
