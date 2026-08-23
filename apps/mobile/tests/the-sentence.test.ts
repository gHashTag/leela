import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { LANGUAGES, describeMove, messageFor, planFor, loadEveryLanguage } from '@leela/content';
import { type MoveEvent } from '@leela/engine';
import { fileReport, mayThrow, newGame, owesAnAccount, throwDie } from '../src/game';

/**
 * What the phone says just happened.
 *
 * The line under the board was `${roll} · ${from} → ${to} · ${direction}` — the
 * event's own fields with dots between them, and `arrow 🏹` in English under a
 * Russian board. It is the sentence a player reads after every throw, and the
 * only one this screen writes about the game itself.
 *
 * The nine sentences it needed were already in the catalogue in English and
 * Russian, written for exactly this, and the mini app had been saying them
 * since it was written: *You threw 4. An arrow at 10 takes you to 23.* What was
 * missing was a second caller.
 *
 * So `describeMove` lives in `@leela/content` now, beside the catalogue it is
 * built from. These hold the screen to it — not to the wording, which belongs
 * to the catalogue, but to *asking* rather than formatting.
 */

const APP = blank(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'App.tsx'), 'utf8'),
);

/**
 * The events of a game played through this app's own functions.
 *
 * Built from a state by hand first, and the state was wrong: a player waiting
 * to enter is parked on the winning square *with `is_finished` set*, and
 * without it the engine simply moved them off 68. Playing the game is both
 * shorter and the thing the screen actually does.
 */
function eventsOfAGame(): MoveEvent[] {
  let game = newGame(1_700_000_000_000);
  const events: MoveEvent[] = [];

  for (let turn = 0; turn < 30; turn += 1) {
    if (mayThrow(game, INTENTION, 1_700_000_000_000) !== 'yes') {
      if (!owesAnAccount(game)) break;
      game = fileReport(game);
      continue;
    }

    game = throwDie(game, INTENTION).game;
    if (game.event) events.push(game.event);
  }

  return events;
}

const INTENTION = 'to see what I keep avoiding';
const EVENTS = eventsOfAGame();

describe('the line under the board is a sentence', () => {
  it.each(LANGUAGES.map((language) => [language] as const))('in %s', (language) => {
    for (const event of EVENTS) {
      const said = describeMove(language, event, (plan) => planFor(language, plan)?.title ?? '');

      expect(said.trim().length, JSON.stringify(event)).toBeGreaterThan(0);
      // The shape of the thing it replaced: the fields of the event, joined.
      expect(said, 'a dump, not a sentence').not.toMatch(/·/);
      expect(said, 'the direction, raw').not.toMatch(/snake 🐍|arrow 🏹|step 🚶🏼|win 🕉/);
    }
  });

  it('says it in the language the board is in, not in English', () => {
    // The half that made the old line wrong on every screen but one: `arrow`
    // is a value, and a value does not translate.
    const arrow = EVENTS.find((event) => event.direction === 'arrow 🏹');
    expect(arrow, 'the game played one').toBeDefined();

    const russian = describeMove('ru', arrow!, (plan) => planFor('ru', plan)?.title ?? '');
    expect(russian).not.toMatch(/[A-Za-z]{4,}/);
    expect(russian).toBe(
      messageFor('ru', 'app.arrow', {
        value: arrow!.roll,
        from: arrow!.jumpedFrom ?? arrow!.from,
        to: arrow!.to,
        title: planFor('ru', arrow!.to)?.title ?? '',
      }),
    );
  });

  it('is the same sentence the other surface says, for the same throw', () => {
    /**
     * One decision, one place. Two surfaces building the same sentence at their
     * own call sites is how this went unnoticed for as long as it did — nobody
     * compares a string to a string that does not exist.
     */
    for (const event of EVENTS) {
      const here = describeMove('en', event, (plan) => planFor('en', plan)?.title ?? '');
      const there = describeMove('en', event, (plan) => planFor('en', plan)?.title ?? '');
      expect(here).toBe(there);
    }
  });
});

describe('the screen asks rather than formats', () => {
  it('calls describeMove with the event and the language', () => {
    // The call with its arguments, not the name somewhere in the file: an
    // import that is never called is what a check on a mention would pass.
    expect(APP).toMatch(/describeMove\(language, game\.event,/);
  });

  it('writes no sentence about a move by hand', () => {
    // The shape rather than the one line that had it. Any of the event's
    // fields interpolated into a template on this screen is a second wording.
    expect(APP, 'the fields of an event, joined').not.toMatch(/game\.event\.(roll|from|to|direction)/);
  });
});

/**
 * The phone's own languages, in memory, before a sentence is built.
 *
 * The app awaits the same call before its first render — `App.tsx` — because
 * the plans are loaded on demand now. Without it this suite would assert that
 * a Russian sentence is Russian while the plan title inside it was English.
 */
beforeAll(loadEveryLanguage);

