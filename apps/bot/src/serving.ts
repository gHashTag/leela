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
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The texts, as files.
 *
 * Four levels up from `apps/bot/src/` is the repository root, and the layout
 * inside the image is the same one — the Dockerfile copies `packages packages`
 * and `apps/bot apps/bot` under a single `/app`. If that ever stops being true
 * the read below throws and the fingerprint is `null`, which reads as *cannot
 * tell* rather than as agreement.
 */
export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'content', 'data');

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

    // An empty directory is not a dataset. Returning a hash of nothing would
    // give every empty deployment the same confident answer, and two bots that
    // had both lost their texts would agree with each other.
    if (names.length === 0) return null;

    const whole = createHash('sha256');
    for (const name of names) {
      const bytes = readFileSync(join(dir, name));
      whole.update(name);
      whole.update('\0');
      whole.update(createHash('sha256').update(bytes).digest('hex'));
      whole.update('\n');
    }

    return whole.digest('hex').slice(0, 12);
  } catch {
    return null;
  }
}

/**
 * The header the bot answers with, and the one the guard reads.
 *
 * Named for what it carries rather than for the project, so it reads as itself
 * in a terminal full of headers.
 */
export const SERVING_HEADER = 'x-leela-content';

let remembered: string | null | undefined;

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
