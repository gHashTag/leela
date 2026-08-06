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

/**
 * How much of the donor tree the audit actually read.
 *
 * `audit-copies.mjs` walks `../leela-src` and ends on "12 of 18 copies agree
 * with the engine". Eighteen copies of what, across how many repositories? It
 * never said, and the answer was fifteen of the twenty-five MIGRATION.md
 * inventories. Ten donors are not on this disk, and one of them is
 * `fullstackserverless/leelachakra` — the original React Native app, the first
 * generation of the shipped game. A whole generation of the code this
 * repository exists to reconcile can be missing and the audit signs off.
 *
 * That is the failure this file already names in another place: a check that
 * passes because it could not find the file. `scripts/lib/variants.mjs` got
 * this right — "Named rather than skipped" — and the copies audit did not.
 *
 * What is fixed here is the silent claim of coverage, not the absence. The ten
 * cannot be re-cloned from inside this repository, and an audit wedged red over
 * something nobody here can do is one somebody deletes rather than obeys. So
 * the exit code does not move; the sentence does.
 */

/**
 * The donor repositories MIGRATION.md inventories, read out of MIGRATION.md.
 *
 * Parsed rather than copied. A second list of twenty-five names kept by hand
 * beside the first is two lists, and the pass that adds a donor to one will not
 * touch the other — which is the same defect one level up from the one being
 * closed.
 *
 * The rules, each written for a thing that is in that section and is not a
 * repository:
 *
 * - Only the inventory section. Later passes name repositories in prose all the
 *   time, and the inventory is the one place that claims to be complete.
 * - Only code spans outside parentheses. A parenthesis after a repository name
 *   holds what is *in* it — `smart-contract-leela (LeelaGame.sol, LeelaToken,
 *   address.json)` — and `LeelaToken` is a contract, not a clone.
 * - `owner/name` counts only when `owner` is one of the organisations the
 *   section's own opening sentence names. That keeps `dharmaapp/leelabook` and
 *   drops `docs/plans`, without a list of exceptions written by hand.
 * - Anything with whitespace or a dot is not a repository name: `mobile/
 *   server-graphql/ site/` is a layout, `com.leelagame` is an application id,
 *   `LEELA-PITCH.md` is a file.
 *
 * `declared` is the count the section states in words — "25 repositories". It
 * is returned beside the names so the caller can say when the parse and the
 * prose disagree, instead of quietly reporting a census of whatever it managed
 * to read. A parser trusted to be right about prose is a parser that will be
 * wrong quietly.
 *
 * @param markdown  The whole of MIGRATION.md.
 * @returns `{ declared, donors }` — the stated count (or null), and the names.
 */
export function inventoryFrom(markdown) {
  const section = sectionOf(markdown, 'The inventory');
  const stated = /(\d+)\s+repositories:/.exec(section);
  const declared = stated ? Number(stated[1]) : null;

  // The opening sentence: "25 repositories: 23 in `gHashTag`, one in
  // `dharmaapp`, one in `fullstackserverless`." Every code span in it is an
  // organisation, which is how the owner test below is derived rather than
  // written down.
  const opening = stated ? section.slice(stated.index).split('.')[0] : '';
  const orgs = new Set([...opening.matchAll(/`([^`\n]+)`/g)].map(([, span]) => span));

  const donors = [];
  let depth = 0;

  for (const [token, span] of section.matchAll(/`([^`\n]+)`|[()]/g)) {
    if (token === '(') {
      depth++;
      continue;
    }
    if (token === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0 || span === undefined) continue;

    const name = repositoryNameOf(span, orgs);
    if (name !== null && !donors.includes(name)) donors.push(name);
  }

  return { declared, donors };
}

/** One code span read as a repository name, or null if it is not one. */
function repositoryNameOf(span, orgs) {
  if (/\s/.test(span) || span.includes('.')) return null;

  if (span.includes('/')) {
    const [owner, name, ...rest] = span.split('/');
    if (rest.length > 0 || !name || !orgs.has(owner)) return null;
    return name;
  }

  return orgs.has(span) ? null : span;
}

/** The body of one `## heading`, up to the next one. */
function sectionOf(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  if (start === -1) return '';
  const rest = markdown.slice(start + heading.length);
  const end = rest.indexOf('\n## ');
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The directory names in a directory listing.
 *
 * Takes the entries rather than the path, so this file keeps its one useful
 * property: no imports, and every rule in it can be asserted without a disk.
 * The caller passes `readdirSync(dir, { withFileTypes: true })`.
 *
 * Hidden entries are dropped. `.DS_Store` and `.git` are not donors, and a
 * census that named them would be a census nobody reads twice.
 */
export const presentDirectories = (entries) =>
  entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((e) => e.name);

/**
 * Which inventoried donors are not on this disk.
 *
 * Compared without case, because these clones came from GitHub, where the case
 * is preserved, onto a filesystem that mostly is not case-sensitive. Naming
 * `LeelaAiWeb3` absent because the directory is `leelaaiweb3` would be the
 * check crying wolf, and a check that cries wolf is one somebody deletes.
 *
 * @param donors   The inventoried names, in the order MIGRATION.md gives them.
 * @param present  The directory names found under the source directory.
 */
export function absentDonors(donors, present) {
  const here = new Set(present.map((name) => name.toLowerCase()));
  return donors.filter((donor) => !here.has(donor.toLowerCase()));
}

/**
 * The absent donors, by name, as the lines a reader sees.
 *
 * By name and not by number: "10 donors are missing" is a sentence somebody
 * skims past, and `fullstackserverless/leelachakra` — the original app — is a
 * sentence somebody acts on.
 */
export function censusLines(absent, inventoried) {
  if (absent.length === 0) {
    return [`\nAll ${inventoried} donor repositories MIGRATION.md inventories are on this disk.`];
  }

  // "1 donors are missing" is the tell that nobody read the output; the same
  // small thing as "1 differences from the engine" above.
  const noun = inventoried === 1 ? 'donor repository' : 'donor repositories';
  const verb = absent.length === 1 ? 'is' : 'are';

  return [
    `\n${absent.length} of the ${inventoried} ${noun} MIGRATION.md inventories ${verb} not on this disk:`,
    ...absent.map((name) => `  ${name}`),
    'Nothing above has read them. They are not clonable from here, so this is a',
    'statement of coverage rather than a failure: pass --src at a tree that has',
    'them, or read this report as being about the rest.',
  ];
}

/**
 * A claim about the copies, carrying how much of the tree it is a claim about.
 *
 * The audit's closing line was `12 of 18 copies agree with the engine, and the
 * 6 that do not are the 6 on record.` — true, and read as a statement about the
 * game. It is a statement about fifteen of twenty-five repositories, and the
 * number 18 moves when a donor is missing while the sentence does not.
 *
 * So the coverage is inside the sentence rather than twenty lines above it. It
 * is there even at full coverage: a reader should not have to know that the
 * absence of a caveat is itself the claim.
 *
 * @param claim  The sentence about the copies, with no full stop.
 */
export function withCoverage(claim, { inventoried, present }) {
  if (!inventoried) {
    return `${claim} — over a donor tree this could not size, because MIGRATION.md's inventory did not parse. The coverage of this report is unknown.`;
  }

  const absent = inventoried - present;
  if (absent <= 0) {
    return `${claim}, across all ${inventoried} donor repositories MIGRATION.md inventories.`;
  }

  return (
    `${claim} — across the ${present} of ${inventoried} donor repositories on this disk. ` +
    `The other ${absent} were never cloned here and nothing above has read them.`
  );
}
