/**
 * Is the live bot running what this repository holds?
 *
 * The deciding half of `scripts/audit-serving.mjs`, here so it can be tested
 * without the network. What this file knows: how to read a fingerprint out of
 * a set of response headers, and what the answers mean.
 *
 * **Three answers, not two.** A guard over a remote process has a state that a
 * guard over a file does not: *the question was not answered*. A bot that is
 * down, a bot too old to carry the header at all, a network that dropped the
 * request — none of those are agreement, and none of them are disagreement
 * either. Collapsing them into a pass is how a guard comes to certify the
 * thing it was written to catch; collapsing them into a fail is how it gets
 * switched off. So `verdict` has `serving`, `stale` and `unknown`, and the
 * exit codes below keep them apart.
 *
 * **Two fingerprints, not one — and that correction is the reason this file
 * was rewritten a day after it was written.** The first version measured the
 * texts alone, and `LOOP.md` then told every future iteration that exit 0 meant
 * *the bot is current*. It did not. An edit to `apps/bot/src` left the texts
 * fingerprint identical, so the guard would have reported **serving** for a bot
 * running code from any number of commits ago — the same defect it exists to
 * catch, one layer up. A guard whose sentence claims more than its measurement
 * is worse than no guard, because the sentence is what people act on.
 */

/** The headers the bot answers with. Must match `apps/bot/src/serving.ts`. */
export const SERVING_HEADER = 'x-leela-content';
export const CODE_HEADER = 'x-leela-code';

/**
 * The two halves, named once so a caller cannot ask for a third by typo.
 *
 * `what` is how they are printed. Texts first because a stale dataset is what
 * a player reads, and stale code is what a player does not get.
 */
export const HALVES = [
  { key: 'texts', header: SERVING_HEADER, what: 'the texts it serves' },
  { key: 'code', header: CODE_HEADER, what: 'the code it runs' },
];

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
 * One fingerprint in a response, or null.
 *
 * Takes anything with a `get` — `Headers`, or a plain map in a test.
 */
export function fingerprintFrom(headers, name = SERVING_HEADER) {
  const said = headers?.get?.(name);
  if (typeof said !== 'string') return null;

  const trimmed = said.trim();
  return FINGERPRINT.test(trimmed) ? trimmed : null;
}

/** Both of them, by the names {@link HALVES} gives. */
export function fingerprintsFrom(headers) {
  return Object.fromEntries(HALVES.map(({ key, header }) => [key, fingerprintFrom(headers, header)]));
}

/**
 * The three states, as a verdict a person can act on.
 *
 * Both halves must agree for a pass. A half that could not be established
 * makes the whole answer `unknown` even when the other half matches — because
 * *half the question was answered* is not *the answer is yes*, and the half
 * that goes missing is exactly the half a deployment predating it would drop.
 *
 * @param expected `{texts, code}` from this checkout; a null means unreadable
 * @param served   `{texts, code}` the live bot said; a null means it did not
 */
export function verdict(expected, served) {
  const missing = HALVES.filter(({ key }) => expected?.[key] == null).map(({ what }) => what);
  if (missing.length > 0) {
    return {
      state: 'unknown',
      why: `this checkout could not fingerprint ${missing.join(' or ')}, so there is nothing to compare against`,
    };
  }

  const unanswered = HALVES.filter(({ key }) => served?.[key] == null);
  if (unanswered.length > 0) {
    return {
      state: 'unknown',
      why:
        `the live bot answered without a usable ${unanswered.map(({ header }) => header).join(' or ')}. ` +
        'That is what a bot deployed before this guard existed looks like — and also what a bot that ' +
        'cannot read its own files looks like. Deploy it and ask again: if a header is still missing ' +
        'after a deploy, the bot cannot read what that header names.',
    };
  }

  const differing = HALVES.filter(({ key }) => served[key] !== expected[key]);
  if (differing.length > 0) {
    return {
      state: 'stale',
      why: differing
        .map(({ key, what }) => `${what}: the bot has ${served[key]}, this checkout holds ${expected[key]}`)
        .join('; '),
    };
  }

  return {
    state: 'serving',
    why: `the live bot is running ${expected.code} over ${expected.texts}, which is what this checkout holds`,
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
