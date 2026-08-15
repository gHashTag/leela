/**
 * Rule variants.
 *
 * The two shipped generations of the game disagree about what a six means,
 * and each implements one half of the traditional rule:
 *
 *   - leela v6.5.1 (`com.leelagame`, Google Play versionCode 77) grants an
 *     extra throw on a six and has no three-sixes rule at all.
 *   - NeuroLeela (Expo/Inngest) sends the player back on a third consecutive
 *     six and never grants an extra throw.
 *
 * Traditional Leela has both: a six lets you throw again, and three sixes in
 * a row burn the run and return you to where it started. `classic` is that
 * complete rule. The other two variants exist so live players are not handed
 * a different game overnight — pick per surface, migrate deliberately.
 */

export interface RuleSet {
  /** Identifier persisted alongside a game so old games stay reproducible. */
  readonly id: 'classic' | 'neuroleela' | 'legacy-mobile' | 'online' | 'onchain' | 'telegram';
  /** A six lets the player throw again instead of passing the turn. */
  readonly extraTurnOnSix: boolean;
  /** Three sixes in a row return the player to where the run began. */
  readonly threeSixesReset: boolean;
  /**
   * Re-roll when the die repeats the previous value.
   * The shipped mobile app does this; it is not a traditional rule and it
   * skews the distribution, so only `legacy-mobile` keeps it.
   */
  readonly rerollOnRepeat: boolean;
  /**
   * A player must file a report on the plan they are standing on before they
   * may roll again. This is the practice the game exists for, not a nicety.
   */
  readonly requireReportBeforeRoll: boolean;
  /**
   * Minimum time between rolls, in milliseconds. 0 for no cooldown.
   * The published app used a day for online games and none offline.
   */
  readonly turnCooldownMs: number;
  /**
   * Whether arriving on a six owes a report and starts the cooldown.
   *
   * The published app's `createHistory` gates on `values.count !== 6`: a six
   * writes its history and nothing else, so the player throws again with no
   * reflection and no day's wait. Only a throw of one to five closes the gate.
   *
   * That is the whole point of the extra turn there — a run of sixes is one
   * move, reported once, at the end of it. Traditional Leela treats every
   * arrival alike, so `classic` says true.
   */
  readonly reportAfterSix: boolean;
  /**
   * Whether a throw that could not be made starts the cooldown.
   *
   * `entities` returns nothing when the throw would overshoot 72, so
   * `createHistory` never runs and the day never begins. A player who cannot
   * move is not made to wait for the privilege.
   */
  readonly refusedThrowStartsCooldown: boolean;
  /**
   * Whether a player who has won may enter again with a six.
   *
   * `stepCount === 6 && !isFinished` — the published app will not let them.
   * The game is over and starting another is a deliberate act, which is what
   * its "Start over" button is for.
   */
  readonly mayReenterAfterWinning: boolean;
  /**
   * When the wait between rolls begins.
   *
   * `'roll'` measures from the throw. `'report'` measures from the moment the
   * player wrote about where they landed — which is what the published app
   * does: `startStepTimer` sets `lastStepTime` and is called from one place,
   * `CreatePost`, when the report is posted. A player who takes three days to
   * write still waits a day afterwards, and the day is for sitting with what
   * they wrote rather than for the throw.
   */
  readonly cooldownFrom: 'roll' | 'report';
  /**
   * The shortest thing that counts as a report, in characters.
   *
   * The published app refuses fewer than a hundred: `yup.string().min(100)` in
   * `CreatePost`. It is a product decision rather than a traditional rule, so
   * `classic` asks only that something was written.
   */
  readonly minReportChars: number;
  /**
   * Whether the winning square owes a report.
   *
   * The published app makes one exception to its own six rule —
   * `if (stepCount !== 6 || plan === 68)` navigates to the plan with
   * `report: true` — so Cosmic Consciousness is always written about there.
   *
   * The deployed contract cannot ask for one. Its gate is
   * `if (player.isStart) require(reports[reportIdCounter].reporter == msg.sender)`,
   * and `movePlayer` sets `isStart = false` the moment the player lands on 68 —
   * which also makes `createReport` revert with "You must start the game before
   * creating a report." On chain the winner neither owes a report nor can file
   * one, and a variant that demanded one would lock them out of beginning
   * again.
   *
   * This flag exists because that reading was got wrong once: the win was made
   * to owe a report everywhere, on the strength of "the contract requires a
   * report before every roll in play" — true, and not true of a player the
   * contract has just taken out of play.
   */
  readonly reportOnWinningSquare: boolean;
}

/**
 * Traditional Leela: both halves of the six rule, and the reflection the game
 * exists for. Use for anything new.
 */
