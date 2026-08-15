/**
 * The import graph, read as a graph rather than as text.
 *
 * Twenty-one bespoke audits live in `scripts/`, twelve thousand lines of them,
 * and not one asks a question about the shape of the module graph. Grepping
 * `scripts/` and every `tests` directory under `packages` and `apps` for
 * `circular|cycle` on 2026-08-06 returns four lines: two are prose about the
 * traditional text's arithmetic, one is a comment about a hanging test, and the
 * fourth — `packages/engine/tests/runnable.test.ts:152`, "terminates on a
 * cycle, because modules import each other" — asserts that a walker does not
 * hang on a two-file cycle in a tree the test builds in memory. Not one of them
 * asks whether THIS repository has a cycle. No test anywhere asserts that a
 * package may not reach an app. That is the class this file covers, and it is
 * the reason it exists: not a tool that replaces a sweep, but a reader for
 * something nobody was reading. **Nothing is deleted for this file. There was
 * nothing to delete.**
 *
 * dependency-cruiser 18.1.1, installed as a root devDependency on 2026-08-06,
 * run as `bun run depcruise` — which is `node_modules/.bin/depcruise`, the
 * local binary, for a reason given at length below.
 *
 * ---
 *
 * THE TWO GRAPHS, MEASURED 2026-08-06 over `packages apps`, with the options
 * this file sets (`node_modules` not followed, `node_modules|dist|data`
 * excluded). Both numbers are this tool's own `summary.totalCruised` and
 * `summary.totalDependenciesCruised`, read out of `--output-type json`.
 *
 *     graph                              modules  dependencies  violations
 *     ---------------------------------  -------  ------------  ----------
 *     RUNTIME   tsPreCompilationDeps:false    333           902           0
 *     TYPE-AWARE tsPreCompilationDeps:'specify' 335          968           9
 *
 * Those four counts are a SNAPSHOT and they drift, faster than one might think:
 * three test files landed in this tree between the first cruise run while this
 * file was being written and the last, taking the runtime graph from 329/887 to
 * 333/902 in under twenty minutes. Nothing is asserted against them. The
 * companion test's threshold is walked off the disk on every run precisely so
 * that no check in this repository depends on a number in a comment.
 *
 * The runtime graph is what this config cruises and what the rules below are
 * enforced over. It is green today, on every rule, and it went in green
 * deliberately: a rule that is red the day it is written is a rule somebody
 * turns off, and a rule that has only ever been green can still only go red for
 * the reason it was written down.
 *
 * The two graphs differ by two modules and sixty-six dependencies, and that gap
 * has been stable across every pair of runs measured today. The two
 * extra modules are `grammy/types` and `scripts/lib/spillover.d.mts` — both
 * reachable only through a type position, so neither exists at run time. The
 * sixty-six extra edges are `import type` and `import { type X }`: real to
 * `tsc`, absent from the emitted JavaScript.
 *
 * That difference is not a detail. It is the whole disagreement between the two
 * readings, and it is what the nine type-aware violations are made of:
 *
 *   1 type-only cycle    apps/bot/src/commands.ts <-> apps/bot/src/render.ts
 *   6 tests -> apps      packages/{engine,journal}/tests into apps/* (below)
 *   2 tests -> other app apps/mobile/tests/{contrast,fields}.test.ts into
 *                        apps/miniapp/src/contrast.ts
 *
 * ---
 *
 * WHY THE RUNTIME GRAPH, AND WHY madge WAS REJECTED FOR THIS REPOSITORY.
 *
 * madge is the obvious tool for "find me the cycles" and it is the wrong one
 * here, measured rather than argued. madge 8.0.0, installed into a scratch
 * directory outside this tree on 2026-08-06 so that nothing was added to this
 * repository to run it:
 *
 *     $ madge --extensions ts,tsx --circular packages apps
 *     Processed 338 files (1.6s) (1 warning)
 *     x Found 1 circular dependency!
 *     1) apps/bot/src/commands.ts > apps/bot/src/render.ts
 *     $ echo $?
 *     1
 *
 * It exits 1. On correct code. `apps/bot/src/render.ts:12` is
 *
 *     import type { Room } from './commands';
 *
 * — a type-only import, erased before anything runs. There is no cycle at run
 * time; `commands.ts` imports `render.ts` and `render.ts` imports nothing back.
 * madge does not distinguish the two, so the only finding it has ever produced
 * over this tree is a false one, and a check that cries wolf on correct code is
 * one somebody deletes rather than obeys. dependency-cruiser with
 * `tsPreCompilationDeps: false` does not report it, because the edge is not in
 * the graph it builds — the distinction is made by construction, not by an
 * exemption entry, which is why there is no exemption entry for it below.
 *
 * RETRACTED, and left here rather than removed. An earlier pass recorded that
 * `madge --ts-config` *crashes* in this repository. Re-run on 2026-08-06 at
 * madge 8.0.0 against `apps/bot/tsconfig.json`, both over `apps/bot/src` and
 * over `packages apps`, it does not crash: it completes and prints the same
 * single false cycle. Assume the crash was a different madge or a different
 * tsconfig; it is not reproducible here and is not a reason to reject the tool.
 * The false cycle above is, and it is the only reason needed.
 *
 * AND THE TWO READERS WERE PUT SIDE BY SIDE ON THE SAME PLANTED FAULT, because
 * "madge is wrong about `render.ts`" is one file's word against another's until
 * somebody makes the fault on purpose. Two temporary probes were written into
 * `packages/engine/src` on 2026-08-06 and deleted the moment each run finished:
 *
 *   - `zz-cycle-probe.ts` importing a value from `zz-cycle-probe-b.ts` and
 *     `zz-cycle-probe-b.ts` importing a value back. A REAL runtime cycle.
 *     dependency-cruiser: exit 1, `no-circular`, the cycle printed as a path.
 *     madge: exit 1, two cycles found — the probe and its standing false one.
 *     Both readers name it. Agreement.
 *   - The same two files with one edge changed to `import type`. Nothing else
 *     touched. dependency-cruiser: `v no dependency violations found (335
 *     modules, 903 dependencies cruised)`, exit 0 — correct, because after
 *     erasure nothing cycles. madge: still `Found 2 circular dependencies`,
 *     exit 1.
 *
 * The difference between the two tools is exactly the difference between those
 * two runs, and it is not a matter of taste: one of them goes red on code that
 * has no defect, and this repository has written down at length why a check
 * that cries wolf is one people delete rather than obey.
 *
 * ---
 *
 * WHY `bun run depcruise` AND NEVER `npx --yes dependency-cruiser`.
 *
 * This is this repository's own favourite defect — a check nobody can run reads
 * exactly like a check that passes — and dependency-cruiser produces it by
 * default, in its own output, with the reassuring half first. dependency-cruiser
 * needs a resolvable `typescript` to parse TypeScript at all. Run through
 * `npx --yes`, from a directory where `typescript` does not resolve, against
 * this very config and this very tree:
 *
 *     $ npx --yes dependency-cruiser --config .../.dependency-cruiser.mjs \
 *         --output-type err-long <leela>/packages <leela>/apps
 *     v no dependency violations found (11 modules, 5 dependencies cruised)
 *
 *     !! missing-typescript-transpiler: dependency-cruiser detected a TypeScript
 *        environment, but not a compatible TypeScript compiler ...
 *        it's likely to have missed TypeScript sources and dependencies.
 *     $ echo $?
 *     0
 *
 * **Eleven modules of three hundred and thirty-three, a green tick, and exit 0.**
 * The reason is printed, and it is printed BELOW the tick — a human skims the
 * first line, CI reads the exit code, and neither of them ever learns that
 * ninety-seven per cent of the tree went unread. The same command run from the
 * repository root, where `typescript@5.6.3` resolves, cruises the full graph.
 * So the failure is not "the tool is broken"; it is "the tool silently agrees
 * with you when it cannot see anything", which is worse.
 *
 * Two things follow, and both are in the tree rather than in this paragraph:
 *
 *   - The root script pins the local binary. `bun run depcruise` resolves
 *     `depcruise` from `node_modules/.bin`, beside the `typescript` this
 *     repository installs.
 *   - The exit code is not trusted on its own. THE COUNT GUARD in
 *     `packages/journal/tests/a-package-that-needs-an-app.test.ts` re-runs this
 *     cruise as JSON and asserts that the number of modules cruised is at least
 *     the number of `.ts`/`.tsx` files on disk under every workspace's `src`
 *     directory, counted by walking the disk rather than written down.
 *     Sixty-nine files today, three hundred and thirty-three modules cruised;
 *     the eleven-module run above fails it. A green tick over an empty graph is
 *     the failure mode this whole wiring is built around.
 *
 * ---
 *
 * THE BOUNDARY NO MANIFEST DECLARES, and the reason it is not forbidden here.
 *
 * Six edges run from a package's test suite into an application's source. They
 * are deliberate — they are cross-surface agreement tests, the mechanism by
 * which four surfaces are held to one answer — and forbidding them would be
 * deleting the thing they protect. They are also completely undeclared: not one
 * of the manifests below names the app it needs.
 *
 *   packages/engine/tests/one-question-two-surfaces.test.ts
 *       -> apps/miniapp/src/view.ts
 *       -> apps/mobile/src/game.ts
 *   packages/journal/tests/between-the-surfaces.test.ts
 *       -> apps/bot/src/take-in.ts
 *       -> apps/bot/src/take-out.ts
 *       -> apps/miniapp/src/journal-file.ts
 *       -> apps/mobile/src/journal.ts
 *
 * So the two source packages are **packages/engine** and **packages/journal**,
 * and the three apps they reach are **apps/miniapp**, **apps/mobile** and
 * **apps/bot**. `packages/journal/package.json` declares exactly one workspace
 * dependency, `@leela/engine`, and its suite cannot run without three
 * applications on disk. `packages/engine/package.json` declares no workspace
 * dependency at all, and its suite cannot run without two. A person cloning
 * this repository and running `cd packages/journal && vitest run` on the
 * strength of the manifest is running something the manifest does not describe.
 *
 * There is no `ignore` entry for these edges and there is no rule forbidding
 * them. Instead the statement above is mandatory: the companion test derives
 * the set of such edges from this tool's JSON, on every run, and fails unless
 * every source package and every app it reaches is named in this doc-comment.
 * Add a seventh edge into a fourth app and the test goes red until this
 * paragraph says so. The set is derived; it is not a list somebody remembered
 * to update.
 *
 * The two `apps/mobile/tests -> apps/miniapp/src` edges are the same shape one
 * surface over and are recorded above for completeness. They are not covered by
 * the guard, which asks only about packages, and saying so is cheaper than
 * pretending otherwise.
 *
 * ---
 *
 * WHAT IS ENFORCED. Two rules, both green on the day they were written, both
 * over the runtime graph.
 */
