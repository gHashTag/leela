import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../src';

/**
 * A published count must not be able to depend on something the repository does
 * not carry.
 *
 * On 2026-08-06 a commit landed here called "publish the numbers a fresh clone
 * runs, not the ones this machine does". It changed README's `@leela/content`
 * row from 705 to 661 and the total from 3543 to 3499, and it wrote a long
 * paragraph into `scripts/audit-claims.mjs` explaining that this suite
 * parameterises over the donor repositories at `../leela-src`, so it runs 705
 * cases on the machine that has them and 661 on a stranger's clone; that CI is
 * the stranger; and that `--write` must therefore never be run on a donor
 * machine.
 *
 * None of that had been run. It was ASSUMED, and the donor clones are not the
 * cause. Extract the committed tree on its own — `git archive HEAD | tar -x -C
 * /tmp/freshleela`, a directory whose `..` is `/tmp`, which has never held a
 * `leela-src` — and the suite reports `Test Files 29 passed (29) / Tests 705
 * passed (705)`, under `bunx vitest run` and `npx vitest run` alike. The working
 * tree on a machine that does hold the donors reports the same 29 files and the
 * same 705 cases. Donors present or absent, same count.
 *
 * The mechanism was invented too. `LANGUAGES` is a literal array of 22 subtags
 * in `../src/language.ts`, not a directory listing, so the four
 * `it.each(LANGUAGES)` blocks in `content.test.ts` are 22 cases each wherever
 * they run — 140 cases in that file here and 140 in CI's own log. The donor path
 * really does appear in this directory — in `a-build-that-refuses.test.ts`,
 * where `existsSync(DONOR)` picks between two *labels* for one row of a fixed
 * two-row grid. It changes what a case is called. It cannot change how many
 * there are.
 *
 * RETRACTION OF THE RETRACTION, same day, and it is the more useful half. The
 * paragraph above used to close by calling 661 impossible — a figure it said
 * nothing had ever run. That was the THIRD wrong explanation of this gap, and it
 * was wrong in the way that is cheapest to check: CI printed 661 twice in run
 * 31072659705 at commit d0ad661 — once in the `test` job's own vitest output as
 * `Tests 661 passed (661)`, and once from this repository's `audit-claims` step.
 * A number was called impossible while a log in this repository's own CI held
 * it, twice. (Paraphrased rather than quoted on purpose: a false claim about a
 * number is the one sentence somebody will grep for, and a verbatim copy inside
 * the retraction is what makes that search land on the file that fixed it.)
 *
 * The cause was MEASURED rather than reasoned, and it is not in this file. It
 * was `packages/content/tests/undo.test.ts`, which built a grid of truncated
 * notes one row per byte of `JSON.stringify({ path, original })` where `path`
 * was a file inside `mkdtempSync(join(tmpdir(), …))`. The serialised note is 134
 * bytes when `tmpdir()` is macOS's `/var/folders/cm/…/T` and 90 when it is
 * Linux's `/tmp`: 44 rows of difference, which is the whole gap, and per-file
 * counts confirmed it landed entirely in that one file — 171 cases here against
 * CI's 127, with every other file in the package matching CI to the case. That
 * grid is built from a literal path now, and its width is asserted as a number.
 *
 * Why the `git archive` measurement above looked like a refutation and was not:
 * it moved the *repository* to `/tmp/freshleela` and left `tmpdir()` alone. The
 * count never depended on where the checkout is. It depended on where this
 * machine puts temporary files, which an extraction into `/tmp` does not change.
 *
 * So this file does not guard the number 705, which the audit measures anyway
 * and would catch on its own. It guards the SHAPE of the claim that was made
 * and never checked: that the case count is a function of what the repository
 * carries, and of nothing else. Two derived assertions, no list of known cases:
 *
 *   (a) the set of files under `packages/content/data` as the filesystem has
 *       them and the set as `git ls-files` has them agree in BOTH directions,
 *       so an untracked file cannot add plans a stranger's clone lacks, and a
 *       tracked-but-missing file cannot take them away;
 *   (b) the number of languages the suite parameterises over equals the number
 *       of carried `plans.*.json` files, so the case count is arithmetic over
 *       tracked content rather than over whatever happens to be on the disk.
 *
 * Broken on purpose before being trusted, all three times, and the messages
 * below were copied off the runs rather than imagined.
 *
 * `touch packages/content/data/plans.zz.json` and (a) fails, naming it:
 *
 *   AssertionError: under packages/content/data but not carried by the
 *   repository - a stranger's clone would not have these: expected
 *   [ 'plans.zz.json' ] to deeply equal []
 *
 * (b) stays green for that one, and correctly: an untracked file adds no
 * language, which is the whole reason (a) has to exist separately. `rm` the
 * file and all three pass, with `git status --porcelain` clean of it.
 *
 * Deleting a carried file fails (a) the other way. `rm
 * packages/content/data/editions/leela-en.json`:
 *
 *   AssertionError: carried by the repository but not on this disk - the suite
 *   is reading a smaller dataset than it ships: expected
 *   [ 'editions/leela-en.json' ] to deeply equal []
 *
 * That file was chosen because nothing in `../src` imports it. Delete a
 * `plans.*.json` instead and the suite never reaches an assertion at all — the
 * static import in `../src/index.ts` fails to resolve and the whole file fails
 * to collect. Red either way, which is the point, but only the un-imported file
 * shows this assertion doing the work.
 *
 * (b) was falsified in the extraction tree, where "carried" is the filesystem:
 * add a 23rd plan file the language list has never heard of and
 *
 *   AssertionError: LANGUAGES has 22 entries; the repository carries 23
 *   plans.*.json files: expected 22 to be 23
 *
 * which is the defect in its natural direction — a dataset that grows without
 * the code that reads it, or the other way round.
 *
 * ONE HONEST GAP, stated rather than exempted. "Carried" means the git index,
 * and an extracted archive — the very trick used to measure the fresh-clone
 * count above — has no index for `git ls-files` to read. Where that happens the
 * question is answered by construction: an extraction contains what the
 * repository carries and nothing else. The tests do not take that on faith,
 * they require it to be *demonstrable* (`.git` absent), so a real checkout
 * where git merely failed to run goes red rather than quiet. A check that
 * cannot answer must say so; it must not pass.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const DATA_DIR = 'packages/content/data';
const DATA = join(REPO, DATA_DIR);

/** Every file under a directory, as paths relative to it, in posix form. */
function filesUnder(root: string): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(root);
  return found.sort();
}

