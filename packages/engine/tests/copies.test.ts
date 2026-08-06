import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeProblems } from '../src/audit';
import type { BoardProblem } from '../src/audit';
// A plain module, shared with the script that uses it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { absentDonors, agreesWithEngine, censusLines, inventoryFrom, markFor, presentDirectories, renderResult, repositoryOf, withCoverage } from '../../../scripts/lib/copies.mjs';

/**
 * How a copy of the board is reported.
 *
 * `audit-copies.mjs` ran for the first time in a long while last pass, and two
 * of the eighteen copies came back as `DIFF … 1 differences from the engine`.
 * Which difference? The audit knew — `compareToReference` returns a finding per
 * square — and threw all of it away to print the length.
 *
 * The answer, once a person opened the file, was the arrow from 54 to 68: both
 * web3 hooks treat 54 as a win and stop there, so a player finishes on the
 * wrong square. One line the audit could have said and did not.
 *
 * These assert the rule — everything found is named — rather than the findings
 * that exist today, which are a property of eighteen files in another
 * directory and will change the moment one of them does.
 */

const problem = (from: number, to: number, finding = 'missing'): BoardProblem =>
  ({ finding, from, to, detail: `${finding} at ${from} → ${to}` }) as BoardProblem;

const render = (differences: BoardProblem[], problems: BoardProblem[] = []) =>
  renderResult(
    { file: 'a/board.ts', jumps: 20 - differences.length, problems, differences },
    describeProblems,
  ).join('\n');

