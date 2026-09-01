/**
 * A dependency declared and never installed for a reason.
 *
 * `@eslint/js` was added to the root `package.json` on 2026-08-06 and was dead
 * the day it was added. `grep -rn 'eslint/js'` over this repository, excluding
 * `node_modules` and `bun.lock`, returns exactly one line — its own declaration
 * at `package.json:19`. The ESLint config that arrived with it imports
 * `typescript-eslint` and nothing else. Twelve thousand lines of bespoke
 * tooling across twenty-one audits in `scripts/` would never have said so,
 * because not one of them reads a manifest against the code that uses it.
 *
 * That is the class this file gates: **a manifest that says something the tree
 * does not do.** Six workspaces declared `@vitest/coverage-v8` and had no
 * `coverage` script to run it; four declared `@types/node` at a range two of
 * their neighbours pinned exactly; and `apps/mobile/app.json` declared an
 * appearance behaviour whose package was never installed, on the app that is
 * actually published as `com.leelagame`. None of it fails a test. All of it is
 * a promise in a file somebody will read as true.
 *
 * ---
 *
 * THE MEASURED COMPARISON, 2026-08-06. knip 6.32.0 against
 * `scripts/audit-unread.mjs`, both run over the same tree, at the same commit,
 * before any repair below was made.
 *
 *     class                      knip   audit-unread
 *     -------------------------  -----  ------------------------------------
 *     unused devDependencies       14   not asked (reads no manifest)
 *     unlisted dependencies         4   not asked
 *     unused exports               21   0  ("Every export has at least one
 *                                           caller")
 *     unused exported types         6   not asked (types are not exports to it)
 *     unused files                 14   not asked
 *     duplicate exports             1   23 reported as *ambiguous*, not failed
 *     write-only fields         not asked   697 declarations checked, 10
 *                                           excused, 0 findings
 *
 * The export row is the interesting one and the reason is not that one reader
 * is careless. **`audit-unread` counts a name mentioned anywhere as a caller —
 * including inside the file that declares it. knip resolves imports.** Four of
 * knip's twenty-one, checked by hand:
 *
 *   - `renderPaged`, `apps/bot/src/render.ts:209`. Called twice, at lines 240
 *     and 255, both inside `render.ts`. Nothing imports it. It is exported for
 *     nobody.
 *   - `TURN_HOLDER`, `scripts/lib/whose.mjs:26`. Used at `whose.mjs:189`. Its
 *     only other appearance in the repository is as a *string* in
 *     `scripts/lib/records.mjs:443`, which is a name in a list, not an import.
 *   - `withoutStrings`, `scripts/lib/unread.mjs:408`. Used at `unread.mjs:580`.
 *     Its other mentions are prose in a doc-comment and in a test's comment.
 *   - `currentLanguage`, `apps/miniapp/src/content.ts:81`. Its only other
 *     mention in the tree is the excuse string in `audit-unread.mjs:276` that
 *     explains why it has no caller.
 *
 * `audit-unread` says this about itself, in its own output, and has for some
 * time: *"Uses are counted by name across every source, so one live caller
 * anywhere covers every declaration of that name. Telling them apart means
 * resolving imports, which is a different tool."* This is that tool. The
 * twenty-three ambiguous names it lists and declines to judge are the same
 * limitation from the other side.
 *
 * So the honest reading is not that the bespoke sweep is wrong. It is that its
 * export half asks a weaker question than it appears to ask, and the stronger
 * question now has an answer. **Nothing is deleted here.** Twenty-one exports
 * and six types is not a number anybody can triage in one sitting — each is a
 * judgement between dropping the `export` keyword and finding the caller that
 * should exist — so the export classes are measured and reported, and this gate
 * does not enforce them. A gate switched on over findings nobody has read is
 * one somebody switches off.
 *
 * WHAT HAS NO SUBSTITUTE AND IS DELIBERATELY KEPT. The *field* half of
 * `scripts/lib/unread.mjs` — `declaredFields`, `readsOf`, `unreadFields` — is
 * not reinvention and is not replaced by anything here. No tool in this survey
 * asks whether an interface property or a Drizzle column is **written and never
 * read**: knip works on module boundaries, and a field assigned in one place
 * and never consulted crosses no module boundary at all. Three fields in three
 * passes were found exactly that way — `broadcast`, `rerollOnRepeat`,
 * `needs_report` — each written everywhere, read nowhere, and each looking
 * complete in review. That check keeps running, keeps its 697 declarations and
 * its ten excuses, and this file takes nothing from it.
 *
 * ---
 *
 * WHAT THIS GATE ENFORCES, AND WHY ONLY THIS.
 *
 *     knip --include dependencies,unlisted,binaries
 *
 * Three classes, chosen because each of them has a repair that is a fact rather
 * than a judgement: a package is installed or it is not, a manifest lists it or
 * it does not, a binary exists on the PATH or it does not. `exports`, `types`,
 * `files` and `duplicates` are left out — they are reported by a bare run, and
 * this comment is where their counts are written down until somebody works
 * through them.
 *
 * Nothing below is an ignore entry written to make a red thing green. There is
 * exactly one `ignoreDependencies` list in this file, it covers three packages,
 * and the evidence that each is genuinely required is quoted at it with file
 * and line — from inside `node_modules`, because that is where the requirement
 * lives and there is nowhere else to read it.
 *
 * ---
 *
 * WHAT WAS REPAIRED TO MAKE THIS GREEN, 2026-08-06.
 *
 * 1. `@eslint/js` removed from the root manifest. Dead on arrival, above.
 *
 * 2. `@vitest/coverage-v8` removed from `packages/ai`, `packages/contracts`,
 *    `packages/db`, `apps/bot`, `apps/docs` and `apps/miniapp`. It was declared
 *    in seven manifests. Exactly one workspace can run it: `packages/engine`
 *    has a `coverage` script (`vitest run --coverage`), and knip does not
 *    report it there — which is the check agreeing with the reason it was kept.
 *    The only `vitest.config` in the repository is `apps/mobile`'s, and that
 *    workspace never declared the package at all.
 *
 * 3. `@types/node` converged on `22.20.1` in all six workspaces that declare
 *    it. Four said `^22.10.1` and two said `22.20.1`; `bun.lock` resolves every
 *    one of them to a single `@types/node@22.20.1`, so this changes no install
 *    and no lockfile entry — it makes the six manifests say the one thing that
 *    was already true. Exact rather than a range because the resolution is
 *    pinned by a committed lockfile that CI installs with `--frozen-lockfile`:
 *    a caret there is a range nothing can honour, and a `@types` minor bump is
 *    a thing that turns a typecheck red on a pull request that did not touch it.
 *    This is not a knip finding; it is the same defect one manifest over, and
 *    `syncpack` is what named it.
 *
 * 4. The published app's appearance, which is the one repair here that a player
 *    could have seen. Covered at length below.
 *
 * ---
 *
 * THE APPEARANCE THE PHONE DECLARED AND DOES NOT HAVE.
 *
 * `apps/mobile/app.json` set `"userInterfaceStyle": "automatic"` — follow the
 * phone's light/dark setting — and `apps/mobile/package.json` declared no
 * `expo-system-ui`. Expo needs that package for the property to reach the
 * Android build, and `expo prebuild` prints a WARNING rather than an error, so
 * the app that ships as `com.leelagame` has a manifest promising a behaviour
 * its build does not carry. Twenty-one audits read source, tests and
 * workflows; not one reads an app manifest. knip's Expo plugin does, and it is
 * where two of the four unlisted findings came from.
 *
 * The choice was: install `expo-system-ui` (Expo SDK 54.0.36 bundles `~6.0.9`,
 * read from `apps/mobile/node_modules/expo/bundledNativeModules.json`) and make
 * the declaration true, or delete the declaration. **The key is deleted, and
 * the reason is that honouring it would have made the app worse, measurably:**
 *
 *   - `apps/mobile/src/palette.ts` holds one palette. `page` is `#faf7f2` and
 *     it is the screen's background at `App.tsx:975`. There is no dark half,
 *     and `contrast.test.ts` measures the pairs of that one palette.
 *   - `grep -rn 'useColorScheme|Appearance|colorScheme' apps/mobile/src` returns
 *     nothing. No screen in this app asks what the phone's scheme is.
 *   - `App.tsx:478` renders `<StatusBar style="auto" />`, and `auto` is not
 *     inert. `expo-status-bar`'s own type documentation, in
 *     `node_modules/expo-status-bar/src/types.ts`: *"picks the appropriate
 *     value according to the active color scheme, eg: if your app is dark mode,
 *     the style will be `light`."*
 *
 * Put together: with `automatic` honoured, a phone in dark mode gives this app
 * a colour scheme of `dark`, the status bar therefore draws its clock and
 * battery in white, and the screen behind them is `#faf7f2`. White on `#faf7f2`
 * is a contrast ratio of about 1.03:1 — the top of the screen goes blank. On
 * iOS that is live today, because `userInterfaceStyle` reaches an iOS build
 * without `expo-system-ui`; on Android it is exactly what installing the
 * package would have switched on.
 *
 * So the app does not need `expo-system-ui`. It needs not to claim an
 * appearance it has no second palette for. With the key gone, Expo's default
 * applies, the scheme is light, `style="auto"` picks dark glyphs, and the
 * manifest says what `palette.ts` has always said.
 *
 * ASSUMED, NOT MEASURED, and separated deliberately: that Expo's default for an
 * absent `userInterfaceStyle` is `light`, and that `expo-system-ui` is what
 * carries the property to Android. Both are Expo's documented behaviour and
 * both are what knip's plugin encodes, but `@expo/config-plugins` is not
 * installed in this tree and `expo prebuild` needs a native toolchain and
 * writes a gitignored `ios/`, so neither was run here. Everything else in the
 * paragraphs above was read out of a file in this repository or its
 * `node_modules`.
 *
 * `apps/mobile/tests/a-setting-with-no-package.test.ts` is the guard, and it is
 * written as a shape: every key in `app.json`'s `expo` object, against a map of
 * which keys need a package. Not a list of the one that was wrong.
 *
 * ---
 *
 * THE OTHER TWO UNLISTED FINDINGS: `expo-updates`, INVESTIGATED RATHER THAN
 * EXCUSED.
 *
 * knip reported `expo-updates` unlisted for a manifest with no `updates` key at
 * all, which reads like a false positive. It is not. From
 * `node_modules/knip/dist/plugins/expo/helpers.js`:
 *
 *     if (config.updates?.enabled !== false) {
 *       inputs.add(toProductionDependency('expo-updates'));
 *     }
 *
 * Absent means enabled — which is Expo's own default, and therefore the
 * manifest, read literally, was asking for over-the-air updates from a client
 * that is not installed and never was. No `expo-updates` anywhere in this tree;
 * none in any of the six donor Expo apps under `/Users/playra/leela-src`
 * either. The repair is the manifest saying so: `"updates": { "enabled": false }`.
 *
 * That is the same act as deleting `userInterfaceStyle`, one default over. One
 * was a declaration with no package behind it and could be removed; this one is
 * a *default* with no package behind it, and a default can only be corrected by
 * being written down. Both directions end with `app.json` describing the app
 * that is built from it.
 *
 * ---
 *
 * WHERE knip CANNOT SEE, AND THE ONE IGNORE IN THIS FILE.
 *
 * `apps/mobile` runs two test runners: vitest for the suites, and jest for
 * Detox's walk through the app on a simulator. The jest config is at
 * `e2e/jest.config.js` rather than the workspace root, so knip's Jest plugin
 * did not find it and reported seven of that workspace's devDependencies as
 * unused. Pointing the plugin at the real path — the `jest.config` entry below,
 * not an ignore — resolves four of them honestly: `babel-jest` and `@babel/core`
 * from the transform, `@babel/preset-typescript` and
 * `@babel/plugin-transform-modules-commonjs` from the options written inline
 * beside it.
 *
 * Three remain, and no configuration can reach them, because the requirement is
 * a string that a third-party package resolves against the *consumer's* working
 * directory at runtime. Read out of `apps/mobile/node_modules` on 2026-08-06:
 *
 *   - `detox/runners/jest/testEnvironment/index.js:5`
 *       const maybeNodeEnvironment = require(resolveFrom(process.cwd(), 'jest-environment-node'));
 *   - `detox/runners/jest/reporters/DetoxVerboseReporter.js:5`
 *       const VerboseReporter = require(resolveFrom(process.cwd(), '@jest/reporters')).VerboseReporter;
 *   - `detox/runners/jest/testEnvironment/utils/validateAndPatchProjectConfig.js:26`
 *       message: 'Check that you have an installed copy of "jest-circus" npm package, exiting.'
 *
 * Detox's own manifest peer-depends on `jest` alone, optionally, and lists none
 * of these three. They are this workspace's to install and nothing in this
 * workspace's source names them — so every static reader, bespoke or bought,
 * will call them unused forever. Removing them does not fail a test on Linux;
 * it makes `npx detox test` die on a Mac, which is where nobody would look.
 *
 * They are ignored, scoped to `apps/mobile` so the same three names stay
 * checked everywhere else, and the quotations above are the evidence. If a
 * future Detox resolves them itself, the entries become wrong quietly — knip's
 * own `--include` for unused ignores is not part of this gate, so that is a
 * known and stated hole rather than a covered one.
 *
 * ---
 *
 * HOW TO RUN IT, AND ONE TRAP MEASURED THE HARD WAY.
 *
 *     bun run knip
 *
 * Not `bunx knip`. **knip 6.32.0 does not discover a file named
 * `knip.config.mjs`.** Its `KNIP_CONFIG_LOCATIONS`, at
 * `node_modules/knip/dist/constants.js:3`, is exactly: `knip.json`,
 * `knip.jsonc`, `.knip.json`, `.knip.jsonc`, `knip.ts`, `knip.js`,
 * `knip.config.ts`, `knip.config.js`. No `.mjs`, although `.mjs` is what this
 * repository writes every other config and script in, and what ESLint — which
 * does discover `eslint.config.mjs` — is configured by three files away.
 *
 * A config the tool never reads is the exact defect this repository keeps
 * finding in its own checks: `audit-copies` sat broken under `node` for passes
 * because a check nobody can run reads like a check that passes. Here it would
 * have read as three Detox packages failing a gate that a file in the tree
 * appears to answer.
 *
 * So the invocation is a script in the root manifest and it names the config
 * explicitly, CI runs that script, and there is one spelling of the command
 * rather than two. Renaming this file to `knip.config.js` would let the flag go
 * — it was tried and works — at the cost of an ESM `.js` in a package with no
 * `"type": "module"`, which is a different trap for a different day.
 *
 * There is a smaller proof of the same thing in a bare run's own output: the
 * unused-files count went from 14 to 15 the moment this file was written, and
 * the fifteenth is this file. A tool that reports its own configuration as
 * dead code is telling you it never opened it.
 *
 * Bare `bunx knip`, with no config, reports the export and file classes this
 * gate leaves out. That is worth running by hand; it is not what CI reads.
 *
 * ---
 *
 * A LATER MEASUREMENT, 2026-08-06, AND AN IGNORE THAT WAS NOT NEEDED.
 *
 * `@vitest/coverage-v8` came back to the root manifest — not to the six
 * workspaces that had it with no way to run it, but to the one place that now
 * has a script for it: `bun run coverage`, which is
 * `vitest run --workspace coverage.workspace.ts --coverage` over all ten
 * workspaces at once. A coverage provider is loaded by Vitest by name and is
 * imported by nothing, so it was expected to land in `ignoreDependencies`
 * beside the three Detox packages.
 *
 * It did not, and the expectation was tested rather than assumed. With the
 * `coverage` script present:
 *
 *     $ bun run knip
 *     (no findings)
 *
 * With the same dependency and the script deleted, and nothing else changed:
 *
 *     $ npx knip --config knip.config.mjs --include dependencies,unlisted,binaries
 *     Unused devDependencies (1)
 *     @vitest/coverage-v8  package.json:33:6
 *
 * So knip resolves the provider from the `--coverage` in the command, and the
 * dependency is held live by the one thing that can run it — which is the rule
 * `@vitest/coverage-v8` was removed from six manifests for breaking. It is
 * excused nowhere, and this paragraph is here so nobody adds an ignore for it
 * on the reasoning that a provider must need one. Delete the script and the
 * gate goes red, correctly.
 *
 * `coverage.workspace.ts` itself is now the fifteenth entry in the unused-files
 * class of a bare run, for the same reason `knip.config.mjs` was: nothing
 * imports it, it is named on a command line. That class is reported and not
 * enforced, above, and this is a second example of why.
 */

