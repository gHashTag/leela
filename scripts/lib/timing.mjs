/**
 * A test may not put an upper bound on wall-clock time without saying why.
 *
 * Three flakes in this repository were one shape: a test asserting that
 * something finished inside N milliseconds. `kept.test.ts` failed at 1283 ms
 * against a bound of 1_000 when a dozen workspaces ran at once; `waiting.test.ts`
 * failed against 400 ms at a clean checkout the next morning; and the payload
 * and suite-timeout flakes of #64 were the same idea wearing a different hat.
 * **Every one was repaired by raising the number**, which is the move #46–#49
 * already wrote down as wrong: a measurement taken to explain a load problem is
 * subject to the load, so the next busy machine moves the goalposts again.
 *
 * The asymmetry is the whole rule. An UPPER bound — *it finished within N* —
 * is falsified by a slow machine, which says nothing about the code. A LOWER
 * bound — *it waited at least N* — a slow machine only makes MORE true, so it
 * cannot flake that way and is not recorded here.
 *
 * What replaces an upper bound is nearly always available: count the calls
 * instead of timing them, or drive the clock yourself with fake timers. Both
 * give an exact answer on a loaded machine and an idle one alike. Where neither
 * fits, the bound is declared below with its margin, and the declaration is
 * re-derived on every run so one that stops describing anything fails.
 */

/** `Date.now()` or `performance.now()`, as a difference. */
const CLOCK_DIFFERENCE = /(?:Date|performance)\s*\.\s*now\s*\(\s*\)\s*-/;

/** The matchers that make a reading a ceiling rather than a floor. */
const UPPER = /\.\s*toBeLessThan(?:OrEqual)?\s*\(/;

/** And the ones that make it a floor, which load cannot break. */
const LOWER = /\.\s*toBeGreaterThan(?:OrEqual)?\s*\(/;

/**
 * Every wall-clock bound in a source, with which kind it is.
 *
 * A statement rather than a line: an assertion broken over three lines by the
 * formatter is one bound, and reading line by line would find the clock on one
 * line and its matcher on another and report neither.
 *
 * @param source blanked source — comments gone, strings kept. A bound quoted in
 *   a comment explaining this rule is not a bound, and this file is full of
 *   them.
 * @returns `[{ statement, upper }]` in the order they appear.
 */
export function wallClockBounds(source) {
  const found = [];

  for (const statement of String(source ?? '').split(';')) {
    if (!CLOCK_DIFFERENCE.test(statement)) continue;
    if (!UPPER.test(statement) && !LOWER.test(statement)) continue;

    found.push({ statement: statement.trim().replace(/\s+/g, ' '), upper: UPPER.test(statement) });
  }

  return found;
}

/**
 * The upper bounds this repository still has, and why each is allowed.
 *
 * Not a list of things to ignore. Each entry is a claim that the margin is wide
 * enough that load cannot close it, and the number in it is measured. An entry
 * naming a file that no longer holds one fails, and a file that grows one
 * without an entry fails.
 */
export const DECLARED = [
  {
    file: 'apps/miniapp/tests/waiting.test.ts',
    bounds: 2,
    because:
      'both are ceilings on an operation whose nominal cost is under 30 ms, set at 10_000 and ' +
      '1_000 — margins of 300x and 30x. The first version of the second was 400 ms and it went ' +
      'red at a clean checkout, which is what the present numbers were chosen against. The file ' +
      'also carries a LOWER bound, which is not counted here: a slow machine only makes it more ' +
      'true. The remaining ceilings are what `until` is FOR — it is a clock, and a test that it ' +
      'behaves like a clock has to look at one somewhere',
  },
];
