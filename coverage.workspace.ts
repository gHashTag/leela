import { defineWorkspace } from 'vitest/config';

/**
 * One Vitest instance over every workspace, for the sake of the coverage
 * number.
 *
 * ---
 *
 * WHY IT EXISTS. Coverage in this repository was, until now, one thing only:
 * `packages/engine`'s own `coverage` script, run inside `packages/engine`. That
 * scope answers a question nobody asked. A file whose callers live in *other*
 * workspaces reads as dead when it is measured beside its own tests alone, and
 * the repository then has a number saying an untested file where there is a
 * well-tested one.
 *
 * MEASURED, 2026-08-06, v8 provider, vitest 2.1.9, same commit, same machine.
 * `packages/engine/src/published.ts` is `stateFromKept` and `isKeptPlayer` —
 * the migration that reads a game the published `com.leelagame` app left in a
 * player's phone. Its only two callers are `apps/mobile/src/inherited.ts:32`
 * and `packages/db/src/legacy.ts:20`, and neither is in `packages/engine`.
 *
 *     scope                        file            % Stmts   % Funcs
 *     ---------------------------  --------------  -------  --------
 *     packages/engine alone        published.ts       6.97         0
 *     ten workspaces, one run      published.ts        100       100
 *     packages/engine alone        stored.ts         21.21         0
 *     ten workspaces, one run      stored.ts           100       100
 *
 * The left-hand pair is the point: **0% of the functions in a file the phone
 * app cannot start without**, and 0% again for the store beside it. Nothing in
 * either is untested — both are at 100% of statements and 100% of functions the
 * moment their callers are in the room. The measurement was asked a question
 * with the walls in the wrong place.
 *
 * The control, from the same two runs: `packages/engine/src/board.ts` reads
 * 92.98% of statements and **50% of functions, with lines 96-97 and 101-102
 * uncovered, under BOTH scopings** — `snakeAt` and `arrowAt`, which nothing
 * calls anywhere in this repository. That is what a real gap looks like, and it
 * is how you can tell the two apart: widening the walls moved `published.ts`
 * from 0 to 100 and moved `board.ts` not at all.
 *
 * So per-package coverage here is a scoping artifact, not an untested file, and
 * the two must not be confused — because they call for opposite repairs. An
 * untested file wants tests. A file that only *reads* as untested wants the
 * measurement widened, and writing engine-local tests for `stateFromKept` to
 * make a red number go green would add duplicate coverage of a path already
 * exercised from `apps/mobile` and `packages/db`, and leave the real question —
 * does the migration still hold when the mobile app changes? — exactly as
 * unasked as it was.
 *
 * The same artifact is the stated blocker for retiring
 * `scripts/audit-mutants.mjs` in favour of Stryker: Stryker recorded 227
 * mutants as *no coverage*, and a mutant with no coverage is a mutant nobody
 * can kill. How many of those 227 are the same scoping artifact is NOT settled
 * here and is not claimed to be — this file only makes the wider measurement
 * possible.
 *
 * ---
 *
 * THE WHOLE RUN, MEASURED THE SAME DAY, so that the two figures above are read
 * against something:
 *
 *     Test Files  203 passed (203)
 *          Tests  3595 passed (3595)
 *     All files   65.38 % Stmts | 90.86 % Branch | 90.52 % Funcs
 *
 * That statements figure is not stable to two decimals and the reason is worth
 * knowing: v8 counts *this file* too, at 0%, because nothing imports it. The
 * first run of it read 65.49, and writing the paragraphs you are now reading
 * moved it to 65.38. A total a doc-comment can move is a shape and not a
 * target; if yours differs in the second decimal, the length of this comment is
 * the first thing to check and the last thing to worry about.
 *
 * The statements figure is NOT a statement about the shipped code and must not
 * be quoted as one. v8 counts every file it loads, and this run loads
 * `scripts/audit-*.mjs` — twelve thousand lines of audits — at 0%, because
 * those are executed as separate `node` processes by `bun run audit` and are
 * never imported by a test. Their libraries, `scripts/lib/*.mjs`, are imported
 * and sit at 95.81%. Per workspace, `src/` only:
 *
 *     packages/contracts  100    packages/db       100    packages/journal  100
 *     packages/ai         100    packages/content  99.05  packages/engine   99.57
 *     apps/docs          97.60   apps/miniapp      94.20  apps/bot          91.76
 *     apps/mobile        43.57
 *
 * `apps/mobile` is 43.57% for one reason, and it is the same class as
 * `published.ts` rather than a hole: `App.tsx` is 1,076 lines at 0%, because
 * this repository's mobile tests are unit tests over `src/*.ts` and the screen
 * itself is walked by Detox on a simulator, which no Vitest run can reach.
 * Coverage cannot see a second runner.
 *
 * ---
 *
 * WHY THE NAME IS WRONG ON PURPOSE. Vitest auto-detects a workspace file named
 * `vitest.workspace.{ts,mts,js,mjs,json}` in the root and applies it to *every*
 * bare `vitest` invocation. There is no such file here, and adding one would
 * quietly change what `npx vitest` means in this repository — every workspace's
 * own `test` script, every developer's habit, every CI step. This file is named
 * so that Vitest will never find it by itself. It is reached one way only:
 *
 *     bun run coverage        # vitest run --workspace coverage.workspace.ts --coverage
 *
 * That is the same lesson `knip.config.mjs` writes down four paragraphs into
 * its own header, from the other direction: there, a config the tool refused to
 * discover read as a check that passed. Here, a config the tool discovers too
 * eagerly would read as a test run that had not changed. Both are a file whose
 * effect does not match the command somebody typed.
 *
 * ---
 *
 * WHAT MADE ONE RUN POSSIBLE, AND WHAT IT COST. Seven suites in
 * `apps/miniapp/tests` read their fixtures through `process.cwd()`. A run
 * started at the repository root sets that to the repository root, and the
 * seven threw ENOENT — the measured symptom was
 * `ENOENT /Users/playra/leela/src/state.ts`. Five of the seven read at module
 * scope, so they did not fail: they were never collected, and the reporter
 * printed `tests/paint.test.ts (0 test)` beside a green tick. They are anchored
 * to `import.meta.url` now, and `partly-written.test.ts` carries the guard and
 * the long account of it.
 *
 * Anchoring them cost one more repair, and it is the more interesting one.
 * `apps/mobile/tests/source.test.ts` sweeps the whole tree for checks that
 * assert over source without blanking the comments out of it first, and it
 * recognises a read with `/readFileSync\([^)]*['"`][^'"`]*(src|index\.html)/`.
 * `[^)]*` cannot cross a `)`, so a read spelled `resolve(process.cwd(), 'src',
 * file)` was invisible to it — the rule was blind to exactly the spelling this
 * change was removing. The first repository-wide run named
 * `apps/miniapp/tests/reports.test.ts` on the first try, and the find was real:
 * it matched `/^export function ((?:save|clear)\w*)\(/gm` against unblanked
 * text, so a line of that shape inside a doc-comment would have been read as a
 * declaration. It blanks now. A defect that had been sitting behind a bracket
 * was found by widening the walls, which is the same thing this file is for.
 *
 * The projects are the two globs the root `package.json` already declares as
 * `workspaces`, rather than ten directory names written out here. A hand-kept
 * list of workspaces is the defect this repository keeps finding in itself: it
 * is right on the day it is written and silent on the day a workspace is added.
 * `services/*` is the third glob in that manifest and is deliberately left out
 * — there is no `services/` directory in this tree, and Vitest errors on a
 * workspace glob that matches nothing.
 */
export default defineWorkspace(['packages/*', 'apps/*']);
