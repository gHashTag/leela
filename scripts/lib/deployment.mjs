/**
 * Asking a chain whether an address holds a contract.
 *
 * The repository said the game's contract is "deployed at 0x2741CE…" as a plain
 * fact, and rested an argument on it: two divergences from the engine were
 * called permanent *because deployed*. Nobody had asked a chain.
 *
 * The distinction this exists to protect is the one an overclaim comes from:
 * **an RPC that does not answer is not a chain that has no contract.** A probe
 * that reports silence as absence is how "we checked" becomes untrue.
 */

/** What a chain said about an address. */
export const PRESENT = 'present';
export const ABSENT = 'absent';
export const UNREACHABLE = 'unreachable';

/**
 * What a set of chains says when some of them did not say anything.
 *
 * This is the value the module was missing, and its absence was the defect.
 * `summarise` used to return `ABSENT` for any run in which a single chain
 * answered, so a probe of four chains where three said "no code" and Polygon
 * timed out came back `absent` — a finding — and that exact run is transcribed
 * in `packages/contracts/README.md`. Polygon is the one chain a Polygon-targeted
 * project would have deployed to, and it is the one chain that was never asked.
 *
 * `partly-absent` is not a hedge, it is the finding: nobody who saw it could
 * mistake it for "we looked everywhere". The chains that stayed silent are named
 * by `describe`, and `exitCodeFor` turns the same fact into a non-zero exit.
 */
export const PARTLY_ABSENT = 'partly-absent';

/**
 * The verdicts in a set of results, however they arrived.
 *
 * The audit carries a `Map` of chain name to verdict, because a person reading
 * the output needs the names; the tests over the shape of the verdict carry
 * bare verdicts, because a grid of every combination has no names to give. Both
 * are the same question, so both are accepted rather than forcing one caller to
 * unpack for the other and get the unpacking wrong.
 */
function verdictsIn(results) {
  return [...results].map((entry) => (Array.isArray(entry) ? entry[1] : entry));
}

/**
 * Read one `eth_getCode` answer.
 *
 * @param answer  The parsed JSON-RPC response, or null when nothing came back.
 * @returns `present` when there is bytecode, `absent` when the chain answered
 *          with none, and `unreachable` for everything else — an error object,
 *          a malformed body, a timeout. Never `absent` by default.
 */
export function classify(answer) {
  if (answer === null || typeof answer !== 'object') return UNREACHABLE;
  if ('error' in answer) return UNREACHABLE;

  const result = answer.result;
  if (typeof result !== 'string') return UNREACHABLE;
  if (!result.startsWith('0x')) return UNREACHABLE;

  // `0x` is the empty answer: the address exists as a number and holds no code.
  return result.length > 2 ? PRESENT : ABSENT;
}

/**
 * What a set of chains says, together.
 *
 * Four answers, and the fourth is the one this function used to lack:
 *
 * - `present` if any chain has the code. One is enough and it wins outright,
 *   because a contract found somewhere is found, and no amount of silence
 *   elsewhere makes a thing that was seen unseen.
 * - `absent` **only when every chain answered** and none had it. That is the
 *   only shape of run in which "it is not deployed" is a thing this probe knows.
 * - `partly-absent` when at least one chain answered "no code" and at least one
 *   said nothing. Not a finding about the contract: a finding about the run.
 * - `unreachable` when nothing could be asked at all — including the empty set,
 *   which is a probe that asked nobody.
 *
 * The sentence that was here said `absent` requires that every chain answered,
 * and the code returned `absent` as soon as *a* chain answered. The prose was
 * right and the code was wrong, and the disagreement had also been copied into
 * a test title. "We could not look" and "it is not there" are different
 * findings, and so is "we could look in three places out of four".
 *
 * @param results  Verdicts, or `[chain, verdict]` entries such as a `Map`.
 */
export function summarise(results) {
  const values = verdictsIn(results);
  if (values.length === 0) return UNREACHABLE;
  if (values.some((r) => r === PRESENT)) return PRESENT;
  if (values.every((r) => r === UNREACHABLE)) return UNREACHABLE;
  if (values.some((r) => r === UNREACHABLE)) return PARTLY_ABSENT;
  return ABSENT;
}

/**
 * The exit code a run of this probe deserves, worked out without a network.
 *
 * The audit needs four public RPC endpoints and is deliberately not in CI, so
 * the part of it that decides whether a run counts as an answer must be
 * testable on its own. This is that part: a pure function of the verdicts, with
 * no `fetch` anywhere near it.
 *
 * `0` only when every chain answered — silence included in a green run is the
 * whole defect. Otherwise `2`, which in this repository already means *the check
 * has no answer for at least one of these*: `audit-copies.mjs` exits 2 for files
 * whose board it could not read, and says so in the same words. Keeping one
 * vocabulary matters more here than a code chosen fresh, because the person
 * reading a non-zero exit is reading across scripts.
 *
 * Note that a `present` verdict does not buy a zero. The contract was found, and
 * the run still has nothing to say about the chain that was quiet; the verdict
 * is the place where finding it wins, not the exit code.
 *
 * @param byChain  Verdicts, or `[chain, verdict]` entries such as a `Map`.
 */
export function exitCodeFor(byChain) {
  const values = verdictsIn(byChain);
  if (values.length === 0) return 2;
  return values.some((r) => r === UNREACHABLE) ? 2 : 0;
}

/**
 * A sentence for a person, naming what was asked and what came back.
 *
 * The conclusion used to read `0xabc holds no code on any chain that answered`,
 * which is true of a run in which one chain out of four answered and is read by
 * everybody as "it is not deployed". The clause carrying the whole doubt —
 * *that answered* — is four words at the end of a sentence whose subject is the
 * contract. So the count is now in front of the reader, and the chains that
 * stayed quiet are named, because a reader who can see `polygon was silent`
 * cannot come away thinking Polygon was checked.
 */
export function describe(address, byChain) {
  const entries = [...byChain];
  const lines = entries.map(([chain, verdict]) => `  ${chain}: ${verdict}`);

  const silent = entries.filter(([, verdict]) => verdict === UNREACHABLE).map(([chain]) => chain);
  const answered = entries.length - silent.length;
  const overall = summarise(entries);

  const chains = (n) => `${n} ${n === 1 ? 'chain' : 'chains'}`;
  const quiet = `${silent.join(', ')} ${silent.length === 1 ? 'was' : 'were'} silent`;

  let conclusion;
  if (overall === PRESENT) {
    conclusion =
      silent.length === 0
        ? `${address} holds code.`
        : `${address} holds code; ${quiet}, which does not change that.`;
  } else if (overall === ABSENT) {
    conclusion = `all ${chains(answered)} answered and none held code: ${address} holds no code.`;
  } else if (overall === PARTLY_ABSENT) {
    conclusion =
      `${answered} of ${chains(entries.length)} answered and none held code; ${quiet}. ` +
      `This run does not say whether ${address} is deployed there.`;
  } else {
    conclusion = `no chain answered about ${address}; nothing was learned.`;
  }

  return [...lines, '', conclusion].join('\n');
}
