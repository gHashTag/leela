/**
 * Run the deployment checks against a live site.
 *
 *   bun run scripts/smoke-run.ts https://t27.ai/leela/
 *
 * Exits non-zero when anything is wrong, so CI fails a deployment that
 * uploaded successfully and serves something broken.
 *
 * Outside `src` because it is a Node program in a browser app: it reads
 * `process.argv`, and it only typechecked at all because a test file happened
 * to import `vitest`, whose types drag Node's globals in behind it. A build
 * tool has no business being in the bundle's source tree either.
 */

import { allPassed, describeResults, runChecks, type Fetcher } from '../src/smoke';

const base = process.argv[2] ?? 'https://t27.ai/leela/';

/**
 * A fetcher with a timeout: a hung request should fail the check rather than
 * hang the workflow until GitHub kills it.
 */
const fetcher: Fetcher = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    // `content-length` is what the server sent, before `fetch` decompressed
    // it: on a gzipping host that is the number a phone pays. Read before the
    // body, because reading the body is what consumes the response.
    const declared = response.headers.get('content-length');
    const transferred = declared === null ? undefined : Number(declared);

    return {
      status: response.status,
      text: await response.text(),
      transferred: transferred !== undefined && Number.isFinite(transferred) ? transferred : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
};

console.log(`Checking ${base}\n`);
const results = await runChecks(base, fetcher);
console.log(describeResults(results));

if (!allPassed(results)) {
  console.error('\nThe deployment is live but not working.');
  process.exit(1);
}

console.log(`\nAll ${results.length} checks passed.`);
