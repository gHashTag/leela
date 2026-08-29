import { describe, expect, it } from 'vitest';
// A plain module, shared with the script that runs the suites. One suppressed
// line rather than a `.d.ts`, which would be a second description of it.
// One line, and it has to stay one line: `@ts-expect-error` suppresses the
// line that follows it, and a wrapped import puts the `from` clause — which is
// where the error is reported — six lines further down. Splitting this made the
// directive itself unused AND the error surface, both at once.
// @ts-expect-error - untyped .mjs
// prettier-ignore
import { MOST_FAILURES_SHOWN, UnreadableSuiteReport, capturedOutput, countsFrom, failureLines, failuresFrom } from '../../../scripts/lib/suites.mjs';

/**
 * Reading a suite's own count of itself, out of a run that failed.
 *
 * `audit-claims` is the check that holds README's test table to the suites. On
 * 2026-08-06 it printed nine measured counts, reached `@leela/mobile`, and died
 * with a hundred kilobytes of stack: `execFileSync` throws on a non-zero exit,
 * vitest exits non-zero whenever one assertion is red, and the report the audit
 * wanted — `"numTotalTests":396,"numFailedTests":1` — was sitting unread on the
 * thrown error. The one check whose subject is whether this repository's stated
 * numbers are true replaced its answer with a stack trace, and the table went
 * unenforced while it drifted 311 tests.
 *
 * These assert the shape of that defect, not today's packages and not today's
 * numbers. The counts change every pass, and a test that repeated them would be
 * a second hand-kept copy of the very thing under suspicion — the reason
 * `claims.test.ts` beside this one already gives for asserting rules rather
 * than figures. So the input is built from the boundary instead: for any counts
 * at all, the same numbers must come back however the text was dressed up and
 * however it arrived.
 */

/** A vitest JSON report carrying whatever counts a case wants to claim. */
const reportFor = (total: number, failed: number) =>
  JSON.stringify({
    numTotalTests: total,
    numPassedTests: total - failed,
    numFailedTests: failed,
    numTotalTestSuites: 1,
    success: failed === 0,
    testResults: [{ name: '/somewhere/a.test.ts', status: failed === 0 ? 'passed' : 'failed' }],
  });

/** What `execFileSync` throws: the output is there, the exit code is not zero. */
const thrownBy = (stdout: string) =>
  Object.assign(new Error('Command failed: npx vitest run --reporter=json'), {
    status: 1,
    signal: null,
    stdout,
    stderr: '',
    output: [null, stdout, ''],
  });

/**
 * The edge of every dimension the capture can vary along, crossed with itself.
 *
 * Banner or none, green or red, string or Buffer, alone or with trailing noise:
 * whatever one of these the runner happens to hand over, the number read out of
 * it must be the number the reporter wrote. Enumerating the four captures seen
 * so far would be a list of what has already gone wrong once.
 */
const DRESSINGS: Array<[string, (json: string) => string]> = [
  ['bare', (json) => json],
  ['after a banner line', (json) => `\n> @leela/x test\n> vitest run\n\n${json}`],
  ['after a banner containing a brace', (json) => `RUN v3.2.4 /repo/packages/{engine,ai}\n${json}`],
  ['with trailing noise', (json) => `${json}\n\nJSON report written to stdout\n`],
  ['both', (json) => `RUN v3.2.4 {mode: test}\n${json}\ndone in 4.11s\n`],
];

const COUNTS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [1, 1],
  [396, 1],
  [3336, 17],
];

