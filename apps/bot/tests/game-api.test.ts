import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { openRoom, report, roll, start, type Room } from '../src/commands';
import {
  INIT_DATA_MAX_AGE_MS,
  gameRoute,
  playerFromInitData,
  snapshotOf,
  type GameReply,
} from '../src/game-api';
import { MemoryEntitlementStore, MemoryReportSink, MemoryRoomStore, type StepSink } from '../src/store';
import { tableMiniAppUrl } from '../src/bot';
import { askRoute } from '../src/serve';

const TOKEN = '123456:test-token';
const NOW = 1_800_000_000_000;
const ORIGIN = 'https://t27.ai';

const signed = (userId: string, at = NOW): string => {
  const data = new URLSearchParams({
    auth_date: String(Math.floor(at / 1000)),
    query_id: 'AAExample',
    user: JSON.stringify({ id: Number(userId), first_name: 'Ada' }),
  });
  const check = [...data.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  data.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return data.toString();
};

const request = (body: unknown, origin = ORIGIN): Request =>
  new Request('https://service.example/api/game', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const table = (): Room => {
  const opened = openRoom('-1001', { id: '7', name: 'Ada' }, 1).room as Room;
  return start(opened, '7').room as Room;
};

const tableAfterMoves = (wanted: number): Room => {
  let room = { ...table(), seed: 4 };
  let moved = 0;
  for (let guard = 0; moved < wanted && guard < 200; guard += 1) {
    const player = room.session.players[0];
    if (player?.reportSubmitted === false && player.state.loka > 0) {
      room = report(room, '7', `A sufficiently long account ${guard}`, NOW + guard * 60_000).room ?? room;
    }
    const result = roll(room, '7', NOW + (guard + 1) * 60_000);
    const effect = result.effects?.find((one) => one.kind === 'move');
    room = result.room ?? room;
    if (effect?.kind === 'move' && effect.event.from !== effect.event.to) moved += 1;
  }
  const player = room.session.players[0];
  if (player?.reportSubmitted === false && player.state.loka > 0) {
    room = report(room, '7', 'The third free landing, fully accounted for.', NOW + 20_000_000).room ?? room;
  }
  return room;
};

describe('Telegram launch proof', () => {
  it('accepts a current signed user and refuses tampering and expiry', () => {
    expect(playerFromInitData(signed('7'), TOKEN, NOW)).toEqual({ id: '7', name: 'Ada' });

    const changed = new URLSearchParams(signed('7'));
    changed.set('user', JSON.stringify({ id: 8, first_name: 'Mallory' }));
    expect(playerFromInitData(changed.toString(), TOKEN, NOW)).toBeNull();
    expect(
      playerFromInitData(signed('7', NOW - INIT_DATA_MAX_AGE_MS - 1000), TOKEN, NOW),
    ).toBeNull();
  });
});

it('puts only the table handle on the board launch URL', () => {
  expect(tableMiniAppUrl('https://t27.ai/leela/', '-1001')).toBe(
    'https://t27.ai/leela/?chat=-1001',
  );
});

describe('the chat table API', () => {
  it('returns only a table the signed player is seated at', async () => {
    const store = new MemoryRoomStore();
    await store.save(table());
    const route = askRoute({
      game: gameRoute({
        botToken: TOKEN,
        store,
        reports: new MemoryReportSink(),
        allowedOrigins: [ORIGIN],
        now: () => NOW,
      }),
    });

    const read = await route(request({ initData: signed('7'), chatId: '-1001', action: 'read' }));
    expect(read.status).toBe(200);
    const readBody = (await read.json()) as GameReply;
    expect(readBody.snapshot).toEqual(snapshotOf((await store.get('-1001')) as Room));
    expect(readBody.player).toEqual({
      intention: null,
      reports: [],
      access: {
        enabled: false,
        mayRoll: true,
        freeMoves: 3,
        movesUsed: 0,
        left: null,
        entitledUntil: null,
        tiers: [],
      },
    });

    const stranger = await route(request({ initData: signed('8'), chatId: '-1001', action: 'read' }));
    expect(stranger.status).toBe(403);
    const forged = await route(request({ initData: `${signed('7')}x`, chatId: '-1001', action: 'read' }));
    expect(forged.status).toBe(401);
  });

  it('keeps intention and reports in the same private player context', async () => {
    const store = new MemoryRoomStore();
    const reports = new MemoryReportSink(() => NOW);
    await store.save({ ...table(), seed: 4 });
    const route = gameRoute({
      botToken: TOKEN,
      store,
      reports,
      allowedOrigins: [ORIGIN],
      now: () => NOW,
    });
    const base = { initData: signed('7'), chatId: '-1001' };

    const intention = await route(request({ ...base, action: 'intention', text: '  What am I avoiding?  ' }));
    expect(intention.status).toBe(200);
    expect(((await intention.json()) as GameReply).player.intention).toBe('What am I avoiding?');

    const rolled = await route(request({ ...base, action: 'roll' }));
    expect(((await rolled.json()) as GameReply).move?.roll).toBe(6);

    const reported = await route(request({ ...base, action: 'report', text: 'I see the old pattern.' }));
    const body = (await reported.json()) as GameReply;
    expect(body.accepted).toBe(true);
    expect(body.player.reports).toEqual([
      { plan: 6, text: 'I see the old pattern.', at: NOW },
    ]);
    expect((await store.get('-1001'))?.session.players[0]?.reportSubmitted).toBe(true);

    const duplicate = await route(request({ ...base, action: 'report', text: 'Again.' }));
    expect(((await duplicate.json()) as GameReply).accepted).toBe(false);
    expect(await reports.history('7')).toHaveLength(1);
  });

  it('persists and records the authoritative throw before announcing it', async () => {
    const store = new MemoryRoomStore();
    const reports = new MemoryReportSink();
    await reports.setIntention('7', 'What am I avoiding?');
    await store.save(table());
    const steps: Array<{ userId: string; roll: number }> = [];
    const sink: StepSink = {
      async record(step) {
        steps.push({ userId: step.userId, roll: step.event.roll });
      },
    };
    const announced: string[] = [];
    const route = gameRoute({
      botToken: TOKEN,
      store,
      reports,
      steps: sink,
      allowedOrigins: [ORIGIN],
      now: () => NOW,
      broadcast: async (_chat, text) => {
        // The save is observable before the chat hears the move.
        expect((await store.get('-1001'))?.rollsTaken).toBe(1);
        announced.push(text);
      },
    });

    const response = await route(request({ initData: signed('7'), chatId: '-1001', action: 'roll' }));
    const body = (await response.json()) as GameReply;
    const kept = await store.get('-1001');

    expect(response.status).toBe(200);
    expect(body.move?.roll).toBe(4);
    expect(body.snapshot).toEqual(snapshotOf(kept as Room));
    expect(kept?.rollsTaken).toBe(1);
    expect(steps).toEqual([{ userId: '7', roll: 4 }]);
    expect(announced[0]).toBe(body.replies[0]);
  });

  it('serializes simultaneous throws so neither overwrites the other', async () => {
    const store = new MemoryRoomStore();
    const reports = new MemoryReportSink();
    await reports.setIntention('7', 'What am I avoiding?');
    await store.save(table());
    const route = gameRoute({
      botToken: TOKEN,
      store,
      reports,
      allowedOrigins: [ORIGIN],
      now: () => NOW,
    });
    const body = { initData: signed('7'), chatId: '-1001', action: 'roll' };

    await Promise.all([route(request(body)), route(request(body))]);

    expect((await store.get('-1001'))?.rollsTaken).toBe(2);
  });

  it('keeps the move and tells the operator when the chat announcement fails', async () => {
    const store = new MemoryRoomStore();
    const reports = new MemoryReportSink();
    await reports.setIntention('7', 'What am I avoiding?');
    await store.save(table());
    const logged: string[] = [];
    const route = gameRoute({
      botToken: TOKEN,
      store,
      reports,
      allowedOrigins: [ORIGIN],
      now: () => NOW,
      broadcast: async () => {
        throw new Error('Telegram is unavailable');
      },
      log: (line) => logged.push(line),
    });

    const response = await route(
      request({ initData: signed('7'), chatId: '-1001', action: 'roll' }),
    );

    expect(response.status).toBe(200);
    expect((await store.get('-1001'))?.rollsTaken).toBe(1);
    expect(logged).toEqual(['[game-api] failed to announce a mini-app throw']);
  });

  it('creates only an authenticated, configured Stars invoice', async () => {
    const store = new MemoryRoomStore();
    await store.save(table());
    const seen: unknown[] = [];
    const route = gameRoute({
      botToken: TOKEN,
      store,
      reports: new MemoryReportSink(),
      entitlements: new MemoryEntitlementStore(),
      stars: [{ id: 'month', stars: 150, days: 30 }],
      allowedOrigins: [ORIGIN],
      now: () => NOW,
      createInvoiceLink: async (invoice) => {
        seen.push(invoice);
        return 'https://t.me/$invoice';
      },
    });
    const base = { initData: signed('7'), chatId: '-1001', action: 'invoice' };

    const response = await route(request({ ...base, tier: 'month' }));
    const body = (await response.json()) as GameReply;
    expect(response.status).toBe(200);
    expect(body.invoiceUrl).toBe('https://t.me/$invoice');
    expect(seen).toMatchObject([{ currency: 'XTR', payload: 'leela:pro:month:v1', prices: [{ amount: 150 }] }]);

    expect((await route(request({ ...base, tier: 'year' }))).status).toBe(400);
    expect((await route(request({ ...base, initData: signed('8'), tier: 'month' }))).status).toBe(403);
  });

  it('refuses the fourth movement server-side and a recorded payment unlocks it', async () => {
    const store = new MemoryRoomStore();
    const entitlements = new MemoryEntitlementStore();
    await store.save(tableAfterMoves(3));
    const reports = new MemoryReportSink();
    await reports.setIntention('7', 'What am I avoiding?');
    const route = gameRoute({
      botToken: TOKEN, store, reports, entitlements,
      stars: [{ id: 'month', stars: 150, days: 30 }],
      allowedOrigins: [ORIGIN], now: () => NOW + 30_000_000,
    });
    const body = { initData: signed('7', NOW + 30_000_000), chatId: '-1001', action: 'roll' };
    const before = (await store.get('-1001'))?.rollsTaken;

    const blocked = (await (await route(request(body))).json()) as GameReply;
    expect(blocked.accepted).toBe(false);
    expect(blocked.replies.join(' ')).toMatch(/three free moves/i);
    expect((await store.get('-1001'))?.rollsTaken).toBe(before);

    await entitlements.record({ userId: '7', chargeId: 'paid', tier: 'month', stars: 150, days: 30, at: NOW + 30_000_000 });
    const paid = (await (await route(request(body))).json()) as GameReply;
    expect(paid.accepted).toBe(true);
    expect((await store.get('-1001'))?.rollsTaken).toBe((before ?? 0) + 1);
  });
});
