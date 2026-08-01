/**
 * A player, as far as a test is concerned.
 *
 * The names come from `src/handles.ts` so that the screen and the walk cannot
 * drift apart — a suite reaching for `roll` while the screen says `roll-button`
 * fails with *not found*, which reads exactly like the control being gone.
 */
const { HANDLE, squareHandle } = require('../src/handles');

/** Every throw of the die, up to a stated bound. */
const MOST_THROWS = 40;

/**
 * Throw until the player is on the board.
 *
 * The die is not seeded. Making it certain would mean a launch argument only a
 * test passes, and a code path nobody who plays the game takes is a code path
 * nobody maintains. So this taps, with a bound: forty throws without a six is
 * about one run in two thousand, and it fails saying so rather than hanging.
 */
async function enterTheGame() {
  for (let attempt = 0; attempt < MOST_THROWS; attempt += 1) {
    await element(by.id(HANDLE.roll)).tap();

    // The title of the square, which is drawn only when there is a square to
    // read — the same question `squareToRead` asks, and not a second one
    // written for a test. A player who has not entered stands on 68 with
    // nothing to read, so its appearance *is* being on the board.
    //
    // The board's own cells were tried first, through `accessibilityState`.
    // That matcher is for a switch, and it answered false forever: forty throws
    // and no entry, on a game that had entered on the second.
    try {
      await expect(element(by.id(HANDLE.square))).toBeVisible();
      return attempt + 1;
    } catch {
      // Not yet. An owed account blocks the next throw, so file one when the
      // writing box appears — which is what a player does.
      await writeIfAsked('Something to say about this square.');
    }
  }

  throw new Error(`no six in ${MOST_THROWS} throws — the die or the gate is wrong`);
}

/** File an account when the game is asking for one, and do nothing when it is not. */
async function writeIfAsked(words) {
  try {
    await element(by.id(HANDLE.report)).typeText(words);
    await element(by.id(HANDLE.reportSave)).tap();
    return true;
  } catch {
    return false;
  }
}

/** Answer the question the game will not start without. */
async function sayWhatFor(words = 'What am I holding on to?') {
  await element(by.id(HANDLE.intention)).typeText(words);
  await element(by.id(HANDLE.intentionSave)).tap();
}

module.exports = { HANDLE, squareHandle, MOST_THROWS, enterTheGame, writeIfAsked, sayWhatFor };
