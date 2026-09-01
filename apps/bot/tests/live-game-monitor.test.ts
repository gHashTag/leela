import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLASSIC, applyRoll, initialState } from '@leela/engine';
import { blank } from '../../../scripts/lib/source.mjs';
import {
  liveGameExitCode,
  liveGamePlayerIsActive,
  liveGameRemoteExitCode,
  liveGameVerdict,
} from '../src/live-game-monitor';

const EXPECTED = {
  plan: 6,
  language: 'ru',
  moved: 3,
  entitled: false,
  canSubscribe: true,
};

const SERVED = {
  ...EXPECTED,
  waiting: false,
  won: false,
  state: {
    loka: 6,
    previous_loka: 1,
    direction: '',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
  },
};

const clean = {
  expected: EXPECTED,
  signed: { status: 200, body: SERVED },
  badSignatureStatus: 401,
  foreignOriginStatus: 403,
};

describe('the signed live-game verdict', () => {
  it('passes only when the public game is the durable game and both refusals have their exact shape', () => {
    const verdict = liveGameVerdict(clean);
    expect(verdict.state).toBe('passing');
    expect(verdict.why).toContain('plan 6');
    expect(liveGameExitCode(verdict.state)).toBe(0);
  });

  it.each([
    ['a valid signed read became 403', { ...clean, signed: { status: 403, body: {} } }],
    ['the top-level plan drifted', { ...clean, signed: { status: 200, body: { ...SERVED, plan: 11 } } }],
    ['the engine state drifted', { ...clean, signed: { status: 200, body: { ...SERVED, state: { ...SERVED.state, loka: 41 } } } }],
    ['the durable language drifted', { ...clean, signed: { status: 200, body: { ...SERVED, language: 'en' } } }],
    ['the free-move count drifted', { ...clean, signed: { status: 200, body: { ...SERVED, moved: 2 } } }],
    ['an unsigned caller entered', { ...clean, badSignatureStatus: 200 }],
    ['a foreign origin entered', { ...clean, foreignOriginStatus: 200 }],
  ])('fails when %s', (_name, observation) => {
    const verdict = liveGameVerdict(observation);
    expect(verdict.state).toBe('failing');
    expect(liveGameExitCode(verdict.state)).toBe(1);
  });

  it.each([
    ['there is no active player', { expected: null, signed: null, badSignatureStatus: 401, foreignOriginStatus: 403 }],
    ['Railway did not answer', { expected: EXPECTED, signed: null, badSignatureStatus: null, foreignOriginStatus: null }],
  ])('says cannot tell when %s', (_name, observation) => {
    const verdict = liveGameVerdict(observation);
    expect(verdict.state).toBe('unknown');
    expect(liveGameExitCode(verdict.state)).toBe(2);
  });

  it('fails closed on a malformed 200 instead of throwing or printing its body', () => {
    const verdict = liveGameVerdict({
      ...clean,
      signed: { status: 200, body: { plan: 'private-player-id' } },
    });

    expect(verdict.state).toBe('failing');
    expect(verdict.why).not.toContain('private-player-id');
  });

  it.each([
    [
      'a proven valid-request 403',
      { ...clean, signed: { status: 403, body: null }, badSignatureStatus: null },
    ],
    [
      'a proven bad-signature admission',
      { ...clean, signed: null, badSignatureStatus: 200 },
    ],
    [
      'a proven foreign-origin admission',
      { ...clean, signed: null, foreignOriginStatus: 200 },
    ],
  ])('does not let a simultaneous timeout hide %s', (_name, observation) => {
    expect(liveGameVerdict(observation).state).toBe('failing');
  });
});

describe('the Railway wrapper verdict', () => {
  it.each([
    [0, 'PASS — signed game matches durable state.\n', 0],
    [1, 'FAIL — the signed game is stale.\n', 1],
    [2, 'UNKNOWN — no active game.\n', 2],
  ])('keeps the three declared results distinct', (status, output, expected) => {
    expect(liveGameRemoteExitCode(status, output)).toBe(expected);
  });

  it.each([
    [255, ''],
    [42, 'FAIL — command did not produce its own exit.'],
    [1, 'ssh: connection failed'],
    [0, 'not a monitor verdict'],
    [0, 'FAIL — label and exit disagree.'],
  ])('normalizes an adapter failure to UNKNOWN', (status, output) => {
    expect(liveGameRemoteExitCode(status, output)).toBe(2);
  });
});

describe('the player selected for a production probe', () => {
  it('keeps a player waiting to enter and a player on the board in the active cohort', () => {
    expect(liveGamePlayerIsActive(initialState())).toBe(true);
    expect(liveGamePlayerIsActive(applyRoll(initialState(), 6, CLASSIC).state)).toBe(true);
  });

  it('excludes a player whose game has finished', () => {
    expect(
      liveGamePlayerIsActive({
        loka: 68,
        previous_loka: 67,
        direction: '',
        consecutive_sixes: 0,
        position_before_three_sixes: 0,
        is_finished: true,
      }),
    ).toBe(false);
  });
});

describe('the production image contract', () => {
  it('ships the Railway SSH monitor at the repository-relative path its wrapper invokes', () => {
    const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
    const runtime = dockerfile
      .split(/(?=^FROM )/gm)
      .find((stage) => /^FROM manifests AS runtime$/m.test(stage));
    const instructions = runtime
      ?.split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));

    expect(instructions).toContain(
      'COPY scripts/monitor-live-game.mjs scripts/monitor-live-game.mjs',
    );
  });

  it('uses the linked Railway target instead of a partial service override', () => {
    const monitor = blank(
      readFileSync(new URL('../../../scripts/monitor-live-game.mjs', import.meta.url), 'utf8'),
    );
    const manifest = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    );

    expect(monitor).toContain(
      "['ssh', 'bun', 'run', 'scripts/monitor-live-game.mjs', '--inside']",
    );
    expect(monitor).not.toContain("['ssh', '--service'");
    expect(manifest.scripts?.['monitor:live']).toBe('bun scripts/monitor-live-game.mjs');
  });
});
