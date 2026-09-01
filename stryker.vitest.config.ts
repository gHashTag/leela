import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Vitest config that Stryker's runner is pointed at, and nothing else is.
 *
 * ---
 *
 * WHY IT EXISTS. `@stryker-mutator/vitest-runner` builds its own Vitest
 * instance and hands it exactly two things out of `stryker.conf.mjs`:
 * `vitest.dir` and `vitest.configFile`. That was read out of
 * `node_modules/@stryker-mutator/vitest-runner/dist/src/vitest-test-runner.js`
 * on this machine rather than out of the documentation — `init()` calls
 * `vitestWrapper.createVitest('test', { config: this.options.vitest?.configFile,
 * ..., dir: this.options.vitest.dir, ... })`, and the runner's own schema at
 * `dist/schema/vitest-runner-options.json` lists three properties in total:
 * `dir`, `related`, `configFile`.
 *
 * `dir` names ONE directory. While `stryker.conf.mjs` said
 * `vitest: { dir: 'packages/engine' }`, every mutant was judged by
 * `packages/engine`'s own suite alone, and a file whose callers live in another
 * workspace read as *no coverage* — a mutant nobody can kill, which is not the
 * same thing as a mutant nobody killed. `coverage.workspace.ts` measured that
 * exact artifact from the other direction on the same day, for the same two
 * files, and its table is the reason this file was written:
 * `published.ts` 6.97% -> 100% of statements and `stored.ts` 21.21% -> 100% the
 * moment their callers in `apps/mobile` and `packages/db` are in the room, with
 * `board.ts` unchanged at 92.98/50 as the control.
 *
 * So this file exists to give the runner a config whose `test.workspace`
 * reaches all ten workspaces, and `stryker.conf.mjs` names it through
 * `vitest.configFile` instead of naming a directory.
 *
 * ---
 *
 * WHY IT POINTS AT `coverage.workspace.ts` INSTEAD OF LISTING THE PROJECTS.
 * In Vitest 2.1.9 `test.workspace` is `string` and not an array — a path to a
 * file that must default-export an array of project paths. Read out of the
 * installed build, not assumed: `reporters.nr4dxCkA.d.ts:1898` types it as
 * `workspace?: string`, and `cli-api.DqsSTaIi.js` (`getWorkspaceConfigPath`,
 * `resolveWorkspace`) executes that path and throws *must export a default
 * array of project paths* if it does not. So a path is the only shape available
 * here, and there are exactly two candidates: a new list written out below, or
 * the list this repository already keeps.
 *
 * It points at the existing one on purpose, and the purpose is not brevity.
 * `coverage.workspace.ts` is `defineWorkspace(['packages/*', 'apps/*'])` — the
 * two globs the root `package.json` already declares as `workspaces`, with
 * `services/*` left out because Vitest errors on a glob matching nothing and
 * there is no `services/` directory in this tree. Writing ten directory names
 * here would be the defect this repository keeps finding in itself: a hand-kept
 * list that is right on the day it is written and silent on the day a workspace
 * is added. Worse, it would be a SECOND such list, free to drift from the
 * first, and the whole value of this pass is that the coverage number and the
 * mutation number are now taken with the walls in the same place. If they were
 * taken from two lists, a disagreement between them would no longer mean
 * anything.
 *
 * The cost of that choice, stated rather than hidden: editing
 * `coverage.workspace.ts` now silently changes what `bun run mutate:engine`
 * measures. That is the intended coupling, but it IS a coupling, and anyone
 * narrowing that file should expect this file's numbers to move with it.
 *
 * The path is resolved from `import.meta.url` rather than from
 * `process.cwd()`. Stryker copies the tree into `.stryker-tmp/sandbox-*` and
 * runs there; `import.meta.url` is the sandbox copy of this file, so the
 * workspace file it finds is the sandbox copy too. A `cwd()`-relative path
 * would work by accident and an absolute path baked at author time would reach
 * back out of the sandbox into the real tree — which is exactly the mistake
 * that `coverage.workspace.ts` records seven `apps/miniapp` suites making with
 * their fixtures.
 *
 * ---
 *
 * WHY THE NAME IS WRONG ON PURPOSE, AGAIN. Vitest auto-detects
 * `vitest.config.{ts,mts,js,mjs,cjs,cts}` and `vitest.workspace.*` in the root
 * and applies them to every bare `vitest` invocation. This repository has no
 * root config, and adding one under either of those names would quietly change
 * what `npx vitest` means in ten workspaces, in every developer's habit and in
 * every CI step. `stryker.vitest.config.ts` is a name Vitest will never find by
 * itself. It is reached one way only: `stryker.conf.mjs` names it in
 * `vitest.configFile`. That is the same rule `coverage.workspace.ts` states at
 * length for its own name, and the same lesson `knip.config.mjs` writes down
 * from the other direction — a config the tool refuses to discover reads like a
 * check that passed.
 *
 * ---
 *
 * WHAT IS DELIBERATELY NOT SET HERE. No `coverage`, no `reporters`, no
 * `include`: the runner overrides all of that anyway (`coverage: { enabled:
 * false }`, `maxWorkers: 1`, `bail`, `onConsoleLog`) and each project keeps its
 * own `include` from its own directory. Anything added here would apply to ten
 * workspaces at once and would be read by nobody, because nothing but Stryker
 * ever loads this file.
 */
const HERE = fileURLToPath(new URL('.', import.meta.url));

/**
 * Every `@leela/*` package, pointed at its entry file **inside whichever tree
 * this config was loaded from**.
 *
 * Read out of each package's own `package.json` rather than written out here,
 * for the same reason the workspace globs are not written out here. It is also
 * not a formality: the six manifests do not agree on how they declare an entry.
 * Four are `exports: { '.': './src/index.ts' }`; `@leela/content` adds a
 * `'./data/*'` subpath; `@leela/contracts` has no `exports` at all and its
 * `main` is `./src/verify.ts`, not an `index.ts`. A regular expression mapping
 * `@leela/(.+)` to `packages/$1/src/index.ts` — the obvious one line — would
 * have silently pointed `@leela/contracts` at a file that does not exist and
 * broken `@leela/content/data/...` outright.
 *
 * The `find` is an anchored RegExp and not a string on purpose. Vite's alias is
 * @rollup/plugin-alias semantics, where a STRING `find` matches the bare
 * specifier *and every subpath under it* — `'@leela/content'` would capture
 * `'@leela/content/data/plans.json'` and rewrite it to
 * `.../src/index.ts/data/plans.json`. `/^@leela\/content$/` matches the bare
 * specifier only, and subpaths fall through to normal resolution, which is what
 * they need.
 */
function workspaceAliases(): { find: RegExp; replacement: string }[] {
  const packagesDir = join(HERE, 'packages');
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      let manifest: { name?: string; main?: string; exports?: unknown };
      try {
        manifest = JSON.parse(readFileSync(join(packagesDir, entry.name, 'package.json'), 'utf8'));
      } catch {
        return [];
      }
      const dot = (manifest.exports as Record<string, string> | undefined)?.['.'];
      const entryFile = typeof dot === 'string' ? dot : manifest.main;
      if (!manifest.name || !entryFile) return [];
      return [
        {
          find: new RegExp(`^${manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
          replacement: join(packagesDir, entry.name, entryFile),
        },
      ];
    });
}

export default defineConfig({
  test: {
    workspace: join(HERE, 'coverage.workspace.ts'),
  },
  resolve: {
    alias: workspaceAliases(),
  },
});
