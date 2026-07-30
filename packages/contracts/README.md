# @leela/contracts

`LeelaGame.sol`, and a check that its board still matches the engine.

## Where it is, which is nowhere reachable

`smart-contract-leela/address.json` records
`0x2741CE9C9fA1c9B78b20cab7F07998d77846b7Af`, and this README used to state that
as a plain fact and rest an argument on it.

Asked, on 2026-07-30 — `node scripts/audit-deployment.mjs`:

```
  polygon:      unreachable
  polygon-amoy: absent
  ethereum:     absent
  bsc:          absent
```

The only network the project ever configured is **Mumbai** — `hardhat.config.ts`
has exactly one network entry and it is that — and Polygon shut Mumbai down in
April 2024. There is nothing left to ask, and the address holds no code on any
chain that answered.

So the contract is a **historical artefact**, not a live one. That changes one
thing and not another:

- It does **not** change the value of the check below. The Solidity is a fifth
  independent description of the board, written by people who had to get it
  right, and disagreement with the engine is still worth knowing about.
- It **does** change the argument. The two divergences below are not permanent
  *because deployed*; they are a record of what one implementation did. They
  stay described by the `onchain` ruleset because a variant that once existed is
  still a variant, and silently folding it into `classic` would be changing the
  rules of a game somebody played.

## The board agrees

The contract is a fourth copy of the board: twenty `else if` branches. All
twenty snakes and arrows land on the same squares as `@leela/engine`, and
`WIN_PLAN` and `TOTAL_PLANS` match. `verify.ts` reads the Solidity source and
asserts this, so a future edit to either side fails a test rather than
silently making an on-chain game a different game.

Reading the source rather than running it is deliberate: a full Hardhat
toolchain to assert twenty numbers would be a heavy way to learn very little.

## The contract is where the report gate came from

```solidity
require(
  reports[reportIdCounter].reporter == msg.sender,
  'You must create a report before rolling the dice.'
);
```

This is the only implementation that ever enforced it. The published mobile app
gated online play; the Expo rewrite kept a `needs_report` column and checked it
nowhere. That the rule survives in the contract is the evidence it belongs to
the game rather than to one app's product decisions — and why `classic` has it.

## Where it diverges, permanently

Two differences from `classic`, both in deployed bytecode and therefore fixed.
They are described by the `onchain` ruleset, not treated as bugs.

**The entering six counts as the first of a run.** On entry the contract sets
`consecutiveSixes = 1`; the engine leaves it at `0`. On chain, two more sixes
after entering trigger the reset — one throw sooner than anywhere else.

**The fallback square is overwritten on every six.** The engine records it only
when a run begins:

```ts
newBeforeThreeSixes: consecutive === 0 ? currentLoka : positionBeforeThreeSixes
```

The contract assigns it unconditionally inside `if (roll == MAX_ROLL)`, so a
third six returns the player to where the *third* six began rather than the
first. The player loses one move instead of the run.

Neither is expressible as a flag on a `RuleSet`, so anything that needs to
reproduce an on-chain move exactly should consult the contract.

## Also present

`movePlayer` checks `newPlan > TOTAL_PLANS` before the jump chain and again in
a trailing `else if`. The second is unreachable — by then `newPlan` is at most
`TOTAL_PLANS`. Harmless, and noted so nobody spends an afternoon on it.

## Not done here

The subgraph. `leela-ai-4` is the newest of four iterations; the other three
are archived. Porting it needs a deployed indexer, which is a deployment
decision rather than a code one.
