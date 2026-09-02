import { describe, expect, it } from 'vitest';
import {
  ACQUISITION_SOURCES,
  acquisitionFromMiniApp,
  acquisitionFromStart,
  attributeAcquisition,
  mainMiniAppUrl,
} from '../src/acquisition';
import { MemoryAcquisitionStore, type AcquisitionStore } from '../src/store';

describe('closed first-touch acquisition vocabulary', () => {
  it('distinguishes every owned Telegram entry surface and refuses invented labels', () => {
    expect(ACQUISITION_SOURCES).toEqual(['direct', 'public', 'guest', 'inline', 'mini_app']);
    expect(acquisitionFromStart(undefined)).toEqual({ source: 'direct', campaign: null });
    expect(acquisitionFromStart('guest')).toEqual({ source: 'guest', campaign: null });
    expect(acquisitionFromStart('inline')).toEqual({ source: 'inline', campaign: null });
    expect(acquisitionFromStart('public_k4f')).toEqual({ source: 'public', campaign: 'k4f' });
    expect(acquisitionFromStart('somebody_else')).toEqual({ source: 'direct', campaign: null });

    expect(acquisitionFromMiniApp(undefined)).toEqual({ source: 'mini_app', campaign: null });
    expect(acquisitionFromMiniApp('guest')).toEqual({ source: 'guest', campaign: null });
    expect(acquisitionFromMiniApp('inline')).toEqual({ source: 'inline', campaign: null });
    expect(acquisitionFromMiniApp('public_k4f')).toEqual({ source: 'public', campaign: 'k4f' });
    expect(acquisitionFromMiniApp('not_ours')).toEqual({ source: 'direct', campaign: null });
    expect(acquisitionFromMiniApp(null, false)).toEqual({ source: 'direct', campaign: null });
  });

  it('builds only bounded Main Mini App links', () => {
    expect(mainMiniAppUrl('leela_test_bot')).toBe('https://t.me/leela_test_bot?startapp=main');
    expect(mainMiniAppUrl('@leela_test_bot', 'guest')).toBe(
      'https://t.me/leela_test_bot?startapp=guest',
    );
    expect(() => mainMiniAppUrl('bad', 'guest')).toThrow();
    expect(() => mainMiniAppUrl('leela_test_bot', 'not ours')).toThrow();
  });
});

describe('first touch wins without entering gameplay', () => {
  it('keeps one source however often Telegram retries or another surface follows', async () => {
    const store = new MemoryAcquisitionStore();
    await store.record('player', { source: 'public', campaign: 'k4f', startedAt: 100 });
    await store.record('player', { source: 'inline', campaign: null, startedAt: 200 });

    expect(await store.of('player')).toEqual({
      source: 'public',
      campaign: 'k4f',
      startedAt: 100,
    });
  });

  it('logs neither the player nor the storage error and never throws through start', async () => {
    const store: AcquisitionStore = {
      async record() {
        throw new Error('private-player and database-path');
      },
      async of() {
        return null;
      },
    };
    const logs: string[] = [];

    await expect(
      attributeAcquisition({
        store,
        userId: 'private-player',
        attribution: { source: 'guest', campaign: null },
        at: 100,
        log: (line) => logs.push(line),
      }),
    ).resolves.toBe(false);

    expect(logs).toEqual(['[acquisition] guest first touch could not be recorded.']);
    expect(logs.join(' ')).not.toMatch(/private-player|database-path/);
  });
});
