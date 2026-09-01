import { describe, expect, it } from 'vitest';
import { loadLanguage, messageFor } from '@leela/content';
import type { GameState } from '@leela/engine';
import { CLASSIC } from '@leela/engine';
import type { Room } from '../src/commands';
import { DirectChannels } from '../src/delivery';
import {
  createInitiative,
  type NudgeApi,
} from '../src/initiative';
import { MemoryNudgeStore, MemoryRoomStore } from '../src/store';

const NOW = Date.UTC(2026, 8, 1, 6);

function on(plan: number): GameState {
  return {
    loka: plan,
    previous_loka: 9,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
  };
}

function room(reportSubmitted: boolean): Room {
  return {
    chatId: 'table',
    session: {
      id: 'table',
      players: [
        {
          id: 'player',
          name: 'Player',
          state: on(12),
          lastRollAt: NOW - 60_000,
          lastReportAt: null,
          reportSubmitted,
        },
      ],
      turnIndex: 0,
      rules: CLASSIC,
      rollCount: 1,
    },
    seed: 1,
    rollsTaken: 1,
    language: 'ru',
    started: true,
    names: {},
  };
}

describe('the proactive companion', () => {
  it('uses the current plan without exporting private writing, then asks for the accepted action', async () => {
    await loadLanguage('ru');
    const store = new MemoryRoomStore();
    await store.save(room(false));

    const sent: string[] = [];
    const api: NudgeApi = {
      async sendMessage(_chatId, text) {
        sent.push(text);
        return {};
      },
    };

    const calls: unknown[] = [];
    const companion = {
      status: () => ({ available: true, skipped: 0 }),
      async engage(options: unknown) {
        calls.push(options);
        return { text: 'Что в этом плане просит сегодня честного внимания?', fromModel: true };
      },
    };
    const initiative = createInitiative({
      api,
      store,
      nudges: new MemoryNudgeStore(),
      channels: new DirectChannels(),
      launchUrl: 'https://example.com/leela',
      now: () => NOW,
      companion,
    });

    const summary = await initiative.runTick(NOW);

    expect(calls).toEqual([
      {
        language: 'ru',
        plan: 12,
        reportOwed: true,
      },
    ]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('Что в этом плане просит сегодня честного внимания?');
    expect(sent[0]).not.toContain('/roll');
    expect(sent[0]).toContain('Ответьте здесь');
    expect(summary.bridges).toEqual({ model: 1, canonical: 0 });
  });

  it('uses a localized canonical bridge and /roll when the report is already filed', async () => {
    await loadLanguage('ru');
    const store = new MemoryRoomStore();
    await store.save(room(true));
    const sent: string[] = [];

    const initiative = createInitiative({
      api: {
        async sendMessage(_chatId: string, text: string) {
          sent.push(text);
          return {};
        },
      },
      store,
      nudges: new MemoryNudgeStore(),
      channels: new DirectChannels(),
      launchUrl: 'https://example.com/leela',
      now: () => NOW,
    });

    const summary = await initiative.runTick(NOW);

    expect(sent[0]).toContain(messageFor('ru', 'nudge.agentRoll'));
    expect(sent[0]).toContain('/roll');
    expect(sent[0]).not.toContain(messageFor('ru', 'nudge.reportCta'));
    expect(summary.bridges).toEqual({ model: 0, canonical: 1 });
  });

  it('does not offer a refused roll for another turn, a cooldown, or a short report', async () => {
    await loadLanguage('ru');

    const anotherTurn = room(true);
    anotherTurn.session.players.push({
      id: 'holder',
      name: 'Holder',
      state: on(9),
      lastRollAt: NOW - 15 * 24 * 60 * 60 * 1_000,
      lastReportAt: null,
      reportSubmitted: true,
    });
    anotherTurn.session.turnIndex = 1;

    const cooling = room(true);
    cooling.session.rules = {
      ...CLASSIC,
      turnCooldownMs: 24 * 60 * 60 * 1_000,
      cooldownFrom: 'report',
    };
    cooling.session.players[0]!.lastReportAt = NOW - 1_000;

    const longReport = room(false);
    longReport.session.rules = { ...CLASSIC, minReportChars: 100 };

    const messages: string[] = [];
    for (const candidate of [anotherTurn, cooling, longReport]) {
      const store = new MemoryRoomStore();
      await store.save(candidate);
      const sent: string[] = [];
      const initiative = createInitiative({
        api: { async sendMessage(_chatId, text) { sent.push(text); return {}; } },
        store,
        nudges: new MemoryNudgeStore(),
        channels: new DirectChannels(),
        launchUrl: 'https://example.com/leela',
        now: () => NOW,
      });
      await initiative.runTick(NOW);
      messages.push(sent[0] ?? '');
    }

    expect(messages[0]).toContain(messageFor('ru', 'roll.notYourTurn', { name: 'holder' }));
    expect(messages[0]).not.toContain('/roll');
    expect(messages[1]).toContain('Следующий бросок через');
    expect(messages[1]).not.toContain('/roll');
    expect(messages[2]).toContain('100');
    expect(messages[2]).not.toContain('/roll');
  });

  it('does not read private context or call a cooling companion', async () => {
    await loadLanguage('ru');
    const store = new MemoryRoomStore();
    await store.save(room(true));
    let reads = 0;
    let calls = 0;
    const sent: string[] = [];

    const initiative = createInitiative({
      api: {
        async sendMessage(_chatId: string, text: string) {
          sent.push(text);
          return {};
        },
      },
      store,
      nudges: new MemoryNudgeStore(),
      channels: new DirectChannels(),
      launchUrl: 'https://example.com/leela',
      now: () => NOW,
      companion: {
        status: () => ({ available: false, reason: 'cooldown', skipped: 1 }),
        async engage() {
          calls += 1;
          return { text: 'must not be used', fromModel: true };
        },
      },
      // A deliberately wider runtime object proves even a legacy caller that
      // still supplies the old private sink cannot make the new route read it.
      reports: {
        async intention() {
          reads += 1;
          return 'private';
        },
        async history() {
          reads += 1;
          return [];
        },
      },
    } as unknown as Parameters<typeof createInitiative>[0]);

    const summary = await initiative.runTick(NOW);

    expect({ reads, calls }).toEqual({ reads: 0, calls: 0 });
    expect(sent[0]).toContain(messageFor('ru', 'nudge.agentRoll'));
    expect(summary.bridges).toEqual({ model: 0, canonical: 1 });
  });

  it('stops spending the tick on the model after its first transient fallback', async () => {
    await loadLanguage('ru');
    const first = room(true);
    first.chatId = 'table-a';
    first.session.id = 'table-a';
    first.session.players[0]!.id = 'player-a';
    const second = room(true);
    second.chatId = 'table-b';
    second.session.id = 'table-b';
    second.session.players[0]!.id = 'player-b';

    const store = new MemoryRoomStore();
    await store.save(first);
    await store.save(second);
    let reads = 0;
    let calls = 0;

    const initiative = createInitiative({
      api: { async sendMessage() { return {}; } },
      store,
      nudges: new MemoryNudgeStore(),
      channels: new DirectChannels(),
      launchUrl: 'https://example.com/leela',
      now: () => NOW,
      companion: {
        status: () => ({ available: true, skipped: 0 }),
        async engage() {
          calls += 1;
          return { text: 'canonical after a timeout', fromModel: false };
        },
      },
      reports: {
        async intention() {
          reads += 1;
          return null;
        },
        async history() {
          reads += 1;
          return [];
        },
      },
    } as unknown as Parameters<typeof createInitiative>[0]);

    const summary = await initiative.runTick(NOW);

    expect({ calls, reads }).toEqual({ calls: 1, reads: 0 });
    expect(summary).toEqual({
      sent: 2,
      bridges: { model: 0, canonical: 2 },
      skipped: {},
    });
  });

  it('keeps the tick alive when an injected companion cannot report status', async () => {
    await loadLanguage('ru');
    const store = new MemoryRoomStore();
    await store.save(room(true));
    const sent: string[] = [];

    const initiative = createInitiative({
      api: { async sendMessage(_chatId, text) { sent.push(text); return {}; } },
      store,
      nudges: new MemoryNudgeStore(),
      channels: new DirectChannels(),
      launchUrl: 'https://example.com/leela',
      now: () => NOW,
      companion: {
        status() {
          throw new Error('bad status adapter');
        },
        async engage() {
          throw new Error('must not be called');
        },
      },
    });

    await expect(initiative.runTick(NOW)).resolves.toMatchObject({
      sent: 1,
      bridges: { model: 0, canonical: 1 },
    });
    expect(sent[0]).toContain(messageFor('ru', 'nudge.agentRoll'));
  });

  it('leaves a doorstep word deterministic because there is no plan underfoot', async () => {
    const atDoor = room(true);
    const seat = atDoor.session.players[0];
    if (!seat) throw new Error('the fixture lost its player');
    seat.state = {
      loka: 68,
      previous_loka: 0,
      direction: '',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: true,
    };
    seat.lastRollAt = null;

    const store = new MemoryRoomStore();
    await store.save(atDoor);
    let calls = 0;

    const initiative = createInitiative({
      api: { async sendMessage() { return {}; } },
      store,
      nudges: new MemoryNudgeStore(),
      channels: new DirectChannels(),
      launchUrl: 'https://example.com/leela',
      now: () => NOW,
      companion: {
        status: () => ({ available: true, skipped: 0 }),
        async engage() {
          calls += 1;
          return { text: 'must not be used', fromModel: true };
        },
      },
    });

    const summary = await initiative.runTick(NOW);

    expect(calls).toBe(0);
    expect(summary).toEqual({
      sent: 1,
      bridges: { model: 0, canonical: 0 },
      skipped: {},
    });
  });
});
