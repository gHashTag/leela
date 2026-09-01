import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error - the reporter is plain JavaScript, shared with the audit scripts
import { finish } from '../../../scripts/lib/report.mjs';

/**
 * The last line an audit prints, against the code it exits on.
 *
 * Four audits decided to fail and then printed an all-clear as their final
 * line. Each set `process.exitCode = 1` in a staleness branch, and each then
 * reached an all-clear condition written over a different variable, which knew
 * nothing about that branch. The exit code was right. The sentence under it was
 * wrong, and a human reads the sentence — an hour went into debugging a package
 * whose failures a script had already named on screen, above its own all-clear.
 *
 * This holds the shape of that defect rather than the four places it was found:
 * a grid over every subset of sections drawn from the EDGES of what a section
 * can be — failing or not, speaking or silent, with prose around its lines or
 * without — in both orders. Nothing here names an audit. Naming them would make
 * this a fifth copy of the rule, which is the defect one level up: the rule was
 * restated in prose in four epilogues and implemented in one script.
 *
 * Three claims, asserted on every row:
 *
 *   i.   the all-clear appears if and only if nothing failing spoke;
 *   ii.  when something failing spoke, the last non-empty line on screen is its;
 *   iii. the returned code is 1 exactly when something failing spoke.
 *
 * (ii) is the one that is easy to leave out and the one the incident was about.
 * A run may find twenty standing, already-recorded things and one alarm; if the
 * twenty print last, the alarm has scrolled off the top of the terminal and the
 * exit code is all that is left of it.
 */

const ALL_CLEAR = 'ALL-CLEAR nothing to report';

type Section = {
  id: string;
  failing: boolean;
  lines: string[];
  heading?: string;
  epilogue?: string;
};

/**
 * The edges of what a section can be, not a list of the ones in use.
 *
 * Every field that the reporter branches on is at both of its extremes here:
 * `failing` both ways, `lines` empty and not, `heading`/`epilogue` present and
 * absent, and an epilogue that is several lines with a blank one inside it —
 * because the real ones are, and "the last line" is the last NON-EMPTY line.
 */
const edges: Section[] = [
  {
    id: 'A',
    failing: true,
    heading: 'A heading of a failing section',
    lines: ['  A first', '  A second'],
    epilogue: '\nA epilogue, which is\nA two lines and a blank one above them',
  },
  { id: 'B', failing: true, lines: ['  B alone, no prose around it'] },
  { id: 'C', failing: true, lines: [] },
  {
    id: 'D',
    failing: false,
    heading: 'D heading of a standing note',
    lines: ['  D first', '  D second', '  D third'],
    epilogue: '\nD epilogue',
  },
  { id: 'E', failing: false, lines: [] },
];

/** Every subset of the edges, in the order given and reversed. */
function grid(): Section[][] {
  const rows: Section[][] = [];
  for (let mask = 0; mask < 1 << edges.length; mask += 1) {
    const chosen = edges.filter((_, at) => (mask & (1 << at)) !== 0);
    rows.push(chosen);
    if (chosen.length > 1) rows.push([...chosen].reverse());
  }
  return rows;
}

/**
 * What a row means, computed from the row rather than looked up.
 *
 * A section that is `failing` and has nothing to say is silence: these lists are
 * built unconditionally by the callers and are empty on almost every run, so a
 * declared-failing empty one cannot be a failure. Saying that here, once,
 * independently of the reporter, is what makes the assertions below evidence
 * rather than a restatement of the implementation.
 */
const speaks = (section: Section) => section.lines.length > 0;
const failed = (row: Section[]) => row.some((section) => section.failing && speaks(section));

/** Which section a printed line came from, by the marker every one of its strings carries. */
function whose(line: string, row: Section[]): Section | undefined {
  return row.find((section) =>
    [section.heading ?? '', ...section.lines, section.epilogue ?? ''].some(
      (text) => text.length > 0 && text.split('\n').some((one) => one.trim() === line.trim()),
    ),
  );
}

/** Run the reporter with the console captured, exactly as a terminal would see it. */
function run(row: Section[]): { code: number; out: string[] } {
  const said: string[] = [];
  const was = console.log;
  console.log = (...parts: unknown[]) => {
    said.push(parts.map(String).join(' '));
  };
  try {
    const code = finish({ sections: row, allClear: ALL_CLEAR }) as number;
    return { code, out: said.join('\n').split('\n') };
  } finally {
    console.log = was;
  }
}

afterEach(() => {
  // A test that leaves the console replaced takes the next failure's message
  // with it.
  expect(typeof console.log).toBe('function');
});

describe('the last line a reader sees', () => {
  const rows = grid();

  it('covers the edges it claims to', () => {
    // The grid is generated, so this asserts the generator reached the corners:
    // an empty row, a row that is only failing sections, one that is only
    // silent ones, and rows holding a failing and a passing section in each
    // order.
    expect(rows.some((row) => row.length === 0)).toBe(true);
    expect(rows.some((row) => row.length > 0 && row.every((s) => s.failing))).toBe(true);
    expect(rows.some((row) => row.length > 0 && row.every((s) => !speaks(s)))).toBe(true);

    const both = rows.filter(
      (row) =>
        row.some((s) => s.failing && speaks(s)) && row.some((s) => !s.failing && speaks(s)),
    );
    expect(both.some((row) => row.findIndex((s) => s.failing) < row.findIndex((s) => !s.failing))).toBe(true);
    expect(both.some((row) => row.findIndex((s) => s.failing) > row.findIndex((s) => !s.failing))).toBe(true);
  });

  it('says the all-clear if and only if nothing failing spoke', () => {
    for (const row of rows) {
      const { out } = run(row);
      const said = out.includes(ALL_CLEAR);
      expect(said, `${row.map((s) => s.id).join('') || '(no sections)'}`).toBe(!failed(row));
    }
  });

  it('gives the last word on screen to the thing that failed', () => {
    for (const row of rows) {
      if (!failed(row)) continue;

      const { out } = run(row);
      const last = [...out].reverse().find((line) => line.trim().length > 0);
      const from = whose(last ?? '', row);

      const named = row.map((s) => s.id).join('');
      expect(last, named).toBeTruthy();
      expect(from, `${named}: nothing owns ${JSON.stringify(last)}`).toBeTruthy();
      expect(from?.failing, `${named}: the last line came from ${from?.id}`).toBe(true);
    }
  });

  it('returns the code its own last line agrees with', () => {
    for (const row of rows) {
      const { code, out } = run(row);
      const named = row.map((s) => s.id).join('') || '(no sections)';
      expect(code, named).toBe(failed(row) ? 1 : 0);
      // And the two are the same claim, which is the whole point: a run that
      // exits 1 must not be signing off with the all-clear.
      expect(out.includes(ALL_CLEAR), named).toBe(code === 0);
    }
  });

  it('prints everything a speaking section had to say, whatever it means', () => {
    // The rearrangement is allowed to move a block. It is not allowed to lose
    // one — an audit that hides its standing findings to make the alarm last
    // has traded one silence for another.
    for (const row of rows) {
      const { out } = run(row);
      const screen = out.join('\n');
      for (const section of row) {
        for (const line of section.lines) {
          expect(screen.includes(line), `${section.id}: ${line}`).toBe(true);
        }
        if (speaks(section) && section.heading) {
          expect(screen.includes(section.heading), `${section.id}: heading`).toBe(true);
        }
        if (!speaks(section) && section.heading) {
          expect(screen.includes(section.heading), `${section.id}: silent heading`).toBe(false);
        }
      }
    }
  });
});
