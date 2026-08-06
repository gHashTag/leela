import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// A plain module, shared with the script that uses it. One suppressed line
// rather than a `.d.ts`, which would be a second description of it.
// @ts-expect-error - untyped .mjs
import { auditsRunByCi, checkAuditsRun, checkRuntimes, documentedRuntimes, findNodeBlockers, needsOf, relativeImports, resolvableByNode, runtimeOf, withoutCommentLines } from '../../../scripts/lib/runnable.mjs';

/**
 * Whether a script can be started by the runtime it names.
 *
 * `scripts/audit-copies.mjs` is the check that walks the source repositories
 * and reads every copy of the board — the one that found a hundred-square
 * Snakes and Ladders set pretending to be Leela. README said to run it with
 * `node`, and under `node` it died in the module loader: it imports the
 * engine's TypeScript, and the engine imports `./board` with no extension.
 *
 * Nothing caught it. The script needs the donor clones, so it cannot be in CI,
 * and a check nobody can run reads exactly like a check that passes — the same
 * defect this repository keeps finding in a new place.
 *
 * These assert the rule, against a made-up tree. Asserting against this
 * repository's actual files would be a test that passes until someone edits
 * one, which is the thing under suspicion.
 */

/** A tiny filesystem: paths to sources. Anything else reads as absent. */
const treeOf =
  (files: Record<string, string>) =>
  (path: string): string | null =>
    files[path] ?? null;

describe('the runtime a script declares', () => {
  it('is read from the shebang', () => {
    expect(runtimeOf('#!/usr/bin/env bun\nconsole.log(1)')).toBe('bun');
    expect(runtimeOf('#!/usr/bin/env node\n')).toBe('node');
  });

  it('is nothing when there is no shebang, rather than a guess', () => {
    // A script with no shebang is not "probably node": it is a script that
    // does not say, and saying so is the check.
    expect(runtimeOf('console.log(1)')).toBeNull();
  });
});

describe('what Node can follow', () => {
  it('is a specifier with an extension, and nothing else', () => {
    expect(resolvableByNode('./board.ts')).toBe(true);
    expect(resolvableByNode('../lib/claims.mjs')).toBe(true);
    expect(resolvableByNode('./board')).toBe(false);
    expect(resolvableByNode('../packages/engine/src/index')).toBe(false);
  });

  it('does not mistake a dotted directory for an extension', () => {
    // `./v1.2/index` ends in a digit, not a module. Node cannot load it either.
    expect(resolvableByNode('./v1.2/index')).toBe(false);
  });
});

describe('reading the imports out of a file', () => {
  it('finds them whether they are imports or re-exports', () => {
    const source = `
import { a } from './a.ts';
export { b } from './b.ts';
import './side-effect.ts';
import fromNpm from 'grammy';
`;
    expect(relativeImports(source)).toEqual(['./a.ts', './b.ts', './side-effect.ts']);
  });

  it('does not read prose as code', () => {
    // The first version of this check reported two scripts as broken over a
    // doc comment that quoted the rule it was checking. A scanner that reads
    // prose as code over-reports exactly as readily as one that misses an
    // import under-reports.
    const source = `
/**
 * An \`export { name } from './x'\` is plumbing, not a use.
 */
// import './commented-out';
import { real } from './real.ts';
`;
    expect(relativeImports(source)).toEqual(['./real.ts']);
  });

  it('is not confused by a regex literal containing a quote', () => {
    // The obvious fix — a character scanner tracking quotes — was written
    // first and was wrong: /['"]/ opens a string that never closes, and every
    // comment after it reads as code.
    const source = `
const quoted = /['"]/g;
/** Says \`from './ghost'\` and means nothing by it. */
import { real } from './real.ts';
`;
    expect(relativeImports(source)).toEqual(['./real.ts']);
  });

  it('keeps a comment line out and the code around it in', () => {
    expect(withoutCommentLines("import './a.ts';\n * prose\n// note\nimport './b.ts';")).toBe(
      "import './a.ts';\nimport './b.ts';",
    );
  });
});

