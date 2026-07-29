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
  readonly id: 'classic' | 'neuroleela' | 'legacy-mobile';
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
}

/** Traditional Leela: both halves of the six rule. Use for anything new. */
export const CLASSIC: RuleSet = Object.freeze({
  id: 'classic',
  extraTurnOnSix: true,
  threeSixesReset: true,
  rerollOnRepeat: false,
});

/** What NeuroLeela (Expo) shipped: reset on three sixes, no extra turn. */
export const NEUROLEELA: RuleSet = Object.freeze({
  id: 'neuroleela',
  extraTurnOnSix: false,
  threeSixesReset: true,
  rerollOnRepeat: false,
});

/** What the published mobile app shipped: extra turn, no reset, re-roll on repeat. */
export const LEGACY_MOBILE: RuleSet = Object.freeze({
  id: 'legacy-mobile',
  extraTurnOnSix: true,
  threeSixesReset: false,
  rerollOnRepeat: true,
});

export const RULESETS = Object.freeze({
  classic: CLASSIC,
  neuroleela: NEUROLEELA,
  'legacy-mobile': LEGACY_MOBILE,
});

/**
 * Default for the unified engine.
 *
 * NEUROLEELA, not CLASSIC: it is what the most recent code plays, so nothing
 * changes for current players by adopting the engine. Move surfaces to
 * CLASSIC as a deliberate, announced change.
 */
export const DEFAULT_RULESET: RuleSet = NEUROLEELA;

export function ruleSetById(id: RuleSet['id']): RuleSet {
  return RULESETS[id];
}