/**
 * What the repository carries under `packages/content/data`.
 *
 * `index` is the answer a checkout gives. `extraction` is the answer a tree
 * with no `.git` gives, where the files present *are* the carried ones; it
 * exists only so that the fresh-clone measurement this file documents can still
 * be taken. Anything else — git present but unreadable, git binary missing in a
 * real checkout — is `unanswerable`, and the first case below fails on it.
 */
function carried(): { mode: 'index' | 'extraction' | 'unanswerable'; files: string[]; why: string } {
  const isCheckout = existsSync(join(REPO, '.git'));
  try {
    // stderr is dropped on purpose: in an extraction git says `fatal: not a
    // git repository` and that is an expected answer here, not a fault. A check
    // that prints alarming text while passing is one people stop reading.
    const out = execFileSync('git', ['ls-files', '-z', '--', DATA_DIR], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const files = out
      .split('\0')
      .filter(Boolean)
      .map((path) => path.slice(`${DATA_DIR}/`.length))
      .sort();
    if (files.length > 0) return { mode: 'index', files, why: 'git ls-files answered' };
    if (!isCheckout) return { mode: 'extraction', files: filesUnder(DATA), why: 'no .git: the tree is what was carried' };
    return { mode: 'unanswerable', files: [], why: 'a checkout whose index lists nothing under the dataset' };
  } catch (error) {
    if (!isCheckout) return { mode: 'extraction', files: filesUnder(DATA), why: 'no .git: the tree is what was carried' };
    return { mode: 'unanswerable', files: [], why: `a checkout where git could not be read: ${String(error)}` };
  }
}

const repository = carried();
const onDisk = filesUnder(DATA);

describe('a count a stranger cannot run', () => {
  it('can say what the repository carries, rather than passing without an answer', () => {
    expect(
      repository.mode,
      `this tree cannot be asked what it carries, so nothing below would mean anything: ${repository.why}`,
    ).not.toBe('unanswerable');
    expect(repository.files.length, 'the dataset directory is empty in the carried reading').toBeGreaterThan(0);
  });

  it('holds no file a stranger would not get, and misses none a stranger would', () => {
    const inRepository = new Set(repository.files);
    const present = new Set(onDisk);

    expect(
      onDisk.filter((file) => !inRepository.has(file)),
      "under packages/content/data but not carried by the repository - a stranger's clone would not have these",
    ).toEqual([]);
    expect(
      repository.files.filter((file) => !present.has(file)),
      'carried by the repository but not on this disk - the suite is reading a smaller dataset than it ships',
    ).toEqual([]);
  });

  it('parameterises over exactly as many languages as there are carried plan files', () => {
    const plans = repository.files.filter((file) => /^plans\.[^/]+\.json$/.test(file));
    expect(
      LANGUAGES.length,
      `LANGUAGES has ${LANGUAGES.length} entries; the repository carries ${plans.length} plans.*.json files`,
    ).toBe(plans.length);
  });
});
