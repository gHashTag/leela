/**
 * Ten workspaces, one strict configuration.
 *
 * `audit-configs` was written on a sentence it states itself: *a flag turned on
 * in eight files is a flag that will be missing from the ninth.* It asked for
 * `noUncheckedIndexedAccess`, which is the flag that would have caught
 * `ruleSetById` returning `undefined` typed as a `RuleSet`.
 *
 * Two more were missing from all ten. `noUnusedLocals` is what would have
 * caught three functions in `packages/db/src/legacy.ts` — dead the moment
 * `stateFromLegacy` began delegating, and invisible to everything else:
 * `audit-unread` reads exports and fields, and a private function is neither.
 * They were found by hand a pass later, and only because one of them happened
 * to have been copied. Turned on, the compiler names it in the file, at the
 * keyboard, the moment the last caller goes.
 *
 * This asserts the rule the audit's own sentence implies, and one step further
 * than the audit does: not *these three flags are on*, which is a list to keep,
 * but **whatever any of them turns on, all of them turn on**. A flag added to
 * one and not the rest fails here without anybody having to remember a check.
 *
 * Booleans only. The first version of this compared the whole of
 * `compilerOptions` and two workspaces said no: `apps/miniapp` needs
 * `types: ["vite/client"]` and `apps/mobile` needs `jsx: "react-jsx"`. Neither
 * is a standard anybody is held to — they are what an app runs on — and a rule
 * that forbade them would be a rule about the wrong thing.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** A tsconfig with comments in it, as JSON. */
function readConfig(path: string): {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  extends?: string;
} {
  const text = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '');

  return JSON.parse(text) as ReturnType<typeof readConfig>;
}

/** Every workspace that ships code, and its strict configuration. */
function strictConfigs(): Array<{ where: string; config: ReturnType<typeof readConfig> }> {
  const found: Array<{ where: string; config: ReturnType<typeof readConfig> }> = [];

  for (const group of ['packages', 'apps']) {
    for (const name of readdirSync(join(ROOT, group)).sort()) {
      const workspace = join(ROOT, group, name);
      if (!existsSync(join(workspace, 'package.json'))) continue;
      if (!existsSync(join(workspace, 'src'))) continue;

      const strict = join(workspace, 'tsconfig.src.json');
      if (!existsSync(strict)) continue;

      found.push({ where: `${group}/${name}`, config: readConfig(strict) });
    }
  }

  return found;
}

describe('the configuration the shipped code is held to', () => {
  it('turns on in all of them whatever it turns on in one', () => {
    // The rule, without a list to keep: a flag learned from one defect reaches
    // every package rather than the one it was learned in.
    //
    // Booleans only, and that is not a loophole — it is the difference between
    // a rule and a platform. `apps/miniapp` needs `types: ["vite/client"]` and
    // `apps/mobile` needs `jsx: "react-jsx"`; neither is a standard anybody is
    // held to, and demanding they match would forbid an app from saying what it
    // runs on. This test asked for that first, and the two of them said no.
    const configs = strictConfigs();
    expect(configs.length).toBeGreaterThan(1);

    const flags = new Set<string>();
    for (const { config } of configs) {
      for (const [flag, value] of Object.entries(config.compilerOptions ?? {})) {
        if (value === true) flags.add(flag);
      }
    }

    const missing: string[] = [];
    for (const { where, config } of configs) {
      for (const flag of flags) {
        if (config.compilerOptions?.[flag] !== true) missing.push(`${where} does not turn on ${flag}`);
      }
    }

    expect(missing).toEqual([]);
    expect(flags.size).toBeGreaterThan(0);
  });

  it('turns on the flags each of which was learned from a defect', () => {
    // Named as well as compared, because "all ten agree" is also satisfied by
    // all ten turning nothing on.
    for (const { where, config } of strictConfigs()) {
      expect({ where, ...config.compilerOptions }).toMatchObject({
        where,
        // `ruleSetById` returned undefined typed as a RuleSet.
        noUncheckedIndexedAccess: true,
        // Three functions died in legacy.ts and nothing said so.
        noUnusedLocals: true,
        // An argument nothing reads is a question nobody answered.
        noUnusedParameters: true,
      });
    }
  });

  it('covers what ships and not what tests it', () => {
    // Deliberate, and stated where the flag is: `rows[0]` in a test is a value
    // the test built two lines earlier, and a helper written for one test and
    // left is noise rather than a defect.
    for (const { where, config } of strictConfigs()) {
      expect({ where, include: config.include }).toEqual({ where, include: ['src'] });
    }
  });

  it('is held by every workspace, not most of them', () => {
    // The count is the assertion `audit-configs` makes, restated here so that a
    // workspace which simply has no strict config cannot pass by being skipped.
    const shipping = ['packages', 'apps'].flatMap((group) =>
      readdirSync(join(ROOT, group))
        .filter((name) => existsSync(join(ROOT, group, name, 'src')))
        .filter((name) => existsSync(join(ROOT, group, name, 'package.json')))
        .map((name) => `${group}/${name}`),
    );

    expect(strictConfigs().map((one) => one.where).sort()).toEqual(shipping.sort());
  });
});