describe('the same numbers, however the text arrived', () => {
  for (const [dressing, dress] of DRESSINGS) {
    for (const [total, failed] of COUNTS) {
      it(`reads ${total}/${failed} ${dressing}`, () => {
        const counts = countsFrom(dress(reportFor(total, failed)));
        expect(counts.total).toBe(total);
        expect(counts.failed).toBe(failed);
        expect(counts.passed).toBe(total - failed);
      });
    }
  }

  it('does not care whether the run succeeded', () => {
    // The defect in one line: a red run has counted its tests as carefully as a
    // green one, and the old code could only read the green.
    for (const [total, failed] of COUNTS) {
      const green = countsFrom(reportFor(total, 0));
      const red = countsFrom(reportFor(total, failed));
      expect(red.total).toBe(green.total);
      expect(red.red).toBe(failed > 0);
    }
  });

  it('reads a thrown error exactly as it reads stdout', () => {
    for (const [dressing, dress] of DRESSINGS) {
      for (const [total, failed] of COUNTS) {
        const text = dress(reportFor(total, failed));
        const asStdout = countsFrom(text);
        const asThrown = countsFrom(capturedOutput(thrownBy(text)));
        expect(asThrown, `${dressing} ${total}/${failed}`).toEqual(asStdout);
      }
    }
  });

  it('reads the output off `output[1]` when `stdout` is absent', () => {
    // Node fills both and documents neither as the one to use.
    const text = reportFor(42, 3);
    const partial = Object.assign(new Error('Command failed'), { output: [null, text, ''] });
    expect(countsFrom(capturedOutput(partial))).toEqual(countsFrom(text));
  });

  it('reads a Buffer as readily as a string', () => {
    const text = reportFor(42, 3);
    const buffered = Object.assign(new Error('Command failed'), { stdout: Buffer.from(text, 'utf8') });
    expect(countsFrom(capturedOutput(buffered))).toEqual(countsFrom(text));
  });

  it('is red when the reporter says so even with nothing failing to count', () => {
    // A file that throws on import fails to collect: zero failed tests, and the
    // run is still red. Counting failures alone would call this green.
    const collapsed = JSON.stringify({ numTotalTests: 0, numFailedTests: 0, success: false });
    expect(countsFrom(collapsed).red).toBe(true);
  });
});

