/**
 * Which dataset the running bot is serving — as a number it can say out loud.
 *
 * **THE BOT DOES NOT DEPLOY ITSELF.** The web surfaces are rebuilt by
 * `pages.yml` on every push, so a repair to the texts reaches a reader the
 * moment CI is green. The bot is shipped by hand with `railway up`, and until
 * somebody runs it the bot serves whatever it was serving before, however
 * green the repository is.
 *
 * That is not a hypothesis. Three iterations repaired the dataset —
 * seventy-three plan titles that still carried their "Plan N" label, and a
 * Malay plan printing `& Nbsp; & nbsp;` between two paragraphs — and all three
 * read the contract's paragraph about `railway up` and none of them ran it. On
 * 2026-08-29 the last successful deployment was **2026-08-28 19:39** and those
 * commits landed at **04:57** and **06:12** the next morning, so a player
 * standing on the fourteenth plan was still being told, by name, that they were
 * on `۔ Astral Plane`.
 *
 * A paragraph in a contract asking six iterations to remember something is not
 * a guard. This is the measurement that replaces it: the bot reports a
 * fingerprint of the texts it has on disk, `scripts/audit-serving.mjs` computes
 * the same fingerprint from the repository, and the two either agree or they do
 * not.
 *
 * **Node and Bun only.** It reads the filesystem, so it lives here and not in
 * `@leela/content` — that package is imported by the browser and by Metro, and
 * a `node:fs` import in it would break both. The bot's image copies `packages`
 * as plain files (`apps/bot/Dockerfile`) and Bun runs the TypeScript directly,
 * so the same directory this reads on a laptop is on the container's disk.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repository, as this process can see it.
 *
 * Three levels up from `apps/bot/src/` is the root, and the layout inside the
 * image is the same one — the Dockerfile copies `packages packages` and
 * `apps/bot apps/bot` under a single `/app`. If that ever stops being true the
 * reads below throw and the fingerprint is `null`, which reads as *cannot tell*
 * rather than as agreement.
 */
export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The texts, as files. */
export const DATA_DIR = join(REPO, 'packages', 'content', 'data');

/**
 * The TypeScript this container actually runs, under a given root.
 *
 * `apps/bot/src` is the bot; `packages` is every workspace it imports, and the
 * Dockerfile copies the whole directory rather than the five the bot names. A
 * superset is the honest scope here: the claim is *the live bot is running the
 * code this checkout holds*, and what decides that is what went into the image.
 *
 * Taking a root rather than closing over {@link REPO}, so a test can build a
 * tree and ask about it. The alternative was a test that edits `apps/bot/src`
 * and puts it back, which leaves the checkout dirty the moment an assertion
 * throws — and the assertions here are about exactly that directory.
 *
 * `existsSync` rather than letting the walk throw: a root holding one of the
 * two is a legitimate question, and a missing directory would otherwise make
 * the whole answer `null` — *cannot tell*, where the truthful answer is a
 * fingerprint of what is there.
 */
export const codeDirsIn = (repo: string): string[] =>
  [join(repo, 'apps', 'bot', 'src'), join(repo, 'packages')].filter((dir) => existsSync(dir));

/**
 * Directories that are in the image and are not the program.
 *
 * `node_modules` is installed inside the image from the lockfile, not copied
 * from here, so hashing this machine's copy would compare two different things.
 * `dist` is built output no workspace here ships. `tests` are copied — the
 * Dockerfile takes `apps/bot` whole — but a test cannot change what a player
 * sees, and the question this answers is *would deploying now change anything
 * for anybody*. A test-only commit leaves the fingerprint still, on purpose.
 */
const NOT_THE_PROGRAM = new Set(['node_modules', 'dist', 'tests', '.git', 'coverage']);

/** Every `.ts` under a directory, as paths relative to `base`. */
function codeUnder(dir: string, base: string): string[] {
  const found: string[] = [];

  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!NOT_THE_PROGRAM.has(entry.name)) walk(join(at, entry.name));
        continue;
      }
      // `.test.ts` is excluded by name as well as by directory: two workspaces
      // keep a test beside the file it tests rather than under `tests/`.
      if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        found.push(relative(base, join(at, entry.name)));
      }
    }
  };

  walk(dir);
  return found;
}

/**
 * A short, stable name for the contents of a directory of texts.
 *
 * Every top-level `.json`, hashed by name **and** by bytes, then hashed
 * together in name order. Name as well as bytes because a language that
 * disappears must change the answer, and sorted because a filesystem does not
 * promise an order.
 *
 * `data/editions/` is deliberately not read: it holds the two donor snapshots
 * the generator merges, no code loads them, and nothing in them is ever shown
 * to a player. A fingerprint that moves when something unserved changes is a
 * fingerprint that goes off for the wrong reason.
 *
 * Twelve hex characters. This is not a security boundary — it says *the same*
 * or *not the same* about a directory that only this project writes — and a
 * fingerprint a person can read off a terminal and compare by eye is worth
 * more here than forty-eight characters nobody checks.
 *
 * @returns the fingerprint, or `null` when the texts cannot be read at all.
 */
