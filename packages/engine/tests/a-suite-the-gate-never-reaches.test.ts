import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A workspace that stops declaring a script drops out of `verify` in silence.
 *
 * The root manifest fans the gate out with `bun run --filter '*' <name>`. That
 * command runs the workspaces which declare `<name>` and says NOTHING WHATEVER
 * about the ones which do not. MEASURED 2026-08-06 in a scratch two-workspace
 * monorepo built outside this repository, `packages/a` declaring the script and
 * `packages/b` not — three cases, three different behaviours:
 *
 *   b declares no `test`       ->  `a test: A-RAN`
 *                                  `a test: Exited with code 0`
 *                                  nothing about b at all, exit 0
 *   b declares `test: exit 3`  ->  `b test: Exited with code 3`
 *                                  `error: script "test" exited with code 3`, exit 3
 *   NEITHER declares `test`    ->  `error: No packages matched the filter`
 *                                  `error: script "test" exited with code 1`, exit 1
 *
 * Losing the whole fan-out is loud. Losing ONE leg of it is silent, and it is
 * silent in the direction that matters: the gate goes green having run less.
 * The last two cases are in the behavioural block at the bottom of this file
 * precisely so the first one is read as a measured asymmetry rather than as a
 * suspicion about a command nobody ran.
 *
 * Every reader that could have caught it bypasses the script instead of running
 * it, so all four keep saying yes:
 *
 *   - `scripts/audit-claims.mjs` finds packages by walking the filesystem and
 *     runs `npx vitest run` directly, so it would go on printing
 *     `@leela/docs … 239` and confirming README's table for a suite the gate no
 *     longer reaches;
 *   - `.github/workflows/ci.yml` runs `(cd "$pkg" && bunx vitest run)` in a
 *     hard-coded shell loop, so CI stays green for the same reason;
 *   - `packages/content/tests/a-gate-that-runs-no-audit.test.ts` asks whether
 *     `verify` HAS a test step, never what that step reaches;
 *   - `scripts/audit-configs.mjs` checked `typecheck:strict` and only that.
 *
 * A grep over `scripts/` and every `tests/` directory found no assertion about
 * a `test` script anywhere before this file.
 *
 * WHAT IS ASSERTED, and it is deliberately not a list of ten names. Both halves
 * are derived from the root manifest, so neither goes stale:
 *
 *   (a) WHICH SCRIPTS. The legs of `verify` are parsed out of `verify`; each
 *       leg is looked up as a root script; a leg whose command reads
 *       `--filter '*' <name>` contributes `<name>`. An eleventh leg added to
 *       `verify` tomorrow is therefore covered tomorrow, and a leg that is not
 *       a fan-out — `content:build`, `audit` — contributes nothing, because
 *       neither of them can lose a workspace this way.
 *   (b) WHICH WORKSPACES. The `workspaces` globs are read out of the root
 *       manifest rather than named here. `services/*` is declared and has no
 *       directory on disk; a glob whose root is absent must contribute nothing
 *       and must not throw, or this file would cry wolf about a workspace group
 *       nobody has yet. That tolerance is bounded below by a count, so "matched
 *       nothing anywhere" cannot pass as "found no problems".
 *
 * One name IS hardcoded: the reader understands exactly one glob shape, `x/*`,
 * and asserts that every declared glob has it. A shape it did not understand
 * would otherwise match nothing and report success — the same silence one level
 * up. Saying so out loud costs a failing test the day somebody writes
 * `packages/**` and buys a reader that cannot go quietly blind.
 *
 * The population is workspaces that have a `tests/` directory. `verify` fans
 * `typecheck` out over all of them and `test` over all of them; a workspace
 * carrying a suite is the one where being skipped means assertions stop being
 * run, which is the loss with no other witness.
 *
 * BROKEN ON PURPOSE before being trusted. The `"test": "vitest run"` line was
 * deleted from `packages/contracts/package.json` and both readers were run.
 * These messages are copied off those runs, not imagined.
 *
 * `node scripts/audit-configs.mjs` exited 1:
 *
 *   packages/contracts: package.json declares no `test: vitest run`, so `bun
 *   run --filter '*' test` skips this workspace in silence and `verify` still
 *   exits 0
 *
 * `cd packages/engine && npx vitest run` failed the case below, 1 failed and 7
 * passed:
 *
 *   AssertionError: expected [ Array(1) ] to deeply equal []
 *   - Array []
 *   + Array [
 *   +   "packages/contracts has tests/ and declares no `test` script, so `bun
 *       run --filter '*' test` skips it in silence and `verify` still exits 0",
 *   + ]
 *
 * The other seven passed throughout, which is the half worth writing down: the
 * derivation, the glob reader and the three `bun` cases are about the gate and
 * not about any one workspace, so a workspace losing a script must move exactly
 * one case. The line was then restored byte for byte and both commands went
 * back to exit 0.
 *
 * `git diff` on that manifest did NOT print nothing afterwards, and the honest
 * reason is not this file: another agent was editing `devDependencies` in the
 * same manifest at the same time, and that hunk was already in the working tree
 * when the copy this restore came from was taken. What was verified instead is
 * the thing actually claimed — the restored file is byte-identical to the copy
 * made before the break, and the diff against HEAD contains no `scripts` hunk.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

type Manifest = {
  workspaces?: string[];
  scripts?: Record<string, string>;
};

/** A workspace manifest, or the root one for `''`. */
function manifestAt(where: string): Manifest {
  return JSON.parse(readFileSync(join(ROOT, where, 'package.json'), 'utf8')) as Manifest;
}

/**
 * The root script names a `&&` chain runs.
 *
 * Parsed rather than compared as a string, for the reason the audit gate learnt
 * one file over: an equality here would break on a step being added and would
 * pass on a step being moved into a comment at the end.
 */
function legsOf(command: string): string[] {
  return command
    .split('&&')
    .map((leg) => leg.trim())
    .flatMap((leg) => {
      const found = /^bun run ([\w:.-]+)$/.exec(leg);
      return found?.[1] === undefined ? [] : [found[1]];
    });
}

/**
 * The script names `verify` fans out over every workspace, read out of `verify`.
 *
 * A leg that is not a fan-out contributes nothing, and that is the point rather
 * than an omission: `content:build` runs one node script and `audit` runs the
 * audits, and neither can quietly lose a workspace, because neither asks the
 * workspaces anything.
 */
function fannedOutScripts(): string[] {
  const scripts = manifestAt('').scripts ?? {};
  const names = new Set<string>();

  for (const leg of legsOf(scripts['verify'] ?? '')) {
    const found = /--filter\s+'\*'\s+([\w:.-]+)/.exec(scripts[leg] ?? '');
    if (found?.[1] !== undefined) names.add(found[1]);
  }

  return [...names].sort();
}

/** One declared glob, and what it actually matched on this disk. */
type Group = { glob: string; group: string; shaped: boolean; present: boolean; matched: string[] };

function byGlob(): Group[] {
  return (manifestAt('').workspaces ?? []).map((glob) => {
    const shaped = glob.endsWith('/*') && !glob.slice(0, -2).includes('*');
    const group = shaped ? glob.slice(0, -2) : glob;
    const present = shaped && existsSync(join(ROOT, group));

    return {
      glob,
      group,
      shaped,
      present,
      matched: present
        ? readdirSync(join(ROOT, group))
            .sort()
            .map((name) => `${group}/${name}`)
            .filter((where) => existsSync(join(ROOT, where, 'package.json')))
        : [],
    };
  });
}

/** Every declared workspace that carries a suite. */
function workspacesWithTests(): string[] {
  return byGlob()
    .flatMap(({ matched }) => matched)
    .filter((where) => existsSync(join(ROOT, where, 'tests')));
}

describe('what the root gate fans out over', () => {
  it('is derived from `verify` rather than listed in this file', () => {
    const scripts = manifestAt('').scripts ?? {};
    const wanted = fannedOutScripts();

    // Not vacuous: a derivation that quietly returned nothing would pass every
    // other case in this file, since a rule over no scripts is satisfied by any
    // manifest at all.
    expect(wanted.length).toBeGreaterThan(0);

    // Each derived name is one a root script really fans out, and the leg it
    // came from is really in `verify`.
    for (const name of wanted) {
      const leg = legsOf(scripts['verify'] ?? '').find((one) =>
        new RegExp(`--filter\\s+'\\*'\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).test(
          scripts[one] ?? '',
        ),
      );
      expect({ name, leg }).toEqual({ name, leg: name });
    }
  });

  it('does not count the legs that cannot lose a workspace', () => {
    // `content:build` and `audit` are legs of `verify` and are not fan-outs.
    // Stated so that a future reader does not "fix" their absence by widening
    // the derivation to every leg, which would demand a `content:build` script
    // of ten workspaces that have no business declaring one.
    const scripts = manifestAt('').scripts ?? {};
    const legs = legsOf(scripts['verify'] ?? '');
    const wanted = new Set(fannedOutScripts());

    expect(legs.length).toBeGreaterThan(wanted.size);
    for (const leg of legs) {
      if (wanted.has(leg)) continue;
      expect({ leg, fansOut: /--filter/.test(scripts[leg] ?? '') }).toEqual({ leg, fansOut: false });
    }
  });
});