export default {
  forbidden: [
    /**
     * A cycle at RUN TIME. Not a cycle in the type graph — see the madge
     * paragraph above: `apps/bot/src/commands.ts` and `apps/bot/src/render.ts`
     * form one in the type graph and it is harmless, because
     * `render.ts:12` is `import type`. `tsPreCompilationDeps: false` keeps that
     * edge out of the graph entirely, so this rule cannot fire on it and needs
     * no exemption to avoid doing so.
     *
     * MEASURED zero violations over 333 modules and 902 dependencies on the day
     * it went in. A runtime cycle in an ES-module graph is a module that reads a
     * binding from a neighbour that has not finished evaluating, which is
     * `undefined` at exactly one point in the program and correct everywhere
     * else — a defect that survives review, survives a typecheck, and shows up
     * as a crash on one code path.
     */
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'A module that depends on itself through its neighbours, at run time. ' +
        'Type-only edges are not in this graph, so a type-only cycle is not a ' +
        'violation here and does not need excusing.',
      from: {},
      to: { circular: true },
    },

    /**
     * A library reaching into an application. `packages/*` are the shared
     * layers — engine, content, journal, db, ai, contracts — and `apps/*` are
     * the four surfaces built on top of them. The arrow only ever points one
     * way, and nothing until now said so.
     *
     * MEASURED zero violations on the day it went in, which is the whole
     * point: this is a direction that is correct today and that one convenient
     * import would reverse. A package that imports from an app cannot be
     * published, cannot be tested without that app, and drags a Telegram
     * client or a React Native screen into whatever else consumes it.
     *
     * `src` only. Test suites are deliberately excluded — six of them cross
     * this line on purpose, they are listed in the header, and the companion
     * test makes that listing mandatory rather than optional. Forbidding them
     * here would mean writing an exemption list for correct code, which is the
     * shape this repository keeps finding rot in.
     */
    {
      name: 'no-package-src-to-app',
      severity: 'error',
      comment:
        'packages/*/src must not import from apps/**. The dependency runs from ' +
        'app to library and never back. Tests are out of scope on purpose; see ' +
        'the header of this file.',
      from: { path: '^packages/[^/]+/src/' },
      to: { path: '^apps/' },
    },
  ],

  options: {
    /**
     * THE RUNTIME GRAPH. `false` means edges are read from the source as it
     * will be executed: `import type` and `import { type X }` are not
     * dependencies, because they are erased before anything runs. Setting this
     * to `'specify'` builds the type-aware graph instead — 335 modules, 968
     * dependencies, 9 violations, all nine of them measured and explained in
     * the header, and none of them a defect. Changing this line therefore turns
     * a green gate red without any code changing, which is why the number it
     * produces is written down above rather than left to be rediscovered.
     */
    tsPreCompilationDeps: false,

    /**
     * Third-party packages are edges, not territory. Following them would drag
     * grammy, react-native and expo into the graph, which answers no question
     * asked here and costs minutes. Without this, a cruise over `packages apps`
     * does not finish inside two minutes on this machine.
     */
    doNotFollow: { path: 'node_modules' },

    /**
     * `data/` is `packages/content/data` — twenty-three generated JSON files,
     * one per language, produced by `scripts/build-content.mjs`. They are
     * imported, so the tool sees them, and they are not modules anybody can
     * write a cycle through. `dist/` is build output. Excluding both is the
     * difference between 333 modules and 367, and none of the 34 is source
     * anybody edits.
     */
    exclude: { path: '(^|/)(node_modules|dist|data)/' },
  },
};
