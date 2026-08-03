/**
 * A field of `RuleSet` that nothing consults.
 *
 * This has happened twice, to the same field. `rerollOnRepeat` was declared, set
 * correctly on all five variants, documented — and read by nothing, so two
 * variants claimed a fidelity they did not have. That finding is why
 * `audit-unread` exists. Then it was rehabilitated and read by two surfaces of
 * three: the phone built a plain die while calling itself `legacy-mobile`.
 *
 * `audit-unread` asks this question of every field in the repository and exits
 * zero either way, on purpose: a field can be legitimately write-only, and a
 * check that blocks a build on a judgement call gets switched off rather than
 * heeded. **A `RuleSet` field is not one of those.** It exists to make a variant
 * behave differently; one that nothing reads is a variant promising something it
 * does not do, and there is no judgement in that.
 *
 * So this asks the same question of the twelve, and fails. Measured when it was
 * written: every one is read at least twice by code that is not a test, the
 * thinnest at two — `rerollOnRepeat`, `reportAfterSix`,
 * `refusedThrowStartsCooldown`, `cooldownFrom` and `reportOnWinningSquare`.
 *
 * Tests are not searched, and that is the point. `broadcast` was read in its
 * tests and nowhere else, which is exactly the state this looks for: a field
 * the suite confirms and the program ignores.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
// The audit's own reader, so the question is asked the way the audit asks it.
// @ts-expect-error — a plain .mjs module with no types, deliberately.
import { declaredFields, readsOf } from '../../../scripts/lib/unread.mjs';
import { RULESETS } from '../src/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Every source file in the repository that is not a test. */
function programSources(from: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;

    const path = join(from, entry.name);
    if (entry.isDirectory()) found.push(...programSources(path));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) found.push(path);
  }

  return found;
}

/** The fields the interface declares, without the values the variants set. */
function fieldsOfRuleSet(): string[] {
  const source = readFileSync(join(ROOT, 'packages', 'engine', 'src', 'rulesets.ts'), 'utf8');
  const from = source.indexOf('export interface RuleSet');
  const declaration = source.slice(from, source.indexOf('\n}', from));

  const declared = declaredFields(declaration, 'rulesets.ts') as Array<{ name: string }>;

  return [...new Set(declared.map((field) => field.name))];
}

const SOURCES = programSources(join(ROOT, 'apps'))
  .concat(programSources(join(ROOT, 'packages')), programSources(join(ROOT, 'scripts')))
  .map((file) => readFileSync(file, 'utf8'));

describe('a rule a variant declares', () => {
  it('is read by the program, not only by the tests', () => {
    // The shape. A field nothing reads is a variant promising a difference it
    // does not make — and the two times this happened, it was found by hand.
    const unread = fieldsOfRuleSet().filter((field) => readsOf(field, SOURCES) === 0);

    expect(unread).toEqual([]);
  });

  it('is one of a set this test can actually see', () => {
    // If the interface moved or was written another way, the check above would
    // pass over an empty list and say nothing was wrong.
    const fields = fieldsOfRuleSet();

    expect(fields).toContain('rerollOnRepeat');
    expect(fields).toContain('minReportChars');
    expect(fields.length).toBeGreaterThan(8);
  });

  it('is set on every variant, so none of them is silent about it', () => {
    // The other half: a field read by the program but missing from a variant
    // would be that variant taking whatever the type's default is, which for a
    // boolean is a decision nobody made.
    const fields = fieldsOfRuleSet();
    const missing: string[] = [];

    for (const rules of Object.values(RULESETS)) {
      for (const field of fields) {
        if (!(field in rules)) missing.push(`${rules.id}: ${field}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('is searched over the program as it is, not over one package', () => {
    // The sources this reads have to be the whole of it: a field read only by
    // the bot would look unread to a check that only knew the engine.
    expect(SOURCES.length).toBeGreaterThan(100);

    const anywhere = programSources(join(ROOT, 'apps')).map((file) => relative(ROOT, file));
    expect(anywhere.some((file) => file.startsWith('apps/bot'))).toBe(true);
    expect(anywhere.some((file) => file.startsWith('apps/mobile'))).toBe(true);
  });
});
