/**
 * A suppression that suppresses nothing, and the switch that stopped saying so.
 *
 * This repository replaced `scripts/audit-awaited.mjs` with typescript-eslint,
 * and the whole case for that swap was written about ONE line:
 *
 *     for (const rubbish of [...]) {
 *       // (a next-line disable of `no-await-in-loop`, spelled out in
 *       //  apps/mobile/tests/awaited.test.ts as a fixture)
 *       expect(loadKeptGame(device).then((k) => k.game), rubbish).resolves.toBe(null);
 *     }
 *
 * Somebody wrote `await`, a lint rule refused it inside a loop, the `await` came
 * off, and the line excusing it stayed — six malformed-input cases that could no
 * longer fail, standing under a comment that read as though it were still doing
 * something. A directive outliving what it excused.
 *
 * ESLint has a built-in reader for exactly that: unused-directive reporting. The
 * config that replaced the sweep switched it off, in the same change that turned
 * the sweep on, over the single finding it produced —
 * `packages/db/tests/legacy.test.ts:346`, a disable of `no-throw-literal` above
 * a deliberate `throw 'a bare string'`. The reason recorded for switching it off
 * was that the directive is a note to a human reader and "unused" only because
 * ESLint was new here.
 *
 * That reason does not survive being checked, and checking it is what this file
 * is. No configuration in this repository enables `no-throw-literal`. The
 * directive named a rule the repository does not run, so it suppressed nothing
 * on the day it was written and would suppress nothing on any day after — while
 * telling every reader of that test that a lint rule is being held off the bare
 * throw. It is deleted. The throw and the assertion under it are untouched: the
 * test is right, only the suppression was dead.
 *
 * WHAT IS ASSERTED, as shapes rather than as those two lines.
 *
 *   (a) Every rule named in an `eslint-disable` directive anywhere under the
 *       config's own `files` globs is a rule the config actually enables. This
 *       is derived twice over — the rule names come from importing
 *       `eslint.config.mjs`, and so do the globs — so a rule renamed, a rule
 *       dropped, or a directive typed with a plugin prefix it does not have all
 *       fail here without anybody maintaining a list of known offenders.
 *
 *   (b) The config leaves unused-directive reporting on. Absent is fine —
 *       ESLint 9 and later default it to reporting — and `'error'` or `'warn'`
 *       are fine. `'off'` is not.
 *
 *   (c) Every DIRECTORY entry in `.gitignore` is covered by the config's
 *       `ignores`. ESLint's flat config does not read `.gitignore`, so without
 *       this the lint result depends on which generated artifacts happen to
 *       exist on the machine running it — measured, not supposed: with
 *       `packages/engine/coverage` on disk, `bunx eslint .` printed three
 *       findings from Istanbul's vendored report scripts; on CI, which has never
 *       run `bun run coverage`, it printed none.
 *
 * READ WITH THE TYPESCRIPT PARSER, not by line, and this repository can name the
 * innocents that choice spares. `grep -rn eslint-disable` over the workspaces
 * reports four lines today and only one of them is a directive: two are prose
 * inside `apps/mobile/tests/*.test.ts` describing the defect, and one sits
 * inside a template literal there, a fixture handed to a parser as source text.
 * A check that names three innocents to catch one defect is one somebody
 * switches off — which is, precisely, the thing that happened here.
 *
 * It does not shell out to ESLint. `bunx eslint .` is the other reader and runs
 * in CI; this file asks the question a lint run cannot, because a lint run
 * reports what the config told it to report and cannot see the config being told
 * to stop.
 *
 * BROKEN ON PURPOSE, 2026-08-06, because an assertion never seen to fail is not
 * evidence. Each of the three was made to fail and then undone.
 *
 *   (i) A next-line disable of `no-console` planted above the `REPO` constant
 *       in this file — line 109 as the file then stood, and the number is
 *       quoted only because both readers below print it. Case (a) failed:
 *
 *         + Array [
 *         +   "packages/db/tests/a-suppression-that-suppresses-nothing.test.ts:109
 *         +    disables no-console",
 *         + ]
 *
 *       and `bunx eslint .` went from silent exit 0 to exit 1:
 *
 *         109:1  error  Unused eslint-disable directive (no problems were
 *                       reported from 'no-console')
 *         ✖ 1 problem (1 error, 0 warnings)
 *
 *       Two readers sharing no code, on the same planted line, for the same
 *       reason. Neither of them was told about it.
 *
 *  (ii) `reportUnusedDisableDirectives` set back to `'off'`. Case (b) failed:
 *
 *         AssertionError: reportUnusedDisableDirectives is off. A directive can
 *         then rot in place … expected 'off' to match /^(?:error|warn)$/
 *
 *       Case (a) passed throughout — 1 failed, 7 passed — which is why both are
 *       here. (a) is what reads directives; (b) is what keeps ESLint reading
 *       them, and a repository can lose the second while the first still says
 *       everything is fine.
 *
 * (iii) `'**' + '/coverage/**'` removed from the config's `ignores`. Case (c)
 *       failed:
 *
 *         + Array [
 *         +   "coverage/ — coverage/f.ts, packages/engine/coverage/f.ts,
 *         +    apps/mobile/a/b/coverage/f.ts",
 *         + ]
 *
 *       and `bunx eslint .` printed the three Istanbul files again and exited 1
 *       — this machine disagreeing with CI over a commit neither of them had
 *       changed, which is the whole of what (c) closes.
 *
 * All three were undone, and the verification run afterwards is in the report:
 * `bunx eslint .` exits 0 with no output both with `packages/engine/coverage`
 * on disk and with it moved away, and the two runs are identical.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * The config as ESLint receives it, not as a regular expression guesses it.
 *
 * `tseslint.config()` is a function: it can flatten, extend and reorder what it
 * is handed, so the array this yields is the only honest answer to "what does
 * this repository enable". Reading the file as text would be a second
 * implementation of that function, and the whole register of this repository is
 * that a restated rule is one that goes stale.
 */
