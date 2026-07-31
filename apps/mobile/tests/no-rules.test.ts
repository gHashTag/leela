import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARROWS, CLASSIC, SNAKES, TOTAL_PLANS, WIN_LOKA, initialState, replay } from '@leela/engine';
import {
  fileReport,
  isOver,
  mayThrow,
  newGame,
  owesAnAccount,
  standingOn,
  throwDie,
} from '../src/game';

/**
 * This app knows no rules, and that is the point of it existing here.
 *
 * The app it replaces carried its own movement. `GameService.ts` in
 * `NeuroLeelaExpo` is 471 lines, and `getDirectionAndPosition` and
 * `handleConsecutiveSixes` inside it decide where a throw puts a player — the
 * fifth copy of the board's rules in this family of repositories, after the
 * published app, the Expo rewrite, the Solidity contract and the mini app.
 *
 * Every copy has been somewhere the game could quietly become a different game.
 * The contract's two divergences are described in `packages/contracts`; the
 * published app's are a whole `RuleSet`. So the rule for this surface is that
 * it has none: `@leela/engine` moves the player, and this app draws the result.
 *
 * Asserted two ways. The source is read, because a rule can be written back in
 * at any time and a comment will not stop it. And a game is played through the
 * app's own functions and replayed through the engine, because matching source
 * text proves nothing about what actually happens on a throw.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src');

/**
 * The code that decides things, with the code that draws them taken out.
 *
 * Comments go first — half of this repository is prose about what went wrong,
 * and the numbers in it are quotations. Then the stylesheet, because a pixel is
 * not a square: `minHeight: 72` on a text field tripped the board-size rule the
 * hour it was written, and a check that cries wolf on a layout is a check
 * somebody will delete rather than obey.
 */
function gameCodeIn(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/StyleSheet\.create\(\{[\s\S]*?\n\}\);/g, ' ');
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('the app carries no rule of its own', () => {
  /**
   * What a rule looks like when somebody writes one back in.
   *
   * Not a list of names to avoid — that is a spelling test. These are the
   * *shapes* a movement rule takes: a square number written as a literal, a
   * comparison against the size of the board, arithmetic on a position.
   */
  const RULES = [
    { what: 'a jump written as a number pair', pattern: /\b(?:12|51|41|63|2|9|14|31|71)\s*:\s*\d+/ },
    { what: 'the winning square as a literal', pattern: new RegExp(`\\b${WIN_LOKA}\\b`) },
    { what: 'the size of the board as a literal', pattern: new RegExp(`\\b${TOTAL_PLANS}\\b`) },
    { what: 'the entering six as a literal', pattern: /roll\s*===?\s*6|=== 6\b|> 6\b/ },
    { what: 'position arithmetic', pattern: /loka\s*[+\-]|position\s*[+\-]\s*\d/ },
  ];

  for (const { what, pattern } of RULES) {
    it(`has no ${what}`, () => {
      const offenders = filesUnder(SRC)
        .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
        .filter((file) => pattern.test(gameCodeIn(readFileSync(file, 'utf8'))))
        .map((file) => relative(SRC, file));

      expect(offenders).toEqual([]);
    });
  }

  it('imports its movement rather than defining it', () => {
    const source = readFileSync(join(SRC, 'game.ts'), 'utf8');

    expect(source).toContain("from '@leela/engine'");
    expect(source).toMatch(/\badvance\b/);
  });
});