export const CLASSIC: RuleSet = Object.freeze({
  id: 'classic',
  extraTurnOnSix: true,
  threeSixesReset: true,
  rerollOnRepeat: false,
  requireReportBeforeRoll: true,
  turnCooldownMs: 0,
  // Every arrival is an arrival: a six is a square you are standing on.
  reportAfterSix: true,
  refusedThrowStartsCooldown: true,
  mayReenterAfterWinning: true,
  cooldownFrom: 'roll',
  minReportChars: 0,
  reportOnWinningSquare: true,
});

/** What NeuroLeela (Expo) shipped: reset on three sixes, no extra turn. */
export const NEUROLEELA: RuleSet = Object.freeze({
  id: 'neuroleela',
  extraTurnOnSix: false,
  threeSixesReset: true,
  rerollOnRepeat: false,
  // NeuroLeela's schema carried `needs_report` and nothing ever enforced it.
  // This monorepo reproduced that for a while: see `canPlayerRoll` in
  // `@leela/db`, which is where the flag is finally read.
  requireReportBeforeRoll: false,
  turnCooldownMs: 0,
  reportAfterSix: true,
  refusedThrowStartsCooldown: true,
  mayReenterAfterWinning: true,
  cooldownFrom: 'roll',
  minReportChars: 0,
  reportOnWinningSquare: true,
});

/** What the published mobile app shipped: extra turn, no reset, re-roll on repeat. */
export const LEGACY_MOBILE: RuleSet = Object.freeze({
  id: 'legacy-mobile',
  extraTurnOnSix: true,
  threeSixesReset: false,
  rerollOnRepeat: true,
  // Offline play was ungated; the online mode gated on both — see ONLINE below.
  requireReportBeforeRoll: false,
  turnCooldownMs: 0,
  // `store/helper.ts` and `screens/helper.ts`, read rather than remembered.
  reportAfterSix: false,
  refusedThrowStartsCooldown: false,
  mayReenterAfterWinning: false,
  // The day is measured from the report, and a hundred characters is what
  // `CreatePost` accepts. Offline play has no cooldown to start.
  cooldownFrom: 'report',
  minReportChars: 100,
  reportOnWinningSquare: true,
});

/**
 * The published app's online mode: a report before every roll, and a day
 * between rolls. The slowest and most faithful way the game has shipped.
 */
export const ONLINE: RuleSet = Object.freeze({
  id: 'online',
  extraTurnOnSix: true,
  threeSixesReset: false,
  rerollOnRepeat: true,
  requireReportBeforeRoll: true,
  turnCooldownMs: 86_400_000,
  // A six writes its history and nothing else: no report, no day's wait. The
  // day begins on the throw that ends the run.
  reportAfterSix: false,
  refusedThrowStartsCooldown: false,
  mayReenterAfterWinning: false,
  cooldownFrom: 'report',
  minReportChars: 100,
  reportOnWinningSquare: true,
});

/**
 * What `LeelaGame.sol` actually does, at
 * `0x2741CE9C9fA1c9B78b20cab7F07998d77846b7Af`.
 *
 * A deployed contract cannot be corrected, so its behaviour is described here
 * rather than treated as a bug to fix. It states the report gate in so many
 * words — `require(..., 'You must create a report before rolling the dice.')`.
 *
 * **RETRACTED: "It is the only implementation that ever stated the report
 * gate."** That sentence stood here, and in `packages/contracts/README.md`, in
 * `packages/contracts/tests/verify.test.ts` and in `MIGRATION.md`, and it is
 * false. MEASURED: the shipped Telegram bot stated it too, per player and with
 * a fifty-character minimum — its `make_step` handler discards the throw and
 * enters the report conversation at lines 78-90 while an account is owed, and
 * clears the flag at line 39 of its report conversation, after the row is
 * written. `TELEGRAM` below carries the citations and `scripts/audit-variants.mjs`
 * re-reads them. The sentence was repeated in four places and never checked
 * against the sixth implementation, which is what the retraction is for.
 *
 * The argument it was making survives the retraction stronger than it went in.
 * *Two independent implementations stated the gate* — one in Solidity, one in
 * TypeScript, neither aware of the other — which is better evidence that the
 * rule belongs to the game than one implementation was. And the bot's is the
 * faithful one: it gates **per player**, where this contract gates **per last
 * writer** (below), so what everybody reads the require to mean is what the
 * bot actually does and not what the chain does.
 *
 * **What it asks is not what it says.** The condition is
 * `reports[reportIdCounter].reporter == msg.sender`, and that counter is the
 * last report filed by *anybody* — so the question is *were you the last person
 * to write*, not *have you written about this square*. A lone player writes once
 * and may throw for the rest of the game. `requireReportBeforeRoll` is still the
 * nearest true thing to say about it, and `packages/contracts/tests/gate.test.ts`
 * holds the reading to the Solidity.
 *
 * Two ways it differs from `classic`. Both are now **read out of the Solidity**
 * by `parseSixes` in `packages/contracts`, rather than described here and
 * nowhere else — the board in that same file had been parsed and asserted since
 * the beginning, and these two sat beside it in prose:
 *
 *   - the six that enters the game is counted as the first of a run, so two
 *     more sixes trigger the reset;
 *   - `positionBeforeThreeSixes` is written on *every* six, at the top of the
 *     same call that reads it back — so `plan = positionBeforeThreeSixes` is
 *     `plan = plan`, and the on-chain reset **cannot move anybody**. It spends
 *     the throw. This flag says the variant has the reset, and on chain the
 *     reset is a throw lost and nothing more.
 *
 * Neither is expressible as a flag, so anything reading this variant should
 * consult the contract for a move it needs to reproduce exactly.
 */
