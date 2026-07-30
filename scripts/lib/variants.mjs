/**
 * Holding a variant to the app it claims to reproduce.
 *
 * `packages/contracts` holds `onchain` to the Solidity, because the contract is
 * vendored here and a test can read it. `legacy-mobile` and `online` reproduce
 * the published mobile app, which is not vendored — so their rules were written
 * by reading `leela-src`, and after that the reading was a memory.
 *
 * `onchain` is what a memory is worth: it carried `classic`'s value for all
 * five flags added after it was written, and one of them was wrong. These two
 * were written the same way.
 *
 * Both halves of a claim are checked, which is the whole idea. The flag must
 * still hold the value its evidence supports, and the evidence must still be in
 * the app. Either one changing alone is a disagreement worth a person's
 * attention.
 */

/**
 * Everything wrong with one claim.
 *
 * @param rules  The variant, as the engine exports it.
 * @param claim  `{ flag, value, file, must?, mustNot?, why }`.
 * @param read   `(file) => string | null`. Injected so the rule can be
 *               asserted without a clone of the published app to hand.
 */
export function checkClaim(rules, claim, read) {
  const where = `${rules.id}.${claim.flag}`;

  if (rules[claim.flag] !== claim.value) {
    return [
      `${where} is ${JSON.stringify(rules[claim.flag])}, and the evidence in ${claim.file} says ${JSON.stringify(claim.value)} — ${claim.why}`,
    ];
  }

  const source = read(claim.file);
  if (source === null || source === undefined) {
    // Named rather than skipped. An audit that passes because it could not
    // find the file is the failure this repository keeps meeting: a check that
    // reads as a pass because it did not look.
    return [`${where}: ${claim.file} is not there to check against`];
  }

  const problems = [];
  if (claim.must && !claim.must.test(source)) {
    problems.push(`${where}: ${claim.file} no longer shows that ${claim.why}`);
  }
  if (claim.mustNot && claim.mustNot.test(source)) {
    problems.push(`${where}: ${claim.file} now shows what the flag says is absent — ${claim.why}`);
  }

  return problems;
}
