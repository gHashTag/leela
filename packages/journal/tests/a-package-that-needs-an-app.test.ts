/**
 * A leaf package whose suite cannot run without three applications on disk.
 *
 * `packages/journal/package.json` declares exactly one workspace dependency,
 * `@leela/engine`. The suite in this very directory —
 * `between-the-surfaces.test.ts` — imports from `apps/bot/src/take-in.ts`,
 * `apps/bot/src/take-out.ts`, `apps/miniapp/src/journal-file.ts` and
 * `apps/mobile/src/journal.ts`, by relative path, four directories up. Those
 * imports are deliberate: they are the mechanism that holds four surfaces to
 * one journal format, and deleting them would delete the agreement. What is
 * not deliberate is that nothing anywhere says they exist. A person reading
 * the manifest and running `cd packages/journal && vitest run` on a checkout
 * without the apps is running something the manifest does not describe.
 *
 * This file is the statement, and it is derived rather than remembered. It
 * cruises the real import graph with dependency-cruiser, derives the set of
 * edges that cross from a package's tests into an app, and fails unless
 * `.dependency-cruiser.mjs` names every one of them. Add a seventh edge into a
 * fourth app tomorrow and this goes red until the header says so. Nothing here
 * is a list somebody has to keep up to date; the list is read off the graph.
 *
 * ---
 *
 * WHY THE FIRST CASE COUNTS MODULES, AND WHY THAT IS THE IMPORTANT ONE.
 *
 * dependency-cruiser needs a resolvable `typescript` to parse TypeScript at
 * all, and when it cannot find one it does not fail. It prints a tick, a
 * module count, and exit 0, with the reason on a later line. MEASURED
 * 2026-08-06, this repository's own config, run through `npx --yes
 * dependency-cruiser` from a scratch directory where `typescript` does not
 * resolve:
 *
 *     v no dependency violations found (11 modules, 5 dependencies cruised)
 *     !! missing-typescript-transpiler: ... likely to have missed TypeScript
 *        sources and dependencies.
 *     $ echo $?  ->  0
 *
 * Eleven modules of three hundred and thirty-three. Green tick, exit 0, and a
 * gate that has read nothing. This repository's recurring defect is a check
 * nobody can run reading exactly like a check that passes, and here is an
 * off-the-shelf tool producing it by default. So the exit code is not trusted
 * on its own: the first case below re-runs the cruise as JSON and holds the
 * number of modules against the number of TypeScript files it can see on disk,
 * counted by walking the disk in this file. No number is hardcoded — a
 * hardcoded 333 would be wrong by tomorrow, and three test files landed in this
 * tree while this file was being written - the runtime graph went from 329
 * modules to 333 in under twenty minutes, with other work in flight.
 *
 * ---
 *
 * BOTH GUARDS WERE BROKEN ON PURPOSE BEFORE THEY WERE TRUSTED, 2026-08-06.
 *
 * 1. THE RULES, each on its own planted fault, each probe deleted immediately.
 *    `packages/engine/src/zz-cycle-probe.ts` containing
 *    `import { discardReports } from '../../../apps/bot/src/store';` and a use
 *    of it — a package reaching into an app, the exact thing
 *    `no-package-src-to-app` forbids: `bun run depcruise` went from exit 0 to
 *    exit 1, naming the module and the rule. Then the same probe paired with a
 *    `zz-cycle-probe-b.ts` importing back from it — a real runtime cycle:
 *    exit 1 again, `no-circular`, the cycle printed as a path. Then one of
 *    those two edges changed to `import type` and nothing else: exit 0, which
 *    is the correct answer and the one madge does not give. Both probes were
 *    deleted and the cruise went green again.
 *
 * 2. THE COUNT GUARD, twice, because it has two failure modes.
 *    (a) The real one: the cruise was run through `npx --yes
 *        dependency-cruiser` from a directory where `typescript` does not
 *        resolve. It exits 0 and reports 11 modules; this case fails with
 *        `11 >= 69` false, which is the whole point — the tool said everything
 *        was fine and the test said it had not looked.
 *    (b) The blunt one: the cruise was restricted to `packages` alone. It
 *        exits 0 over a real graph that is simply missing half the tree, and
 *        this case fails on the per-file half rather than the count, naming
 *        the `apps/*` sources that went unread.
 *    Neither failure is visible in an exit code. That is why this file exists
 *    alongside the CI step rather than instead of it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The repository root, from this file rather than from the working directory. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const CONFIG = join(ROOT, '.dependency-cruiser.mjs');

/**
 * The local binary, deliberately, and never `npx`. See the header: a cruise
 * that cannot resolve `typescript` reports success over almost nothing.
 */
const DEPCRUISE = join(ROOT, 'node_modules', '.bin', 'depcruise');

type Dependency = { readonly resolved: string; readonly dependencyTypes: readonly string[] };
type Module = { readonly source: string; readonly dependencies: readonly Dependency[] };
type Cruise = { readonly modules: readonly Module[] };

/**
 * Run the cruise the CI step runs, as JSON.
 *
 * `depcruise` exits non-zero when it finds violations and still writes its
 * report to stdout, so the report is read out of the thrown error too. An
 * empty stdout is a different failure and is reported as one rather than
 * parsed into an empty graph — an empty graph would pass nothing and fail
 * everything for a reason nobody could read.
 */
