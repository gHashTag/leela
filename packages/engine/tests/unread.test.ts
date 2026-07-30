// The audit lives in `scripts/lib/unread.mjs` and is tested here because this
// is the package whose test run always happens; a checker nobody tests is the
// thing it exists to prevent.
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs module with no types, deliberately.
import { declaredFields, readsOf, unreadFields } from '../../../scripts/lib/unread.mjs';

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