describe('what a copy of the board reports', () => {
  it('names every difference, rather than counting them', () => {
    // The shape of the defect: for any set of findings, each one appears in
    // the output. A test listing today's two findings would pass just as well
    // against a report that printed a number.
    const differences = [problem(12, 8), problem(54, 68), problem(63, 2)];
    const output = render(differences);

    for (const finding of differences) {
      expect(output).toContain(String(finding.from));
      expect(output).toContain(finding.detail);
    }
  });

  it('names problems and differences both, since they are different questions', () => {
    // A snake that climbs is wrong on the board's own terms; a missing jump is
    // a disagreement with this engine. A report that showed one and summarised
    // the other would hide whichever it summarised.
    const output = render([problem(54, 68)], [problem(17, 7, 'wrong-direction')]);
    expect(output).toContain('wrong-direction');
    expect(output).toContain('54');
  });

  it('still gives the total, because a reader scanning eighteen wants it first', () => {
    expect(render([problem(1, 2), problem(3, 4)])).toContain('2 differences');
  });

  it('counts one difference as one, in words a person wrote', () => {
    // "1 differences from the engine" is what the report said for a year. It
    // is a small thing and it is the tell: nobody had read the output.
    const output = render([problem(54, 68)]);
    expect(output).toContain('1 difference from the engine');
    expect(output).not.toContain('1 differences');
  });

  it('is one line for a copy that agrees, and says so', () => {
    const lines = renderResult(
      { file: 'a/board.ts', jumps: 20, problems: [], differences: [] },
      describeProblems,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('ok');
    expect(lines[0]).toContain('20 jumps');
  });

  it('does not call a copy with findings ok', () => {
    expect(render([problem(54, 68)]).startsWith('DIFF')).toBe(true);
  });

  it('reads a copy with neither problems nor differences as agreeing', () => {
    expect(agreesWithEngine({ problems: [], differences: [] })).toBe(true);
    expect(agreesWithEngine({ problems: [], differences: [problem(1, 2)] })).toBe(false);
    expect(agreesWithEngine({ problems: [problem(1, 2)], differences: [] })).toBe(false);
  });

  it('treats a result missing its arrays as agreeing, rather than throwing', () => {
    // The extractor can produce a result with nothing to say. A report that
    // crashes on one file reports on none of the other seventeen.
    expect(agreesWithEngine({})).toBe(true);
    expect(() => renderResult({ file: 'x.ts', jumps: 0 }, describeProblems)).not.toThrow();
  });
});

describe('a jump the reference has and a copy does not', () => {
  it('is named with the jump, not only the square', () => {
    // "no jump from 54" made a reader open the file to find out what belonged
    // there — which is the work the audit exists to save.
    const [finding] = describeProblems([
      { finding: 'missing', from: 54, to: 68, detail: 'no jump from 54, reference says 54 → 68' },
    ]).split('\n');

    expect(finding).toContain('54');
    expect(finding).toContain('68');
  });
});

describe('a rule that lives in another file of the same repository', () => {
  /**
   * `detectRules` reads one file at a time, and the table printed a dash for
   * anything it did not find in the copy it was reading. A dash reads as "this
   * copy does not play that rule" — which is not what it meant. The published
   * app's re-rolling die is in `DiceStore.ts` and its report gate is in
   * `OnlinePlayer.store`, neither anywhere near a board.
   *
   * The caveat existed, as a paragraph in MIGRATION.md that a reader of the
   * table never sees. `elsewhere` puts it where it changes a conclusion.
   */
  const perFile = new Map<string, Record<string, boolean>>([
    ['leela/src/store/helper.ts', { entryOnSix: true, rerollOnRepeat: false }],
    ['leela/src/store/DiceStore.ts', { entryOnSix: false, rerollOnRepeat: true }],
    ['other/src/game.ts', { entryOnSix: false, rerollOnRepeat: true }],
  ]);

  const mark = (rule: string, file: string) =>
    markFor(rule, file, perFile.get(file) ?? {}, perFile);

  it('says yes when the rule is in this very file', () => {
    expect(mark('entryOnSix', 'leela/src/store/helper.ts')).toBe('yes');
  });

  it('says elsewhere when a neighbour in the same repository has it', () => {
    expect(mark('rerollOnRepeat', 'leela/src/store/helper.ts')).toBe('elsewhere');
  });

  it('does not borrow a rule from a different repository', () => {
    // The whole point of the mark is that it is about *this* codebase. A rule
    // another project plays says nothing about this one.
    const alone = new Map([
      ['a/game.ts', { rerollOnRepeat: false }],
      ['b/game.ts', { rerollOnRepeat: true }],
    ]);
    expect(markFor('rerollOnRepeat', 'a/game.ts', { rerollOnRepeat: false }, alone)).toBe('—');
  });

  it('says nothing found when no file in the repository has it', () => {
    const none = new Map([['a/game.ts', { reportGate: false }]]);
    expect(markFor('reportGate', 'a/game.ts', { reportGate: false }, none)).toBe('—');
  });

  it('reads the repository off the path, which is how the scan is rooted', () => {
    expect(repositoryOf('leela/src/store/helper.ts')).toBe('leela');
    expect(repositoryOf('LeelaGame.sol')).toBe('LeelaGame.sol');
  });

  it('does not call a file its own elsewhere', () => {
    // A file that lacks the rule must not be told the rule is in a neighbour
    // when the only neighbour is itself.
    const one = new Map([['a/game.ts', { reportGate: false }]]);
    expect(markFor('reportGate', 'a/game.ts', {}, one)).toBe('—');
  });
});

/**
 * How much of the donor tree the report is a report about.
 *
 * `audit-copies.mjs` ended on "12 of 18 copies agree with the engine" and
 * exited 0. Eighteen copies out of what? Fifteen of the twenty-five
 * repositories MIGRATION.md inventories are on this disk. Ten are not, and one
 * of them is `leelachakra`, the original React Native app — the first
 * generation of the game whose rules everything above is compared against. A
 * whole generation could vanish and the audit would sign off in the same words.
 *
 * The repository already answers this correctly one directory over:
 * `scripts/lib/variants.mjs` says "Named rather than skipped. An audit that
 * passes because it could not find the file is the failure this repository
 * keeps meeting."
 *
 * These assert the rule over made-up inventories and made-up disks, because the
 * real one is not in CI — which is the whole shape of the defect: a check whose
 * evidence is a directory that may not be there.
 */
describe('which donors the audit actually read', () => {
  /** Five names and all 32 ways a disk could hold some of them. */
  const INVENTORY = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

  const subsets = <T,>(items: T[]): T[][] =>
    items.reduce<T[][]>((all, item) => [...all, ...all.map((subset) => [...subset, item])], [[]]);

  it('names exactly the ones that are not there, for every way a disk can be short', () => {
    // The grid rather than today's ten. A census that special-cases the empty
    // disk, or the full one, is a census that will be wrong on the day between.
    for (const present of subsets(INVENTORY)) {
      const complement = INVENTORY.filter((donor) => !present.includes(donor));
      expect({ present, absent: absentDonors(INVENTORY, present) }).toEqual({
        present,
        absent: complement,
      });
    }
  });

  it('does not count a directory nobody inventoried as covering one that is', () => {
    // A tree with the right number of directories and the wrong names is the
    // failure a count would miss entirely.
    expect(absentDonors(INVENTORY, ['one', 'two', 'three', 'four', 'five'])).toEqual(INVENTORY);
  });

  it('does not call a donor absent over the case of its directory', () => {
    // These clones came off GitHub, where case is kept, onto a filesystem that
    // mostly does not keep it. A check that cried wolf here is one somebody
    // deletes rather than obeys.
    expect(absentDonors(['LeelaAiWeb3', 'NeuroLeelaExpo'], ['leelaaiweb3', 'NeuroLeelaExpo'])).toEqual(
      [],
    );
  });

  it('names every absent donor in the report, not the number of them', () => {
    for (const present of subsets(INVENTORY)) {
      const absent = absentDonors(INVENTORY, present);
      const rendered = censusLines(absent, INVENTORY.length).join('\n');
      for (const donor of absent) expect(rendered).toContain(donor);
    }
  });

  it('says so plainly when the whole tree is there', () => {
    expect(censusLines([], INVENTORY.length).join('\n')).toContain(`All ${INVENTORY.length}`);
  });

  it('counts one missing donor in words a person wrote', () => {
    const line = censusLines(['alpha'], 25)[0];
    expect(line).toContain('1 of the 25 donor repositories');
    expect(line).toContain(' is not on this disk');
  });
});

describe('the sentence the report closes on', () => {
  const INVENTORY = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

  const closing = (present: number) =>
    withCoverage('12 of 18 copies agree with the engine', {
      inventoried: INVENTORY.length,
      present,
    });

  it('is a different sentence for every amount of the tree it read', () => {
    // The shape of the defect, and the reason it survived: the old closing line
    // read identically whether the audit had walked twenty-five repositories or
    // five. A sentence that does not move when the coverage moves is a sentence
    // that is not about the coverage.
    const sentences = INVENTORY.map((_, index) => closing(index + 1));
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it('never claims coverage it does not have', () => {
    for (let present = 0; present < INVENTORY.length; present++) {
      const line = closing(present);
      expect(line).toContain(`${present} of ${INVENTORY.length}`);
      expect(line).toContain(String(INVENTORY.length - present));
    }
  });

  it('still carries the coverage when the coverage is complete', () => {
    // A reader should not have to know that the absence of a caveat is itself
    // the claim. Full coverage is stated, not implied by silence.
    expect(closing(INVENTORY.length)).toContain(`all ${INVENTORY.length} donor repositories`);
  });

  it('says the coverage is unknown when the inventory could not be read', () => {
    // The one answer a parser of prose must have. Reporting a census against a
    // denominator of zero would be the silent claim again, one level down.
    const line = withCoverage('12 of 18 copies agree', { inventoried: 0, present: 0 });
    expect(line).toContain('unknown');
    expect(line).not.toContain('0 of 0');
  });
});

describe('the inventory read out of MIGRATION.md', () => {
  /**
   * A made-up inventory in the shape the real one is written in: a sentence
   * naming the organisations, a table of `owner/name`, prose naming bare
   * repositories, and parentheses holding what is *inside* a repository rather
   * than another repository.
   */
  const DOCUMENT = `# Migration

## The inventory

4 repositories: 2 in \`acme\`, one in \`dharmaapp\`, one in
\`fullstackserverless\`.

| Repository | What only it has |
|---|---|
| \`fullstackserverless/leelachakra\` | the original, with \`LEELA-PITCH.md\` |
| \`acme/leela\` | the published app, \`com.leelagame\`, a \`src/\` directory |

\`acme/thing\` (\`Contract.sol\`, \`Token\`, \`address.json\`), and \`bare-repo\`
was an attempt at a monorepo (\`mobile/ server-graphql/ site/\`), with
\`docs/plans\` in it.

## What the merge found

\`never-inventoried\` is named here and is not part of the inventory.
`;

  const parsed = () => inventoryFrom(DOCUMENT);

  it('reads the names, and the count the document states, as two things', () => {
    // Two things, because they are the two that can disagree. A parser that
    // returned only what it managed to read would shrink the denominator of
    // every sentence above it, quietly.
    expect(parsed()).toEqual({ declared: 4, donors: ['leelachakra', 'leela', 'thing', 'bare-repo'] });
  });

  it('does not read what is inside a repository as another repository', () => {
    // `smart-contract-leela (LeelaGame.sol, LeelaToken, address.json)` is one
    // repository and three of its contents. `LeelaToken` is a contract.
    expect(parsed().donors).not.toContain('Token');
    expect(parsed().donors).not.toContain('Contract.sol');
  });

  it('does not read a path, a file or an application id as a repository', () => {
    for (const notARepository of ['plans', 'src', 'LEELA-PITCH.md', 'com.leelagame', 'site']) {
      expect(parsed().donors).not.toContain(notARepository);
    }
  });

  it('does not read the organisations as repositories of their own', () => {
    for (const org of ['acme', 'dharmaapp', 'fullstackserverless']) {
      expect(parsed().donors).not.toContain(org);
    }
  });

  it('stops at the end of the inventory, which is the part that claims to be complete', () => {
    // Later passes name repositories in prose constantly. Reading those as
    // inventoried would grow the denominator every time somebody wrote one
    // down, and the census would name donors nobody ever had.
    expect(parsed().donors).not.toContain('never-inventoried');
  });

  it('reads nothing, rather than guessing, when there is no inventory', () => {
    expect(inventoryFrom('# Migration\n\nNo inventory here.\n')).toEqual({
      declared: null,
      donors: [],
    });
  });

  it('agrees with the count MIGRATION.md itself states', () => {
    // Against the real document, because this is the one place the parse can be
    // wrong about prose nobody in this repository controls. If a donor is ever
    // added in a shape this cannot read, the two numbers part company here
    // rather than in a denominator somebody quotes.
    const { declared, donors } = inventoryFrom(
      readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), 'MIGRATION.md'), 'utf8'),
    );

    expect({ declared, named: donors.length }).toEqual({ declared, named: declared });
  });
});

