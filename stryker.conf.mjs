/**
 * Breaking the code on purpose, in a copy of the tree rather than in the tree.
 *
 * `scripts/audit-mutants.mjs` is 493 lines that put `return <constant>;` at the
 * top of a named function, run the suites that own it, and report the ones
 * nothing noticed. It has earned its place three times over. It also edits
 * **shipped source in place**, and the only thing standing between a stopped
 * run and a broken working tree is a hand-rolled note at
 * `scripts/.mutants-undo.json`. That note cannot be written from a signal
 * handler, and the repository measured why: the sweep lives inside synchronous
 * `execFileSync`, so the event loop never turns and a `SIGINT` handler never
 * runs. On 2026-08-06 a ten-minute timeout on a loop running every audit left
 * `return '';` at the top of `summariseReturns` in `packages/ai/src/prompts.ts`
 * and ten tests went red in a package nobody had touched. It has cost this
 * project an hour twice.
 *
 * Stryker's `inPlace` option defaults to **false** — read out of
 * `@stryker-mutator/core/schema/stryker-schema.json` on this machine, not out
 * of the documentation. Mutants run in a copy under `.stryker-tmp/sandbox-*`,
 * and the sandbox is deleted afterwards (`cleanTempDir: 'always'` below). There
 * is no note to lose, because there is nothing to put back. That is the whole
 * reason this file exists, and it was checked rather than assumed: after a full
 * run, `grep -rn 'stryMutAct\|activeMutant\|__stryker__\|stryCov_'
 * packages/engine/src` returns 0 lines, and every file under it hashes to what
 * it hashed to before the run. `git status` is NOT the check to use here — this
 * is a shared working tree, and two files under `packages/engine/src` are
 * legitimately modified by other work at any given moment.
 *
 * ---
 *
 * THE FIRST MEASUREMENT, 2026-08-06, WITH `packages/engine`'S OWN SUITE ALONE
 * AS THE JUDGE. `bun run mutate:engine` on this Mac, Stryker 9.6.1 with
 * `@stryker-mutator/vitest-runner` 9.6.1, over `packages/engine/src`, with
 * `vitest.dir` naming one workspace. Three consecutive runs produced identical
 * totals. That scope is not a footnote — read THE SECOND MEASUREMENT below
 * before quoting the 60.36% anywhere.
 *
 * (Stryker HAS been run, three times, and this table is the output. Any note
 * elsewhere carrying forward that it has never been run is stale as of
 * 2026-08-06 and this line retires it.)
 *
 *     mutants generated   1264   (12 files instrumented, of 467 read)
 *     killed               762
 *     survived             274
 *     timed out              1
 *     no coverage          227
 *     errors                 0
 *     mutation score     60.36 % total, 73.58 % of covered code
 *     tests per mutant   20.52, 20.91 and 20.56 on average, on three runs
 *     wall time          2 min 39 s, 4 min 14 s and 6 min 09 s
 *
 * The wall-time spread is this configuration settling, not noise in the
 * measurement: the slowest run also wrote a JSON report, and the fastest is the
 * file as it now stands, with `disableTypeChecks` scoped to one package instead
 * of preprocessing all 467 files in the sandbox. The mutant counts are byte for
 * byte identical across all three.
 *
 * Per file, JUDGED BY `packages/engine`'S OWN SUITE ALONE:
 *
 *     file           score    killed  survived  no cov
 *     -------------  -------  ------  --------  ------
 *     audit.ts        52.21      142       130       0
 *     board.ts        86.11       31         1       4
 *     dice.ts         89.47       17         2       0
 *     extract.ts      67.96      193        91       0
 *     game.ts         80.87       93        18       4
 *     published.ts     0.00        0         0      70
 *     rules.ts        97.30       72         2       0
 *     session.ts      89.74      104        12       0
 *     stored.ts        0.00        0         7     138
 *     turn.ts         83.33      110        11      11
 *
 * `Ran 20.91 tests per mutant on average` is the number to check first after
 * any change to this file. Stryker's own troubleshooting names **`Ran 0.00
 * tests per mutant`** as the standard monorepo failure, and it means the runner
 * and the mutated files disagree about which project they are in — not that the
 * tests are bad.
 *
 * ---
 *
 * THE ANSWER TO THE QUESTION THIS WAS RUN TO ANSWER: **the two readers do not
 * overlap, and the reason is not that either is careless.**
 *
 * `node scripts/audit-mutants.mjs hasWon owesReport isWaitingToEnter
 * needsSixToEnter waitParts`, run on this machine on 2026-08-06 immediately
 * after the sweep above, printed *Every one of them was defended by something*
 * — nine crude breaks, between 2 and 63 tests failing on each. It reports
 * nothing at all for `packages/engine`. Stryker reports 274 survivors and 227
 * uncovered mutants in the same directory. **Not one of Stryker's survivors is
 * a decision `audit-mutants` reports, because `audit-mutants` currently reports
 * none.** The sets are disjoint by construction, and the reading worth having
 * is what happens inside the five functions both tools look at:
 *
 *   - `hasWon` (`src/game.ts:213`). audit-mutants: 63 tests fail when it always
 *     returns `true`, 26 when it always returns `false`. Stryker: 12 killed,
 *     **2 survived**, both on the same line —
 *     `state.loka === WIN_LOKA && state.is_finished` with `&&` mutated to `||`,
 *     and with its first operand replaced by `true`. No test in the engine's
 *     suite has a state that is `is_finished` anywhere but the winning square,
 *     so half of that conjunction is undefended. A whole-function constant can
 *     never find this: replacing the return breaks both operands at once, and
 *     something always notices.
 *   - `needsSixToEnter` (`src/turn.ts:233`). audit-mutants: 5 and 2 tests fail.
 *     Stryker: 10 killed, **3 survived**, each one an operand of the three-way
 *     `&&` replaced by `true`.
 *   - `owesReport`, `isWaitingToEnter`, `waitParts`. Stryker kills every mutant
 *     in all three — 21, 5 and 11 of them. Both readers agree these are
 *     defended, which is the row that makes the disagreement above worth
 *     trusting.
 *   - `countsAsReport` (`src/turn.ts:186`). **11 mutants, no coverage at all**,
 *     and this is the one that keeps `audit-mutants` alive. The engine's own
 *     suite never calls it. `audit-mutants` covers it anyway, because its entry
 *     carries `also: ['apps/miniapp', 'apps/mobile', 'apps/bot']` — it knows
 *     that a rule in `packages/` is usually asked by the apps rather than by
 *     its own package, and it runs those suites too. Stryker as configured here
 *     runs one vitest project and cannot see them.
 *
 * So the honest summary is: **Stryker is strictly finer inside a function, and
 * currently blind across packages.** Finer, because 274 survivors is what a
 * per-operator mutation set finds where a per-function constant finds nothing.
 * Blind, because `vitest.dir` names exactly one workspace and the cross-package
 * `also` list has no equivalent in this config.
 *
 * WHAT IS DELIBERATELY NOT DONE HERE: `scripts/audit-mutants.mjs` is **not
 * deleted**, and this evidence does not yet earn its deletion. Removing it
 * touches `README.md`, the `auditsThisGateCannotRun` table in `package.json`,
 * `scripts/lib/undo.mjs` and `scripts/audit-scripts.mjs`. Before any of that,
 * two things have to be true and neither is true today: this config has to
 * reach the other nine workspaces the way `also` does, and the doc-comment of
 * `audit-mutants.mjs` — the three tests that were green with the whole rule
 * deleted, and the three occasions its own body-finding was wrong in the
 * direction that made it *lie*, reporting NOBODY NOTICED for a decision five
 * tests defend — has to move into this file first. That prose is institutional
 * memory; a config file does not hold it by default, which is exactly why this
 * one is `.mjs` and not `.json`.
 *
 * ---
 *
 * FOUR THINGS MEASURED THE HARD WAY WHILE GETTING THIS TO RUN AT ALL. Each was
 * a failed run rather than a guess, and each is why a line below looks
 * redundant.
 *
 * 1. **Stryker does not read `.gitignore`.** Its `ignorePatterns` default is
 *    `[]`, and with it the sandbox copy died on
 *    `ENOTSUP: operation not supported on socket, copyfile
 *    '.../apps/mobile/ios/Pods/hermes-engine/.../hermes.framework/Resources'`.
 *    `apps/mobile/ios/` is generated by `expo prebuild`, is gitignored, is
 *    hundreds of megabytes, and contains a socket. The `ignorePatterns` below
 *    are that list, and they are not decoration: without them this tool cannot
 *    start in this repository at all.
 *
 * 2. **Plugin auto-discovery does not survive bun's layout.** With `plugins`
 *    left at its default of `['@stryker-mutator/*']` the run died with *Cannot
 *    find TestRunner plugin "vitest". In fact, no TestRunner plugins were
 *    loaded.* — although `node_modules/@stryker-mutator/` holds both `core` and
 *    `vitest-runner`. bun keeps the real packages under `node_modules/.bun/`
 *    and leaves symlinks, and the discovery glob runs from the sandbox, where
 *    `node_modules` is itself a symlink. Naming the plugin resolves it as a
 *    module instead of as a glob, and works. This is the same class as knip not
 *    discovering `knip.config.mjs`: a tool that silently found nothing reads
 *    exactly like a tool that found nothing wrong.
 *
 * 3. **`src/rulesets.ts` is excluded from `mutate`, and not because its mutants
 *    were inconvenient.** `packages/engine/tests/a-variant-nobody-re-reads.test.ts`
 *    reads that file *as text* — `readFileSync(join(HERE, '..', 'src',
 *    'rulesets.ts'))` — and parses the variants out of it with a regular
 *    expression. Stryker instruments every file it mutates, so the text in the
 *    sandbox is no longer the text that test parses: it found 0 variants where
 *    the module exports 6, and the initial run failed before a single mutant
 *    was tested. That is a real and general incompatibility between mutation
 *    testing in a sandbox and a repository whose tests read their own source,
 *    and it is written down rather than worked around, because the exclusion is
 *    a hole: `rulesets.ts` is unmeasured by this tool. `audit-mutants` has no
 *    such problem — it mutates the real file, and the test reads the real file.
 *
 * 4. `disableTypeChecks` is scoped to `packages/engine`. At its default of
 *    `true` it tries to strip type checks from every file in the sandbox and
 *    warns on `scripts/lib/undo.d.mts`, because `export const RECOVERY: string;`
 *    in a declaration file is `Missing initializer in const declaration` to
 *    Babel. Harmless, and a page of stack trace above the numbers anybody runs
 *    this for.
 *
 * ---
 *
 * HOW IT IS RUN, AND WHERE IT IS DELIBERATELY NOT RUN.
 *
 *     bun run mutate:engine
 *
 * It is **not** in `bun run verify` and **not** in `bun run audit`, and that is
 * the rule `package.json` already states for `audit-mutants` in its
 * `auditsThisGateCannotRun` table: *a gate must not mutate the tree it is
 * checking.* Minutes of wall time and a full test run per mutant is a tool
 * somebody reaches for, not a gate somebody waits on. CI runs the suites
 * themselves.
 *
 * `concurrency: 2` rather than the default half-the-cores: this is run on a
 * laptop that is doing other things, and the numbers above were produced at 2.
 *
 * `@stryker-mutator/api` is a root devDependency for one reason: the `@type`
 * annotation at the end of this comment imports a type from it. knip caught
 * that the moment the annotation went in — *Unlisted dependencies (1):
 * @stryker-mutator/api/core, stryker.conf.mjs* — which is the gate installed
 * one pass earlier doing exactly the job it was installed for, on the pass
 * after it.
 *
 * KNOWN AND NOT FIXED HERE: `.stryker-tmp` is not in `.gitignore`. A completed
 * run removes it — `cleanTempDir: 'always'` — but a run killed halfway leaves
 * an untracked directory behind. Adding that entry is a change to a file this
 * pass does not own.
 *
 * ---
 *
 * THE OTHER TOOL IN THIS FILE'S BUDGET: actionlint, and it found nothing.
 *
 * `github-actionlint` 1.7.12 — a Node wrapper that fetches rhysd/actionlint's
 * official binary — was run over both workflows on 2026-08-06:
 *
 *     $ npx github-actionlint .github/workflows/*.yml
 *     actionlint=0
 *
 * **Zero findings over `ci.yml` and `pages.yml`.** That is the result, and a
 * clean first run is the argument for keeping it rather than against it: it
 * costs seconds, it is a standing guard with nothing to clean up, and it covers
 * a class nothing in `scripts/` covers at all — script injection through an
 * untrusted `${{ }}` interpolated into a `run:` block, runner labels that do
 * not exist, a `needs:` naming a job that does not.
 *
 * It was proven to discriminate before it was trusted. With one step reading
 * `run: echo ${{ github.event.head_commit.message }}` temporarily added to
 * `ci.yml` as step two of the `test` job, it exits 1 and names the file, the
 * line and the column, and underlines the expression:
 *
 *     .github/workflows/ci.yml:22:23: "github.event.head_commit.message" is
 *     potentially untrusted. avoid using it directly in inline scripts.
 *     instead, pass it through an environment variable. see
 *     https://docs.github.com/... for more details [expression]
 *        |
 *     22 |         run: echo ${{ github.event.head_commit.message }}
 *        |                       ^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *
 * That step was reverted, and the clean run above is the tree as it stands.
 *
 * actionlint is also the tool whose absence cost this repository two rounds of
 * teaching bespoke code to read a workflow as YAML. `scripts/lib/runnable.mjs`
 * still does, and keeps its own job: it answers *is this audit run by CI*,
 * which is a question about this repository and not about GitHub Actions.
 * actionlint answers the second question and knows nothing about the first.
 *
 * ASSUMED, NOT MEASURED, and separated deliberately: `github-actionlint` has no
 * install script — it downloads the binary lazily, on first run. `bun install
 * --frozen-lockfile` therefore does not need it in `trustedDependencies`. That
 * was read out of the installed `node_modules/github-actionlint/package.json`
 * (no `postinstall` field) and out of `dist/bin/actionlint.js`
 * (`await getBinaryPath(...)`, at call time), and not observed on a clean CI
 * runner. The consequence, stated so nobody is surprised by it: the CI step
 * reaches GitHub Releases the first time it runs, so an outage there turns a
 * workflow-lint step red for a reason that has nothing to do with the workflow.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  // Reporting only. Nothing here installs, and nothing here writes to the
  // tree — `inPlace` is left at its default of `false`, which is the point.
  packageManager: 'npm',
  reporters: ['progress', 'clear-text'],

  testRunner: 'vitest',

  // Named rather than discovered. Measured note 2 above: the default glob finds
  // nothing under bun's `node_modules/.bun` layout, and reports that as "no
  // TestRunner plugins were loaded" rather than as a failure to look.
  plugins: ['@stryker-mutator/vitest-runner'],

  // One workspace, and it stays one for a measured reason rather than for want
  // of trying. `vitest.configFile` pointing at a ten-project workspace was
  // built, run and reverted on 2026-08-06; it loads ten projects and measures
  // exactly what this line measures, to the mutant. See THE SECOND
  // MEASUREMENT below before changing it — the blocker is not this option.
  vitest: { dir: 'packages/engine' },

  // `rulesets.ts` is excluded for a stated reason rather than a convenient one:
  // `a-variant-nobody-re-reads.test.ts` parses that file's own text, and
  // instrumented text is not the text it parses. Measured note 3 above.
  mutate: ['packages/engine/src/**/*.ts', '!packages/engine/src/rulesets.ts'],

  // Generated, gitignored, and copied anyway, because Stryker does not read
  // `.gitignore`. `apps/mobile/ios` holds a socket and stops the copy dead.
  ignorePatterns: ['apps/mobile/ios', 'apps/mobile/android', 'apps/mobile/.expo', 'dist', 'build', 'coverage', '.leela.db*'],

  // Scoped, so a `.d.mts` in `scripts/lib` does not print a Babel stack trace
  // above the numbers. Measured note 4 above.
  disableTypeChecks: 'packages/engine/**/*.ts',

  concurrency: 2,
  cleanTempDir: 'always',
  timeoutMS: 60000,
};
