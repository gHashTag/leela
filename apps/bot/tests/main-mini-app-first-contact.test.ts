import { describe, expect, it } from 'vitest';
import { roomForMiniApp } from '../src/main-mini-app';
import { MemoryRoomStore, type RoomStore } from '../src/store';

const who = {
  id: '100',
  name: 'Mina',
  language: 'ru',
  authAt: 1,
  startParam: 'main',
  startParamValid: true,
};

describe('Main Mini App first contact', () => {
  it('opens the same started private game a later bot command will find', async () => {
    const store = new MemoryRoomStore();
    const first = await roomForMiniApp({ who, store, now: () => 100 });
    const second = await roomForMiniApp({ who, store, now: () => 200 });

    expect(first?.started).toBe(true);
    expect(first?.language).toBe('ru');
    expect(first?.session.players.map((player) => player.id)).toEqual(['100']);
    expect(second).toEqual(first);
    expect(await store.get('100')).toEqual(first);
  });

  it('returns no game and logs no identity when durable storage refuses it', async () => {
    const store: RoomStore = {
      async get() {
        return null;
      },
      async roomOf() {
        return null;
      },
      async save() {
        throw new Error('failed for player 100');
      },
      async delete() {},
    };
    const logs: string[] = [];

    await expect(
      roomForMiniApp({ who, store, now: () => 100, log: (line) => logs.push(line) }),
    ).resolves.toBeNull();
    expect(logs).toEqual(['[miniapp] first-contact game could not be kept.']);
    expect(logs.join(' ')).not.toContain('100');
  });
});
