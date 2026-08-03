/**
 * What a throw says about where the player has ended up.
 *
 * On the mini app the sentence after a throw goes into `#say`, which is
 * `role="status" aria-live="polite"` — so it is the one thing a screen reader
 * announces when the board changes. The square's name is also on the screen, in
 * `plan-title`, and that element changes **silently**. A player who cannot see
 * the board knows where they are from this sentence or from nothing.
 *
 * The catalogue is checked for having a key for every outcome on both surfaces,
 * and for saying it in both languages. Nothing checked what it says. Take
 * `{title}` out of `app.step` and a blind player hears *You threw 3. 1 → 6.* —
 * a number with no name — and every test still passes.
 *
 * So the shape: **a throw that moves the player names where they now are, the
 * number and the square, on both surfaces and in both languages. A throw that
 * moves nobody names neither**, because a player who is still waiting to enter
 * has not arrived anywhere and being told a square would be worse than being
 * told nothing.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messageFor } from '../src/index';

/** The two catalogues that are complete. The other twenty fall back to these. */
const COMPLETE = ['en', 'ru'] as const;

/** Values distinctive enough that finding them in a sentence means something. */
const THROW = {
  name: 'Ada',
  value: 3,
  from: 17,
  to: 41,
  title: 'The human plane (jana-loka)',
  plan: 41,
};

/** An outcome that puts the player on a new square, named on both surfaces. */
const MOVES = [
  { what: 'entering the game', bot: 'move.enter', app: 'app.entered' },
  { what: 'a third six', bot: 'move.threeSixes', app: 'app.threeSixes' },
  { what: 'a snake', bot: 'move.snake', app: 'app.snake' },
  { what: 'an arrow', bot: 'move.arrow', app: 'app.arrow' },
  { what: 'a plain step', bot: 'move.step', app: 'app.step' },
] as const;

/** An outcome that leaves the player where they were. */
const STAYS = [
  { what: 'not a six, before entering', bot: 'move.needSix', app: 'app.needSix' },
  { what: 'a throw with no room left', bot: 'move.refused', app: 'app.noRoom' },
] as const;

const said = (language: (typeof COMPLETE)[number], key: string) =>
  messageFor(language, key as Parameters<typeof messageFor>[1], THROW);

describe('a throw that moves the player', () => {
  it('says which square they are on now, on both surfaces and in both languages', () => {
    const silent: string[] = [];

    for (const language of COMPLETE) {
      for (const outcome of MOVES) {
        for (const key of [outcome.bot, outcome.app]) {
          const text = said(language, key);

          if (!text.includes(String(THROW.to))) silent.push(`${language}/${key}: no square number`);
          if (!text.includes(THROW.title)) silent.push(`${language}/${key}: no square name`);
        }
      }
    }

    expect(silent).toEqual([]);
  });

  it('says the number and the name together, not one or the other', () => {
    // Both halves are needed and for different reasons: the number is what the
    // board is drawn from and what a player counts along, and the name is what
    // the square means. A sentence with only one of them is half an answer.
    for (const language of COMPLETE) {
      for (const outcome of MOVES) {
        const app = said(language, outcome.app);

        expect({
          language,
          what: outcome.what,
          both: app.includes(String(THROW.to)) && app.includes(THROW.title),
        }).toEqual({ language, what: outcome.what, both: true });
      }
    }
  });
});

describe('a throw that moves nobody', () => {
  it('names no square, because the player has not arrived at one', () => {
    // The other half, and the one that keeps the rule from being *every message
    // mentions everything*: a player waiting for a six is told what they threw,
    // and telling them a square would say they had gone somewhere.
    const wrong: string[] = [];

    for (const language of COMPLETE) {
      for (const outcome of STAYS) {
        for (const key of [outcome.bot, outcome.app]) {
          if (said(language, key).includes(THROW.title)) wrong.push(`${language}/${key}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it('still says what was thrown, so the sentence is not empty of news', () => {
    for (const language of COMPLETE) {
      for (const outcome of STAYS) {
        expect({ language, app: outcome.app, told: said(language, outcome.app).includes('3') }).toEqual({
          language,
          app: outcome.app,
          told: true,
        });
      }
    }
  });
});

describe('the pairing this rests on', () => {
  it('covers every outcome the bot can announce', () => {
    // If an outcome is added and not listed here, the assertions above pass
    // over it in silence — which is the failure they exist to prevent, one
    // level up. Read out of the catalogue rather than counted, because a count
    // of my own list is a fact about my own list.
    const catalogue = readFileSync(
      join(import.meta.dirname, '..', 'src', 'messages.ts'),
      'utf8',
    );

    const announced = [...new Set([...catalogue.matchAll(/^\s*'(move\.[\w.]+)':/gm)].map((m) => m[1]))];
    const listed = new Set([...MOVES, ...STAYS].map((one) => one.bot as string));

    expect(announced.filter((key) => !listed.has(key ?? ''))).toEqual([]);
    expect(announced.length).toBeGreaterThan(5);
  });
});
