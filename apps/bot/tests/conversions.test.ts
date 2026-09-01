import { describe, expect, it } from 'vitest';
import { attributeConversion } from '../src/conversions';
import { MemoryNudgeStore, type NudgeStore } from '../src/store';

describe('privacy-minimal daily-word attribution', () => {
  it('records an aggregate event without putting the player in the log', async () => {
    const nudges = new MemoryNudgeStore();
    await nudges.record('private-player-id', { at: 100, excerpt: 0 });
    const said: string[] = [];

    await expect(
      attributeConversion({
        nudges,
        userId: 'private-player-id',
        kind: 'response',
        at: 101,
        log: (line) => said.push(line),
      }),
    ).resolves.toBe(true);

    expect(said).toEqual([]);
    expect(said.join(' ')).not.toContain('private-player-id');
  });

  it('cannot interrupt play when metrics storage fails', async () => {
    const broken: NudgeStore = {
      async of() {
        throw new Error('unused');
      },
      async record() {},
      async convert() {
        throw new Error('database unavailable for private-player-id');
      },
      async setQuieted() {},
    };
    const said: string[] = [];

    await expect(
      attributeConversion({
        nudges: broken,
        userId: 'private-player-id',
        kind: 'roll',
        at: 101,
        log: (line) => said.push(line),
      }),
    ).resolves.toBe(false);

    expect(said.join(' ')).toContain('roll conversion could not be recorded');
    expect(said.join(' ')).not.toContain('private-player-id');
  });

  it('cannot interrupt play when both metrics storage and its logger fail', async () => {
    const broken: NudgeStore = {
      async of() {
        throw new Error('unused');
      },
      async record() {},
      async convert() {
        throw new Error('database unavailable');
      },
      async setQuieted() {},
    };

    await expect(
      attributeConversion({
        nudges: broken,
        userId: 'private-player-id',
        kind: 'roll',
        at: 101,
        log: () => {
          throw new Error('logger unavailable');
        },
      }),
    ).resolves.toBe(false);
  });
});