export const ONCHAIN: RuleSet = Object.freeze({
  id: 'onchain',
  extraTurnOnSix: false,
  threeSixesReset: true,
  rerollOnRepeat: false,
  requireReportBeforeRoll: true,
  turnCooldownMs: 0,
  reportAfterSix: true,
  refusedThrowStartsCooldown: true,
  mayReenterAfterWinning: true,
  cooldownFrom: 'roll',
  minReportChars: 0,
  reportOnWinningSquare: false,
});

/**
 * What the shipped Telegram bot plays.
 *
 * The sixth implementation and the one that had no variant. It is the reason
 * the retraction above exists: the bot stated the report gate too, per player,
 * with a length on it, and four files said the contract was the only one that
 * ever did. Everything below is MEASURED at the donor, with line numbers,
 * because the sentence it replaces was repeated on nobody's reading.
 *
 * **The gate, and it is stated.** `leela-chakra-bot/src/index.ts:64` throws the
 * die at the top of the `make_step` handler. `:78` then asks
 * `if (user.isWrite)` and, when the player owes an account, re-sends the plan
 * they are standing on, enters the report conversation and returns — so the
 * throw is discarded and `gameStep` at `:127` is never reached while a report
 * is owed. The flag is cleared in exactly one place,
 * `leela-chakra-bot/src/commands/report/index.ts:39`, after `updateHistory`
 * has written the row.
 *
 * **It is per player, which is the stronger form.** `isWrite` is a column on
 * the *user*, so the question the bot asks is *do you owe an account for the
 * square you are standing on*. The contract's
 * `reports[reportIdCounter].reporter == msg.sender` asks *were you the last
 * person to write*, which a lone player satisfies once and then forever. Same
 * rule, two implementations; only one of them means it.
 *
 * **Fifty characters is the bot's own bar.**
 * `leela-chakra-bot/src/commands/report/index.ts:17-22` refuses on
 * `report?.length < 50` and says so to the player. Two things measured while
 * reading it, neither of which changes the flag:
 *
 *   - the sentence shown says *longer than 50 characters* and the condition
 *     accepts exactly fifty, so the donor's own message is off by one;
 *   - the length is taken from the raw text. `countsAsReport` trims first, so
 *     fifty spaces are an account to the donor and are not one here. That is
 *     a deliberate divergence: a gate opened by whitespace is the rule with
 *     its point removed, and no variant in this file reproduces one.
 *
 * **MEASURED DEFECT OF THE DONOR — the gate is armed at one of the two
 * paths.** `isWrite: true` is set at `leela-chakra-bot/src/index.ts:163`, and
 * `:156-160` returns before it whenever the plan carries a picture: the photo
 * goes out, the report conversation is entered, and the flag is never written.
 * So a player standing on an illustrated square is told in bold that *the game
 * will not continue* until they write, and may then throw again without
 * writing — the next press finds `isWrite` unset and rolls. The bold sentence
 * is true for pictureless squares only. `grep -rn isWrite src/` returns three
 * sites in the donor and that is all of them: `:78` reads it, `:163` sets it,
 * `commands/report/index.ts:39` clears it. Recorded as the donor's defect, not
 * this repository's: the variant says what the rule *was*, and the surface
 * that plays it is a separate decision.
 *
 * **The board rules are unrecoverable, and here is the proof rather than the
 * excuse.** The donor computes no move.
 * `leela-chakra-bot/src/core/supabase/game.ts:15-20` hands the roll to
 * `supabase.functions.invoke("game-step")` and stores whatever comes back;
 * `grep -rn game-step` over all fifteen donor clones returns four call sites
 * and no definition anywhere. That is why `audit-copies` finds zero board
 * copies in this donor. So every flag below is one of three things, and which
 * one it is is stated rather than left to be guessed:
 *
 *   - **measured** in the bot's own code — `requireReportBeforeRoll`,
 *     `minReportChars`, `turnCooldownMs`, `rerollOnRepeat`, `reportAfterSix`,
 *     `mayReenterAfterWinning`, `reportOnWinningSquare`, `extraTurnOnSix`;
 *   - **indirect** — `threeSixesReset`, on the donor storing the result of a
 *     rule it does not itself compute;
 *   - **inert** — `refusedThrowStartsCooldown` and `cooldownFrom`, which
 *     decide nothing at all while `turnCooldownMs` is 0, and are marked as
 *     such below rather than passed off as readings.
 *
 * Nothing here is filled in from `CLASSIC`. That is the exact failure recorded
 * in `scripts/audit-variants.mjs`'s own header: `onchain` carried `classic`'s
 * value for all five flags added after it was written, and one of them was
 * wrong.
 */
