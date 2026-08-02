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

/**
 * What the audit's exit code was worth before this.
 *
 * `process.exit(wrong > 0 ? 1 : 0)`, where `wrong` counted copies that disagree
 * with the engine. Six of the eighteen do, and none of them is ours to fix:
 * four are the 100-square Snakes and Ladders board somebody dropped into
 * `processDiceRoll`, and two are the web3 hooks missing the arrow from 54.
 * They are donor repositories, frozen, and the whole reason this monorepo
 * exists. So the audit was red on the day it was written and red on every day
 * since, which means its exit code said nothing at all — and a check that
 * cannot go green is a check nobody runs twice. A seventh disagreement would
 * have landed in a report that already said `1`.
 *
 * `untranslated.mjs` states the answer this repository already uses twice:
 * *these are recorded, not repaired*, and the audit's job becomes that the set
 * does not grow quietly and that the record does not rot.
 */

/**
 * One copy's disagreement, as the sentence the record is matched on.
 *
 * Counted by kind rather than summed, so that a difference swapped for a
 * different kind of difference — the same total, a different board — does not
 * slip through a matching number. Everything in the line is arithmetic, which
 * is the bar `corrections.mjs` sets for anything recorded rather than fixed:
 * nothing here is a judgement about what a donor should have written.
 */
export function nameOf(result) {
  const tally = (list) => {
    const by = new Map();
    for (const problem of list) by.set(problem.finding, (by.get(problem.finding) ?? 0) + 1);
    return [...by]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([finding, n]) => `${n} ${finding}`)
      .join(', ');
  };

  const { file, jumps, problems = [], differences = [] } = result;
  const board = problems.length > 0 ? ` (${tally(problems)})` : '';

  return (
    `${file}: ${jumps} jumps; differences ${differences.length} (${tally(differences)});` +
    ` problems ${problems.length}${board}`
  );
}

/**
 * The six that disagree today, each as its own sentence.
 *
 * Not a list of exemptions — a list of what the copies do, kept so that the
 * seventh is loud.
 *
 * The four identical ones are the find this audit was written for: an inngest
 * function playing Snakes and Ladders on a 100-square board under the name of
 * this game, in two repositories, in two files each. The two web3 hooks stop a
 * player on 54 because they have no arrow from it.
 */
export const RECORDED = [
  'LeelaAiWeb3/src/hooks/useLeelaGame/handlePlayerMovement.ts: 19 jumps; differences 1 (1 missing); problems 0',
  'NeuroLeelaAgent/inngest/functions/processDiceRoll.ts: 22 jumps; differences 34 (6 different-target, 14 extra, 14 missing); problems 13 (2 both-snake-and-arrow, 7 off-the-board, 4 wrong-direction)',
  'NeuroLeelaAgent/inngest/server-config/game-logic.ts: 22 jumps; differences 34 (6 different-target, 14 extra, 14 missing); problems 13 (2 both-snake-and-arrow, 7 off-the-board, 4 wrong-direction)',
  'NeuroLeelaExpo/inngest/functions/processDiceRoll.ts: 22 jumps; differences 34 (6 different-target, 14 extra, 14 missing); problems 13 (2 both-snake-and-arrow, 7 off-the-board, 4 wrong-direction)',
  'NeuroLeelaExpo/inngest/server-config/game-logic.ts: 22 jumps; differences 34 (6 different-target, 14 extra, 14 missing); problems 13 (2 both-snake-and-arrow, 7 off-the-board, 4 wrong-direction)',
  'leelaWeb3/mobile/src/hooks/useLeelaGame/handlePlayerMovement.ts: 19 jumps; differences 1 (1 missing); problems 0',
];

/**
 * The two ways this can be wrong, as two lists.
 *
 * `fresh` is a copy nobody has recorded — a donor edited, a repository cloned,
 * or a board this audit only just learned to read. `rotted` is a record
 * matching nothing: a donor fixed, a file moved, or a copy whose disagreement
 * changed shape. The second is the one a quiet check would never mention, and
 * it is how a record turns into a lie it is still passing.
 *
 * @param results  Every copy the audit read, agreeing or not.
 */
export function against(results) {
  const disagreeing = results.filter(
    (result) => (result.problems?.length ?? 0) > 0 || (result.differences?.length ?? 0) > 0,
  );

  const seen = new Set(disagreeing.map(nameOf));
  const recorded = new Set(RECORDED);

  return {
    fresh: disagreeing.filter((result) => !recorded.has(nameOf(result))),
    rotted: RECORDED.filter((line) => !seen.has(line)),
  };
}
