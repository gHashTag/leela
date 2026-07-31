import { describe, expect, it } from 'vitest';
// @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
import { drawings, inlineDrawings, namesItsDecision } from '../../../scripts/lib/drawings.mjs';
// @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
import { unnamedReaders } from '../../../scripts/lib/whose.mjs';
import { readFileSync } from 'node:fs';
import {
  CLASSIC,
  applyRoll,
  createSession,
  hasWon,
  initialState,
  seededRoller,
  type GameState,
  type Session,
} from '@leela/engine';
import { EMPTY, record, type Journal } from '../src/reports';
import { canRoll, mayAsk, mayExport, mayShare, mayStartOver, mayThrow, mayWrite } from '../src/view';

/**
 * A disabled button is a drawing, and a drawing refuses nothing.
 *
 * Three defects in three consecutive passes had one shape. `draw` disabled a
 * control and the act behind it asked nothing, so any other path walked
 * straight past: a double tap on Save filed two accounts of one square, one tap
 * on the players button threw away a month of play, and the die took a throw
 * the drawing had already refused.
 *
 * The hundredth pass closed the 68 ambiguity as a class rather than waiting for
 * its ninth sighting. This is the second shape, closed the same way: **a
 * control's availability is decided by a named function, and the act behind it
 * asks the same one.**
 *
 * The name is what makes the second half possible. A condition written inline
 * is a decision nothing else can call, which is exactly why the acts did not
 * call it — and why `el.report.disabled = owing === null` was still a smell
 * even though `owingSeat` was doing the work: the drawing and the act were two
 * questions that happened to agree.
 */

const MECHANICAL = new Set(['roll.disabled']);
const SOURCE = readFileSync('src/main.ts', 'utf8');

describe('every control the app draws', () => {
  it('names the decision behind it', () => {
    // The rule, over the file as it is. `audit-drawings.mjs` runs the same
    // check in CI; this one fails in the package the change was made in.
    expect(inlineDrawings(SOURCE, MECHANICAL)).toEqual([]);
  });

  it('is a control this test can actually see', () => {
    // A regex that matched nothing would pass the check above for ever.
    const found = drawings(SOURCE) as Array<{ control: string }>;

    expect(found.length).toBeGreaterThan(5);
    expect(found.map((drawing) => drawing.control)).toContain('roll');
  });

  it('is not fooled by a condition dressed as a call', () => {
    // What the check is worth depends on what it refuses.
    const inline = { control: 'x', property: 'disabled', decided: "el.y.value.trim().length === 0" };
    const named = { control: 'x', property: 'disabled', decided: 'mayShare(el.y.value)' };
    const negated = { control: 'x', property: 'hidden', decided: '!mayStartOver(session)' };
    const plain = { control: 'x', property: 'hidden', decided: '!tools' };

    expect(namesItsDecision(inline, new Set())).toBe(false);
    expect(namesItsDecision(named, new Set())).toBe(true);
    expect(namesItsDecision(negated, new Set())).toBe(true);
    // A plain name is a decision something else computed and can be read again.
    expect(namesItsDecision(plain, new Set())).toBe(true);
  });

  it('may be mechanical, but only where that is written down', () => {
    const spin = { control: 'roll', property: 'disabled', decided: 'true' };

    expect(namesItsDecision(spin, new Set())).toBe(false);
    expect(namesItsDecision(spin, MECHANICAL)).toBe(true);
  });
});

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

function seated(state: GameState, reportSubmitted = true): Session {
  const session = createSession('device', [{ id: 'p1' }], CLASSIC);
  return {
    ...session,
    players: session.players.map((player) => ({ ...player, state, reportSubmitted })),
  };
}