describe('what stops a script running under Node', () => {
  it('is an extensionless import anywhere it can reach, not just the first file', () => {
    // The whole point of walking: `board-overlay.mjs` imports `board.ts`
    // directly and runs today only because that file happens to import
    // nothing. The day it imports a neighbour without an extension, the script
    // breaks in the loader and nothing about the script itself has changed.
    const blockers = findNodeBlockers(
      'scripts/thing.mjs',
      treeOf({
        'scripts/thing.mjs': "import { x } from '../packages/engine/src/index.ts';",
        'packages/engine/src/index.ts': "export { x } from './board';",
      }),
    );

    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toEqual({ file: 'packages/engine/src/index.ts', specifier: './board' });
  });

  it('is nothing at all when every hop names a file', () => {
    expect(
      findNodeBlockers(
        'scripts/thing.mjs',
        treeOf({
          'scripts/thing.mjs': "import { x } from './lib/x.mjs';",
          'scripts/lib/x.mjs': "export { y } from './y.mjs';",
          'scripts/lib/y.mjs': 'export const y = 1;',
        }),
      ),
    ).toEqual([]);
  });

  it('keeps walking past one blocker, so it does not hide the rest', () => {
    const blockers = findNodeBlockers(
      'a.mjs',
      treeOf({
        'a.mjs': "import './b';",
        'b.ts': "import './c';",
        'c.ts': 'export const c = 1;',
      }),
    );
    expect(blockers.map((blocker: { specifier: string }) => blocker.specifier)).toEqual([
      './b',
      './c',
    ]);
  });

  it('terminates on a cycle, because modules import each other', () => {
    expect(() =>
      findNodeBlockers(
        'a.ts',
        treeOf({ 'a.ts': "import './b.ts';", 'b.ts': "import './a.ts';" }),
      ),
    ).not.toThrow();
  });

  it('treats a file it cannot read as nothing to follow', () => {
    // A script importing something genuinely missing is a different failure,
    // and one Node reports clearly. This check is about the silent one.
    expect(findNodeBlockers('a.mjs', treeOf({ 'a.mjs': "import './gone.ts';" }))).toEqual([]);
  });
});

describe('what the docs tell a reader to run', () => {
  it('is read out of prose and code alike', () => {
    const documented = documentedRuntimes(
      '```bash\nnode scripts/audit-claims.mjs\n```\nOr run `bun scripts/audit-copies.mjs --src ../leela-src`.',
    );
    expect([...(documented.get('scripts/audit-claims.mjs') ?? [])]).toEqual(['node']);
    expect([...(documented.get('scripts/audit-copies.mjs') ?? [])]).toEqual(['bun']);
  });

  it('records both when two documents disagree', () => {
    const documented = documentedRuntimes('node scripts/a.mjs\nbun scripts/a.mjs');
    expect((documented.get('scripts/a.mjs') as Set<string>).size).toBe(2);
  });
});

