/**
 * Run the deployment checks against a live site.
 *
 *   bun run src/smoke-run.ts https://t27.ai/leela/
 *
 * Exits non-zero when anything is wrong, so CI fails a deployment that
 * uploaded successfully and serves something broken.
 */

import { allPassed, describeResults, runChecks, type Fetcher } from './smoke';

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
    return { status: response.status, text: await response.text() };
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
