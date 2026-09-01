/**
 * Every assertion is one somebody waited for.
 *
 * `expect(p).resolves.toBe(x)` returns a promise. Dropped on the floor, nothing
 * in the test waits on it.
 *
 * It is worth being exact about what that costs, because the obvious sentence —
 * *the assertion checks nothing* — is false here, and was measured to be false
 * rather than assumed. Breaking one on purpose (`toBe(null)` changed to a value
 * no game can hold) does fail the test today: Vitest auto-awaits assertions
 * left hanging when a test ends. What it prints alongside is the finding:
 *
 *     Promise returned by `expect(actual).resolves.toBe(expected)` was not
 *     awaited. Vitest currently auto-awaits hanging assertions at the end of
 *     the test, but this will cause the test to fail in Vitest 3.
 *
 * So the defect is not a dead check. It is a live check standing on a rescue
 * its own runner has announced it is removing — correct today, failing on the
 * next major whether or not the code under it is right, and silent about the
 * difference in between.
 *
 * Found by reading `bun run verify`'s own output rather than its exit code.
 * `verify` exited 0 with 3,012 tests green, and printed that warning six times
 * from `apps/mobile`. All six came from one site, `tests/kept-game.test.ts`,
 * looping over six malformed payloads:
 *
 *     // eslint-disable-next-line no-await-in-loop
 *     expect(loadKeptGame(device).then((k) => k.game), rubbish).resolves.toBe(null);
 *
 * The comment is the fingerprint. Somebody wrote `await`, the lint rule refused
 * it inside a loop, and the `await` came off while the line excusing it stayed
 * — leaving a suppression above a statement it no longer suppresses, and six
 * malformed-input cases that could not fail.
 *
 * The rule this makes checkable: **an assertion whose result is discarded is
 * not an assertion.** Asserted as a shape, not as those six: any `.resolves` or
 * `.rejects` anywhere under a workspace's tests, in any file, is read for
 * whether something waits on it.
 *
 * Read with the TypeScript parser, not a regular expression. The three sites in
 * `apps/bot` that a line-oriented grep reports are all correct — their `await`
 * sits on an earlier line — and a check that names three innocents to catch one
 * defect is one somebody switches off.
 *
 * Waited for means: `await` it, `return` it, or put it where an `await`ed or
 * `return`ed expression collects it (`Promise.all([...])` is the common one).
 * Assigning it to a name also counts: the value was captured, and what happens
 * to it afterwards is a question this check does not pretend to answer.
 *
 * ---
 *
 * WHAT REPLACED WHAT, 2026-08-06.
 *
 * The prose above described `scripts/audit-awaited.mjs`, 125 lines of
 * hand-rolled walking over the TypeScript AST, and it is kept here because the
 * six kept-game cases are the reason the rule exists at all and a config file
 * does not otherwise remember them. That sweep is deleted; this config is what
 * runs in its place, and the two were measured against each other before
 * anything was removed rather than after.
 *
 *     node scripts/audit-awaited.mjs
 *       audit-awaited: 198 test file(s) across 10 workspace(s) with tests
 *         every .resolves/.rejects assertion is awaited, returned or collected
 *
 *     bunx eslint      (eslint 10.8.0, typescript-eslint 8.66.0, projectService)
 *       0 no-floating-promises, 0 no-misused-promises, 0 await-thenable
 *       across all ten workspaces
 *
 * Two readers that share no code, reporting the same nothing. That agreement is
 * the whole evidence for the swap, and it is worth naming what it does and does
 * not establish: it says the bespoke sweep was not catching anything this tool
 * misses *today*, not that the two are equivalent in general. The tool reads
 * types; the sweep read shapes. Where they would differ is on a promise the
 * source does not spell — `no-floating-promises` sees a returned `Promise<T>`
 * through a helper and an alias, and the sweep only ever saw the literal
 * `.resolves`/`.rejects` member. The replacement is strictly the wider reader.
 *
 * It also covers ground the sweep never claimed: `no-floating-promises` looks at
 * every statement in `src/` too, not only assertions under `tests/`, and
 * `no-misused-promises` catches an `async` function handed to something that
 * wants a synchronous one — the shape that makes a Telegram middleware return
 * before its own work is done.
 *
 * PROVED BY BREAKING IT, same day, because an assertion never seen to fail is
 * not evidence. A probe holding one unawaited assertion, written into a real
 * workspace so `projectService` covers it:
 *
 *     packages/engine/tests/__eslint-probe.tmp.ts
 *       17:3  error  Promises must be awaited, end with a call to .catch, end
 *                    with a call to .then with a rejection handler or be
 *                    explicitly marked as ignored with the `void` operator
 *                    @typescript-eslint/no-floating-promises
 *
 * The bare `bunx eslint` that CI runs went to exit 1 on it, not only the
 * invocation naming the file, so the glob is known to reach that directory and
 * not merely the parser.
 *
 * The deleted sweep was pointed at the same planted fault before it was removed,
 * and named it too — `audit-awaited: 199 test file(s)`, one finding, same file,
 * same line 11. Two readers agreeing on nothing is weak evidence; two readers
 * that share no code agreeing on the same something is the reason this swap is
 * defensible. The probe was then deleted and the tree confirmed clean again.
 *
 * WHY `require-await` IS DELIBERATELY OFF. It was enabled once and measured:
 * 155 findings, 0 defects. Every one is either an `async` test double that
 * satisfies a promise-returning interface, or an `async` method wrapping the
 * synchronous SQLite API — `apps/bot/src/sqlite.ts`, `apps/bot/src/store.ts`,
 * and `packages/ai/src/model.ts` account for the bulk of them. An `async`
 * keyword there is the signature, not a mistake, and a check that names a
 * hundred and fifty-five innocents to catch nothing is one somebody deletes
 * rather than obeys. Turning it on is not a tightening; it is the same fault as
 * the line-oriented grep that the prose above rejects.
 *
 * WHY UNUSED-DIRECTIVE REPORTING IS OFF — RETRACTED 2026-08-06, kept because a
 * paragraph that argued itself into switching off a check is worth more standing
 * than missing. The argument is below; what is wrong with it follows it.
 *
 * ESLint 9 and later report a dangling
 * `eslint-disable` by default, and on the first run that produced exactly one:
 *
 *     packages/db/tests/legacy.test.ts
 *       346:9  warning  Unused eslint-disable directive (no problems were
 *                       reported from 'no-throw-literal')
 *
 * That directive sits above a deliberate `throw 'a bare string'` in a test whose
 * whole subject is a non-Error being thrown. It is a note to a human reader, and
 * it is "unused" only in the sense that this repository had no ESLint at all
 * until today, so no directive anywhere in it has ever suppressed anything. A
 * check whose first act is to name a correct comment in a file the rule has no
 * quarrel with is the line-oriented grep again, wearing a different hat. This
 * config reports the three rules it claims to enforce and nothing else.
 *
 * --- WHAT IS WRONG WITH IT, and it is the same defect the whole migration is
 * about. Re-measured 2026-08-06 and now `'error'`.
 *
 * The paragraph above is the only place in this repository where the switch is
 * explained: `grep -rn reportUnusedDisableDirectives --include='*.md'` over the
 * tree returns nothing, so outside this file the exemption is undeclared, and
 * `scripts/audit-records.mjs` cannot see it either — it holds `const NAME = [...]`
 * lists to a declaration, and this is a scalar in an object literal.
 *
 * The one instance it was switched off for is the fingerprint of the defect this
 * config was installed to catch. Read the prose at the top of this file again:
 * the six malformed-input cases in `apps/mobile` were hidden by a stale
 * `eslint-disable-next-line no-await-in-loop` left standing after the `await`
 * came off. A directive that outlives what it excused is exactly what
 * unused-directive reporting sees, and the config that replaced the sweep turned
 * it off in the same commit that turned the sweep on.
 *
 * And the excuse offered for it is false on its own terms. The claim was that
 * the directive is a note to a human reader, "unused" only because ESLint is new
 * here. But it names `no-throw-literal`, and no configuration in this repository
 * enables `no-throw-literal` — not this file, and there is no other. It is a
 * suppression naming a rule the repository does not run. It would suppress
 * nothing on the day it was written and nothing on any day after; a reader who
 * trusts it believes a lint rule is being held off a deliberate
 * `throw 'a bare string'` when no such rule is watching. It is deleted; the
 * throw and the assertion under it are untouched, because the test is right.
 *
 * MEASURED, both runs from the repository root, before this change:
 *
 *     bunx eslint . --report-unused-disable-directives
 *       4 problems (4 errors, 0 warnings)
 *       packages/db/tests/legacy.test.ts
 *         346:9  error  Unused eslint-disable directive (no problems were
 *                       reported from 'no-throw-literal')
 *       packages/engine/coverage/{block-navigation,prettify,sorter}.js
 *         1:1    error  Unused eslint-disable directive (no problems were
 *                       reported)
 *
 *     bunx eslint .          (the invocation CI runs, switch still 'off')
 *       3 problems (0 errors, 3 warnings)  — the three coverage files
 *       exit 0
 *
 * Two findings in that pair, and the second was not the one being looked for.
 *
 * FIRST: `'off'` never covered the whole repository. It sits in a config object
 * carrying `files: LINTED_SOURCES`, so it applies to the files those globs
 * match and to nothing else; every other file keeps ESLint 10's default of
 * `'warn'`. The switch silenced the one real finding in `packages/db` and left
 * the three it had no opinion about printing. An exemption that quiets the
 * signal and keeps the noise is not a trade anybody would have chosen out loud.
 *
 * SECOND: ESLint's flat config DOES NOT READ `.gitignore`. Those three files are
 * `packages/engine/coverage/*.js`, Istanbul's vendored report scripts, each
 * opening with a blanket `eslint-disable` of its own. `coverage/` is line 4 of
 * `.gitignore` and this config declared no `ignores` at all, so the lint result
 * depended on whether somebody had run `bun run coverage`: CI never has, this
 * machine has. That also retires one sentence of the round-2 report — "eslint
 * repo-wide exit 0 with no output". Exit 0 is right; "no output" stopped being
 * true the moment the coverage capability added in that same round was
 * exercised. A gate whose output changes with an untracked artifact on disk is a
 * gate two people can honestly disagree about.
 *
 * So `ignores` below names the generated directories `.gitignore` already names,
 * and `packages/db/tests/a-suppression-that-suppresses-nothing.test.ts` holds
 * that correspondence: every directory entry in `.gitignore` must be covered
 * here, derived from the file rather than restated, so the two cannot drift and
 * `bunx eslint .` gives the same answer with `packages/engine/coverage` present
 * and absent. Verified both ways, identical: exit 0, no output.
 *
 * That test also holds the shape this section is about — every rule named in a
 * directive anywhere under `LINTED_SOURCES` must be a rule this config actually
 * enables — and it reads comments through the TypeScript parser rather than by
 * line, because a `grep` for the directive names three innocents today: the
 * `no-await-in-loop` line in `apps/mobile/tests/awaited.test.ts` and its
 * neighbours live inside template literals holding the defect as a fixture.
 *
 * Run:  bunx eslint
 */