/**
 * Required, invisible, and quoted at length above: each is resolved by Detox
 * from `process.cwd()` at runtime, so no reader of this repository's own source
 * can see the reference.
 *
 * A top-level constant with a name rather than an array inline in the object
 * below, and the reason is that `scripts/audit-records.mjs` could not see it
 * either. That check exists so that no list of excused things sits anywhere in
 * this repository without something saying what it is and what would make it
 * stale — and on the day this file was written it read `scripts/` and
 * `scripts/lib/` and nothing else, so the first exemption list ever written at
 * the root was outside it twice over: in a directory it did not walk, and
 * written as an object property its regex is anchored against. The directory is
 * widened; loosening the regex to match a property would have named every
 * `files:` and `rules:` in every config here, so this list is given a name
 * instead. It is declared in `scripts/lib/records.mjs` as a permission whose
 * entries must still be named in `apps/mobile/package.json`, which is the thing
 * that withdraws it: the day Detox resolves these itself and the three
 * devDependencies come out of that manifest, this ignore excuses nothing and the
 * audit says so.
 */
const IGNORED_DEPENDENCIES = ['@jest/reporters', 'jest-circus', 'jest-environment-node'];

/** @type {import('knip').KnipConfig} */
export default {
  workspaces: {
    'apps/mobile': {
      // Detox's runner, not the workspace's. `vitest run` is the suite; this
      // config is only ever loaded by `npx detox test` on a Mac.
      jest: { config: ['e2e/jest.config.js'] },

      ignoreDependencies: IGNORED_DEPENDENCIES,
    },
  },
};
