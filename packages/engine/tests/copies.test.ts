import { describe, expect, it } from 'vitest';
import { describeProblems } from '../src/audit';
import type { BoardProblem } from '../src/audit';
// A plain module, shared with the script that uses it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { agreesWithEngine, markFor, renderResult, repositoryOf } from '../../../scripts/lib/copies.mjs';

/**
 * How a copy of the board is reported.
 *
 * `audit-copies.mjs` ran for the first time in a long while last pass, and two
 * of the eighteen copies came back as `DIFF … 1 differences from the engine`.
 * Which difference? The audit knew — `compareToReference` returns a finding per
 * square — and threw all of it away to print the length.
 *
 * The answer, once a person opened the file, was the arrow from 54 to 68: both
 * web3 hooks treat 54 as a win and stop there, so a player finishes on the
 * wrong square. One line the audit could have said and did not.
 *
 * These assert the rule — everything found is named — rather than the findings
 * that exist today, which are a property of eighteen files in another
 * directory and will change the moment one of them does.
 */

const problem = (from: number, to: number, finding = 'missing'): BoardProblem =>
  ({ finding, from, to, detail: `${finding} at ${from} → ${to}` }) as BoardProblem;

const render = (differences: BoardProblem[], problems: BoardProblem[] = []) =>
  renderResult(
    { file: 'a/board.ts', jumps: 20 - differences.length, problems, differences },
    describeProblems,
  ).join('\n');

describe('what a copy of the board reports', () => {
  it('names every difference, rather than counting them', () => {
    // The shape of the defect: for any set of findings, each one appears in
    // the output. A test listing today's two findings would pass just as well
    // against a report that printed a number.
    const differences = [problem(12, 8), problem(54, 68), problem(63, 2)];
    const output = render(differences);

    for (const finding of differences) {
      expect(output).toContain(String(finding.from));
      expect(output).toContain(finding.detail);
    }
  });

  it('names problems and differences both, since they are different questions', () => {
    // A snake that climbs is wrong on the board's own terms; a missing jump is
    // a disagreement with this engine. A report that showed one and summarised
    // the other would hide whichever it summarised.
    const output = render([problem(54, 68)], [problem(17, 7, 'wrong-direction')]);
    expect(output).toContain('wrong-direction');
    expect(output).toContain('54');
  });

  it('still gives the total, because a reader scanning eighteen wants it first', () => {
    expect(render([problem(1, 2), problem(3, 4)])).toContain('2 differences');
  });

  it('counts one difference as one, in words a person wrote', () => {
    // "1 differences from the engine" is what the report said for a year. It
    // is a small thing and it is the tell: nobody had read the output.
    const output = render([problem(54, 68)]);
    expect(output).toContain('1 difference from the engine');
    expect(output).not.toContain('1 differences');
  });

  it('is one line for a copy that agrees, and says so', () => {
    const lines = renderResult(
      { file: 'a/board.ts', jumps: 20, problems: [], differences: [] },
      describeProblems,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('ok');
    expect(lines[0]).toContain('20 jumps');
  });

  it('does not call a copy with findings ok', () => {
    expect(render([problem(54, 68)]).startsWith('DIFF')).toBe(true);
  });

  it('reads a copy with neither problems nor differences as agreeing', () => {
    expect(agreesWithEngine({ problems: [], differences: [] })).toBe(true);
    expect(agreesWithEngine({ problems: [], differences: [problem(1, 2)] })).toBe(false);
    expect(agreesWithEngine({ problems: [problem(1, 2)], differences: [] })).toBe(false);
  });

  it('treats a result missing its arrays as agreeing, rather than throwing', () => {
    // The extractor can produce a result with nothing to say. A report that
    // crashes on one file reports on none of the other seventeen.
    expect(agreesWithEngine({})).toBe(true);
    expect(() => renderResult({ file: 'x.ts', jumps: 0 }, describeProblems)).not.toThrow();
  });
});

describe('a jump the reference has and a copy does not', () => {
  it('is named with the jump, not only the square', () => {
    // "no jump from 54" made a reader open the file to find out what belonged
    // there — which is the work the audit exists to save.
    const [finding] = describeProblems([
      { finding: 'missing', from: 54, to: 68, detail: 'no jump from 54, reference says 54 → 68' },
    ]).split('\n');

    expect(finding).toContain('54');
    expect(finding).toContain('68');
  });
});

describe('a rule that lives in another file of the same repository', () => {
  /**
   * `detectRules` reads one file at a time, and the table printed a dash for
   * anything it did not find in the copy it was reading. A dash reads as "this
   * copy does not play that rule" — which is not what it meant. The published
   * app's re-rolling die is in `DiceStore.ts` and its report gate is in
   * `OnlinePlayer.store`, neither anywhere near a board.
   *
   * The caveat existed, as a paragraph in MIGRATION.md that a reader of the
   * table never sees. `elsewhere` puts it where it changes a conclusion.
   */
  const perFile = new Map<string, Record<string, boolean>>([
    ['leela/src/store/helper.ts', { entryOnSix: true, rerollOnRepeat: false }],
    ['leela/src/store/DiceStore.ts', { entryOnSix: false, rerollOnRepeat: true }],
    ['other/src/game.ts', { entryOnSix: false, rerollOnRepeat: true }],
  ]);

  const mark = (rule: string, file: string) =>
    markFor(rule, file, perFile.get(file) ?? {}, perFile);

  it('says yes when the rule is in this very file', () => {
    expect(mark('entryOnSix', 'leela/src/store/helper.ts')).toBe('yes');
  });

  it('says elsewhere when a neighbour in the same repository has it', () => {
    expect(mark('rerollOnRepeat', 'leela/src/store/helper.ts')).toBe('elsewhere');
  });

  it('does not borrow a rule from a different repository', () => {
    // The whole point of the mark is that it is about *this* codebase. A rule
    // another project plays says nothing about this one.
    const alone = new Map([
      ['a/game.ts', { rerollOnRepeat: false }],
      ['b/game.ts', { rerollOnRepeat: true }],
    ]);
    expect(markFor('rerollOnRepeat', 'a/game.ts', { rerollOnRepeat: false }, alone)).toBe('—');
  });

  it('says nothing found when no file in the repository has it', () => {
    const none = new Map([['a/game.ts', { reportGate: false }]]);
    expect(markFor('reportGate', 'a/game.ts', { reportGate: false }, none)).toBe('—');
  });

  it('reads the repository off the path, which is how the scan is rooted', () => {
    expect(repositoryOf('leela/src/store/helper.ts')).toBe('leela');
    expect(repositoryOf('LeelaGame.sol')).toBe('LeelaGame.sol');
  });

  it('does not call a file its own elsewhere', () => {
    // A file that lacks the rule must not be told the rule is in a neighbour
    // when the only neighbour is itself.
    const one = new Map([['a/game.ts', { reportGate: false }]]);
    expect(markFor('reportGate', 'a/game.ts', {}, one)).toBe('—');
  });
});