export const TELEGRAM: RuleSet = Object.freeze({
  id: 'telegram',
  // MEASURED. `roll` appears at :64 (drawn), :127 (sent away) and twice inside
  // display strings, and nowhere else: the bot never branches on the value of
  // the throw. Whether the edge function grants another throw is unrecoverable,
  // but no extra throw could reach the player through this surface anyway —
  // the gate at :78 stands between every pair of presses.
  extraTurnOnSix: false,
  // INDIRECT, and the only flag here that is. `game.ts:35-36` writes
  // `consecutive_sixes` and `position_before_three_sixes` out of the edge
  // function's answer, so the rule exists upstream and this donor names it.
  // Which throw it fires on, and which square it returns to, are not in any
  // clone — `onchain` and `classic` disagree about exactly that, so this flag
  // says *the variant has the rule* and nothing finer.
  threeSixesReset: true,
  // MEASURED. `const roll = Math.floor(Math.random() * 6) + 1` at :64 is the
  // only die in the bot, and it is compared with nothing.
  rerollOnRepeat: false,
  // MEASURED, and the reason this variant exists: `if (user.isWrite)` at :78.
  requireReportBeforeRoll: true,
  // MEASURED. Nothing in the donor measures time between throws: no timer, no
  // stored last-roll time read back, no wait shown to anybody.
  turnCooldownMs: 0,
  // MEASURED. `:163` arms the gate after the throw with no exemption for a six
  // — there is no branch on the roll to hang one on.
  reportAfterSix: true,
  // INERT. There is no cooldown to start, so this flag decides nothing for
  // this variant. Stated so nobody reads it as a reading of the donor.
  refusedThrowStartsCooldown: true,
  // MEASURED. `is_finished` is written to the table at `game.ts:36` and read
  // by nothing, so the bot refuses nobody for having won. Whether the edge
  // function refuses them is unrecoverable; this surface does not.
  mayReenterAfterWinning: true,
  // INERT for the same reason as `refusedThrowStartsCooldown`: with no wait,
  // there is nothing to measure from.
  cooldownFrom: 'roll',
  // MEASURED. `report?.length < 50` at `commands/report/index.ts:17`.
  minReportChars: 50,
  // MEASURED. The gate exempts no square: the winning plan is not named
  // anywhere in the bot, and `:163` does not look at where the player landed.
  reportOnWinningSquare: true,
});

export const RULESETS = Object.freeze({
  classic: CLASSIC,
  neuroleela: NEUROLEELA,
  'legacy-mobile': LEGACY_MOBILE,
  online: ONLINE,
  onchain: ONCHAIN,
  telegram: TELEGRAM,
});

/**
 * Default for the unified engine.
 *
 * NEUROLEELA, not CLASSIC: it is what the most recent code plays, so nothing
 * changes for current players by adopting the engine. Move surfaces to
 * CLASSIC as a deliberate, announced change.
 */
export const DEFAULT_RULESET: RuleSet = NEUROLEELA;

/** Whether a string names a variant. For anything read from outside. */
export function isRuleSetId(value: string): value is RuleSet['id'] {
  return Object.prototype.hasOwnProperty.call(RULESETS, value);
}

/**
 * The variant with this id.
 *
 * Throws rather than returning `undefined` typed as a `RuleSet`. The signature
 * said this was total and it was not: a row in a database with `ruleset` set
 * to something no longer known returned undefined, and the chat it belonged to
 * then threw on `rules.reports` for every command anyone sent, forever. An
 * error naming the id is a thing an operator can act on; a `TypeError` three
 * calls away is not.
 *
 * Not silently falling back to `classic`: that would change the rules of a
 * game in progress without telling anybody.
 */
export function ruleSetById(id: RuleSet['id']): RuleSet {
  // Through the guard, not through truthiness: `RULESETS['toString']` is a
  // function inherited from `Object.prototype`, and a function typed as a
  // `RuleSet` is worse than the undefined this was written to catch.
  if (!isRuleSetId(id)) {
    throw new RangeError(
      `no rule set named "${id}" — known variants are ${Object.keys(RULESETS).join(', ')}`,
    );
  }
  return RULESETS[id];
}
