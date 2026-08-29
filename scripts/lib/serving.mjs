/**
 * Is the live bot serving the texts this repository holds?
 *
 * The deciding half of `scripts/audit-serving.mjs`, here so it can be tested
 * without the network. What this file knows: how to read a fingerprint out of
 * a set of response headers, and what the three answers mean.
 *
 * **Three answers, not two.** A guard over a remote process has a state that a
 * guard over a file does not: *the question was not answered*. A bot that is
 * down, a bot too old to carry the header at all, a network that dropped the
 * request — none of those are agreement, and none of them are disagreement
 * either. Collapsing them into a pass is how a guard comes to certify the
 * thing it was written to catch; collapsing them into a fail is how it gets
 * switched off. So `verdict` has `serving`, `stale` and `unknown`, and the
 * exit codes below keep them apart.
 */

/** The header the bot answers with. Must match `apps/bot/src/serving.ts`. */
export const SERVING_HEADER = 'x-leela-content';

/**
 * What a fingerprint may look like, so a wrong one is not read as a right one.
 *
 * Twelve lowercase hex characters. A proxy that inserts its own header, or a
 * bot half-way through a rename, produces something this refuses — and a value
 * that is not a fingerprint is `unknown`, not `stale`: saying *the bot is
 * behind* about a string nobody has established the meaning of is a claim
 * about a deployment made from a typo.
 */
export const FINGERPRINT = /^[0-9a-f]{12}$/;

/**
 * The fingerprint in a response, or null.
 *
 * Takes anything with a `get` — `Headers`, or a plain map in a test.
 */
export function fingerprintFrom(headers) {
  const said = headers?.get?.(SERVING_HEADER);
  if (typeof said !== 'string') return null;

  const trimmed = said.trim();
  return FINGERPRINT.test(trimmed) ? trimmed : null;
}

/**
 * The three states, as a verdict a person can act on.
 *
 * @param expected the repository's fingerprint, or null if it could not be computed
 * @param served   what the live bot said, or null if it said nothing usable
 */
export function verdict(expected, served) {
  if (expected === null) {
    return {
      state: 'unknown',
      why: 'this checkout could not fingerprint packages/content/data, so there is nothing to compare against',
    };
  }
  if (served === null) {
    return {
      state: 'unknown',
      why:
        `the live bot answered without a usable ${SERVING_HEADER}. That is what a bot deployed before ` +
        'this guard existed looks like — and also what a bot that cannot read its own texts looks like. ' +
        'Deploy it and ask again: if the header is still missing after a deploy, the bot has no dataset.',
    };
  }
  if (served === expected) {
    return { state: 'serving', why: `the live bot is serving ${served}, which is what this checkout holds` };
  }
  return {
    state: 'stale',
    why: `the live bot is serving ${served}; this checkout holds ${expected}`,
  };
}

/**
 * The exit code for a verdict.
 *
 * **1 for stale, 2 for unknown**, and the difference is deliberate. 1 is *the
 * answer is no*; 2 is *there is no answer*, which is the convention
 * `audit-deployment.mjs` already uses for a chain that did not reply. A caller
 * that treats them the same is free to, and a caller that must not act on a
 * guess can tell them apart.
 */
export function exitCodeFor(state) {
  if (state === 'serving') return 0;
  if (state === 'stale') return 1;
  return 2;
}