import tseslint from 'typescript-eslint';

/**
 * Where the three rules above are asked, as globs.
 *
 * Named and hoisted out of the object below for the same reason
 * `knip.config.mjs`'s ignore list is: `scripts/audit-records.mjs` holds every
 * list-shaped constant in this repository to a declaration saying what it is,
 * and until the pass that wrote this comment it read `scripts/` and
 * `scripts/lib/` only. The two configs at the root were the first lists ever
 * written outside its reach, and they were outside it twice — the directory was
 * not walked, and its pattern is anchored to `const NAME =` at the start of a
 * line, which an array inline in a call argument is not.
 *
 * It is declared as vocabulary, because nothing in it is an excuse: every entry
 * points ESLint AT something rather than away from it. What it can lose is a
 * whole workspace, by omission — a package added tomorrow whose sources match no
 * line here is simply not linted, and nothing says so. That is a stated hole
 * rather than a covered one: closing it means comparing these globs against
 * `workspacePackages` from `scripts/lib/claims.mjs`, which is a check that does
 * not exist and a CI step to go with it.
 *
 * AND IT LOST A FILE THAT WAY, which is the omission above happening rather
 * than being predicted. Every line here ends in `src/**` or `tests/**`, so a
 * TypeScript file sitting at the ROOT of a workspace matched nothing. The one
 * that mattered is `apps/mobile/app.config.ts` — the file that appends `.dev`
 * to the bundle identifier and so the only thing standing between a simulator
 * build and the published `com.leelagame` / `xyz.ghashtag.dharma` app, which is
 * this project's one stated irreversible risk. Asked about it directly, ESLint
 * answered:
 *
 *     apps/mobile/app.config.ts
 *       0:0  warning  File ignored because no matching configuration was
 *                     supplied
 *
 * A warning, and exit code 0. `bunx eslint` was green over a file it had never
 * opened.
 *
 * WHY THE GLOB NAMES `app.config.ts` AT A WORKSPACE ROOT AND NOT EVERY `.ts`
 * THERE, measured rather than chosen. (Neither pattern can be written out in
 * this paragraph: a star followed by a slash ends a block comment.) The wide
 * form matches four files today, and two of them are build-tool configuration
 * that no `tsconfig.json` includes:
 *
 *     apps/miniapp/vite.config.ts
 *       0:0  error  Parsing error: ... was not found by the project service.
 *                   Consider either including it in the tsconfig.json or
 *                   including it in allowDefaultProject
 *     apps/mobile/vitest.config.ts
 *       0:0  error  Parsing error: ... was not found by the project service.
 *
 * Type-aware linting needs a program, so widening here turns the repository red
 * over two files whose repair lives in `apps/miniapp/tsconfig.json` and
 * `apps/mobile/tsconfig.json` — files the change that wrote this paragraph does
 * not own. Left as a stated hole rather than an ignore list, in the register the
 * paragraph above uses: `vite.config.ts` and `vitest.config.ts` are unlinted,
 * the reason is a missing program and not a waiver, and closing it is two
 * `include` entries plus the entry below widened from `app.config.ts` to every
 * `.ts` at a workspace root.
 */
