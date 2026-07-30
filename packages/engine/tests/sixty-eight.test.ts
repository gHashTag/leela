import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  ONLINE,
  WIN_LOKA,
  applyRoll,
  arrivedByJump,
  arrivedOnSix,
  canRoll,
  hasWon,
  initialState,
  isWaitingToEnter,
  owesReport,
  seededRoller,
  type GameState,
  type RuleSet,
} from '../src/index';

/**
 * Square 68 means two different things, and this is the list of everything that
 * has to tell them apart.
 *
 * A player who has not entered the game sits on `WIN_LOKA` with `is_finished`
 * set, and so does a player who has just won it. The board cannot distinguish
 * them; only the history can, which is what `hasWon` reads.
 *
 * It has been found **eight times**, in eight places, and fixed eight times
 * one at a time:
 *
 * 1. `hasWon` itself — a migrated player with no history read as a winner.
 * 2. `owesReport` — the gate skipped the one square a whole game is played to
 *    reach.
 * 3. `needsSixToEnter` — a winner's refused throw is the same event as a
 *    waiting player's, so the helper written to tell refusals apart could not.
 * 4. The mini app's header — reaching 68 reset it to "—" and emptied the bar.
 * 5. The line under the board — a winner was told *"a six puts you on the
 *    board"*.
 * 6. The bot's `/report` — a player who had never begun could file an account
 *    of Cosmic Consciousness.
 * 7. The bot's `/ask` — every question before the first six was answered from
 *    the winning square's text.
 * 8. The mini app's die — `isSessionOver` asked about the table, not the seat.
 *
 * Eight identical defects are one unclosed shape rather than eight mistakes. So
 * the rule is stated here, over the *engine*, once: **every function that
 * answers a question about a player must answer it differently for these two
 * states, or say in writing why it does not.**
 */

/** Nobody has thrown a six yet. */
const WAITING: GameState = initialState();

/** A game played to its end, so the winning state is one a game produced. */
function playedToTheEnd(): GameState {
  for (let seed = 1; seed <= 200; seed += 1) {
    let state = initialState();
    const die = seededRoller(seed);

    for (let turn = 0; turn < 400; turn += 1) {
      state = applyRoll(state, die(), CLASSIC).state;
      if (hasWon(state)) return state;
    }
  }

  throw new Error('no seed reached Cosmic Consciousness');
}

const WON = playedToTheEnd();

describe('the two states that share a square', () => {
  it('are both on 68, both finished, and genuinely different', () => {
    // If these ever stop being indistinguishable by position, the whole class
    // has gone away and the table below is no longer needed.
    expect(WAITING.loka).toBe(WIN_LOKA);
    expect(WON.loka).toBe(WIN_LOKA);
    expect(WAITING.is_finished).toBe(true);
    expect(WON.is_finished).toBe(true);

    expect(hasWon(WAITING)).toBe(false);
    expect(hasWon(WON)).toBe(true);
    expect(isWaitingToEnter(WAITING)).toBe(true);
    expect(isWaitingToEnter(WON)).toBe(false);
  });

  it('are reachable, not constructed — the winner was played to', () => {
    expect(WON.previous_loka).not.toBe(0);
    expect(WON.previous_loka).not.toBe(WIN_LOKA);
  });
});

/**
 * Everything in the engine that takes a state and answers a question about the
 * player in it.
 *
 * `differs` is the claim: does this function have to tell the two apart? Where
 * it does not, the reason is written down, because "these two states get the
 * same answer" is exactly the sentence eight defects were hiding behind.
 */
const ASKED: Array<{
  what: string;
  ask: (state: GameState, rules: RuleSet) => unknown;
  /** Whether this answer must differ — as a rule, or per ruleset. */
  differs: boolean | ((rules: RuleSet) => boolean);
  because?: string;
}> = [
  { what: 'hasWon', ask: (state) => hasWon(state), differs: true },
  { what: 'isWaitingToEnter', ask: (state) => isWaitingToEnter(state), differs: true },
  {
    what: 'owesReport',
    ask: (state, rules) => owesReport(state, rules),
    differs: true,
  },
  {
    what: 'applyRoll',
    ask: (state, rules) => applyRoll(state, 6, rules).state,
    // The one place the two states are *allowed* to be treated alike, and only
    // where a ruleset says so: `mayReenterAfterWinning` decides whether a six
    // begins another game for somebody who has finished one. Under the
    // published app's rules it does not, and the answers must differ; under
    // classic Leela it does, and they must not.
    differs: (rules) => !rules.mayReenterAfterWinning,
    because:
      'The difference belongs to `mayReenterAfterWinning`, which is a rule and ' +
      'not an oversight — so it is checked per ruleset rather than waived.',
  },
  {
    what: 'canRoll',
    ask: (state, rules) =>
      canRoll(state, { reportSubmitted: false, lastRollAt: null, lastReportAt: null, now: 0 }, rules),
    differs: false,
    because:
      'Neither is gated: a waiting player has no plan to reflect on, and a ' +
      'winner is refused by the session rather than by the turn. The seat-level ' +
      'answer is the surfaces` — see the mini app`s `canRoll(session)`.',
  },
  {
    what: 'arrivedByJump',
    ask: (state) => arrivedByJump(state),
    differs: false,
    because: 'Neither arrived by a snake or an arrow: one has not moved, and the other stepped.',
  },
  {
    what: 'arrivedOnSix',
    ask: (state) => arrivedOnSix(state),
    differs: false,
    because: 'A question about the throw that brought them, which neither of these describes.',
  },
];

describe('every engine answer about a player', () => {
  const RULES = [CLASSIC, LEGACY_MOBILE, ONLINE];

  it('tells the two states apart wherever it claims to', () => {
    for (const asked of ASKED) {
      for (const rules of RULES) {
        const must =
          typeof asked.differs === 'function' ? asked.differs(rules) : asked.differs;
        if (!must) continue;

        expect(asked.ask(WAITING, rules), `${asked.what} / ${rules.id}`).not.toEqual(
          asked.ask(WON, rules),
        );
      }
    }
  });

  it('has a written reason wherever it does not', () => {
    // The sentence eight defects hid behind was "these two get the same
    // answer". It is allowed, and it has to be argued.
    for (const asked of ASKED) {
      const always = asked.differs === true;
      if (always) continue;

      expect(asked.because, asked.what).toBeTruthy();
      expect((asked.because ?? '').length, asked.what).toBeGreaterThan(40);
    }
  });

  it('covers every engine function that takes a state', () => {
    // The guard against the ninth: a function added later that reads a state
    // and answers a question is a function that has to appear here.
    const source = [
      readSource('turn.ts'),
      readSource('game.ts'),
    ].join('\n');

    const declared = new Set(ASKED.map((asked) => asked.what));
    const found = [...source.matchAll(/export function (\w+)\(\s*state: GameState/g)].map(
      (match) => match[1] as string,
    );

    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((name) => !declared.has(name))).toEqual([]);
  });
});

/** Vitest runs from the package root, so the sources are where they look. */
function readSource(file: string): string {
  return readFileSync(`src/${file}`, 'utf8');
}
