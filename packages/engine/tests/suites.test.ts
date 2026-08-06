import { describe, expect, it } from 'vitest';
// A plain module, shared with the script that runs the suites. One suppressed
// line rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { UnreadableSuiteReport, capturedOutput, countsFrom } from '../../../scripts/lib/suites.mjs';

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
