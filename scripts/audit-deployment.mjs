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
 * red. It is a tool for answering the question when the answer matters — and
 * the answer it gives is written down, with its date, in the README.
 *
 *   node scripts/audit-deployment.mjs [address]
 */

import { classify, describe, summarise, UNREACHABLE } from './lib/deployment.mjs';

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

if (summarise([...byChain.values()]) === UNREACHABLE) {
  // Not a failure of the contract — a failure to ask. Said plainly, and
  // reported as an error, because a silent "nothing found" is the mistake this
  // whole script exists to avoid.
  console.error('\nEvery chain was silent. This says nothing about the contract.');
  process.exitCode = 1;
}
