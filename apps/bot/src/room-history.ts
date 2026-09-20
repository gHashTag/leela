import { advance, createSession, rollerFor, seededRoller } from '@leela/engine';
import type { Room } from './commands';

export interface RoomHistory {
  rolls: number[][];
  moves: number[];
  lastThrower: number | null;
}

/** Replay the room once for every piece of derived per-seat history. */
export function roomHistory(room: Room): RoomHistory {
  let replayed = createSession(
    room.session.id,
    room.session.players.map(({ id, name }) => ({ id, ...(name ? { name } : {}) })),
    room.session.rules,
  );
  const rolls = replayed.players.map(() => [] as number[]);
  const moves = replayed.players.map(() => 0);
  const die = rollerFor(room.session.rules, seededRoller(room.seed));
  let lastThrower: number | null = null;

  for (let taken = 0; taken < room.rollsTaken; taken += 1) {
    const value = die();
    lastThrower = replayed.turnIndex;
    rolls[lastThrower]?.push(value);
    // Reports are private records and are deliberately not in the room's dice
    // history. During replay, mark the current landing accounted for so the
    // engine can reach the next recorded throw without inventing report text.
    // The deterministic die and movement remain the things reconstructed.
    if (replayed.players[lastThrower]?.reportSubmitted === false) {
      replayed = {
        ...replayed,
        players: replayed.players.map((player, at) => at === lastThrower
          ? { ...player, reportSubmitted: true, lastReportAt: taken * 60_000 }
          : player),
      };
    }
    const advanced = advance(replayed, value, (taken + 1) * 60_000);
    if (advanced.event.from !== advanced.event.to) moves[lastThrower] = (moves[lastThrower] ?? 0) + 1;
    replayed = advanced.session;
  }

  return { rolls, moves, lastThrower };
}