describe('the workspaces the root manifest declares', () => {
  it('are found through globs of the one shape this reader understands', () => {
    // A glob shape it could not read would match nothing and report success.
    // Failing loudly is the cheaper of the two.
    for (const { glob, shaped } of byGlob()) {
      expect({ glob, shaped }).toEqual({ glob, shaped: true });
    }
  });

  it('tolerate a declared group with no directory, without matching nothing at all', () => {
    const groups = byGlob();

    // `services/*` is declared and absent. It must contribute nothing and must
    // not throw — and the bound underneath keeps that tolerance from becoming
    // the answer for every group at once.
    for (const { glob, present, matched } of groups) {
      if (!present) expect({ glob, matched }).toEqual({ glob, matched: [] });
    }

    expect(groups.some(({ present }) => !present)).toBe(true);
    expect(workspacesWithTests().length).toBeGreaterThan(1);
  });
});

describe('a suite the gate never reaches', () => {
  it('cannot exist, because every workspace with tests declares what verify runs', () => {
    const wanted = fannedOutScripts();
    const workspaces = workspacesWithTests();

    expect(wanted.length).toBeGreaterThan(0);
    expect(workspaces.length).toBeGreaterThan(1);

    const silent: string[] = [];
    for (const where of workspaces) {
      const scripts = manifestAt(where).scripts ?? {};
      for (const name of wanted) {
        const declared = scripts[name];
        if (typeof declared !== 'string' || declared.trim() === '') {
          silent.push(
            `${where} has tests/ and declares no \`${name}\` script, so ` +
              `\`bun run --filter '*' ${name}\` skips it in silence and \`verify\` still exits 0`,
          );
        }
      }
    }

    expect(silent).toEqual([]);
  });
});