export function fingerprintOf(dir: string): string | null {
  try {
    const names = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort();

    return hashOf(dir, names);
  } catch {
    return null;
  }
}

/**
 * The same, for the code — every `.ts` under {@link codeDirsIn}.
 *
 * Named by its path relative to the repository rather than by its basename,
 * because two workspaces have an `index.ts` and moving a file between them is
 * a different program.
 *
 * **Why this exists at all.** The first version of this file fingerprinted the
 * texts and nothing else, and `LOOP.md` then told every future iteration that
 * exit 0 meant *the bot is current*. It did not: an edit to `apps/bot/src`
 * left the fingerprint untouched, so the guard would have said **serving** for
 * a bot running code from any number of commits ago. That is the same defect
 * it was written to catch, one layer up — a guard whose sentence claims more
 * than its measurement.
 */
export function codeFingerprint(repo: string = REPO): string | null {
  try {
    const files = codeDirsIn(repo)
      .flatMap((dir) => codeUnder(dir, repo))
      .sort();
    return hashOf(repo, files);
  } catch {
    return null;
  }
}

/**
 * Hash a list of files, by name and by bytes, in the order given.
 *
 * One implementation for both fingerprints. Written out of the two collectors
 * rather than copied into each: the guard and the bot must agree to the
 * character, and two hashers that started identical are two hashers that can
 * drift.
 *
 * @param base what the names are relative to
 * @param names sorted, and hashed **as given** — the caller owns the order,
 *   because a filesystem does not promise one
 */
function hashOf(base: string, names: string[]): string | null {
  // Nothing is not a program, and not a dataset. Returning a hash of the empty
  // list would give every empty deployment the same confident answer, and two
  // bots that had both lost their files would agree with each other.
  if (names.length === 0) return null;

  const whole = createHash('sha256');
  for (const name of names) {
    const bytes = readFileSync(join(base, name));
    // Separators normalised so the answer is the same on any filesystem this
    // ever runs on. The image is Linux and the laptop is a Mac; both use `/`,
    // and the day one does not is the day the two sides silently disagree.
    whole.update(name.split(sep).join('/'));
    whole.update('\0');
    whole.update(createHash('sha256').update(bytes).digest('hex'));
    whole.update('\n');
  }

  return whole.digest('hex').slice(0, 12);
}

/**
 * The header the bot answers with, and the one the guard reads.
 *
 * Named for what it carries rather than for the project, so it reads as itself
 * in a terminal full of headers.
 */
export const SERVING_HEADER = 'x-leela-content';

/**
 * And the one for the code.
 *
 * A second header rather than a second field inside the first, so that each
 * can be **absent** on its own. Absence is the *cannot tell* state, and a bot
 * old enough to carry the texts header and not this one is a real thing that
 * existed for exactly one day — the guard has to be able to say which half it
 * could not establish.
 */
export const CODE_HEADER = 'x-leela-code';

let remembered: string | null | undefined;
let rememberedCode: string | null | undefined;

/**
 * This process's fingerprint, read once.
 *
 * Memoised because it is answered on every request and the texts cannot change
 * under a running container — the image is immutable and a new dataset arrives
 * only as a new deployment. `undefined` is the *not yet asked* state, which is
 * why the cache is not simply `string | null`: `null` is a real answer and
 * must not be recomputed on every request.
 *
 * There is deliberately no way to forget it. A `forgetFingerprint` was written
 * for the tests and then had no caller, because nothing needs one: the tests
 * that exercise a *different* answer hand `askRoute` a `serving` function, and
 * the ones that exercise *this* answer want it stable. An export kept for a
 * test that does not use it is a second way to reach the state, and the
 * useful thing about a memoised read is that there is only one.
 */
export function servingFingerprint(): string | null {
  if (remembered === undefined) remembered = fingerprintOf(DATA_DIR);
  return remembered;
}

/**
 * The code fingerprint, read once, for the same reasons.
 *
 * This one walks a few hundred files rather than twenty-four, which is why it
 * is worth memoising and why it is read on the first request rather than at
 * startup: a bot that cannot answer until it has hashed itself is a bot whose
 * diagnostic delayed it.
 */
export function runningFingerprint(): string | null {
  if (rememberedCode === undefined) rememberedCode = codeFingerprint();
  return rememberedCode;
}