describe('what cannot be read is named, never guessed', () => {
  /**
   * Every way the capture can carry no report, and none of them may be zero.
   *
   * Zero is the dangerous answer rather than merely a wrong one: `--write` puts
   * what this returns into README as a measured fact, so a suite that failed to
   * start would be published as a package with no tests.
   */
  const UNREADABLE: Array<[string, unknown, string]> = [
    ['the runner error and nothing else', 'Command failed', 'no-json'],
    ['an empty capture', '', 'empty'],
    ['whitespace only', '   \n\t\n', 'empty'],
    ['nothing at all', undefined, 'empty'],
    ['null', null, 'empty'],
    ['a truncated object', '{"numTotalTests":39', 'not-a-report'],
    ['JSON from some other tool', '{"ok":true,"tests":12}', 'not-a-report'],
    ['a brace in prose', 'error in {engine,ai}: could not resolve', 'not-a-report'],
    ['a report whose count is not a number', '{"numTotalTests":"396"}', 'not-a-report'],
  ];

  for (const [what, input, kind] of UNREADABLE) {
    it(`raises rather than returning a count for ${what}`, () => {
      expect(() => countsFrom(input as string)).toThrowError(UnreadableSuiteReport);

      let caught: unknown;
      try {
        countsFrom(input as string);
      } catch (error) {
        caught = error;
      }
      const named = caught as { name: string; kind: string; message: string };
      expect(named.name).toBe('UnreadableSuiteReport');
      expect(named.kind).toBe(kind);
      expect(named.message.length).toBeGreaterThan(0);
    });
  }

  it('quotes back what it could not read, so the diagnosis names something', () => {
    // A message that says only "unexpected token" sends a reader to the wrong
    // file. What arrived is the evidence.
    let message = '';
    try {
      countsFrom('ENOENT: npx not found on PATH');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('npx not found');
  });

  it('never answers with a number it did not read', () => {
    // The shape of the whole guard: for every unreadable input, there is no
    // path that yields counts. If one ever returns instead of throwing, this
    // sees it whatever the number is.
    for (const [what, input] of UNREADABLE) {
      let returned: unknown = 'nothing was returned';
      try {
        returned = countsFrom(input as string);
      } catch {
        continue;
      }
      expect.fail(`${what} returned ${JSON.stringify(returned)} instead of raising`);
    }
  });
});

/**
 * WHICH tests failed, not only how many.
 *
 * `countsFrom` above answers *how many*, and for four months that was the whole
 * of what a red suite got said about it: `@leela/engine: 1 of 553 failing`. A
 * reader cannot act on that. It names no test, no file and no reason — and the
 * report it came out of carried all three. `audit-claims.mjs` opens by saying
 * that `> /dev/null` is how a red becomes unexplainable; throwing the names
 * away was the same thing one layer in.
 *
 * **The fixtures below are real vitest output**, not a shape invented here. A
 * suite was built to fail on purpose — one wrong assertion, one file importing
 * a module that does not exist — and run. That matters because the second case
 * is the one an invented fixture would have missed: a file that fails to
 * COLLECT has an empty `assertionResults`, contributes zero to `numTotalTests`
 * AND zero to `numFailedTests`, and is red only by `success: false`. A reader
 * walking assertions alone returns nothing for it.
 */

/** Straight out of `vitest run --reporter=json` on a deliberately red suite. */
const REAL_RED = JSON.stringify({
  numTotalTests: 2,
  numPassedTests: 1,
  numFailedTests: 1,
  success: false,
  testResults: [
    {
      name: '/private/tmp/redsuite/tests/a.test.ts',
      status: 'failed',
      message: '',
      assertionResults: [
        { fullName: 'a group passes', status: 'passed', failureMessages: [] },
        {
          fullName: 'a group fails on purpose',
          status: 'failed',
          failureMessages: [
            'AssertionError: expected 1 to be 2 // Object.is equality\n    at /private/tmp/redsuite/tests/a.test.ts:4:44',
          ],
        },
      ],
    },
    {
      name: '/private/tmp/redsuite/tests/broken.test.ts',
      status: 'failed',
      message:
        'Failed to load url ./does-not-exist (resolved id: ./does-not-exist) in /private/tmp/redsuite/tests/broken.test.ts. Does the file exist?',
      assertionResults: [],
    },
  ],
});

describe('which tests failed, out of the same report the counts came from', () => {
  it('names the failing test, its file and its reason', () => {
    const found = failuresFrom(REAL_RED);

    expect(found[0]).toEqual({
      file: '/private/tmp/redsuite/tests/a.test.ts',
      name: 'a group fails on purpose',
      why: 'AssertionError: expected 1 to be 2 // Object.is equality',
    });
  });

  it('REPORTS A FILE THAT NEVER RAN, which has no failing assertion to find', () => {
    /*
     * The case that makes this more than a convenience. `broken.test.ts` is
     * `status: "failed"` with an EMPTY `assertionResults` — it counts as zero
     * total and zero failed — so a reader that walked assertions would answer
     * "nothing failed" about a suite that plainly did.
     */
    const found = failuresFrom(REAL_RED);
    const never = found.find((one: { name: string | null }) => one.name === null);

    expect(never).toBeDefined();
    expect(never.file).toContain('broken.test.ts');
    expect(never.why).toContain('Failed to load url');
    expect(found).toHaveLength(2);
  });

  it('says nothing about a green run', () => {
    expect(failuresFrom(reportFor(12, 0))).toEqual([]);
  });

  it('refuses to guess when the report cannot be read, exactly as the counts do', () => {
    // Two readers of one format disagreeing about whether it is readable would
    // be worse than either being wrong, so this asks the other one.
    expect(() => failuresFrom('Command failed')).toThrow(UnreadableSuiteReport);
    expect(() => failuresFrom('')).toThrow(UnreadableSuiteReport);
  });

  it('survives a report whose entries are missing the fields it wants', () => {
    const odd = JSON.stringify({
      numTotalTests: 1,
      numFailedTests: 1,
      success: false,
      testResults: [{ status: 'failed' }, { assertionResults: [{ status: 'failed' }] }],
    });

    const found = failuresFrom(odd);
    expect(found).toHaveLength(2);
    expect(found[1].name).toBe('(an unnamed test)');
  });
});

describe('printing those failures without burying the rest of the report', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ file: `/a/b/t${i}.test.ts`, name: `test ${i}`, why: 'boom' }));

  it('shortens the path, because an absolute one is most of a terminal', () => {
    expect(failureLines(many(1), (path: string) => path.split('/').slice(-2).join('/'))[0]).toContain(
      'b/t0.test.ts \u203a test 0',
    );
  });

  it('CAPS THE LIST AND SAYS IT CAPPED IT', () => {
    /*
     * A suite with two hundred red tests has one cause, and two hundred lines
     * scroll the alarm off the top of the terminal — the way of hiding a
     * finding that `report.mjs` exists to stop. A list silently cut at eight
     * reads as a list of eight, so what was dropped is said.
     */
    const lines = failureLines(many(MOST_FAILURES_SHOWN + 5));

    expect(lines).toHaveLength(MOST_FAILURES_SHOWN + 1);
    expect(lines[lines.length - 1]).toContain('5 more not shown');
  });

  it('does not add a note when nothing was dropped', () => {
    expect(failureLines(many(MOST_FAILURES_SHOWN)).join('\n')).not.toContain('not shown');
    expect(failureLines([])).toEqual([]);
  });

  it('marks a file that never ran as such rather than naming a test', () => {
    const lines = failureLines([{ file: '/a/broken.test.ts', name: null, why: 'Failed to load url' }]);

    expect(lines[0]).toContain('never ran');
    expect(lines[0]).not.toContain('\u203a');
  });
});