/**
 * The asymmetry itself, run rather than asserted.
 *
 * Built in a temporary directory holding two workspaces this repository has
 * never heard of, for the reason the audit-gate test gives about its own: a
 * behavioural test over the real tree is one that passes until somebody edits a
 * file. No install happens — `bun run --filter` needs none — so this reaches no
 * network.
 *
 * Skipped, loudly, where `bun` is not on PATH. The three cases are a claim
 * about `bun`'s behaviour and there is no honest way to make it without `bun`;
 * a stub would be this file asserting its own assumption.
 */
const hasBun = (() => {
  try {
    execSync('bun --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasBun)('what `--filter \'*\'` does when a workspace stops declaring the script', () => {
  /**
   * The marker `a`'s script leaves behind, and why it is a file.
   *
   * This case needs a control: *something ran*, so that "bun said nothing
   * about `b`" is not vacuously true of a command that did nothing at all.
   * That control used to be `echo A-RAN` and an assertion on the captured
   * stdout, and **it went red at a clean checkout on 2026-08-29** with
   *
   *     expected '$ bun run --filter \'*\' test\na test…' to contain 'A-RAN'
   *
   * `bun run --filter` does not let a workspace write to the terminal; it
   * captures each one and relays it under a prefix. The capture above is that
   * relay having delivered `a test: Exited with code 0` and not the line the
   * script printed — MEASURED, because a script writing to a file instead of
   * stdout produces that exact output, banner and all. **The script ran. Its
   * stdout did not arrive.**
   *
   * Quiet runs did not reproduce it: 10 alone, 48 at six-way concurrency, and
   * 12 through a nested `--filter` all passed. It wants the load of the whole
   * repository's suites, which is the one place the control was never worth
   * being fragile in.
   *
   * A file is written by the script itself and read after the process has
   * exited. Nothing relays it, so nothing can drop it — and it is a STRICTLY
   * BETTER control, because it proves the script ran rather than that its
   * output was successfully forwarded, which was never the subject here.
   */
  const MARKER = 'a-ran.txt';
  const LEAVES_A_MARKER = `echo A-RAN > ${MARKER}`;

  /** A two-workspace monorepo, `a` and `b`, with the scripts given. */
  function scratch(a: string | null, b: string | null): string {
    const dir = mkdtempSync(join(tmpdir(), 'leela-gate-'));
    const script = (name: string, value: string | null) =>
      JSON.stringify({
        name,
        version: '1.0.0',
        ...(value === null ? {} : { scripts: { test: value } }),
      });

    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'scratch',
        private: true,
        workspaces: ['packages/*'],
        scripts: { test: "bun run --filter '*' test" },
      }),
    );
    for (const [name, value] of [
      ['a', a],
      ['b', b],
    ] as const) {
      mkdirSync(join(dir, 'packages', name), { recursive: true });
      writeFileSync(join(dir, 'packages', name, 'package.json'), script(name, value));
    }

    return dir;
  }

  /** `bun run test` there, both streams, and the exit status. */
  function run(dir: string): { status: number; output: string } {
    try {
      return { status: 0, output: execSync('bun run test 2>&1', { cwd: dir, encoding: 'utf8' }) };
    } catch (err) {
      const failure = err as { status?: number; stdout?: string };
      return { status: failure.status ?? -1, output: failure.stdout ?? '' };
    }
  }

  /**
   * The tree is built and run inside the case, not while the file is being
   * collected. A `describe.skipIf` still evaluates its factory to find out what
   * it is skipping, so a scratch monorepo built out here would be built — and
   * `bun` run — on the very machine the skip exists for.
   */
  function ran(
    a: string | null,
    b: string | null,
  ): { status: number; output: string; aRan: boolean } {
    const dir = scratch(a, b);
    try {
      const outcome = run(dir);
      // Read before the tree goes: the marker is the whole control, and a
      // `finally` that deletes the directory runs before any assertion does.
      return { ...outcome, aRan: existsSync(join(dir, 'packages', 'a', MARKER)) };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('says nothing whatever about the workspace that lost it, and exits 0', () => {
    const one = ran(LEAVES_A_MARKER, null);

    // The control, off disk rather than out of a relayed stream. See MARKER.
    expect(one.aRan, `the run was vacuous. bun said:\n${one.output}`).toBe(true);

    // And the property itself: nothing whatever about the workspace that lost
    // the script. This one IS about what bun says, so it reads what bun said.
    expect(one.output, 'bun named the workspace that has no test script').not.toContain('b test');
    expect(one.status).toBe(0);
  });

  it('is loud when the script is there and fails', () => {
    const failing = ran(LEAVES_A_MARKER, 'exit 3');

    expect(failing.output).toContain('b test: Exited with code 3');
    expect(failing.status).not.toBe(0);
  });

  it('is loud when every workspace loses it, which is why losing one is the dangerous case', () => {
    const none = ran(null, null);

    // Bun 1.1 says "No packages matched the filter"; 1.2 inserts "workspace";
    // a later release drops that sentence entirely for "Script \"test\" not
    // found in N packages matching \"*\"". The assertion is about the
    // loudness, not any one edition's phrasing.
    expect(none.output).toMatch(
      /No (?:workspace )?packages matched the filter|Script "[^"]+" not found in \d+ packages? matching/,
    );
    expect(none.status).not.toBe(0);
  });
});
