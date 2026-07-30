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
 * @returns `present` if any chain has the code — one is enough, and a contract
 *          found somewhere is found. `absent` only when every chain answered
 *          and none had it. `unreachable` when nothing could be asked, because
 *          "we could not look" and "it is not there" are different findings.
 */
export function summarise(results) {
  const values = [...results];
  if (values.length === 0) return UNREACHABLE;
  if (values.some((r) => r === PRESENT)) return PRESENT;
  if (values.every((r) => r === UNREACHABLE)) return UNREACHABLE;
  return ABSENT;
}

/** A sentence for a person, naming what was asked and what came back. */
export function describe(address, byChain) {
  const lines = [...byChain].map(([chain, verdict]) => `  ${chain}: ${verdict}`);
  const overall = summarise([...byChain].map(([, verdict]) => verdict));

  const conclusion =
    overall === PRESENT
      ? `${address} holds code.`
      : overall === ABSENT
        ? `${address} holds no code on any chain that answered.`
        : `no chain answered about ${address}; nothing was learned.`;

  return [...lines, '', conclusion].join('\n');
}
