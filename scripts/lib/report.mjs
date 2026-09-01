/**
 * The last line an audit prints, made to agree with the code it exits on.
 *
 * Four audits in this repository decided to fail and then printed an all-clear
 * as their final line: `audit-arithmetic.mjs`, `audit-numbers.mjs`,
 * `audit-book.mjs` and `audit-offers.mjs`. Each of them set `process.exitCode =
 * 1` inside a staleness branch, and each of them then reached an all-clear
 * condition written over a different variable — `fresh`, `news` — which knew
 * nothing about that branch. So the alarm went off, twenty lines of other
 * findings scrolled past, and the closing sentence said *no board reference has
 * gone missing that was not already recorded*.
 *
 * The exit code was already right. The sentence under it was wrong, and a human
 * reads the sentence.
 *
 * That is not a guess about how people read output. `audit-scripts.mjs` had the
 * same defect and it cost an hour, written up at its lines 120-126 in the words
 * that motivated this module:
 *
 *   > `problems` holds what THIS block found. The stale-mutation note above sets
 *   > `process.exitCode` on its own and is not in that list, so a run that found
 *   > a broken file and no runtime problem used to print the all-clear as its
 *   > last line — twenty lines below the alarm, which is where nobody is still
 *   > looking. The exit code was right and the sentence under it was wrong, and
 *   > a human reads the sentence: it is how an hour went into debugging
 *   > `packages/ai` for ten failures a tool had caused and this script had
 *   > already named.
 *
 * The repair there was one line — `const failed = problems.length > 0 ||
 * process.exitCode === 1` — and it was never carried to the four siblings. Two
 * of them carried the *description* instead: `audit-book.mjs` and
 * `audit-offers.mjs` each named this as "the defect audit-numbers carried for a
 * hundred passes" in an epilogue printed above their own false all-clear. A
 * repository that restates a rule in prose four times and implements it once has
 * the rule in the wrong place, which is why this is a module and not a fifth
 * hand-copy.
 *
 * ## What it guarantees
 *
 * Given the sections an audit found, `finish` guarantees three things that no
 * caller has to remember:
 *
 * 1. The all-clear sentence is printed if and only if nothing failing has
 *    anything to say. It is never printed beside a failure.
 * 2. When something failing does have something to say, the LAST block on
 *    screen belongs to it. Informational sections — the standing, already
 *    recorded findings an audit names on every run — are printed first however
 *    the caller ordered them, because a finding that scrolls the alarm off the
 *    top of a terminal has hidden it.
 * 3. The returned code is 1 exactly when a failing section had lines, so a
 *    caller writing `process.exitCode = finish(...)` cannot disagree with its
 *    own last line.
 *
 * ## What "failing" means here
 *
 * `failing` is a property of the KIND of section, not of this run: the stale
 * records of `audit-arithmetic` are a failure whenever there are any, and the
 * already-recorded false sums are never one. A section only actually fails when
 * it also has lines. That distinction is the reason `finish` takes sections
 * rather than a boolean — the caller says what a finding means once, at the
 * place it is collected, and this decides what the run says about it.
 *
 * A section is `{ lines, failing, heading, epilogue }`. `lines` arrive already
 * indented and already truncated by the caller, because the exact strings are
 * the audits' own and this is a re-arrangement of them rather than a rewording.
 */

/**
 * Whether a section has anything to report on this run.
 *
 * Sections are built unconditionally by the callers — `stale`, `fresh`,
 * `healed`, `uncovered` are computed every run and are usually empty — so an
 * empty one is silence, not a finding. Keeping this in one named function is
 * what stops the failure test and the printing test from drifting apart, which
 * is precisely how the four audits came to fail on one variable and print about
 * another.
 */
const speaks = (section) => (section?.lines?.length ?? 0) > 0;

/** Heading, then the lines, then the epilogue — any of the three may be absent. */
function show(section) {
  if (section.heading) console.log(section.heading);
  for (const line of section.lines) console.log(line);
  if (section.epilogue) console.log(section.epilogue);
  console.log('');
}

/**
 * Print the run, and return the exit code that agrees with it.
 *
 * Prints through `console.log` rather than through an injected writer: the
 * thing under test is what a person sees in a terminal, and a test that reads
 * an injected sink proves the sink was called. The test captures `console.log`
 * itself for that reason.
 *
 * @param {object} report
 * @param {Array<{lines: string[], failing?: boolean, heading?: string, epilogue?: string}>} [report.sections]
 * @param {string} [report.allClear] the sentence for a run with nothing failing
 * @returns {0 | 1} for `process.exitCode = finish(...)`
 */
export function finish({ sections = [], allClear = '' } = {}) {
  const speaking = sections.filter(speaks);
  const failures = speaking.filter((section) => section.failing);
  const notes = speaking.filter((section) => !section.failing);

  // Notes first, alarms last. The callers all collect the standing findings
  // last, because that is the order the prose reads in; on screen it is the
  // order that buries the alarm.
  for (const section of notes) show(section);
  for (const section of failures) show(section);

  if (failures.length === 0 && allClear) console.log(allClear);

  return failures.length > 0 ? 1 : 0;
}
