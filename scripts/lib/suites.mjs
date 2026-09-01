/**
 * How many tests a suite ran, read out of vitest's own report.
 *
 * `audit-claims` is the check whose entire subject is whether the numbers this
 * repository states about itself are true. It runs every workspace's suite with
 * `--reporter=json`, reads `numTotalTests`, and compares that against the table
 * in README. On 2026-08-06 it printed nine measured counts, reached
 * `@leela/mobile`, and died with a hundred kilobytes of stack trace.
 *
 * Nothing was wrong with the reading. `execFileSync` throws on any non-zero
 * exit, vitest exits non-zero whenever one assertion is red, and the report the
 * audit wanted was sitting on the thrown error the whole time — the string
 * `{"numTotalTests":396,"numFailedTests":1,...}` was there in `output[1]`, and
 * the runner threw it away and replaced it with a stack. The one check that
 * exists to say "README claims 3025 and the suites run 3336" said instead that
 * a command failed, at a line number, in `child_process`. A reader learns
 * nothing about README's staleness from that, and the table went unenforced for
 * as long as any suite anywhere was red.
 *
 * So the parsing lives here, apart from anything that spawns a process, and it
 * cannot tell a green run from a red one: it is handed text and it finds the
 * report. Whether that text came back as stdout or off the `stdout` of an
 * exception is the caller's problem, not the format's.
 *
 * The other half of the defect is the silent one. `output.indexOf('{')` on a
 * truncated capture returns -1, `slice(-1)` is the last character, and
 * `JSON.parse` of that raises `Unexpected token` naming neither the package nor
 * the reason — and a version that swallowed it and returned 0 would be worse
 * still: a package whose suite could not start would read as a package with no
 * tests, and `--write` would then put that zero into README as fact. Every path
 * that cannot produce a number here raises `UnreadableSuiteReport` with a kind
 * that names which way it failed.
 */

/**
 * A capture that carries no report, and which way it failed to.
 *
 * `kind` is one of:
 *
 *   - `empty` — nothing was captured at all. The child wrote no stdout, which
 *     usually means it never started: a missing binary, a bad cwd.
 *   - `no-json` — text arrived and no balanced JSON object could be read out of
 *     it. Typically the runner's own error message, `Command failed` and
 *     nothing else, which is exactly the string the old code fed to `slice`.
 *   - `not-a-report` — JSON was read and it is not vitest's: no
 *     `numTotalTests`. A different reporter, or a different tool.
 */
export class UnreadableSuiteReport extends Error {
  constructor(kind, message, text = '') {
    super(message);
    this.name = 'UnreadableSuiteReport';
    this.kind = kind;
    this.text = text;
  }
}

/** As much of a capture as is worth quoting back at a person. */
const excerpt = (text, limit = 200) => {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed;
};

/**
 * The span of the first balanced JSON object starting at `from`, or null.
 *
 * String-aware, because the report is full of file paths and message text and a
 * brace inside a quoted string closes nothing. Escapes are honoured so that a
 * `\"` in an assertion message does not end the string early — a test name
 * containing a quote is not exotic, and counting braces naively would stop the
 * scan in the middle of the object and hand `JSON.parse` a fragment.
 */
function objectAt(text, from) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(from, i + 1);
    }
  }
  return null;
}

/**
 * The vitest report inside a capture.
 *
 * Vitest prints banner lines before the object often enough that the original
 * code already allowed for it — `indexOf('{')` was there for that reason. But a
 * banner can itself contain a brace (a path under a `{foo,bar}` glob, a config
 * echo), so the first `{` is not reliably the report's. Every opening brace is
 * tried in turn and the first one that both closes and looks like a vitest
 * report wins. Text after the object is ignored the same way: a summary line
 * printed once the reporter has flushed is not a parse error.
 */
function reportIn(text) {
  for (let i = text.indexOf('{'); i !== -1; i = text.indexOf('{', i + 1)) {
    const span = objectAt(text, i);
    if (span === null) continue;

    let parsed;
    try {
      parsed = JSON.parse(span);
    } catch {
      continue;
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.numTotalTests === 'number') return parsed;
  }
  return null;
}

