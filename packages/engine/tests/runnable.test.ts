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
  const WORKFLOW = `
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
