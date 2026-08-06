#!/usr/bin/env node
/**
 * Ask several chains whether the game's contract is there.
 *
 * `packages/contracts/README.md` said "Deployed at 0x2741CE…" and the migration
 * record called two divergences from the engine permanent *because deployed*.
 * That is a claim about the world, and it had never been checked.
 *
 * Needs: the network. Public RPCs rate-limit, and a gate that goes red because
 *        somebody's node was busy teaches people to ignore red.
 *
 * Deliberately not in CI: it needs the network, public RPCs rate-limit, and a
 * gate that goes red because somebody's node was busy teaches people to ignore
 * red. It is a tool for answering the question when the answer matters.
 *
 * What it produces is written down, with its date, in
 * `packages/contracts/README.md` — and *what* is written down there is the
 * correction this comment needed. The recorded run is not "the answer": three
 * chains answered, Polygon did not, and it went into the README as a plain
 * finding with the silent chain listed above it as a detail. So: the run this
 * script produces is written down with its date, and it is only an answer when
 * every chain answered. `exitCodeFor` is what decides which one you got, and it
 * exits non-zero for the other, so a partial run cannot be copied out of a green
 * terminal as though it were complete.
 *
 *   node scripts/audit-deployment.mjs [address]
 */

import { classify, describe, exitCodeFor, UNREACHABLE } from './lib/deployment.mjs';

/** From `smart-contract-leela/address.json`. */
const DEFAULT_ADDRESS = '0x2741CE9C9fA1c9B78b20cab7F07998d77846b7Af';

/**
 * Where to look.
 *
 * Mumbai is the only network the project ever configured — `hardhat.config.ts`
 * has one entry and it is that — and Polygon shut it down in April 2024, which
 * is why it is not in this list: there is nothing left to ask. Amoy replaced
 * it; the mainnets are here because a contract is sometimes moved.
 */
const CHAINS = [
  ['polygon', 'https://polygon-rpc.com'],
  ['polygon-amoy', 'https://polygon-amoy-bor-rpc.publicnode.com'],
  ['ethereum', 'https://ethereum-rpc.publicnode.com'],
  ['bsc', 'https://bsc-dataseed.binance.org'],
];

const TIMEOUT_MS = 20_000;

async function ask(url, address) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    // A refusal, a timeout, a body that is not JSON. All of them mean the same
    // thing here: nothing was learned.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const address = process.argv[2] ?? DEFAULT_ADDRESS;

const byChain = new Map();
for (const [name, url] of CHAINS) {
  byChain.set(name, classify(await ask(url, address)));
}

console.log(`\nLooking for ${address}:\n`);
console.log(describe(address, byChain));

// Not a failure of the contract — a failure to ask. Said plainly, and reported
// as an error, because a silent "nothing found" is the mistake this whole
// script exists to avoid.
//
// The guard here used to fire only when EVERY chain was silent, which is the
// same off-by-one the verdict had: one answering chain made a run green, and a
// green run is what gets pasted into a README. `exitCodeFor` counts silence
// instead of requiring all of it.
process.exitCode = exitCodeFor(byChain);

const silent = [...byChain].filter(([, verdict]) => verdict === UNREACHABLE).map(([chain]) => chain);

if (silent.length > 0 && silent.length === byChain.size) {
  console.error('\nEvery chain was silent. This says nothing about the contract.');
} else if (silent.length > 0) {
  console.error(
    `\n${silent.join(', ')} did not answer, so this run is not an answer about ${silent.length === 1 ? 'that chain' : 'those chains'}.` +
      '\nDo not write it down as though the address had been checked everywhere.',
  );
}
