/**
 * A game the published app kept, as a state this engine can play.
 *
 * `apps/mobile` is meant to succeed the published application and carries its
 * identity in a release build — two apps with one identifier are one app to
 * iOS, so the update installs *over* it. Both keep their data in AsyncStorage,
 * deliberately: `device.ts` says *same dependency, same place on the device, so
 * a phone that has played the old app and the new one is not keeping two
 * unrelated things in two unrelated ways*.
 *
 * Nothing read the old one. A player who had climbed to plan 41 offline would
 * have updated the app and found themselves back on the waiting square, with
 * their own history sitting in the same store under a key nobody opened. That
 * is this repository's oldest defect, on the one path where it happens to
 * somebody who never asked for a migration.
 *
 * The rule itself was already written, in `packages/db` for the Firebase
 * documents: the same four facts, because the offline store keeps per seat what
 * a user document keeps per person. It lives here so that both read it rather
 * than each having a copy — the phone cannot import `packages/db`, which is a
 * database driver, and the rule is about a state rather than a row.
 */

import { WIN_LOKA } from './board';
import type { Direction, GameState } from './types';

/** One move as the published app wrote it. */
export interface KeptStep {
  plan: number;
  /** The die value that produced this entry. */
  count?: number;
  createDate?: number;
  /** `start`, `cube`, `snake`, `arrow`, `liberation`. */
  status?: string;
}

/**
 * What the published app knows about one player, wherever it keeps it.
 *
 * Four facts. Firebase spells them on a user document and the offline store
 * spells them across four parallel arrays, one entry per seat, and they are the
 * same four.
 */
export interface KeptPlayer {
  /** Current plan, 1..72. */
  plan: number;
  /** True once they have entered the game with a six. */
  start: boolean;
  /** True once they have reached Cosmic Consciousness. */
  finish: boolean;
  history?: ReadonlyArray<KeptStep>;
}

/** The most recent step, or undefined for somebody who never rolled. */
function latest(history: ReadonlyArray<KeptStep> | undefined, back = 0): KeptStep | undefined {
  if (!Array.isArray(history) || history.length <= back) return undefined;
  // The app unshifts, so index 0 is newest — but do not trust it; sort.
  return [...history].sort((a, b) => (b.createDate ?? 0) - (a.createDate ?? 0))[back];
}

/** Where the player stood before their current plan. */
function previousPlan(player: KeptPlayer): number {
  return latest(player.history, 1)?.plan ?? player.plan;
}

/** A legacy history status as a direction. */
function directionOf(status: string | undefined): Direction | '' {
  switch (status) {
    case 'snake':
      return 'snake 🐍';
    case 'arrow':
      return 'arrow 🏹';
    case 'liberation':
      return 'win 🕉';
    case 'cube':
      return 'step 🚶🏼';
    default:
      // 'start', or anything a future export adds.
      return '';
  }
}

/** Whether this is a player the published app could have written. */
export function isKeptPlayer(value: unknown): value is KeptPlayer {
  if (typeof value !== 'object' || value === null) return false;
  const player = value as Record<string, unknown>;

  return (
    Number.isInteger(player.plan) &&
    (player.plan as number) >= 1 &&
    (player.plan as number) <= 72 &&
    typeof player.start === 'boolean' &&
    typeof player.finish === 'boolean'
  );
}

/**
 * The state this engine would be in, given what the published app kept.
 *
 * The old app tracks *in the game* with a separate `start` flag, while the
 * engine folds that into `is_finished`: a player is out of play when they sit
 * on the win square, whether that is before their first game or after they won
 * one.
 */
export function stateFromKept(player: KeptPlayer): GameState {
  // A player who has not started, or who has finished, is out of play.
  const outOfPlay = !player.start || player.finish;

  return {
    loka: outOfPlay ? WIN_LOKA : player.plan,
    previous_loka: previousPlan(player),
    direction: directionOf(latest(player.history)?.status),
    // The published app has no three-sixes rule, so there is no run to carry.
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: outOfPlay,
  };
}
