// The audit lives in `scripts/lib/unread.mjs` and is tested here because this
// is the package whose test run always happens; a checker nobody tests is the
// thing it exists to prevent.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs module with no types, deliberately.
import { aliasesOf, declaredExports, declaredFields, readsOf, stripTemplateLiterals, uncalledExports, unreadFields, usesOf } from '../../../scripts/lib/unread.mjs';

describe('finding declarations', () => {
  it('finds an interface field', () => {
    const fields = declaredFields('interface A {\n  broadcast: boolean;\n}', 'a.ts');
    expect(fields.map((f: { name: string }) => f.name)).toContain('broadcast');
  });

  it('finds a readonly and an optional field', () => {
    const fields = declaredFields(
      'interface A {\n  readonly one: string;\n  two?: number;\n}',
      'a.ts',
    );
    expect(fields.map((f: { name: string }) => f.name)).toEqual(['one', 'two']);
  });

  it('finds a Drizzle column, under its TypeScript name', () => {
    const fields = declaredFields(
      "export const t = pgTable('t', {\n  needsReport: boolean('needs_report'),\n});",
      'schema.ts',
    );
    expect(fields.map((f: { name: string }) => f.name)).toContain('needsReport');
  });

  it('ignores a stylesheet held in a template literal', () => {
    // A `.ts` file holding CSS is full of `gap: 3px` lines that look exactly
    // like declarations. Reporting them taught nothing except to distrust it.
    const source = 'export const STYLE = `\n  .cell {\n    gap: 3px;\n    display: flex;\n  }\n`;';
    const names = declaredFields(source, 'style.ts').map((f: { name: string }) => f.name);
    expect(names).not.toContain('gap');
    expect(names).not.toContain('display');
  });
});

describe('counting reads', () => {
  it('counts a mention outside a declaration', () => {
    expect(readsOf('broadcast', ['if (reply.broadcast) send()'])).toBe(1);
  });

  it('does not count the declaration itself', () => {
    expect(readsOf('broadcast', ['  broadcast: boolean;'])).toBe(0);
  });

  it('does not count a plain assignment, because writing is the problem', () => {
    expect(readsOf('broadcast', ['  broadcast: false,'])).toBe(0);
  });

  it('counts a line that both writes and reads', () => {
    // `temperature: options.temperature ?? 0.7` is a read, and was miscounted
    // as a pure write until the name was counted rather than matched.
    expect(readsOf('temperature', ['  temperature: options.temperature ?? 0.7,'])).toBe(1);
  });

  it('does not count a comment', () => {
    expect(readsOf('broadcast', ['  // broadcast is set everywhere', '   * broadcast'])).toBe(0);
  });

  it('respects word boundaries', () => {
    expect(readsOf('plan', ['const title = planFor(6).title'])).toBe(0);
    expect(readsOf('plan', ['const n = entry.plan'])).toBe(1);
  });
});

describe('reporting the unread', () => {
  const declarations = [
    { name: 'read', file: 'a.ts', kind: 'interface' },
    { name: 'unread', file: 'a.ts', kind: 'interface' },
  ];
  const sources = ['interface A {\n  read: boolean;\n  unread: boolean;\n}', 'if (a.read) go()'];

  it('names a field with no readers', () => {
    expect(unreadFields(declarations, sources).map((f: { name: string }) => f.name)).toEqual([
      'unread',
    ]);
  });

  it('says nothing about a field that is read', () => {
    expect(unreadFields(declarations, sources).map((f: { name: string }) => f.name)).not.toContain(
      'read',
    );
  });

  it('honours the write-only list', () => {
    expect(unreadFields(declarations, sources, ['unread'])).toEqual([]);
  });

  it('reports a name once, however many times it is declared', () => {
    const twice = [...declarations, { name: 'unread', file: 'b.ts', kind: 'column' }];
    expect(unreadFields(twice, sources)).toHaveLength(1);
  });

  it('would have caught all three flags found by hand', () => {
    // broadcast, rerollOnRepeat, needs_report: each declared, each set
    // everywhere it should be, each consulted by nothing.
    const shapes = [
      'interface Reply {\n  broadcast: boolean;\n}',
      'const r = { text: "x", broadcast: false };',
      'interface RuleSet {\n  readonly rerollOnRepeat: boolean;\n}',
      'const LEGACY = { id: "legacy-mobile", rerollOnRepeat: true };',
      "const players = pgTable('players', {\n  needsReport: boolean('needs_report'),\n});",
      'const update = { needsReport: true };',
    ];
    const found = unreadFields(
      shapes.flatMap((source, i) => declaredFields(source, `f${i}.ts`)),
      shapes,
    ).map((f: { name: string }) => f.name);

    expect(found).toEqual(['broadcast', 'needsReport', 'rerollOnRepeat']);
  });
});

