// The audit lives in `scripts/lib/unread.mjs` and is tested here because this
// is the package whose test run always happens; a checker nobody tests is the
// thing it exists to prevent.
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs module with no types, deliberately.
import { aliasesOf, declaredFields, readsOf, unreadFields, usesOf } from '../../../scripts/lib/unread.mjs';

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
