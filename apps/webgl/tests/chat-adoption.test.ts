import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { blank } from '../../../scripts/lib/source.mjs';

/**
 * The chat game arrives after the local game has already painted once.
 * Replacing `session` is therefore only half an adoption: every visible fact
 * that was derived from the old session must be repainted in the same block.
 */
describe('an adopted chat game replaces the whole rendered local game', () => {
  const source = blank(
    readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'),
  );

  const adoptionStart = source.indexOf('chatGame = launch');
  const adoption = source.slice(adoptionStart, source.indexOf('\n});', adoptionStart));

  it('clears every transient local move fact before painting the chat state', () => {
    expect(adoption).toContain('session = { ...session, players: [{ ...session.players[0]!, state }] }');
    expect(adoption).toContain('rolls = [[]]');
    expect(adoption).toContain('lastThrower = null');
    expect(adoption).toContain('stillMoving = false');
    expect(adoption).toContain('showFace(RESTING_FACE, true, false)');
  });

  it('replaces every surface that already rendered the former local plan', () => {
    for (const authority of [
      'companion.reset({ retry: true })',
      'companion.arrived(',
      'showStanding(null)',
      'if (visiting !== null) stopVisiting()',
      'showLotus()',
      'showPlanText(state.loka)',
      'showThread()',
      'showPath()',
      'showGate()',
      'settle()',
    ]) {
      expect(adoption, `${authority} is absent from the successful adoption repaint`).toContain(authority);
    }

    expect(adoption).not.toContain('placeSeats()');
    expect(adoption.indexOf('companion.reset({ retry: true })')).toBeLessThan(adoption.indexOf('companion.arrived('));
    expect(adoption.indexOf('session =')).toBeLessThan(adoption.indexOf('showStanding(null)'));
  });

  it('imports chat payment access only after every adoption guard accepts the game', () => {
    const bridgeStart = source.indexOf('void myGame(');
    const bridge = source.slice(bridgeStart, adoptionStart);
    const access = bridge.indexOf('rememberChatAccess(mine.standing)');

    expect(access).toBeGreaterThan(bridge.indexOf("if (state === undefined)"));
    expect(access).toBeGreaterThan(bridge.indexOf('if (session.players.length !== 1)'));
    expect(access).toBeGreaterThan(bridge.indexOf('if (busy) return'));
    expect(access).toBeGreaterThan(bridge.indexOf('alignWithChat('));
  });

  it('makes the standing renderer authoritative for visible and accessible progress', () => {
    const standingStart = source.indexOf('const showStanding =');
    const standing = source.slice(standingStart, source.indexOf('\n};', standingStart));

    expect(standing).toContain("el.progress.setAttribute('aria-label', standing.progressLabel)");
  });
});
