import { describe, expect, it } from 'vitest';
import type { BoardProblem } from '../src/audit';
// A plain module, shared with the script that uses it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { RECORDED, against, nameOf } from '../../../scripts/lib/copies.mjs';

/**
 * A verdict that never moves.
 *
 * `audit-copies.mjs` ended on `process.exit(wrong > 0 ? 1 : 0)`, counting
 * copies that disagree with the engine. Six of the eighteen do, and not one of
 * them is ours to fix — four are the 100-square Snakes and Ladders board
 * dropped into `processDiceRoll`, two are the web3 hooks with no arrow from 54,
 * and all six live in frozen donor repositories. So the check was red the day
 * it was written and red every day since. A check that cannot go green is one
 * nobody runs twice, and a seventh disagreement would have arrived into a
 * report that already said the audit was failing.
 *
 * The repository already answers this twice — `untranslated.mjs` and
 * `spillover.mjs` both record what they cannot repair and then guard the
 * record. These assert that guard as a rule: the seventh is loud, a record
 * that stops matching is loud, and a disagreement that changes shape without
 * changing size is loud too.
 */

const problem = (from: number, to: number, finding: string): BoardProblem =>
  ({ finding, from, to, detail: `${finding} at ${from} → ${to}` }) as BoardProblem;

/** A copy in the shape the audit builds and `against` reads. */
const copy = (
  file: string,
  differences: BoardProblem[] = [],
  problems: BoardProblem[] = [],
) => ({ file, jumps: 20, differences, problems });

/** The recorded six, rebuilt as results — the audit's own input, reconstructed. */
const onRecord = () =>
  RECORDED.map((line: string) => {
    const [file] = line.split(':');
    const kinds = /differences \d+ \(([^)]*)\)/.exec(line)?.[1] ?? '';
    const board = /problems \d+ \(([^)]*)\)/.exec(line)?.[1] ?? '';
    const jumps = Number(/: (\d+) jumps/.exec(line)?.[1]);

    const expand = (tally: string, at: number) =>
      tally
        .split(', ')
        .filter(Boolean)
        .flatMap((part) => {
          const [count, ...rest] = part.split(' ');
          return Array.from({ length: Number(count) }, (_, i) =>
            problem(at + i, at + i + 1, rest.join(' ')),
          );
        });

    return { file, jumps, differences: expand(kinds, 1), problems: expand(board, 500) };
  });

describe('the copies nobody can fix, kept as a record', () => {
  it('says nothing when what is there is what is written down', () => {
    // The point of the change: this is now a state the audit can be in.
    // `wrong > 0` could never be false, so the exit code carried no news.
    expect(against(onRecord())).toEqual({ fresh: [], rotted: [] });
  });

  it('calls out a copy that disagrees and is not on the record', () => {
    const seventh = copy('SomeFork/src/board.ts', [problem(31, 7, 'missing')]);

    const { fresh } = against([...onRecord(), seventh]);

    expect(fresh).toHaveLength(1);
    expect(fresh[0]?.file).toBe('SomeFork/src/board.ts');
  });

  it('calls out a record that has stopped describing anything', () => {
    // A donor fixed upstream, or a file moved. Silence here is how a record
    // becomes an instruction about something that is not there any more.
    const [first, ...rest] = onRecord();
    expect(first).toBeDefined();

    const { rotted } = against(rest);

    expect(rotted).toEqual([RECORDED[0]]);
  });

  it('notices a disagreement that changed shape without changing size', () => {
    // This is why the record counts by kind rather than summing. A board whose
    // one missing jump became one *extra* jump is a different board, and a
    // record keeping only `1 difference` would go on passing over it.
    const [first, ...rest] = onRecord();
    const swapped = {
      ...first,
      differences: (first?.differences ?? []).map((difference: BoardProblem) => ({
        ...difference,
        finding: 'extra',
      })),
    };

    const { fresh, rotted } = against([swapped, ...rest]);

    expect(fresh).toHaveLength(1);
    expect(rotted).toEqual([RECORDED[0]]);
  });

  it('ignores a copy that agrees, however many jumps it carries', () => {
    const { fresh, rotted } = against([...onRecord(), copy('leela/src/store/helper.ts')]);

    expect(fresh).toEqual([]);
    expect(rotted).toEqual([]);
  });

  it('names a copy the same way however the findings arrive', () => {
    // The record is matched on this sentence. If it depended on the order the
    // engine happened to return findings in, every record would rot on a day
    // nothing changed.
    const differences = [problem(9, 31, 'extra'), problem(12, 8, 'missing'), problem(4, 14, 'extra')];

    expect(nameOf(copy('a/board.ts', differences))).toBe(
      nameOf(copy('a/board.ts', [...differences].reverse())),
    );
  });

  it('keeps a record every line of which is arithmetic', () => {
    // Each line is `N differences (a kind, b kind)` and `M problems (…)`. The
    // parts have to sum to the whole, or the line is a sentence nothing the
    // audit produces will ever match — a record that rots on the day it is
    // written, by hand, in the file that exists to stop that.
    for (const line of RECORDED as string[]) {
      for (const part of ['differences', 'problems']) {
        const stated = Number(new RegExp(`${part} (\\d+)`).exec(line)?.[1]);
        const tally = new RegExp(`${part} \\d+ \\(([^)]*)\\)`).exec(line)?.[1] ?? '';
        const summed = tally
          .split(', ')
          .filter(Boolean)
          .reduce((total, entry) => total + Number(entry.split(' ')[0]), 0);

        expect({ line, part, summed }).toEqual({ line, part, summed: stated });
      }
    }
  });

  it('holds one line per copy, with no line written twice', () => {
    expect(new Set(RECORDED).size).toBe(RECORDED.length);
  });
});