/**
 * What a suite ran, from the raw stdout of `vitest run --reporter=json`.
 *
 * Identical for a green run and a red one — that is the whole point of it. A
 * red run has counted its tests just as carefully as a green one; the number is
 * not less true for one of them having failed.
 *
 * `red` is reported alongside the counts rather than instead of them, so a
 * caller can say "the suite is red, and here are its counts" — two facts, which
 * the old code collapsed into one stack trace.
 *
 * @param text Raw stdout, green run or red, banner lines and all.
 * @returns `{ total, passed, failed, red }`.
 * @throws {UnreadableSuiteReport} When no vitest report can be read out.
 */
export function countsFrom(text) {
  const source = typeof text === 'string' ? text : String(text ?? '');

  if (source.trim() === '') {
    throw new UnreadableSuiteReport('empty', 'the suite produced no output at all — it likely never started');
  }

  const report = reportIn(source);
  if (report === null) {
    const looksLikeJson = source.includes('{');
    throw new UnreadableSuiteReport(
      looksLikeJson ? 'not-a-report' : 'no-json',
      looksLikeJson
        ? `the suite printed JSON that is not a vitest report (no numTotalTests): ${excerpt(source)}`
        : `the suite printed no JSON report: ${excerpt(source)}`,
      source,
    );
  }

  const number = (value) => (typeof value === 'number' ? value : 0);
  const total = number(report.numTotalTests);
  const failed = number(report.numFailedTests);

  return {
    total,
    passed: typeof report.numPassedTests === 'number' ? report.numPassedTests : total - failed,
    failed,
    // `success` is the reporter's own verdict and covers what the counts do
    // not: a suite that fails to collect a file has zero failed *tests* and is
    // still red. Falling back to the count keeps an older reporter readable.
    red: report.success === false || failed > 0,
  };
}

/**
 * The stdout hiding on an exception thrown by `execFileSync`.
 *
 * Node puts it in two places and neither is documented as the one to use:
 * `error.stdout`, and `error.output[1]` (index 1 being fd 1). Both are Buffers
 * unless `encoding` was set. This is the single line that the crash of
 * 2026-08-06 came down to — the numbers were always right here.
 *
 * Returns `''` rather than throwing when the error carries nothing, so that the
 * diagnosis comes from `countsFrom`, in one voice, with one set of kinds.
 */
export function capturedOutput(error) {
  const candidate = error?.stdout ?? error?.output?.[1];
  if (candidate === null || candidate === undefined) return '';
  return typeof candidate === 'string' ? candidate : candidate.toString('utf8');
}

/**
 * How many failures are worth printing before the list stops helping.
 *
 * A suite with two hundred red tests has one cause, and two hundred lines
 * scroll the rest of the report off the terminal — which is the same way a
 * finding gets hidden that `report.mjs` was written to stop. What is dropped is
 * always SAID (see `failureLines`), because a list silently cut at eight reads
 * as a list of eight.
 */
export const MOST_FAILURES_SHOWN = 8;

/** The first line of a message, which is the part that names the defect. */
const firstLine = (message) =>
  String(message ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '') ?? '';

/**
 * WHICH tests failed, out of the same report the counts came from.
 *
 * `countsFrom` answers *how many*, and for four months that was all this
 * repository could say about a red suite: `@leela/engine: 1 of 553 failing`.
 * That sentence cannot be acted on. It names no test, no file and no reason,
 * and the report it was read out of carried all three — so the audit whose own
 * documentation says *`> /dev/null` is how a red becomes unexplainable* was
 * discarding the explanation itself, one layer in.
 *
 * **Two shapes of red, and the second is the one a naive reader misses.**
 * Measured against a suite built to fail on purpose:
 *
 *   - A failing assertion has `status: "failed"` on the entry in
 *     `assertionResults`, with the reason in `failureMessages`.
 *   - **A file that fails to COLLECT has no assertionResults at all.** Its
 *     entry is `status: "failed"`, `message: "Failed to load url …"`, and an
 *     empty array — so it contributes zero to `numTotalTests` and zero to
 *     `numFailedTests` alike. A reader that only walked assertions would return
 *     an empty list for a suite that is unmistakably red, which is the same
 *     unexplainable red in a new place. It is why `countsFrom` reads
 *     `success === false` rather than trusting `numFailedTests`.
 *
 * @param text Raw stdout, same as {@link countsFrom} takes.
 * @returns `[{ file, name, why }]`, in the order the report gives.
 *   `name` is `null` for a file that never ran — there is no test to name.
 * @throws {UnreadableSuiteReport} When no vitest report can be read out.
 */