describe('a name something else was renamed to', () => {
  /**
   * `export { squareText as shareTextFor } from '@leela/journal'` is how the
   * mini app takes the journal's word for the format. Export lists are dropped
   * as plumbing before uses are counted — rightly, or a barrel file would make
   * every export look consumed — and the rename went with them, so `squareText`
   * was reported as having no caller while every one of its callers wrote
   * `shareTextFor`.
   *
   * That line was printed on every run of the audit for twenty passes. The
   * reason to fix it is not the export: **a check that always says one thing it
   * cannot back up is a check people stop reading.**
   */

  it('is found, and counts as the same thing', () => {
    const barrel = "export { squareText as shareTextFor } from '@leela/journal';";
    const caller = 'const text = shareTextFor(41, title, written, intention);';

    expect(aliasesOf('squareText', [barrel])).toEqual(['shareTextFor']);
    expect(usesOf('squareText', [barrel, caller])).toBeGreaterThan(0);
  });

  it('is found when the list is written down the page', () => {
    // Which is how every list of more than two names in this repository is
    // written, and why the first version of this found nothing at all — a
    // result indistinguishable from there being nothing to find.
    const barrel = [
      'export {',
      '  fileName,',
      '  parseDocument,',
      '  squareText as shareTextFor,',
      '  takeSquare,',
      "} from '@leela/journal';",
    ].join('\n');

    expect(aliasesOf('squareText', [barrel])).toEqual(['shareTextFor']);
  });

  it('is nothing for a name nobody renamed', () => {
    const barrel = "export { squareText } from '@leela/journal';";

    expect(aliasesOf('squareText', [barrel])).toEqual([]);
    expect(usesOf('squareText', [barrel])).toBe(0);
  });

  it('does not take a similar name for a rename of this one', () => {
    const barrel = "export { squareTextFor as shareTextFor } from './x';";

    expect(aliasesOf('squareText', [barrel])).toEqual([]);
  });

  it('is a rename in an import or export list, not a cast', () => {
    // `x as Y` is TypeScript's cast as well as its rename. Reading one as the
    // other would invent callers, which is worse than missing them: a check
    // that cannot say "nobody uses this" is a check with nothing to say.
    const cast = 'const model = something as squareText;';
    const alsoCast = 'return squareText as unknown as Whatever;';

    expect(aliasesOf('squareText', [cast, alsoCast])).toEqual([]);
  });

  it('still refuses a mention inside a string', () => {
    // The rename must not become a way back in for the accident the audit
    // already guards against: a command name that happens to match an export.
    const barrel = "export { squareText as shareTextFor } from './x';";
    const inAString = "bot.command('shareTextFor', () => undefined);";

    expect(usesOf('squareText', [barrel, inAString])).toBe(0);
  });
});

/**
 * What the audit is still able to see after it has blanked template literals.
 *
 * Everything the audit knows about a file, it knows from the stripped copy:
 * `declaredFields`, `declaredExports` and `declaredMembers` all read that and
 * never the original. So a stripper that loses its place does not report a
 * defect — it reports a smaller repository, in the same confident sentences.
 *
 * The invariant is stated over every file the audit reads rather than over the
 * ones already known to break it. A list of known-bad inputs only proves that
 * those inputs were fixed; the shape is what the next file walking into the
 * same blind spot gets measured against.
 *
 * The obvious way to state it — *every line matching `^export` in the raw file
 * still matches `^export` after stripping* — is false, and was measured to be
 * false rather than reasoned about. It names
 * `packages/engine/tests/runnable.test.ts:62`, where `export { b } from
 * './b.ts';` sits at column 0 **inside a template literal** holding a fixture
 * module. Blanking that line is the whole point of the stripper, so a check
 * phrased that way calls correct code a defect on the day it is written, and a
 * check that cries wolf is one somebody deletes rather than obeys.
 *
 * So the oracle is the TypeScript parser, which is the one reader that already
 * knows the difference between a statement and the text of a template literal.
 * Wherever it says a top-level statement beginning with the word `export`
 * starts, the stripped source must still read `export` **at that same offset** —
 * which asserts the blanking and the index-preservation in one line.
 */
