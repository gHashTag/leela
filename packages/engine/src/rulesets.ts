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