type ConfigEntry = {
  files?: string[];
  ignores?: string[];
  rules?: Record<string, unknown>;
  linterOptions?: { reportUnusedDisableDirectives?: unknown };
};

const CONFIG_PATH = join(REPO, 'eslint.config.mjs');
const config: ConfigEntry[] = (
  (await import(pathToFileURL(CONFIG_PATH).href)) as { default: ConfigEntry[] }
).default;

const enabledRules = new Set(
  config.flatMap((entry) =>
    Object.entries(entry.rules ?? {})
      .filter(([, level]) => level !== 'off' && level !== 0)
      .map(([name]) => name),
  ),
);

const lintedGlobs = config.flatMap((entry) => entry.files ?? []);
const ignoreGlobs = config.flatMap((entry) => entry.ignores ?? []);

/**
 * A glob as a regular expression over slash-separated paths.
 *
 * Small on purpose: three forms appear in this repository's globs and nothing
 * else does. A leading segment of two stars followed by a slash means "at any
 * depth, including none", two stars alone mean "anything", and one star means
 * "anything within a single segment". Everything else is a literal, escaped.
 *
 * Written here rather than taken from a package because the alternative is a
 * dependency whose semantics this file would then have to be read alongside; the
 * assertions below are about coverage, and coverage is decided by whether a path
 * matches, which is the whole of what this needs to answer.
 */
