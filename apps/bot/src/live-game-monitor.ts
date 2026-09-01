/** Pure verdict for the signed production game/sync probe. */

import { hasWon, type GameState } from '@leela/engine';

export type LiveGameState = 'passing' | 'failing' | 'unknown';

export interface ExpectedLiveGame {
  plan: number;
  language: string;
  moved: number;
  entitled: boolean;
  canSubscribe: boolean;
}

export interface LiveGameObservation {
  expected: ExpectedLiveGame | null;
  signed: { status: number; body: unknown } | null;
  badSignatureStatus: number | null;
  foreignOriginStatus: number | null;
}

export interface LiveGameVerdict {
  state: LiveGameState;
  why: string;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Compare public signed state with durable state, and both negative doors. */
export function liveGameVerdict(observation: LiveGameObservation): LiveGameVerdict {
  if (observation.expected === null) {
    return { state: 'unknown', why: 'no active seated player exists to probe' };
  }

  // A completed request that proves a broken or open boundary must dominate a
  // simultaneous timeout. UNKNOWN means no conclusion was possible, not that
  // a known 403/200 can be hidden by one request that did not answer.
  if (observation.signed !== null && observation.signed.status !== 200) {
    return {
      state: 'failing',
      why: `the valid signed game read answered ${observation.signed.status}, expected 200`,
    };
  }
  if (observation.badSignatureStatus !== null && observation.badSignatureStatus !== 401) {
    return {
      state: 'failing',
      why: `the bad-signature read answered ${observation.badSignatureStatus}, expected 401`,
    };
  }
  if (observation.foreignOriginStatus !== null && observation.foreignOriginStatus !== 403) {
    return {
      state: 'failing',
      why: `the foreign-origin read answered ${observation.foreignOriginStatus}, expected 403`,
    };
  }
  if (
    observation.signed === null ||
    observation.badSignatureStatus === null ||
    observation.foreignOriginStatus === null
  ) {
    return { state: 'unknown', why: 'one or more production requests did not answer' };
  }

  const served = record(observation.signed.body);
  const state = record(served?.state);
  if (served === null || state === null) {
    return { state: 'failing', why: 'the signed 200 carried no complete game state' };
  }

  const expected = observation.expected;
  const shape =
    typeof served.plan === 'number' &&
    typeof state.loka === 'number' &&
    typeof served.language === 'string' &&
    typeof served.moved === 'number' &&
    typeof served.entitled === 'boolean' &&
    typeof served.canSubscribe === 'boolean';
  if (!shape) return { state: 'failing', why: 'the signed 200 carried malformed game fields' };

  if (served.plan !== state.loka) {
    return { state: 'failing', why: 'the served plan and engine state disagree' };
  }
  if (
    served.plan !== expected.plan ||
    served.language !== expected.language ||
    served.moved !== expected.moved ||
    served.entitled !== expected.entitled ||
    served.canSubscribe !== expected.canSubscribe
  ) {
    return { state: 'failing', why: 'the served game disagrees with durable state or access' };
  }

  return {
    state: 'passing',
    why: `signed game matches durable plan ${expected.plan}; invalid signature is 401 and foreign origin is 403`,
  };
}

export function liveGameExitCode(state: LiveGameState): 0 | 1 | 2 {
  return state === 'passing' ? 0 : state === 'failing' ? 1 : 2;
}

/** Accept only a self-consistent inner verdict; every adapter failure is 2. */
export function liveGameRemoteExitCode(status: number | null, output: string): 0 | 1 | 2 {
  const expected = status === 0 ? 'PASS' : status === 1 ? 'FAIL' : status === 2 ? 'UNKNOWN' : null;
  if (expected === null) return 2;
  const verdicts = output
    .split(/\r?\n/)
    .filter((line) => /^(PASS|FAIL|UNKNOWN) — /.test(line));
  if (verdicts.length !== 1 || !verdicts[0]?.startsWith(`${expected} — `)) return 2;
  if (status === 0) return 0;
  if (status === 1) return 1;
  return 2;
}

/** Waiting to enter is active; reaching 68 after play is complete. */
export function liveGamePlayerIsActive(player: GameState): boolean {
  return !hasWon(player);
}
