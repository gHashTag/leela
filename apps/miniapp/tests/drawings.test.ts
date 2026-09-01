import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
// @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
import { LITERALS, drawings, inlineDrawings, namesItsDecision } from '../../../scripts/lib/drawings.mjs';
// @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
import { unnamedReaders } from '../../../scripts/lib/whose.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Duplicated from `audit-drawings.mjs` by design — the audit carries the whole
// account of why the waiver is a pair and this carries the pair alone — and the
// two must agree. It was a `Set(['roll.disabled'])` in both places, and that
// spelling excused not the two literals it was written for but every statement
// that would ever be assigned to that control. The grid below is what now holds
// it to its own words.
const MECHANICAL = new Map([['roll.disabled', new Set(['true', 'false'])]]);

/**
 * This package's root, taken from this file's own location rather than from the
 * working directory.
 *
 * Seven suites in this directory used to read their fixtures through
 * `process.cwd()`. That works while Vitest is started inside `apps/miniapp` and
 * throws ENOENT the moment the same file is collected from anywhere else — a
 * repository-root run, a coverage pass over all ten workspaces — and the
 * measured symptom was `ENOENT /Users/playra/leela/src/state.ts`. This file
 * read a bare relative `'src/main.ts'`, which is the same defect with the
 * working directory left implicit rather than named. The long version is at the
 * top of `partly-written.test.ts`, which is also where the guard lives.
 */
const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE = blank(readFileSync(resolve(PACKAGE, 'src/main.ts'), 'utf8'));

/** A drawing as `drawings` reports it, with the span of the decision it read. */
type Drawing = {
  control: string;
  property: string;
  decided: string;
  from: number;
  to: number;
};

/**
 * Every decided-expression shape `lib/drawings.mjs` itself calls un-naming.
 *
 * Read off the module's own rules rather than listed by hand: each member of
 * its exported `LITERALS` and each of those negated, a numeric literal in the
 * three forms its `/^!?-?\d/` admits, and a read of the DOM in the two forms
 * its `/^!?el\./` admits — the second of which, `el.…value.trim().length === 0`,
 * is the exact expression the module's own comment names as the thing it exists
 * to catch.
 *
 * None of them contains a `;`, a newline, or a `.disabled`/`.hidden` of its
 * own, so substituting one into a statement can neither split that statement
 * nor conjure a second one. The grid would otherwise be measuring the
 * substitution rather than the check.
 */
