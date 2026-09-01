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
  it('uses the current plan, intention and path, then asks for the action the gate accepts', async () => {
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
    const reports = {
      async intention() {
        return 'увидеть, где я избегаю выбора';
      },
      async history() {
        // Stores return newest first; prompts must receive the walked path.
        return [
          { plan: 9, text: 'сегодня я остановился', createdAt: new Date(NOW - 1_000) },
          { plan: 6, text: 'я вошёл в игру', createdAt: new Date(NOW - 2_000) },
        ];
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
      reports,
    });

    const summary = await initiative.runTick(NOW);

    expect(calls).toEqual([
      {
        language: 'ru',
        plan: 12,
        reportOwed: true,
        intention: 'увидеть, где я избегаю выбора',
        direction: 'step 🚶🏼',
        previousPlan: 9,
        journey: [
          { plan: 6, text: 'я вошёл в игру' },
          { plan: 9, text: 'сегодня я остановился' },
        ],
      },
    ]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('Что в этом плане просит сегодня честного внимания?');
    expect(sent[0]).not.toContain('/roll');
    expect(sent[0]).toContain('Ответьте одним предложением');
    expect(summary.bridges).toEqual({ model: 1, canonical: 0 });
  });

  it('uses a localized canonical bridge and /roll when the report is already filed', async () => {
    await loadLanguage('ru');
    const store = new MemoryRoomStore();
    await store.save(room(true));
    const sent: string[] = [];

    const initiative = createInitiative({
      api: {
        async sendMessage(_chatId, text) {
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

  it('does not read private context or call a cooling companion', async () => {
    await loadLanguage('ru');
    const store = new MemoryRoomStore();
    await store.save(room(true));
    let reads = 0;
    let calls = 0;
    const sent: string[] = [];

    const initiative = createInitiative({
      api: {
        async sendMessage(_chatId, text) {
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
    });

    const summary = await initiative.runTick(NOW);

    expect({ reads, calls }).toEqual({ reads: 0, calls: 0 });
    expect(sent[0]).toContain(messageFor('ru', 'nudge.agentRoll'));
    expect(summary.bridges).toEqual({ model: 0, canonical: 1 });
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
          return { text: 'must not be used', fromModel: true };
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
    });

    const summary = await initiative.runTick(NOW);

    expect({ reads, calls }).toEqual({ reads: 0, calls: 0 });
    expect(summary).toEqual({
      sent: 1,
      bridges: { model: 0, canonical: 0 },
      skipped: {},
    });
  });
});