const globToRegExp = (glob: string): RegExp => {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const here = glob[i];
    if (here === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') {
      out += '(?:[^/]*/)*';
      i += 2;
    } else if (here === '*' && glob[i + 1] === '*') {
      out += '.*';
      i += 1;
    } else if (here === '*') {
      out += '[^/]*';
    } else if (here === '?') {
      out += '[^/]';
    } else {
      out += here.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
};

const matchesAny = (path: string, globs: string[]): boolean =>
  globs.some((glob) => globToRegExp(glob).test(path));

/**
 * Every file the config points ESLint at, found by walking rather than listed.
 *
 * The walk skips what the config ignores, plus `.git`, which no configuration
 * mentions because nothing ever asked ESLint to open it.
 */
const lintedFiles = (): string[] => {
  const found: string[] = [];
  const walk = (absolute: string) => {
    for (const name of readdirSync(absolute).sort()) {
      const child = join(absolute, name);
      const path = relative(REPO, child).split('\\').join('/');
      if (name === '.git') continue;
      if (statSync(child).isDirectory()) {
        if (matchesAny(`${path}/anything`, ignoreGlobs)) continue;
        walk(child);
      } else if (matchesAny(path, lintedGlobs)) {
        found.push(path);
      }
    }
  };
  walk(REPO);
  return found;
};

/**
 * Comments, from the parser, so a directive inside a string is not a directive.
 *
 * Both leading and trailing trivia are collected: a disable is as often written
 * at the end of the line it excuses as above it, and a reader that saw only one
 * of those would be silent about half the class.
 */
const commentsIn = (text: string, fileName: string): { pos: number; text: string }[] => {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const byPos = new Map<number, { pos: number; text: string }>();
  const collect = (pos: number, end: number) => {
    for (const range of ts.getLeadingCommentRanges(text, pos) ?? []) {
      byPos.set(range.pos, { pos: range.pos, text: text.slice(range.pos, range.end) });
    }
    for (const range of ts.getTrailingCommentRanges(text, end) ?? []) {
      byPos.set(range.pos, { pos: range.pos, text: text.slice(range.pos, range.end) });
    }
  };
  const visit = (node: ts.Node) => {
    collect(node.getFullStart(), node.getEnd());
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  collect(source.endOfFileToken.getFullStart(), source.endOfFileToken.getEnd());
  return [...byPos.values()].sort((left, right) => left.pos - right.pos);
};

/**
 * What ESLint reads out of a comment, and it reads only the front of it.
 *
 * A directive is the FIRST thing in the comment or it is prose. That is why the
 * two paragraphs in `apps/mobile/tests` that describe this defect in English are
 * not directives, and it is why this file may quote the spelling in a string
 * literal a few lines below without accusing itself.
 *
 * Everything after a double dash is ESLint's description separator — a place to
 * say why, not another rule name.
 */
const DIRECTIVE = /^eslint-disable(?:-next-line|-line)?(?![\w-])/;

const directivesIn = (
  text: string,
  fileName: string,
): { line: number; rules: string[] }[] => {
  const found: { line: number; rules: string[] }[] = [];
  for (const comment of commentsIn(text, fileName)) {
    const body = comment.text.startsWith('//')
      ? comment.text.slice(2)
      : comment.text.slice(2, comment.text.length - 2);
    const value = body.trim();
    const head = DIRECTIVE.exec(value);
    if (head === null) continue;
    const named = value.slice(head[0].length).split('--')[0] ?? '';
    found.push({
      line: text.slice(0, comment.pos).split('\n').length,
      rules: named
        .split(/[\s,]+/)
        .map((one) => one.trim())
        .filter((one) => one.length > 0),
    });
  }
  return found;
};

describe('a suppression naming a rule the repository does not run', () => {
  /**
   * The case that would have caught `packages/db` today.
   *
   * Derived from the config on both sides — which rules are enabled, and which
   * files are swept — so it stays true of a repository that enables different
   * rules tomorrow. What it cannot see is a bare disable naming no rule at all;
   * that one turns off everything and is a different question, asked by ESLint's
   * own unused-directive reporting, which case (b) below keeps switched on.
   */
  it('names no rule that the config does not enable', () => {
    const swept = lintedFiles();
    expect(swept.length).toBeGreaterThan(100);

    const wrong: string[] = [];
    for (const path of swept) {
      const text = readFileSync(join(REPO, path), 'utf8');
      if (!text.includes('eslint-disable')) continue;
      for (const directive of directivesIn(text, path)) {
        for (const rule of directive.rules) {
          if (!enabledRules.has(rule)) wrong.push(`${path}:${directive.line} disables ${rule}`);
        }
      }
    }

    expect(
      wrong,
      'A directive naming a rule no configuration enables suppresses nothing. It ' +
        'reads to the next person as though a rule were being held off the line ' +
        'below it, and it is the fingerprint of the defect this repository ' +
        'migrated to typescript-eslint to catch: an excuse that outlived what it ' +
        'excused.',
    ).toEqual([]);
  });

  it('is read from comments, so the same spelling inside a string is left alone', () => {
    const fixture = [
      'const source = `',
      '  for (const rubbish of rubbishes) {',
      '    // eslint-disable-next-line no-await-in-loop',
      '    expect(load(rubbish)).resolves.toBe(null);',
      '  }',
      '`;',
      "const shown = '// eslint-disable-line no-console';",
    ].join('\n');

    expect(directivesIn(fixture, 'fixture.ts')).toEqual([]);
  });

  it('reads a directive whether it sits above the line or at the end of it', () => {
    const fixture = [
      '// eslint-disable-next-line no-console, no-alert -- both, with a reason',
      'const a = 1;',
      'const b = 2; // eslint-disable-line no-debugger',
      '/* eslint-disable no-empty */',
    ].join('\n');

    expect(directivesIn(fixture, 'fixture.ts')).toEqual([
      { line: 1, rules: ['no-console', 'no-alert'] },
      { line: 3, rules: ['no-debugger'] },
      { line: 4, rules: ['no-empty'] },
    ]);
  });
});

describe('the switch that reports a directive nothing needed', () => {
  it('is left on, so a directive cannot rot in place', () => {
    const setting = config
      .map((entry) => entry.linterOptions?.reportUnusedDisableDirectives)
      .filter((one) => one !== undefined);

    for (const one of setting) {
      expect(
        String(one),
        'reportUnusedDisableDirectives is off. A directive can then rot in ' +
          'place: the rule it excused stops applying, the comment stays, and ' +
          'nothing says so — which is the defect this repository migrated to ' +
          'typescript-eslint to stop, and it was switched off here over a single ' +
          'finding that turned out to be a real one.',
      ).toMatch(/^(?:error|warn)$/);
    }
  });

  it('is asked of every file, not only of the linted globs', () => {
    const global = config.filter(
      (entry) =>
        entry.linterOptions?.reportUnusedDisableDirectives !== undefined &&
        entry.files === undefined,
    );

    expect(
      global.length,
      'The setting sits in a config object carrying `files`, so it applies to ' +
        'those globs and to nothing else. That is how it was written when it was ' +
        "'off': it silenced the one real finding in packages/db and left three " +
        'it had no opinion about printing from a generated directory.',
    ).toBeGreaterThan(0);
  });
});

describe('what git ignores and what eslint ignores', () => {
  /**
   * Derived from `.gitignore`, because restating it is how the two drift.
   *
   * A line ending in a slash is a directory. One with no slash inside it matches
   * at any depth, the way git reads it, so coverage is asked at the root AND
   * nested — `coverage/` must cover `packages/engine/coverage`, which is the
   * actual directory that made this a finding. One with a slash inside is
   * anchored to the repository root and is asked only there.
   */
  const directoryEntries = readFileSync(join(REPO, '.gitignore'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('!'))
    .filter((line) => line.endsWith('/'))
    .map((line) => line.replace(/^\/+/, '').replace(/\/+$/, ''));

  it('has something to check', () => {
    expect(directoryEntries.length).toBeGreaterThan(5);
  });

  it('ignores every generated directory that git ignores', () => {
    const uncovered: string[] = [];
    for (const entry of directoryEntries) {
      const anchored = entry.includes('/');
      const probes = anchored
        ? [`${entry}/f.ts`]
        : [`${entry}/f.ts`, `packages/engine/${entry}/f.ts`, `apps/mobile/a/b/${entry}/f.ts`];
      const missed = probes.filter((probe) => !matchesAny(probe, ignoreGlobs));
      if (missed.length > 0) uncovered.push(`${entry}/ — ${missed.join(', ')}`);
    }

    expect(
      uncovered,
      "ESLint's flat config does not read .gitignore. A generated directory it " +
        'does not ignore is linted when it happens to exist and not when it does ' +
        'not, so the same commit gives one answer on a machine that has run ' +
        '`bun run coverage` and another on CI, which never has.',
    ).toEqual([]);
  });

  it('ignores nothing that it is also pointed at', () => {
    const linted = lintedFiles();
    const swallowed = linted.filter((path) => matchesAny(path, ignoreGlobs));

    expect(
      swallowed,
      'An ignore wide enough to cover a linted source is a rule switched off ' +
        'silently: ESLint reports nothing and exits 0 over a file nobody opened.',
    ).toEqual([]);
  });
});