function unNaming(): string[] {
  const literals = [...(LITERALS as Set<string>)];

  return [
    ...literals,
    ...literals.map((literal) => `!${literal}`),
    '0',
    '1',
    '-1',
    '!0',
    'el.writerText.checked',
    '!el.writerText.checked',
    'el.writerText.value.trim().length === 0',
  ];
}

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

    expect(namesItsDecision(inline, new Map())).toBe(false);
    expect(namesItsDecision(named, new Map())).toBe(true);
    expect(namesItsDecision(negated, new Map())).toBe(true);
    // A plain name is a decision something else computed and can be read again.
    expect(namesItsDecision(plain, new Map())).toBe(true);
  });

  it('may be mechanical, but only in the decision that is written down', () => {
    // The waiver excuses a decision on a control, not the control. `= true` and
    // `= false` are the die holding its own control for the length of a spin;
    // a question about the game assigned to the same control is still a
    // question about the game, and still has to carry a name.
    const spin = { control: 'roll', property: 'disabled', decided: 'true' };
    const finally_ = { control: 'roll', property: 'disabled', decided: 'false' };
    const decision = {
      control: 'roll',
      property: 'disabled',
      decided: 'el.writerText.value.trim().length === 0',
    };

    expect(namesItsDecision(spin, new Map())).toBe(false);
    expect(namesItsDecision(spin, MECHANICAL)).toBe(true);
    expect(namesItsDecision(finally_, MECHANICAL)).toBe(true);
    // The plant that this audit reported nothing about for as long as the
    // waiver was a Set of control names.
    expect(namesItsDecision(decision, MECHANICAL)).toBe(false);
  });

  it('refuses an un-naming decision on every control, waived or not', () => {
    /**
     * The shape of the defect rather than the case that revealed it.
     *
     * Over the grid of every drawing in `main.ts` — the waived control included,
     * all three of its statements — against every expression the module itself
     * calls un-naming, putting that expression in that one statement must
     * produce exactly one finding. The file is clean to begin with, so one
     * substitution can account for exactly one finding and nothing else.
     *
     * The single exception is the waiver's own pair, which is read out of
     * `MECHANICAL` rather than spelled out here.
     *
     * Reading it out of `MECHANICAL` alone is not enough, and that was measured
     * rather than reasoned. The first version of this grid took the waiver's
     * word for what was excused, so a waiver that grew took the grid's
     * expectation with it: adding `el.writerText.checked` to the pair left
     * every one of these cells green — the very shape of the defect this test
     * was written for, reproduced inside the test written to close it. An
     * excuse that decides what it is checked against is not checked. So the
     * grid also says what a waiver is allowed to contain: `HELD` below.
     */
    const statements = drawings(SOURCE) as Drawing[];
    const shapes = unNaming();

    /**
     * What a mechanical waiver may excuse: a control simply on, or simply off.
     *
     * Not a sample of two — the whole population. `disabled` and `hidden` are
     * booleans, so an act holding its own control for the length of itself can
     * only write one of these two. Anything else assigned there is a question
     * about the game, whatever the comment above the waiver says, and a
     * question about the game has to carry a name like every other.
     */
    const HELD = new Set(['true', 'false']);

    // A grid over nothing would pass for ever, and the control this exists for
    // must be in it.
    expect(statements.length).toBeGreaterThan(5);
    expect(statements.filter((one) => `${one.control}.${one.property}` === 'roll.disabled').length)
      .toBeGreaterThan(1);
    expect(shapes.length).toBeGreaterThan(10);

    // A waiver may only ever hold a control in a state. Asked of the waiver
    // itself, before any of it is believed.
    const questions: string[] = [];
    for (const [control, excused] of MECHANICAL) {
      for (const shape of excused) {
        if (!HELD.has(shape)) questions.push(`el.${control} = ${shape}`);
      }
    }
    expect(questions).toEqual([]);

    const wrong: string[] = [];
    let waivedCells = 0;

    for (const statement of statements) {
      const control = `${statement.control}.${statement.property}`;

      for (const shape of shapes) {
        const mutated = SOURCE.slice(0, statement.from) + shape + SOURCE.slice(statement.to);
        const waived = (MECHANICAL.get(control)?.has(shape) ?? false) === true;
        const wanted = waived ? 0 : 1;
        const found = (inlineDrawings(mutated, MECHANICAL) as unknown[]).length;

        if (waived) waivedCells += 1;
        if (found !== wanted) wrong.push(`el.${control} = ${shape} — ${found}, wanted ${wanted}`);
      }
    }

    expect(wrong).toEqual([]);
    // And the waiver is still a waiver: some cells really were excused, so the
    // grid above is not green merely because nothing was ever exempt.
    expect(waivedCells).toBeGreaterThan(0);
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
  // Duplicated from `audit-whose.mjs` by design — the audit carries a sentence
  // per name and this carries the names alone — and the two must agree. They
  // gained `openPlan` and `whatIsBeingWritten` together, on the pass where the
  // reader stopped mistaking a ternary's else-colon for an object key and
  // stopped mistaking an object return-type annotation for a body. Neither
  // function changed; both were simply unreadable before.
  const ALLOWED = new Set([
    'takeSeat', 'draw', 'roll', 'openPlans', 'openPlan', 'askIntention',
    'saveTheIntention', 'startOver', 'showWriterHint', 'saveReport', 'openPath',
    'exportPath', 'takeThePastedSquare', 'importPath', 'whatIsBeingWritten',
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
