/**
 * Dice.
 *
 * A game played across devices, or replayed for an audit, needs a die whose
 * values can be reproduced and verified. `Math.random()` gives neither, so the
 * engine ships a small seeded generator alongside it and lets the caller choose.
 */

import { MAX_ROLL } from './board';
import type { DiceRoller } from './types';

/** Throw a fair die using the platform's RNG. Not reproducible. */
export const rollDie: DiceRoller = () => Math.floor(Math.random() * MAX_ROLL) + 1;

/**
 * A deterministic die.
 *
 * Same seed, same sequence, on every platform and in every JS engine — which
 * is what makes a game replayable from its seed alone, and what lets a server
 * and a client agree on a roll without trusting each other.
 *
 * Uses mulberry32: 32-bit state, good enough distribution for six faces, and
 * short enough to port to Solidity or Swift when a surface needs to verify.
 */
export function seededRoller(seed: number): DiceRoller {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * MAX_ROLL) + 1;
  };
}

/**
 * A die that re-rolls once when it repeats the previous value.
 *
 * This is what the published mobile app does. It is not a traditional rule and
 * it distorts the distribution — most visibly, it makes three sixes in a row
 * nearly impossible. Kept so the `legacy-mobile` variant can be reproduced
 * exactly; do not reach for it in new work.
 */
export function noRepeatRoller(source: DiceRoller = rollDie): DiceRoller {
  let previous: number | null = null;
  return () => {
    let value = source();
    if (value === previous) value = source();
    previous = value;
    return value;
  };
}

/** Take `count` values from a roller. Handy for seeding a replay. */
export function rollMany(roller: DiceRoller, count: number): number[] {
  return Array.from({ length: count }, () => roller());
}
