/**
 * The game the published app left on this phone.
 *
 * This app is meant to succeed the published one and carries its identity in a
 * release build — two apps with one identifier are one app to iOS, so the
 * update installs *over* it and inherits its storage. `device.ts` chose
 * AsyncStorage for exactly that reason: *same dependency, same place on the
 * device, so a phone that has played the old app and the new one is not keeping
 * two unrelated things in two unrelated ways.*
 *
 * And nothing read it. The published app keeps its offline game under one
 * AsyncStorage key, `OfflinePlayers`, written by `mobx-persist-store`:
 *
 * ```json
 * { "plans":  [41, 68, 68, 68, 68, 68],
 *   "start":  [true, false, false, false, false, false],
 *   "finish": [false, false, false, false, false, false],
 *   "histories": [[{ "createDate": 1700000000000, "plan": 41, "count": 3,
 *                    "status": "cube" }], …] }
 * ```
 *
 * Six seats, four parallel arrays. A player who had climbed to plan 41 would
 * have updated the app and found themselves back on the waiting square, with
 * their own history in the same store under a key nobody opened. That is the
 * defect this repository exists to have fixed once, arriving on the one path
 * where it happens to somebody who never asked for a migration.
 *
 * Pure over a string, so the whole of it is testable without a phone. What to
 * do with what it finds is the app's decision, in `App.tsx`.
 */

import { isKeptPlayer, stateFromKept, type GameState, type KeptPlayer } from '@leela/engine';

/** Where the published app keeps its offline game. Its store's own name. */
export const PUBLISHED_KEY = 'OfflinePlayers';

/** The most seats the published app offers, and the arrays it writes. */
const SEATS = 6;

export interface Inherited {
  /** Seat zero's game, which is the one this app can seat. */
  state: GameState;
  /**
   * Seats that were also in play and are not being carried across.
   *
   * This app seats one player; the published app seats six. Somebody who played
   * with their family has five other games on this phone, and being told that
   * is the difference between a loss and an absence — the distinction four
   * passes of this migration were spent on.
   */
  others: number;
}

/** Whether a seat was ever played, as opposed to sitting where everyone starts. */
function played(player: KeptPlayer): boolean {
  return player.start || player.finish || (player.history?.length ?? 0) > 1;
}

/**
 * Read the published app's offline game out of what AsyncStorage holds.
 *
 * Null where there is nothing to inherit: no key, not this app's shape, or six
 * seats that never entered a game. A fresh install of the published app writes
 * the key on first launch — `plans: [68 × 6]`, one `start` history entry each —
 * so *the key is there* is not the same as *somebody played*, and adopting the
 * opening position would tell a new player their game had been restored.
 */
export function inheritedGame(raw: string | null): Inherited | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const kept = parsed as Record<string, unknown>;

  const plans = kept.plans;
  const start = kept.start;
  const finish = kept.finish;
  const histories = Array.isArray(kept.histories) ? kept.histories : [];
  if (!Array.isArray(plans) || !Array.isArray(start) || !Array.isArray(finish)) return null;

  const seats: KeptPlayer[] = [];
  for (let seat = 0; seat < Math.min(SEATS, plans.length); seat += 1) {
    const player = {
      plan: plans[seat],
      start: start[seat],
      finish: finish[seat],
      history: Array.isArray(histories[seat]) ? histories[seat] : [],
    };

    // A seat the published app could not have written is a seat to leave alone
    // rather than to guess at: handing this engine a plan of 900 is worse than
    // handing it nothing.
    if (isKeptPlayer(player)) seats.push(player);
  }

  const inPlay = seats.filter(played);
  const [first] = inPlay;
  if (!first) return null;

  return { state: stateFromKept(first), others: inPlay.length - 1 };
}
