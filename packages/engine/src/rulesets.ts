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
  readonly id: 'classic' | 'neuroleela' | 'legacy-mobile' | 'online' | 'onchain';
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
 * rather than treated as a bug to fix. It is the only implementation that ever
 * enforced the report gate — `require(..., 'You must create a report before
 * rolling the dice.')` — which is the evidence that the gate belongs to the
 * game and not to one app's product decisions.
 *
 * Two ways it differs from `classic`, both recorded in `contracts/README.md`:
 *
 *   - the six that enters the game is counted as the first of a run, so two
 *     more sixes trigger the reset;
 *   - `positionBeforeThreeSixes` is overwritten on *every* six, so a third six
 *     returns the player to where the third six began rather than the first.
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

export const RULESETS = Object.freeze({
  classic: CLASSIC,
  neuroleela: NEUROLEELA,
  'legacy-mobile': LEGACY_MOBILE,
  online: ONLINE,
  onchain: ONCHAIN,
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