export function failuresFrom(text) {
  const source = typeof text === 'string' ? text : String(text ?? '');
  const report = reportIn(source);

  if (report === null) {
    // Deliberately the same diagnosis as `countsFrom`, by asking it: two
    // readers of one format disagreeing about whether it is readable is a
    // worse failure than either of them being wrong.
    countsFrom(source);
    return [];
  }

  const files = Array.isArray(report.testResults) ? report.testResults : [];
  const found = [];

  for (const file of files) {
    const assertions = Array.isArray(file?.assertionResults) ? file.assertionResults : [];
    const failed = assertions.filter((one) => one?.status === 'failed');

    for (const one of failed) {
      found.push({
        file: String(file?.name ?? ''),
        name: String(one?.fullName ?? '').trim() || '(an unnamed test)',
        why: firstLine(one?.failureMessages?.[0]),
      });
    }

    // The file failed and named no test: it did not get far enough to have
    // one. `message` is where vitest puts the import error.
    if (failed.length === 0 && file?.status === 'failed') {
      found.push({
        file: String(file?.name ?? ''),
        name: null,
        why: firstLine(file?.message) || 'the file failed and said nothing about why',
      });
    }
  }

  return found;
}

/**
 * Those failures as lines to print, capped, and saying what was capped.
 *
 * @param failures what {@link failuresFrom} returned
 * @param shorten a path shortener — the caller knows what the paths are
 *   relative to, and an absolute path per line is most of a terminal's width
 */
export function failureLines(failures, shorten = (path) => path) {
  const shown = failures.slice(0, MOST_FAILURES_SHOWN).map((one) => {
    const where = shorten(one.file);
    const what = one.name === null ? `${where} — never ran` : `${where} › ${one.name}`;
    return one.why ? `    ${what}\n      ${one.why}` : `    ${what}`;
  });

  const dropped = failures.length - shown.length;
  // Said, not silent. A list cut at eight with no note reads as a list of
  // eight, and the reader stops looking for the ninth.
  if (dropped > 0) shown.push(`    … and ${dropped} more not shown`);

  return shown;
}

/**
 * How to run a workspace's suite — the workspace's OWN command, plus a reporter.
 *
 * `audit-claims` used to run `npx vitest run --reporter=json` in each package
 * directory. That reads the same files and it is not the same run. Every one of
 * the twelve workspaces declares
 *
 *     vitest run --testTimeout=30000 --hookTimeout=60000
 *
 * and the audit's hand-written invocation declared neither, so it measured all
 * of them at vitest's defaults — 5s and 10s. **Those defaults are the exact
 * defect #46–#49 went and fixed**, three suites red in three days from twelve
 * workspaces sitting on them; `audit-configs.mjs` was written to enforce the
 * flags and it enforces them on the SCRIPTS, which this went around.
 *
 * MEASURED, not reasoned: a deliberate seven-second test added to
 * `@leela/storage` — longer than the default, shorter than the declared 30s —
 * fails under `npx vitest run --reporter=json` with *Test timed out in 5000ms*
 * and passes under the package's own script. That is the whole of the flake
 * this repository had been re-running until green: the audit's reds were the
 * audit's own conditions, and they named a real test that is not broken.
 *
 * So the command comes from the manifest. A workspace that changes how it runs
 * its tests changes how this measures them, with nothing to keep in step.
 *
 * @param manifest the parsed `package.json`
 * @param reporter appended after `--`, which is how `bun run` forwards an
 *   argument to the script rather than eating it
 * @returns `{ command, args }` for `execFileSync`
 * @throws {UnreadableSuiteReport} when the workspace declares no test script —
 *   *no way to run it* is not *no tests*, and returning zero here would let
 *   `--write` put that zero into README as a fact.
 */
export function suiteCommand(manifest, reporter = '--reporter=json') {
  const script = manifest?.scripts?.test;

  if (typeof script !== 'string' || script.trim() === '') {
    throw new UnreadableSuiteReport(
      'no-script',
      `${manifest?.name ?? 'the workspace'} declares no test script, so there is no run to measure`,
    );
  }

  return { command: 'bun', args: ['run', 'test', '--', reporter] };
}