function cruise(args: readonly string[]): Cruise {
  let stdout: string;
  try {
    stdout = execFileSync(DEPCRUISE, ['--config', CONFIG, '--output-type', 'json', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const thrown = error as { stdout?: string; message?: string };
    if (!thrown.stdout) throw error;
    stdout = thrown.stdout;
  }
  if (stdout.trim() === '') throw new Error(`${DEPCRUISE} wrote no report at all`);
  return JSON.parse(stdout) as Cruise;
}

let cruised: Cruise | undefined;
/** One cruise, shared. It takes about five seconds and answers both questions. */
function theGraph(): Cruise {
  cruised ??= cruise(['packages', 'apps']);
  return cruised;
}

/** Every `.ts`/`.tsx` file under a directory, as repository-relative paths. */
function typescriptFilesUnder(relative: string): string[] {
  const found: string[] = [];
  const walk = (here: string) => {
    for (const entry of readdirSync(join(ROOT, here), { withFileTypes: true })) {
      const next = `${here}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name)) found.push(next);
    }
  };
  walk(relative);
  return found;
}

/** Every workspace's `src` directory that actually exists, as a relative path. */
function sourceDirectories(): string[] {
  const directories: string[] = [];
  for (const group of ['packages', 'apps']) {
    for (const workspace of readdirSync(join(ROOT, group))) {
      const source = `${group}/${workspace}/src`;
      if (existsSync(join(ROOT, source)) && statSync(join(ROOT, source)).isDirectory()) {
        directories.push(source);
      }
    }
  }
  return directories;
}

describe('the cruise read the tree it says it read', () => {
  it(
    'cruises at least as many modules as there are TypeScript files on disk',
    { timeout: 180_000 },
    () => {
      const onDisk = sourceDirectories().flatMap(typescriptFilesUnder);
      const modules = theGraph().modules;

      // A shape, not a number. The disk is walked here on every run, so this
      // says "the tool saw at least the source" however large the tree grows.
      // Sanity first: a walk that found nothing would make the guard vacuous.
      expect(onDisk.length).toBeGreaterThan(0);
      expect(
        modules.length,
        `the cruise reported ${modules.length} modules and there are ${onDisk.length} ` +
          'TypeScript files under the workspaces’ src directories alone. A cruise ' +
          'that cannot resolve a TypeScript compiler still exits 0 - see this file’s header.',
      ).toBeGreaterThanOrEqual(onDisk.length);

      // Stronger and for the same reason: a cruise can be short without being
      // empty. Every source file the disk has must be a module the tool read.
      const seen = new Set(modules.map((module) => module.source));
      expect(onDisk.filter((file) => !seen.has(file))).toEqual([]);
    },
  );
});

describe('a package whose tests need an application', () => {
  /** Every edge from a package's test suite into an app, read off the graph. */
  const crossings = () =>
    theGraph()
      .modules.filter((module) => /^packages\/[^/]+\/tests\//.test(module.source))
      .flatMap((module) =>
        module.dependencies
          .filter((dependency) => dependency.resolved.startsWith('apps/'))
          .map((dependency) => ({ from: module.source, to: dependency.resolved })),
      );

  const packageOf = (path: string) => path.split('/').slice(0, 2).join('/');

  it(
    'has no manifest saying so, which is why the header must',
    { timeout: 180_000 },
    () => {
      const edges = crossings();

      // If this ever becomes empty the guard below has nothing to guard and
      // would pass by saying nothing. That is a change worth failing on: it
      // means the cross-surface agreement tests are gone, or the cruise is.
      expect(edges.length).toBeGreaterThan(0);

      const needs = new Map<string, Set<string>>();
      for (const edge of edges) {
        const source = packageOf(edge.from);
        const app = packageOf(edge.to);
        (needs.get(source) ?? needs.set(source, new Set()).get(source)!).add(app);
      }

      // MEASURED, and asserted rather than assumed: not one of these packages
      // declares the app its suite imports from. If somebody makes a manifest
      // honest by declaring it, THIS is the assertion to rewrite - deliberately
      // and with the header - and not the one below to delete.
      const undeclared: string[] = [];
      for (const [source, apps] of needs) {
        const manifest = JSON.parse(
          readFileSync(join(ROOT, source, 'package.json'), 'utf8'),
        ) as Record<string, Record<string, string> | undefined>;
        const declared = new Set(
          ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap(
            (field) => Object.keys(manifest[field] ?? {}),
          ),
        );
        for (const app of apps) {
          const name = (JSON.parse(readFileSync(join(ROOT, app, 'package.json'), 'utf8')) as
            { name: string }).name;
          if (!declared.has(name)) undeclared.push(`${source} needs ${name} and does not say so`);
        }
      }
      expect(undeclared.length).toBe([...needs.values()].reduce((n, s) => n + s.size, 0));

      // So the only statement of this boundary is the doc-comment in
      // .dependency-cruiser.mjs, and it is held to the graph: every package
      // that crosses, every app it reaches, and every file at both ends of
      // every edge must be named there by path.
      const header = readFileSync(CONFIG, 'utf8');
      const unnamed = [
        ...new Set([
          ...needs.keys(),
          ...[...needs.values()].flatMap((apps) => [...apps]),
          ...edges.flatMap((edge) => [edge.from, edge.to]),
        ]),
      ].filter((path) => !header.includes(path));
      expect(
        unnamed,
        'a package test reaches into an application and .dependency-cruiser.mjs does not say so',
      ).toEqual([]);
    },
  );
});
