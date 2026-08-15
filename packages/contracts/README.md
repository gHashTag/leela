# @leela/contracts

`LeelaGame.sol`, and a check that its board still matches the engine.

## Where it is, on three chains out of four

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

**That is a partial answer, and it is kept here as one.** Three chains answered
that the address holds no code. Polygon did not answer — and Polygon is the one
chain a Polygon-targeted project would have deployed to, so the chain that
matters most is the chain that was never asked. The run is not re-run here
because re-running it needs the network; it is corrected in what it is called.

What the run supports, in full: *the address holds no code on any chain that
answered.* It does not support "the contract is nowhere", and the probe now
refuses to say that on its behalf — `summarise` returns `partly-absent` for a
run with a hole in it, `describe` names the silent chains in its conclusion, and
`exitCodeFor` exits 2, this repository's code for *no answer for at least one of
these*. The heading above used to say "which is nowhere reachable", which was a
conclusion drawn from three chains and written as though from four.

The only network the project ever configured is **Mumbai** — `hardhat.config.ts`
has exactly one network entry and it is that — and Polygon shut Mumbai down in
April 2024. There is nothing left to ask *there*, which is a fact about Mumbai
rather than a substitute for the Polygon mainnet answer nobody has.

So the contract is best treated as a **historical artefact** rather than a live
one — on the evidence of three chains, plus Mumbai's shutdown. That changes one
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

**RETRACTED: "This is the only implementation that ever *stated* it."** That
sentence stood here, in `packages/engine/src/rulesets.ts`, in
`tests/verify.test.ts` and in `MIGRATION.md`, and it is false. MEASURED in the
donor at `leela-src/leela-chakra-bot`: the shipped Telegram bot stated the gate
too, per player, with a fifty-character minimum on the report.

- `src/index.ts:64` throws the die at the top of the `make_step` handler;
  `:78` asks `if (user.isWrite)` and, when an account is owed, re-sends the
  plan and enters the report conversation — so the throw is discarded and
  `gameStep` at `:127` is never reached.
- `src/commands/report/index.ts:39` clears `isWrite`, in the one place it is
  ever cleared, after `updateHistory` has written the row.
- `src/commands/report/index.ts:17-22` refuses `report?.length < 50`.

The published mobile app gated online play; the Expo rewrite kept a
`needs_report` column and checked it nowhere. Six shipped implementations, and
**two** of them stated the gate.

**The argument the sentence was making is stronger without it.** Two
independent implementations — one in Solidity, one in TypeScript, neither aware
of the other — arrived at the same rule, which is better evidence that the gate
belongs to the game than one implementation was, and why `classic` has it.

And the bot's gate is the stronger of the two. `isWrite` is a column on the
*player*, so the bot asks *do you owe an account for the square you are
standing on*. The require below asks *were you the last person to write* — see
the next paragraph — which a lone player satisfies once and then forever. The
engine records the bot's rules as the `telegram` variant, and
`scripts/audit-variants.mjs` re-reads all three citations above on every run.

*(The bot's own gate is armed at only one of its two paths: `src/index.ts:163`
sets `isWrite: true`, and `:156-160` returns before it whenever the plan
carries a picture. So the bold sentence its players are shown — the game will
not continue until you write — is true for pictureless squares only. Recorded
on the `telegram` variant as a defect of the donor.)*

**The sentence is not the condition, and this README quoted the sentence.**
`reportIdCounter` is the id of the last report filed by *anybody*, so what the
require asks is *were you the last person to write* — not *have you written
about the square you are standing on*. Alone at the table, a player writes once
and may throw for the rest of the game: nothing on the roll path touches
`reports` or `reportIdCounter`, so the answer cannot change. With two players it
becomes a turn-taking rule nobody wrote, where B's report shuts A out until A
writes again.

And the flag that would have been the rule as everyone reads it —
`playerReportCreated`, set true on a report and false on a roll — is written in
both places and **read nowhere**. It is public state that looks exactly like the
gate and is not consulted by it.

None of this is a bug to fix: the bytecode is deployed, unreachable, and
described rather than corrected. It is a description to get right, which is what
this package is for. `tests/gate.test.ts` holds every sentence above to the
Solidity, including the dead flag — a future edit that *reads* it fails, because
the flag becoming live would change what the gate means.

## Every field of `onchain`, held to the source

Four of the twelve were checked against the Solidity and the other eight were
memory — which is exactly how the one wrong flag got in: `onchain` carried
`classic`'s values for the five rules added after it was written, and the
winning square was one of them. Each field is now read off the contract, or
recorded as one the contract cannot express and why. `turnCooldownMs`,
`cooldownFrom` and `refusedThrowStartsCooldown` are the last kind: a contract
keeps no clock, `block.timestamp` is stamped onto a report and consulted by
nothing that decides whether a throw is allowed.

## Where it diverges, permanently

Two differences from `classic`, both in deployed bytecode and therefore fixed.
They are described by the `onchain` ruleset, not treated as bugs.

**Read out of the source, not remembered here.** `parseSixes` and `compareSixes`
in `src/verify.ts` take both differences off `LeelaGame.sol` the way
`parseContract` takes the board, and `tests/a-run-of-sixes.test.ts` checks each
reading against a source edited to say something else. What follows describes
what they compute; if the two ever disagree, the tests are the ones to believe.

**The entering six counts as the first of a run.** On entry the contract sets
`consecutiveSixes = 1`; the engine leaves it at `0`. On chain, two more sixes
after entering trigger the reset — one throw sooner than anywhere else.

**The fallback square is overwritten on every six.** The engine records it only
when a run begins:

```ts
newBeforeThreeSixes: consecutive === 0 ? currentLoka : positionBeforeThreeSixes
```

The contract assigns it unconditionally inside `if (roll == MAX_ROLL)`, and it
does so at the top of the very call that reads it back:

```solidity
player.positionBeforeThreeSixes = player.plan;
player.consecutiveSixes += 1;
if (player.consecutiveSixes == 3) {
  player.plan = player.positionBeforeThreeSixes;   // the square they are on
  player.consecutiveSixes = 0;
  return;
}
```

So `plan = positionBeforeThreeSixes` is `plan = plan`: **the on-chain reset
cannot move anybody.** It spends the throw and leaves the player standing where
they were. Saying it *returns the player to where the third six began* was true
and read as though a move happened. The engine under `threeSixesReset` walks
them back to where the run began — four sixes from the start put a player on
plan 14 and then return them to plan 6.

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