const LINTED_SOURCES = [
  'packages/*/src/**/*.ts',
  'packages/*/tests/**/*.ts',
  'apps/*/src/**/*.ts',
  'apps/*/src/**/*.tsx',
  'apps/*/tests/**/*.ts',
  'apps/*/tests/**/*.tsx',
  // The workspace root, where the identity of the published app is decided.
  'apps/*/app.config.ts',
];

export default tseslint.config(
  {
    /*
     * The generated trees, because flat config does not read `.gitignore`.
     *
     * Every entry here is a directory `.gitignore` already names, and the
     * correspondence is checked rather than trusted:
     * `packages/db/tests/a-suppression-that-suppresses-nothing.test.ts` reads
     * `.gitignore`, takes every line ending in a slash, and requires this list
     * to cover it — at the root and nested, since a bare name in `.gitignore`
     * matches at any depth. Written here rather than derived at load because a
     * config that parses `.gitignore` at startup is a second reader of a format
     * with its own subtleties; a test comparing two literals is the cheaper
     * half of that trade and fails loudly when they drift.
     *
     * An object carrying only `ignores` is global — it applies to every config
     * below it, not merely to `LINTED_SOURCES`.
     *
     * NOT hoisted to a top-level `const` the way `LINTED_SOURCES` is, and that
     * is a deliberate asymmetry with a cost. `scripts/audit-records.mjs` sees a
     * list only when it is written as `const NAME = [` at the start of a line,
     * so this one is invisible to it; hoisting would make it visible and would
     * then demand a `DECLARED` entry in `scripts/lib/records.mjs`, a file the
     * change that wrote this does not own. The test named above is the tighter
     * asker of the two in the meantime — `audit-records` would ask whether this
     * list is declared, and the test asks whether it still describes the tree.
     */
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.vscode/**',
      '**/.idea/**',
      '**/.stryker-tmp/**',
      '**/.mimosa/**',
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
      'apps/mobile/.expo/**',
    ],
  },
  {
    /*
     * On, and deliberately in an object with no `files` of its own, so it
     * reaches every file ESLint opens rather than only the linted globs. That
     * placement is the first finding of the section above: as `'off'` it sat
     * beside `files: LINTED_SOURCES` and silenced the one real finding while
     * leaving three it had no opinion about.
     */
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: LINTED_SOURCES,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
);