describe('a game played through the app is the game the engine plays', () => {
  /**
   * The half that source-reading cannot do. A file with no rule in it can still
   * move a player wrongly by calling the engine wrongly — passing the roll
   * twice, dropping the session, keeping its own copy of the position.
   *
   * So the app plays, and the engine replays the same throws from the same
   * seed, and the two are compared square by square. `replay` is the engine's
   * own — the function a player uses to check a game they were told about.
   */
  const SEED = 4242;

  it('lands where the engine says, throw for throw', () => {
    let game = newGame(SEED);
    const rolls: number[] = [];
    const walked: number[] = [];

    for (let turn = 0; turn < 60 && !isOver(game); turn += 1) {
      if (owesAnAccount(game)) game = fileReport(game);

      const thrown = throwDie(game);
      if (thrown.roll === 0) continue; // refused, so nothing happened to replay
      game = thrown.game;
      rolls.push(thrown.roll);
      walked.push(standingOn(game));
    }

    const replayed = replay(rolls, initialState(), CLASSIC);

    expect(walked.at(-1)).toBe(replayed.at(-1)?.state.loka);
    expect(walked, 'and every square on the way, not only the last').toEqual(
      replayed.map((step) => step.state.loka),
    );
  });

  it('never moves a player who owes an account', () => {
    // The gate is the engine's, and this asks it from both sides: the drawing
    // that dims the die and the act that takes the throw.
    let game = newGame(SEED);

    for (let turn = 0; turn < 40 && !isOver(game); turn += 1) {
      if (!owesAnAccount(game)) {
        game = throwDie(game).game;
        continue;
      }

      expect(mayThrow(game), 'the die is shut').toBe(false);
      const where = standingOn(game);
      expect(throwDie(game).game, 'and shut to the act as well').toBe(game);
      expect(standingOn(game)).toBe(where);

      game = fileReport(game);
      expect(mayThrow(game), 'and open once it is written').toBe(true);
    }
  });

  it('replays from a seed and a count, which is all a player carries away', () => {
    // Two numbers, and the game comes back exactly. That is what makes a throw
    // something nobody has to be trusted about.
    const play = (turns: number) => {
      let game = newGame(SEED);
      for (let turn = 0; turn < turns && !isOver(game); turn += 1) {
        if (owesAnAccount(game)) game = fileReport(game);
        game = throwDie(game).game;
      }
      return game;
    };

    const first = play(20);
    const again = play(20);

    expect(standingOn(again)).toBe(standingOn(first));
    expect(again.rollsTaken).toBe(first.rollsTaken);
  });

  it('knows a snake from an arrow only because the engine said so', () => {
    // Every jump the board has, played rather than looked up: the app reports
    // the direction it was handed, and it is the engine's board that decides.
    let game = newGame(SEED);
    const seen = new Set<string>();

    for (let turn = 0; turn < 300; turn += 1) {
      if (isOver(game)) game = newGame(SEED + turn);
      if (owesAnAccount(game)) game = fileReport(game);
      game = throwDie(game).game;

      // Only the two the board declares. `stop 🛑` is a throw that would
      // overshoot the last square and `win 🕉` is arriving on it; neither is a
      // jump, and holding them to a jump's destination would be this test
      // inventing a rule — which is the one thing it exists to prevent.
      if (game.event?.direction === 'snake 🐍' || game.event?.direction === 'arrow 🏹') {
        seen.add(game.event.direction);
        // The destination is one the board declares, and the board is the
        // engine's. This app has never seen a snake.
        expect(Object.values({ ...SNAKES, ...ARROWS })).toContain(game.event.to);
      }
    }

    expect([...seen].sort(), 'a long enough game meets both').toEqual(['arrow 🏹', 'snake 🐍']);
  });
});

describe('one file knows what a phone is', () => {
  /**
   * `device.ts` is the only place that imports a native library. Everything
   * else takes a `Keeper` or a `Store` and is content with a `Map`, which is
   * what lets a path be tested without a simulator — and what keeps the file
   * that cannot be tested small enough to read in one sitting.
   *
   * The shape rather than the name: any native import anywhere else drags the
   * whole app onto a device to be checked at all, and the surfaces before this
   * one each took a pass to get back out of that.
   */
  const NATIVE = /from '(react-native|@react-native|expo-|@expo)/;

  it('and nothing else imports one', () => {
    const offenders = filesUnder(SRC)
      .filter((file) => file.endsWith('.ts'))
      .filter((file) => NATIVE.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual(['device.ts']);
  });

  it('and the screen is the only place that draws', () => {
    // `App.tsx` may import react-native; it is the drawing. What it must not
    // do is decide, which the rules above already assert.
    const screens = filesUnder(SRC)
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => relative(SRC, file));

    expect(screens).toEqual(['App.tsx']);
  });
});