describe('the stripper keeps its place across every file the audit reads', () => {
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

  function* sourceFiles(dir: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
      // Dependencies are not ours and are not searched by the audit either.
      if (entry === 'node_modules') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) yield* sourceFiles(full);
      else if (/\.tsx?$/.test(entry)) yield full;
    }
  }

  /** Where each top-level `export …` statement begins, according to the parser. */
  function exportsIn(file: string, source: string): number[] {
    const parsed = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    return parsed.statements
      .map((statement) => statement.getStart(parsed))
      .filter((start) => source.startsWith('export', start));
  }

  const files = ['packages', 'apps', 'scripts'].flatMap((dir) => [...sourceFiles(join(ROOT, dir))]);

  it('walks a corpus, so the invariant below cannot pass by finding nothing', () => {
    // A walk that returns an empty list satisfies every assertion made over it,
    // which is the quietest way for a check to stop checking.
    expect(files.length).toBeGreaterThan(100);
  });

  it('never hides a top-level export, whatever the line above it contains', () => {
    const lost: string[] = [];
    let seen = 0;

    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      const stripped: string = stripTemplateLiterals(raw);

      // Offsets have to survive too, or every position the audit reports is a
      // position in a file that no longer exists.
      expect(stripped).toHaveLength(raw.length);
      expect(stripped.split('\n')).toHaveLength(raw.split('\n').length);

      for (const start of exportsIn(file, raw)) {
        seen += 1;
        if (stripped.startsWith('export', start)) continue;

        const line = raw.slice(0, start).split('\n').length;
        lost.push(`${relative(ROOT, file)}:${line}  ${raw.slice(start, start + 60).split('\n')[0]}`);
      }
    }

    // Same reason as the file count: an oracle that found no exports would
    // agree with any stripper at all.
    expect(seen).toBeGreaterThan(400);
    expect(lost).toEqual([]);
  });
});

/**
 * Writing the excuse must not be what stops the audit asking.
 *
 * `audit-unread.mjs` puts `'scripts'` in `SEARCH` and the walk reads `.mjs`, so
 * the audit script is one of the sources searched for callers — its own waiver
 * lists included. Those lists are object literals, `  snakeAt: 'board helper for
 * consumers',`; `withoutStrings` blanks the reason and leaves `snakeAt:`
 * standing, and the counter read that as a use. Measured on this tree: 34 of the
 * exports the audit believed were called had exactly one counted mention in the
 * whole repository, and it was their own excuse line. The uncalled-export gate
 * could therefore never fire for a name once written into `PUBLIC_API`, however
 * dead it later became — the act of excusing something was the act of proving it
 * alive.
 *
 * The rule that fixes it has to be anchored, and that is measured rather than
 * argued. The fields half of the same library strips every `NAME\s*:` anywhere
 * on a line; copied here it took the colon of a ternary's second arm for a key
 * and erased a live caller, turning a green audit red over an export that is
 * used. In this repository a check that names an innocent is deleted rather than
 * obeyed, so a key is a name at the START of its line and a name anywhere else
 * on that line is an expression.
 *
 * Both halves of that are stated over a grid rather than over the three names
 * that motivated it. A test that lists `snakeAt`, `stepsFor` and
 * `ZAI_CODING_BASE_URL` proves those three were fixed; the grid is what the next
 * name shape gets measured against, so the key line and the expression lines are
 * generated from the same `name` variable and the assertion is made for every
 * one of them.
 */