describe('what each named decision answers', () => {
  const WON = playedToTheEnd();
  const written: Journal = record(EMPTY, 41, 'Something about this square.', 1);

  it('offers Start over only to a game that has ended', () => {
    // `hasWon`, not `is_finished`: a player who has not entered carries that
    // too, and the published app shows the button only once a game is over.
    expect(mayStartOver(seated(WON))).toBe(true);
    expect(mayStartOver(seated(initialState()))).toBe(false);
  });

  it('offers the writing box only while somebody owes an account', () => {
    expect(mayWrite(seated({ ...WON }, false))).toBe(true);
    expect(mayWrite(seated(WON, true))).toBe(false);
  });

  it('offers Share only once something has been written', () => {
    expect(mayShare('')).toBe(false);
    expect(mayShare('   \n  ')).toBe(false);
    expect(mayShare('a word')).toBe(true);
  });

  it('offers Save a copy only when there is a path to save', () => {
    // An empty file is not a keepsake, and a download nobody asked for is worse
    // than none at all.
    expect(mayExport(EMPTY.entries)).toBe(false);
    expect(mayExport(written.entries)).toBe(true);
  });

  it('offers the companion only where there is a bridge to it', () => {
    // The mini app is a static page and a model needs a key, so the reflection
    // comes from the bot. `sendData` exists only when Telegram opened this app
    // from a keyboard button — and a control drawn without it is a control that
    // cannot work, which is the whole subject of this file.
    expect(mayAsk('something written', true)).toBe(true);
    expect(mayAsk('something written', false)).toBe(false);
    expect(mayAsk('', true)).toBe(false);
    expect(mayAsk('   ', true)).toBe(false);
  });

  it('offers the die only where the throw would be taken', () => {
    expect(mayThrow(seated(initialState()), 'to see', false, false)).toBe('yes');
    expect(canRoll(seated(WON))).toBe(false);
  });
});

describe('whose values a function reads', () => {
  /**
   * `state`, `journal` and `intention` belong to the seat holding the turn.
   * They are right for the board, the die and the line underneath — that
   * surface *is* that seat's — and wrong everywhere the app talks about
   * somebody else, which it does more often than it looks.
   *
   * Three passes running that produced a defect: a share carrying three seats'
   * values at once, a chip opening another player's private accounts, and
   * "Save a copy" writing a file of whoever held the turn for somebody else to
   * carry away. Each was harmless the day before by accident.
   *
   * `audit-whose.mjs` runs the same check in CI; this one fails in the package
   * the change was made in.
   */
  const ALLOWED = new Set([
    'takeSeat', 'draw', 'roll', 'openPlans', 'askIntention', 'saveTheIntention',
    'startOver', 'showWriterHint', 'saveReport', 'openPath', 'exportPath',
    'takeThePastedSquare', 'importPath',
  ]);

  it('is said out loud, or the function has a seat of its own', () => {
    expect(unnamedReaders(SOURCE, ALLOWED).map((fn: { name: string }) => fn.name)).toEqual([]);
  });

  it('finds the readers at all, or the check is about nothing', () => {
    const readers = unnamedReaders(SOURCE, new Set());
    expect(readers.length).toBeGreaterThan(5);
  });

  it('is not fooled by the word appearing in prose', () => {
    // Half the lines in this repository are prose about what went wrong, and
    // `journal` is in a great many of them.
    const commented = 'function x() {\n  // the journal is not read here\n  return 1;\n}';
    const blocked = 'function y() {\n  /* intention, state, journal */\n  return 1;\n}';

    expect(unnamedReaders(commented, new Set())).toEqual([]);
    expect(unnamedReaders(blocked, new Set())).toEqual([]);
  });

  it('is not fooled by a property or a longer name', () => {
    const property = 'function x() {\n  return { journal: 1, state: 2 };\n}';
    const longer = 'function y() {\n  return loadJournalFor(localStorage, id);\n}';
    const member = 'function z() {\n  return section.intention;\n}';

    expect(unnamedReaders(property, new Set())).toEqual([]);
    expect(unnamedReaders(longer, new Set())).toEqual([]);
    expect(unnamedReaders(member, new Set())).toEqual([]);
  });

  it('catches a bare read', () => {
    const bare = 'function x() {\n  return pathOf(journal);\n}';
    expect(unnamedReaders(bare, new Set()).map((fn: { name: string }) => fn.name)).toEqual(['x']);
  });
});
