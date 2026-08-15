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
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * A tsconfig with comments in it, as JSON.
 *
 * This read its own comments out for as long as it has existed, with
 * `.replace(/\/\*[\s\S]*?\*\//g, '')` — and that is two defects at once, both
 * of them named elsewhere in this repository before they were noticed here.
 *
 * It **removed** rather than blanked. `apps/mobile/tests/source.test.ts:26-36`
 * exists to say what that costs: an index into the stripped text is no longer
 * an index into the file, so anything found in the copy and read back in the
 * original lands off by every comment between. Nothing here reads back today,
 * which is why it cost nothing — the shared `blank` replaces a comment with
 * spaces, character for character, so it cannot begin to.
 *
 * And it was not quote-aware. `"src/**` + `/*"` in an `include` holds a `/*`
 * and then a `*` + `/` two characters later, so the strip matched inside the
 * string and rewrote the glob to `"src*"` before `JSON.parse` ever saw it — a
 * silent wrong answer rather than a throw.
 *
 * MEASURED, and the obvious sentence about the fix is false: the shared blanker
 * is **not quote-aware either**. It turns that same glob into `"src    *"`.
 * What it buys is that the damage keeps its length, so an offset survives and
 * the value is still visibly not what was written; it does not make reading a
 * glob out of a tsconfig safe. `scripts/lib/runnable.mjs:213-233` is this
 * problem solved properly for another language — `withoutHashComment` scans
 * character by character carrying quote state, because a `#` inside
 * `echo "::group::x"` is not a comment either — and that scanner is the pattern
 * to copy the day a config here needs one.
 *
 * Latent rather than live: no tsconfig in this repository holds a `**`, and the
 * check at the bottom of this file pins every `include` to exactly `['src']`,
 * so a glob appearing would fail loudly there before it could be believed. The
 * test below the imports keeps that measurement rather than this paragraph
 * being the only record of it.
 */
function readConfig(path: string): {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  extends?: string;
} {
  return JSON.parse(blank(readFileSync(path, 'utf8'))) as ReturnType<typeof readConfig>;
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

describe('reading a config that has comments in it', () => {
  /**
   * The two readers, over the one input that tells them apart.
   *
   * Kept as a measurement rather than as the paragraph above, because the
   * paragraph is the part that goes stale. Both numbers below were run.
   */
  const withAGlob = '{\n  "include": ["src/**' + '/*"]\n}\n';

  it('keeps an offset, where the strip this replaces moved every one after it', () => {
    const stripped = withAGlob.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(blank(withAGlob)).toHaveLength(withAGlob.length);
    expect(stripped.length, 'what the strip did').toBeLessThan(withAGlob.length);
  });

  it('does not make a glob safe, which is what the obvious sentence would say', () => {
    // The honest half. Neither reader is quote-aware, so both damage the glob
    // and neither throws — the difference is that one of them damages it
    // without moving anything. Said out loud so nobody reads the fix above as
    // more than it is.
    const strip = (text: string) => JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '')) as { include: string[] };

    expect(strip(withAGlob).include).toEqual(['src*']);
    expect((JSON.parse(blank(withAGlob)) as { include: string[] }).include).toEqual(['src    *']);
  });

  it('still reads the configs this file is about', () => {
    // A blanker that ate a brace would fail every check below with a parse
    // error rather than an answer, so the plain fact that ten configs come back
    // is worth one line.
    expect(strictConfigs().length).toBeGreaterThan(1);
  });
});

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