describe('a name is not called by the list that excuses it', () => {
  // The edge of every column: casing, digits, underscores, and the shortest
  // identifier there is. Not a list of the names that broke — a list of the
  // shapes a name can have.
  const names = ['camelCase', 'SCREAMING_SNAKE', 'name2With3Digits', '_leadingUnderscore', 'x', 'aVeryLongExportedHelperName'];
  const indents = ['', '  ', '      '];

  /** The name as the key of an object literal, with a quoted reason for a value. */
  const keyLine = (name: string, indent: string) => `${indent}${name}: 'a reason nobody checked',`;

  /**
   * The name in expression position, on a line whose leading key is a different
   * name. All three are the shapes a waived export is really reached by, and the
   * ternary is the one the unanchored rule erased.
   */
  const expressionLines = (name: string, indent: string) => [
    `${indent}elsewhere: process.env.MODE === 'coding' ? ${name} : undefined,`,
    `${indent}elsewhere: choose(${name}),`,
    `${indent}elsewhere: ${name},`,
  ];

  it('does not count a line whose only mention of the name is the name as a key', () => {
    const counted: string[] = [];

    for (const name of names) {
      for (const indent of indents) {
        const line = keyLine(name, indent);
        if (usesOf(name, [line]) !== 0) counted.push(JSON.stringify(line));
      }
    }

    expect(counted).toEqual([]);
  });

  it('still counts the name in expression position beside a different key', () => {
    const missed: string[] = [];

    for (const name of names) {
      for (const indent of indents) {
        for (const line of expressionLines(name, indent)) {
          if (usesOf(name, [line]) === 0) missed.push(JSON.stringify(line));
        }
      }
    }

    expect(missed).toEqual([]);
  });

  it('counts a key whose value is the same name, because the value half is a read', () => {
    // `paginate: paginate` writes and reads in one line. Dropping the whole line
    // would lose the read, which is the mistake `readsOf` records above having
    // made with `temperature: options.temperature`.
    const missed = names.filter((name) => usesOf(name, [`  ${name}: ${name},`]) === 0);

    expect(missed).toEqual([]);
  });

  it('counts the shorthand, which has no key to strip', () => {
    const missed = names.filter((name) => usesOf(name, [`const held = { ${name} };`]) === 0);

    expect(missed).toEqual([]);
  });

  it('reports an export whose only mention anywhere is its own exemption entry', () => {
    // The whole grid at once, as the audit itself asks the question: a declaring
    // source and an excuse list, and nothing else. Every name must come back
    // uncalled, because an excuse is not a caller.
    for (const name of names) {
      const declared = `export function ${name}() {\n  return 1;\n}\n`;
      const excuses = names.map((one) => keyLine(one, '  ')).join('\n');

      const uncalled = uncalledExports(
        [{ name, file: 'a.ts', kind: 'function' }],
        [declared, excuses],
      ).map((one: { name: string }) => one.name);

      expect(uncalled).toEqual([name]);
    }
  });

  it('says nothing about the same export once a real caller exists', () => {
    // The other direction, and the one that matters more: a rule that reported
    // every waived export would be switched off within a day.
    for (const name of names) {
      const declared = `export function ${name}() {\n  return 1;\n}\n`;
      const excuses = names.map((one) => keyLine(one, '  ')).join('\n');
      const caller = expressionLines(name, '  ').join('\n');

      expect(
        uncalledExports([{ name, file: 'a.ts', kind: 'function' }], [declared, excuses, caller]),
      ).toEqual([]);
    }
  });
});

describe('a backtick that is not a template literal', () => {
  /**
   * Measured on `apps/docs/src/render.ts:161`, which is a markdown renderer:
   * `.replace(/`([^`]+)`/g, '<code>$1</code>')` holds four backticks inside a
   * regex literal. A stripper that only knows about backticks reads the first
   * one as the start of a template and blanks everything to the next stray one
   * — eight top-level exports of that file, and the fields of the interface
   * below them, gone from a report that then said it had checked them.
   */

  const source = [
    "const inline = (text: string) => text.replace(/`([^`]+)`/g, '<code>$1</code>');",
    '',
    'export interface PageOptions {',
    '  title: string;',
    '}',
    '',
    'export function page(options: PageOptions): string {',
    '  return `<h1>${options.title}</h1>`;',
    '}',
  ].join('\n');

  it('leaves the exports declared after it visible', () => {
    const names = declaredExports(source, 'render.ts').map((one: { name: string }) => one.name);

    expect(names).toContain('page');
  });

  it('leaves the fields declared after it visible', () => {
    const names = declaredFields(source, 'render.ts').map((one: { name: string }) => one.name);

    expect(names).toContain('title');
  });

  it('still blanks the template literal that really is one', () => {
    // The other half of the same claim: being quote-aware must not turn into
    // reading a stylesheet held in a `.ts` file as a list of fields.
    const stylesheet = 'export const STYLE = `\n  .cell {\n    gap: 3px;\n  }\n`;';
    const names = declaredFields(stylesheet, 'style.ts').map((one: { name: string }) => one.name);

    expect(names).not.toContain('gap');
  });
});
