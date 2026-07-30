/**
 * How a copy of the board is reported.
 *
 * `audit-copies.mjs` ran for the first time in a long while last pass, and two
 * of the eighteen copies came back as `DIFF … 1 differences from the engine`.
 * Which difference? The audit knew — `compareToReference` returns a finding per
 * square, with the square, the target and the reference's target in it — and
 * threw all of that away to print its length.
 *
 * The answer, once someone opened the file by hand, was that both web3 hooks
 * are missing the arrow from 54 to 68: they treat 54 as a win and stop there,
 * so a player finishes on the wrong square. That is one line the audit could
 * have said and did not.
 *
 * A summary that hides what it summarised is the same defect this repository
 * keeps meeting: a report that reads as complete. The rule below is that every
 * finding is named, and it is asserted as a rule rather than as a list of the
 * findings that exist today.
 */

/**
 * The lines one copy contributes to the report.
 *
 * @param result  `{ file, jumps, problems, differences }` — `problems` are what
 *                is wrong with the board on its own terms (a snake that climbs,
 *                a square off the end), `differences` are where it disagrees
 *                with `@leela/engine`. Both are `BoardProblem[]`.
 * @param describe  The engine's `describeProblems`, injected so this file has
 *                  no import of its own and can be exercised without one.
 */
export function renderResult(result, describe) {
  const { file, jumps, problems = [], differences = [] } = result;
  const agrees = problems.length === 0 && differences.length === 0;

  const head = `${agrees ? 'ok  ' : 'DIFF'}  ${file}  (${jumps} ${plural(jumps, 'jump')})`;
  if (agrees) return [head];

  const lines = [head];

  if (problems.length > 0) {
    lines.push(...indent(describe(problems)));
  }

  if (differences.length > 0) {
    // Named, not counted. The header still gives the total, because a reader
    // scanning eighteen copies wants the number first — but the number is
    // followed by the findings rather than standing in for them.
    lines.push(
      `      ${differences.length} ${plural(differences.length, 'difference')} from the engine:`,
    );
    lines.push(...indent(describe(differences)));
  }

  return lines;
}

/** Whether this copy is one of the ones that agree. */
export const agreesWithEngine = (result) =>
  (result.problems?.length ?? 0) === 0 && (result.differences?.length ?? 0) === 0;

const indent = (text) => text.split('\n').map((line) => `      ${line}`);

/** "1 jump", "20 jumps". A report that says "1 differences" was not read. */
const plural = (count, word) => (count === 1 ? word : `${word}s`);

/**
 * Which repository a scanned file belongs to.
 *
 * Paths are relative to the source directory, so the first segment is the
 * clone. `leela/src/store/helper.ts` → `leela`.
 */
export const repositoryOf = (file) => file.split('/')[0] ?? file;

/**
 * A rule that is not in this file but is somewhere in this repository.
 *
 * `detectRules` reads one file at a time, and the table printed a dash for
 * anything it did not find there. That dash reads as "this copy does not play
 * that rule", which is not what it means: the published app's re-rolling die
 * lives in `DiceStore.ts`, three directories from the board it belongs to, and
 * its report gate lives in `OnlinePlayer.store`. The caveat was written down in
 * MIGRATION.md — a paragraph a reader of the *table* never sees.
 *
 * So the table says `elsewhere` instead. Same knowledge, in the place where it
 * changes what a reader concludes.
 *
 * @param perFile  `Map<file, Record<rule, boolean>>` for every file scanned in
 *                 the repository, not only the ones carrying a board.
 */
export function markFor(rule, file, rules, perFile) {
  if (rules?.[rule]) return 'yes';

  const repository = repositoryOf(file);
  for (const [other, found] of perFile) {
    if (other !== file && repositoryOf(other) === repository && found?.[rule]) return 'elsewhere';
  }

  return '—';
}