describe('what counts as a donor on disk', () => {
  /**
   * Built under a temp directory, not read from `/Users/playra/leela-src`.
   * The donor clones are not in CI — a test that depended on them would pass on
   * one machine and be skipped on the other, which is the defect this whole
   * census exists to close.
   */
  const tree = (entries: Record<string, 'dir' | 'file'>) => {
    const root = mkdtempSync(join(tmpdir(), 'leela-donors-'));
    for (const [name, kind] of Object.entries(entries)) {
      if (kind === 'dir') mkdirSync(join(root, name));
      else writeFileSync(join(root, name), '');
    }
    return root;
  };

  it('is a directory, and not a file beside it', () => {
    const root = tree({ leela: 'dir', leelabook: 'dir', 'README.md': 'file' });
    expect(presentDirectories(readdirSync(root, { withFileTypes: true })).sort()).toEqual([
      'leela',
      'leelabook',
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it('is not a hidden directory', () => {
    // `.git` and `.DS_Store` are not donors, and a census that named them as
    // repositories nobody inventoried is a census nobody reads twice.
    const root = tree({ '.git': 'dir', '.DS_Store': 'file', leela: 'dir' });
    expect(presentDirectories(readdirSync(root, { withFileTypes: true }))).toEqual(['leela']);
    rmSync(root, { recursive: true, force: true });
  });

  it('reads an empty tree as holding nothing, and names every donor absent', () => {
    // The failure in its loudest form: the source directory is there and empty.
    const root = tree({});
    const present = presentDirectories(readdirSync(root, { withFileTypes: true }));
    expect(absentDonors(['alpha', 'beta'], present)).toEqual(['alpha', 'beta']);
    rmSync(root, { recursive: true, force: true });
  });
});