describe('what counts as wrong', () => {
  const declared = (runtime: string | null, specifiers: string[] = []) =>
    new Map([
      [
        'scripts/a.mjs',
        { runtime, blockers: specifiers.map((specifier) => ({ file: 'x.ts', specifier })) },
      ],
    ]);

  it('is a script that says node and cannot run under it', () => {
    const problems = checkRuntimes(declared('node', ['./board']), new Map());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('./board');
  });

  it('is not a script that says bun and imports what bun resolves', () => {
    // The fix for audit-copies was to declare bun, not to rewrite the engine's
    // imports. A blocker is only a blocker for the runtime that has the rule.
    expect(checkRuntimes(declared('bun', ['./board']), new Map())).toEqual([]);
  });

  it('is a script that says nothing about how to run it', () => {
    expect(checkRuntimes(declared(null), new Map())[0]).toContain('no shebang');
  });

  it('is documentation naming a runtime the script does not declare', () => {
    // Both directions, and this repository had one of each: README said `node`
    // for a script that dies under it, and `bun` for one that runs fine under
    // node. A list of commands kept by hand goes stale both ways at once.
    const problems = checkRuntimes(
      declared('node'),
      new Map([['scripts/a.mjs', new Set(['bun'])]]),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('declares node');
  });

  it('is documentation naming a script that is not there', () => {
    const problems = checkRuntimes(new Map(), new Map([['scripts/gone.mjs', new Set(['node'])]]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('which is not there');
  });

  it('is nothing when the file, the shebang and the docs agree', () => {
    expect(
      checkRuntimes(declared('node'), new Map([['scripts/a.mjs', new Set(['node'])]])),
    ).toEqual([]);
  });
});

describe('an audit that nothing runs', () => {
  /**
   * The same defect one step along. `audit-copies.mjs` was broken under the
   * runtime its own README named, and the reason nobody noticed is that it
   * cannot be a CI job: it needs the donor clones. That exemption was an
   * absence — indistinguishable from an oversight — until the script said so
   * itself.
   */
  /**
   * A workflow, rather than the two lines out of one this used to be.
   *
   * The reader below it stopped being a text search and became a structural
   * one, and the structure is the whole claim: a step is a list item under a
   * job's `steps:`. Two dashes floating at column six are not that, and a
   * fixture that keeps passing after the thing it describes has been deleted
   * is the defect this repository keeps finding.
   */
  const WORKFLOW = `
jobs:
  audits:
    runs-on: ubuntu-latest
    steps:
      - run: node scripts/audit-unread.mjs
      - run: bun scripts/audit-copies.mjs
`;

  it('reads the jobs whichever runtime they name', () => {
    expect([...auditsRunByCi(WORKFLOW)].sort()).toEqual([
      'scripts/audit-copies.mjs',
      'scripts/audit-unread.mjs',
    ]);
  });

  it('reads the reason out of the script that has it', () => {
    expect(needsOf(' * Needs: the donor clones in ../leela-src.\n */')).toBe(
      'the donor clones in ../leela-src.',
    );
    expect(needsOf(' * Run:  node scripts/x.mjs\n */')).toBeNull();
  });

  it('names an audit that nothing runs and that gives no reason', () => {
    const problems = checkAuditsRun(
      new Map([['scripts/audit-new.mjs', null]]),
      auditsRunByCi(WORKFLOW),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('nothing runs it');
  });

  it('accepts one that explains itself', () => {
    expect(
      checkAuditsRun(new Map([['scripts/audit-new.mjs', 'the network']]), auditsRunByCi(WORKFLOW)),
    ).toEqual([]);
  });

  it('catches the other direction: CI running what says it cannot run there', () => {
    // A job that runs a script needing clones CI does not check out is a job
    // that passes by not looking — the failure this whole check is about.
    const problems = checkAuditsRun(
      new Map([['scripts/audit-copies.mjs', 'the donor clones']]),
      auditsRunByCi(WORKFLOW),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('it says it needs');
  });

  it('is quiet when every audit is either run or excused', () => {
    expect(
      checkAuditsRun(new Map([['scripts/audit-unread.mjs', null]]), auditsRunByCi(WORKFLOW)),
    ).toEqual([]);
  });
});

/**
 * A step that cannot fail the job is not a step that runs the audit.
 *
 * `auditsRunByCi` is the half of `audit-scripts.mjs` that reads CI, and twenty
 * other audits are supervised by whatever it can see. It read the workflow as
 * text — one `matchAll` for `node scripts/x.mjs` anywhere in the file — so
 * every way of writing a step that does not run was indistinguishable from one
 * that does. MEASURED before the rewrite, on this repository: commenting out
 * `- run: node scripts/audit-doubles.mjs` in `.github/workflows/ci.yml` left
 * `node scripts/audit-scripts.mjs` printing "the docs agree" and exiting 0.
 *
 * The grid below is the shape rather than the three ways it was wrong. Each row
 * says only *can this step fail the job*, and the reader's verdict has to
 * follow from that and nothing else — a step behind a `#`, behind `if: false`,
 * or with its failure waived by `continue-on-error` cannot, and a step with a
 * condition that is true on some events can.
 *
 * Both directions, because they are not the same defect. A guard that misses is
 * blind; a guard that fails a correct workflow is one somebody deletes rather
 * than obeys, and the last assertion holds the reader to the real `ci.yml`.
 */
describe('what counts as a step that runs an audit', () => {
  /** One job, one `steps:`, and whatever the row puts under it. */
  const workflowOf = (steps: string) => `name: CI
on: [push]

jobs:
  audits:
    runs-on: ubuntu-latest
    steps:
${steps}
`;

  /**
   * The grid. `fails` is what the row's steps can bring the job down with;
   * `never` is what appears in the row's text and cannot.
   *
   * `\${{` is escaped only because this file is a template literal. The
   * workflow sees `${{`.
   */
  const SHAPES: { shape: string; steps: string; fails: string[]; never: string[] }[] = [
    {
      shape: 'a plain step',
      steps: '      - run: node scripts/audit-plain.mjs',
      fails: ['scripts/audit-plain.mjs'],
      never: [],
    },
    {
      shape: 'a step whose runtime is bun',
      steps: '      - run: bun scripts/audit-bun.mjs',
      fails: ['scripts/audit-bun.mjs'],
      never: [],
    },
    {
      shape: 'a step inside a YAML comment',
      steps: '      # - run: node scripts/audit-commented.mjs',
      fails: [],
      never: ['scripts/audit-commented.mjs'],
    },
    {
      shape: 'a comment trailing a step that is real',
      steps: [
        '      - run: node scripts/audit-real.mjs',
        '      # run: node scripts/audit-trailing.mjs',
        '      - run: node scripts/audit-second.mjs  # and one on the end of a line',
      ].join('\n'),
      fails: ['scripts/audit-real.mjs', 'scripts/audit-second.mjs'],
      never: ['scripts/audit-trailing.mjs'],
    },
    {
      shape: 'a step that is switched off with if: false',
      steps: ['      - if: false', '        run: node scripts/audit-if-false.mjs'].join('\n'),
      fails: [],
      never: ['scripts/audit-if-false.mjs'],
    },
    {
      shape: 'a step switched off inside an expression',
      steps: ['      - if: \${{ false }}', '        run: node scripts/audit-if-expr.mjs'].join('\n'),
      fails: [],
      never: ['scripts/audit-if-expr.mjs'],
    },
    {
      shape: 'a step whose failure the job forgives',
      steps: [
        '      - continue-on-error: true',
        '        run: node scripts/audit-tolerated.mjs',
      ].join('\n'),
      fails: [],
      never: ['scripts/audit-tolerated.mjs'],
    },
    {
      shape: 'a step that says its failure counts',
      steps: [
        '      - continue-on-error: false',
        '        if: true',
        '        run: node scripts/audit-kept.mjs',
      ].join('\n'),
      fails: ['scripts/audit-kept.mjs'],
      never: [],
    },
    {
      shape: 'a step under a condition that is true on some runs',
      steps: [
        "      - if: \${{ github.event_name == 'push' }}",
        '        run: node scripts/audit-conditional.mjs',
      ].join('\n'),
      fails: ['scripts/audit-conditional.mjs'],
      never: [],
    },
    {
      shape: 'the two layers of quoting, which disagree',
      // YAML's quotes are gone before the runner evaluates anything, so
      // `if: 'false'` is the boolean and the step is skipped. Quotes written
      // *inside* the expression are a string literal, and a non-empty string
      // is true, so that step runs.
      steps: [
        "      - if: 'false'",
        '        run: node scripts/audit-yaml-quoted.mjs',
        "      - if: \${{ 'false' }}",
        '        run: node scripts/audit-expression-quoted.mjs',
      ].join('\n'),
      fails: ['scripts/audit-expression-quoted.mjs'],
      never: ['scripts/audit-yaml-quoted.mjs'],
    },
    {
      shape: 'a script path in a quoted string that is not a command',
      steps: [
        '      - name: "node scripts/audit-named.mjs"',
        '        env:',
        '          NOTE: bun scripts/audit-in-env.mjs',
        '        run: echo nothing',
      ].join('\n'),
      fails: [],
      never: ['scripts/audit-named.mjs', 'scripts/audit-in-env.mjs'],
    },
    {
      shape: 'a command inside a block scalar, and a shell comment beside it',
      steps: [
        '      - run: |',
        '          node scripts/audit-in-block.mjs',
        '          # node scripts/audit-shell-comment.mjs',
      ].join('\n'),
      fails: ['scripts/audit-in-block.mjs'],
      never: ['scripts/audit-shell-comment.mjs'],
    },
    {
      shape: 'a step after one whose shape the reader does not model',
      // Skipping an unrecognised line rather than stopping at it: the steps
      // after it must not vanish, because a lost step is an audit reported as
      // unrun, which is the alarm on correct code.
      steps: [
        '      - uses: oven-sh/setup-bun@v2',
        '        with:',
        '          bun-version: latest',
        '      - run: node scripts/audit-after-oddity.mjs',
      ].join('\n'),
      fails: ['scripts/audit-after-oddity.mjs'],
      never: [],
    },
  ];

  it.each(SHAPES)('reads $shape by whether it can fail the job', ({ steps, fails, never }) => {
    const found = auditsRunByCi(workflowOf(steps));

    for (const path of fails) expect([...found]).toContain(path);
    for (const path of never) expect([...found]).not.toContain(path);
  });

  it('gives the same verdicts when every shape is in one workflow', () => {
    // Alone, a row could pass because the reader stopped early and found
    // nothing. Together, the rows have to be told apart.
    const found = auditsRunByCi(workflowOf(SHAPES.map((row) => row.steps).join('\n')));

    expect([...found].sort()).toEqual([...SHAPES.flatMap((row) => row.fails)].sort());
  });

  it('does not count a step of a job that is switched off', () => {
    const workflow = `jobs:
  audits:
    if: false
    runs-on: ubuntu-latest
    steps:
      - run: node scripts/audit-dead-job.mjs
  live:
    runs-on: ubuntu-latest
    steps:
      - run: node scripts/audit-live-job.mjs
`;

    expect([...auditsRunByCi(workflow)]).toEqual(['scripts/audit-live-job.mjs']);
  });

  /**
   * A limit, written down because the obvious sentence about it is false.
   *
   * The obvious sentence was: "a path inside a quoted string is not a command,
   * so the reader ignores it". MEASURED, and it is only true of YAML strings —
   * `name:` and `env:` above, which are not `run:` and never reach the scan. A
   * path echoed *inside* a command that does run is a shell string, and the
   * reader does not read shell: it takes the `run:` text and matches
   * `node scripts/x.mjs` in it, so the echo below counts.
   *
   * Left as it is rather than fixed, and the reason is the one this file has
   * recorded twice already. Suppressing quoted shell arguments would also
   * suppress `bash -c "node scripts/audit-x.mjs"`, which is a real invocation,
   * and losing that would report a running audit as unrun — an alarm on a
   * correct workflow, which is worse than this, an audit named in an echo and
   * miscounted as run. Nothing in `.github/workflows` echoes a script path.
   *
   * If someone teaches the reader shell, this test fails and it is this note
   * that is out of date rather than the code.
   */
  it('does not read shell, so a path echoed by a command that runs is counted', () => {
    const workflow = workflowOf(
      ['      - run: |', '          echo "not node scripts/audit-echoed.mjs either"'].join('\n'),
    );

    expect([...auditsRunByCi(workflow)]).toEqual(['scripts/audit-echoed.mjs']);
  });

  it('finds nothing in a file that has no steps at all, rather than guessing', () => {
    // The old reader answered from any line of the file. A `paths:` filter or
    // a prose comment naming a script is not a job.
    expect([
      ...auditsRunByCi("name: CI\non:\n  push:\n    paths:\n      - 'scripts/audit-x.mjs'\n"),
    ]).toEqual([]);
  });

  /**
   * The direction that matters more, and the one this file can measure: on the
   * workflow this repository actually has, the structural reader must find
   * exactly what a person reading the file finds.
   *
   * Compared against a deliberately dumber reader — drop the lines that are
   * only a comment, then the old text search — because the two must agree on a
   * workflow that disables nothing, and `ci.yml` disables nothing today. The
   * day a step there is given an `if:` or a `continue-on-error:`, this
   * assertion is where that shows up, and the disagreement is the point rather
   * than a fault: one of the two readers is then wrong about CI, and it is not
   * this one.
   */
  it('finds in the real ci.yml exactly what CI runs there', () => {
    const workflow = readFileSync(
      join(fileURLToPath(new URL('../../../', import.meta.url)), '.github/workflows/ci.yml'),
      'utf8',
    );

    const naive = new Set(
      [
        ...workflow
          .split('\n')
          .filter((line) => !line.trimStart().startsWith('#'))
          .join('\n')
          .matchAll(/(?:node|bun)\s+(scripts\/[\w-]+\.mjs)/g),
      ].map(([, path]) => path),
    );

    // Not an assertion about a number. It refuses the vacuous pass: a reader
    // that returned nothing would satisfy an equality between two empty sets.
    expect(naive.size).toBeGreaterThan(10);
    expect([...auditsRunByCi(workflow)].sort()).toEqual([...naive].sort());
  });
});

/**
 * A document that names a command and is outside the audited set.
 *
 * `checkRuntimes` above is exact about a document it is handed. What it is
 * handed was a list of four written by hand in `scripts/audit-scripts.mjs`:
 * README, MIGRATION and two package READMEs. The three documents this
 * repository tells an agent to read *before touching anything* — `CLAUDE.md`,
 * `AGENTS.md`, `.specify/memory/constitution.md` — were not in it, and between
 * them they named six script commands that nothing checked.
 *
 * One was wrong. `CLAUDE.md` said `bun scripts/board-overlay.mjs` for a script
 * whose shebang says node; MIGRATION.md records that exact finding as closed,
 * because it was fixed in README and left standing in the file Claude Code
 * opens first. The audit's closing line — "the docs agree" — was true of the
 * four documents it read and false of the repository.
 *
 * So the rule is not "these five documents". It is that the audited set is held
 * to the documents that exist: whatever markdown in this repository tells a
 * reader to run a script, the runtime check has read it. A document added
 * tomorrow either joins the list or is named here.
 */
describe('the documents held to the commands they name', () => {
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

  /** Every markdown file in the repository, minus what nobody wrote by hand. */
  const documents = (dir: string, prefix = ''): string[] => {
    const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out']);
    const found: string[] = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) found.push(...documents(join(dir, entry.name), path));
      else if (entry.name.endsWith('.md')) found.push(path);
    }

    return found;
  };

  /**
   * The audited list, read out of the script's source.
   *
   * Not imported: `audit-scripts.mjs` does its work at import time, and
   * importing it here would run the audit inside the test process. Read rather
   * than re-declared, because a copy of the list in this file is a second list
   * to keep, which is the defect.
   *
   * It throws when it finds nothing. A parse that quietly returned `[]` would
   * make every assertion below vacuous — a check that passes because it could
   * not find what it checks is this repository's oldest failure.
   */
  const auditedDocuments = (source: string): string[] => {
    const list = /\bconst DOCS = \[([^\]]*)\]/.exec(source)?.[1];
    if (list === undefined) {
      throw new Error('audit-scripts.mjs no longer declares `const DOCS = [...]`');
    }

    const docs = [...list.matchAll(/'([^']+)'/g)].map(([, doc]) => doc);
    if (docs.length === 0) throw new Error('audit-scripts.mjs declares an empty DOCS');
    return docs;
  };

  const audited = () =>
    new Set(auditedDocuments(readFileSync(join(ROOT, 'scripts/audit-scripts.mjs'), 'utf8')));

  it('is every document in this repository that names a script command', () => {
    // The shape, not today's five. Any markdown that tells a reader `node
    // scripts/x.mjs` is a place the runtime can be documented wrongly, and the
    // check reads it or the check is smaller than it sounds.
    const set = audited();
    const unaudited = documents(ROOT).filter(
      (doc) =>
        documentedRuntimes(readFileSync(join(ROOT, doc), 'utf8')).size > 0 && !set.has(doc),
    );

    expect(unaudited).toEqual([]);
  });

  it('does not require a document that names no command', () => {
    // The list may hold a document that mentions none — `apps/bot/README.md`
    // does today. Being in it is cheap; being outside it is invisible, and only
    // the second direction is a defect.
    expect(audited().size).toBeGreaterThan(0);
  });

  it('refuses to read an empty or missing list as agreement', () => {
    expect(() => auditedDocuments('const DOCS = [];')).toThrow(/empty/);
    expect(() => auditedDocuments('nothing of the sort')).toThrow(/no longer declares/);
  });
});
