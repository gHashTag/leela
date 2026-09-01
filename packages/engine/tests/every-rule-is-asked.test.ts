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
 *
 * **And the audits are not searched either, for the same reason one step over.**
 * `scripts/` was in the sweep from the day this was written, and it made the
 * whole of the sweep a formality: `scripts/audit-variants.mjs` names all twelve
 * flags as STRING VALUES — `flag: 'rerollOnRepeat',` — and `readsOf` counts
 * that as a read. It strips a `name:` write and it skips a comment line; a name
 * written inside a string, as the value, survives both. So every one of the
 * twelve had a read it could not lose, and five of them had NOTHING ELSE: with
 * `scripts/` counted, `rerollOnRepeat`, `reportAfterSix`,
 * `refusedThrowStartsCooldown`, `cooldownFrom` and `reportOnWinningSquare` each
 * stood at exactly two, one of which was an audit spelling the name.
 *
 * Measured rather than reasoned: with `packages/engine/src/dice.ts:76` — the
 * single line in the whole program that reads `rules.rerollOnRepeat` — replaced
 * by a comment, this file stayed GREEN. That is the exact regression the header
 * above says this test exists for, and it exists because it happened twice.
 *
 * An audit that NAMES a field is not a program that READS it. It is a citation,
 * and a citation is prose with a colon in it — the same thing a comment is, and
 * comments were excluded here from the first line.
 *
 * **Blanking the comments out is not a substitute, and that was measured too.**
 * `blank()` deliberately keeps what a string SAYS (`apps/mobile/tests/
 * source.test.ts`: *leaves what a string says, because a check may forbid a
 * sentence*), so `readsOf('rerollOnRepeat', [blank(auditVariants)])` is still 1.
 * There is no reading of `scripts/` that makes a citation stop looking like a
 * read; the citation has to be out of the sweep.
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

/**
 * The roots the program lives under.
 *
 * `scripts` is not one of them, for the reason in the header. Named as a list
 * rather than concatenated by hand so the guard below can ask each of them
 * separately whether it contributed anything — one number over the whole sweep
 * is a guard that a root dropping out of it slips past.
 */
const SOURCE_ROOTS = ['apps', 'packages'];

/** Kept beside their text, so a check can put a mutant in one file's place. */
const FILES = SOURCE_ROOTS.flatMap((root) => programSources(join(ROOT, root)));
const SOURCES = FILES.map((file) => readFileSync(file, 'utf8'));

/**
 * The one line in the program that reads `rerollOnRepeat`, and the file holding it.
 *
 * Written out here so the discrimination check below can take it away without
 * touching `packages/engine/src/dice.ts`. If somebody rewrites that line, the
 * check fails on the assertion that the line is there rather than passing over
 * a mutation it never made.
 */
const DICE = join(ROOT, 'packages', 'engine', 'src', 'dice.ts');
const THE_READ = 'return rules.rerollOnRepeat ? noRepeatRoller(base) : base;';

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
    //
    // Asked per root rather than as one total, and the total is what made this
    // guard necessary to rewrite. It read `SOURCES.length > 100`, which was a
    // number chosen when `scripts/` was in the sweep — apps and packages
    // together are 74 files, so the guard would have gone red for the right
    // change and told whoever made it that the sweep had broken. A count is a
    // guard against a walk finding nothing; it is not a guard against a root
    // going missing, because one root can swell past the threshold on its own.
    const contributed = Object.fromEntries(
      SOURCE_ROOTS.map((root) => [root, programSources(join(ROOT, root)).length > 0]),
    );
    expect(contributed).toEqual({ apps: true, packages: true });
    expect(FILES).toHaveLength(SOURCES.length);

    const anywhere = programSources(join(ROOT, 'apps')).map((file) => relative(ROOT, file));
    expect(anywhere.some((file) => file.startsWith('apps/bot'))).toBe(true);
    expect(anywhere.some((file) => file.startsWith('apps/mobile'))).toBe(true);
  });

  it('does not count an audit that spells the name as a program that reads it', () => {
    /**
     * The discrimination cell, and the reason the sweep shrank.
     *
     * Take away the single line of program that reads `rerollOnRepeat` and this
     * check has to notice. With `scripts/` in the sweep it did not:
     * `scripts/audit-variants.mjs` writes `flag: 'rerollOnRepeat',` and
     * `readsOf` counts the string's contents, so the field kept a read that no
     * deletion of program code could ever remove.
     *
     * The mutation is made HERE, in a copy of the file's text, and never on
     * disk — a check that edits `packages/engine/src/dice.ts` to prove a point
     * is a check that leaves the mutation behind when it is killed, which is a
     * lesson this repository has already paid for once in `audit-mutants`.
     *
     * Both directions, because only one of them is evidence. On the mutant the
     * answer must be exactly `['rerollOnRepeat']` — not "at least one", which
     * would also be satisfied by the sweep having broken and reported all
     * twelve. On the real sources it must be empty.
     */
    const dice = readFileSync(DICE, 'utf8');
    expect(dice, `${relative(ROOT, DICE)} no longer holds the line this is about`).toContain(THE_READ);

    // Commented out at the start of its own line, which is what a regression
    // of this kind looks like when somebody makes it — and what `readsOf` is
    // supposed to see through. An inline `/* ... */` would leave the name on a
    // line that does not begin with a comment, and `readsOf` would count it.
    const mutant = FILES.map((file, at) =>
      file === DICE ? SOURCES[at].replace(THE_READ, `// ${THE_READ}\n  return base;`) : SOURCES[at],
    );

    expect(fieldsOfRuleSet().filter((field) => readsOf(field, mutant) === 0)).toEqual([
      'rerollOnRepeat',
    ]);
    expect(fieldsOfRuleSet().filter((field) => readsOf(field, SOURCES) === 0)).toEqual([]);
  });
});
