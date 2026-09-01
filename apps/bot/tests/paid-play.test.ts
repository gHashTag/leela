import { describe, expect, it } from 'vitest';
import { FREE_MOVES, SUBSCRIBE_REQUEST, messageFor } from '@leela/content';
import { CLASSIC, applyRoll, initialState } from '@leela/engine';
import { accessFor } from '../src/access';
import { createBot } from '../src/bot';
import { openRoom, start } from '../src/commands';
import { offering, type PricedTier } from '../src/stars';
import {
  MemoryEntitlementStore,
  MemoryPaymentFunnelStore,
  MemoryRoomStore,
  MemoryStepSink,
  type EntitlementStore,
  type PaymentFunnelStore,
  type StepSink,
} from '../src/store';

const NOW = 1_760_000_000_000;
const PLAYER = 700;
const PRICED = offering({ LEELA_STARS_MONTH: '150' }) as readonly PricedTier[];

const BOT_INFO = {
  id: 1,
  is_bot: true as const,
  first_name: 'Leela',
  username: 'leela_test_bot',
  can_join_groups: true as const,
  can_read_all_group_messages: false as const,
  supports_inline_queries: false as const,
  can_connect_to_business: false as const,
  has_main_web_app: false as const,
  has_topics_enabled: false as const,
  allows_users_to_create_topics: false as const,
  can_manage_bots: false as const,
  supports_join_request_queries: false as const,
};

const moved = applyRoll(initialState(), 6, CLASSIC).event;
const refused = applyRoll(initialState(), 1, CLASSIC).event;

async function keep(sink: StepSink, userId: string, count: number, event = moved): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await sink.record({ userId, event, ruleset: CLASSIC });
  }
}

describe('the one access decision', () => {
  it('keeps an unpriced deployment open without reading payment state', async () => {
    const forbiddenEntitlements = {
      record: async () => { throw new Error('read a dark rail'); },
      subscribed: async () => { throw new Error('read a dark rail'); },
      of: async () => { throw new Error('read a dark rail'); },
      refund: async () => { throw new Error('read a dark rail'); },
    } as EntitlementStore;
    const forbiddenSteps = {
      record: async () => { throw new Error('read dark moves'); },
      moved: async () => { throw new Error('read dark moves'); },
    } as StepSink;

    await expect(accessFor({
      userId: 'u1',
      stars: null,
      entitlements: forbiddenEntitlements,
      steps: forbiddenSteps,
      now: NOW,
    })).resolves.toEqual({ mayMove: true, moved: 0, entitled: false, left: null });
  });

  it('gives exactly three successful moves, not three attempts', async () => {
    const steps = new MemoryStepSink();
    const entitlements = new MemoryEntitlementStore();

    await keep(steps, 'u1', 8, refused);
    expect(await steps.moved('u1')).toBe(0);

    for (let count = 0; count < FREE_MOVES; count += 1) {
      const access = await accessFor({ userId: 'u1', stars: PRICED, entitlements, steps, now: NOW });
      expect(access).toMatchObject({ mayMove: true, moved: count, entitled: false, left: FREE_MOVES - count });
      await keep(steps, 'u1', 1);
    }

    await expect(accessFor({ userId: 'u1', stars: PRICED, entitlements, steps, now: NOW }))
      .resolves.toEqual({ mayMove: false, moved: FREE_MOVES, entitled: false, left: 0 });
  });

  it('counts per player and opens exhausted play for a live entitlement', async () => {
    const steps = new MemoryStepSink();
    const entitlements = new MemoryEntitlementStore();
    await keep(steps, 'u1', FREE_MOVES);

    expect((await accessFor({ userId: 'u2', stars: PRICED, entitlements, steps, now: NOW })).moved).toBe(0);

    await entitlements.record({
      userId: 'u1',
      chargeId: 'charge-1',
      tier: 'month',
      stars: 150,
      days: 30,
      at: NOW,
    });
    await expect(accessFor({ userId: 'u1', stars: PRICED, entitlements, steps, now: NOW }))
      .resolves.toEqual({ mayMove: true, moved: FREE_MOVES, entitled: true, left: null });
  });
});

let updateId = 0;

const typed = (text: string) => ({
  update_id: (updateId += 1),
  message: {
    message_id: updateId,
    date: 0,
    chat: { id: PLAYER, type: 'private' as const },
    from: { id: PLAYER, is_bot: false, first_name: 'P', language_code: 'en' },
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]?.length ?? 0 }],
  },
}) as never;

const handedOver = (data: string) => ({
  update_id: (updateId += 1),
  message: {
    message_id: updateId,
    date: 0,
    chat: { id: PLAYER, type: 'private' as const },
    from: { id: PLAYER, is_bot: false, first_name: 'P', language_code: 'en' },
    web_app_data: { data, button_text: 'Leela' },
  },
}) as never;

async function paidBot(options: {
  entitled?: boolean;
  moved?: number;
  onBoard?: boolean;
  funnel?: PaymentFunnelStore;
} = {}) {
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const store = new MemoryRoomStore();
  const steps = new MemoryStepSink();
  const entitlements = new MemoryEntitlementStore();
  const funnel = options.funnel ?? new MemoryPaymentFunnelStore();
  const opened = openRoom(String(PLAYER), { id: String(PLAYER), name: 'P' }, 42).room;
  let room = opened ? start(opened, String(PLAYER)).room : null;
  if (room && options.onBoard) {
    room = {
      ...room,
      session: {
        ...room.session,
        players: room.session.players.map((player) => ({
          ...player,
          state: applyRoll(initialState(), 6, CLASSIC).state,
          reportSubmitted: true,
        })),
      },
    };
  }
  if (room) await store.save(room);
  await keep(steps, String(PLAYER), options.moved ?? FREE_MOVES);
  if (options.entitled) {
    await entitlements.record({
      userId: String(PLAYER),
      chargeId: 'charge-live',
      tier: 'month',
      stars: 150,
      days: 30,
      at: NOW,
    });
  }

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    store,
    steps,
    entitlements,
    funnel,
    stars: PRICED,
    now: () => NOW,
    log: () => undefined,
  });
  bot.api.config.use(async (_previous, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: sent.length } } as never;
  });

  return { bot, store, sent, funnel };
}

const said = (sent: Array<{ method: string; payload: Record<string, unknown> }>) =>
  sent.filter((call) => call.method === 'sendMessage').map((call) => String(call.payload.text ?? '')).join('\n');

describe('Telegram uses the shared decision', () => {
  it('blocks the fourth chat move and offers the configured tier', async () => {
    const { bot, store, sent, funnel } = await paidBot();
    await bot.handleUpdate(typed('/roll'));

    expect(said(sent)).toContain(messageFor('en', 'app.tollDue'));
    expect(said(sent)).toContain('/pro month');
    expect((await store.get(String(PLAYER)))?.rollsTaken).toBe(0);
    expect(await funnel.summary()).toMatchObject({ paywall: 1 });
  });

  it('records the third successful free move as trial completion', async () => {
    const { bot, funnel } = await paidBot({ moved: FREE_MOVES - 1, onBoard: true });
    await bot.handleUpdate(typed('/roll'));

    expect(await funnel.summary()).toMatchObject({ trial: 1, return: 0 });
  });

  it('does not show the paywall to an entitled player', async () => {
    const { bot, store, sent, funnel } = await paidBot({ entitled: true, onBoard: true });
    await bot.handleUpdate(typed('/roll'));

    expect(said(sent)).not.toContain(messageFor('en', 'app.tollDue'));
    expect((await store.get(String(PLAYER)))?.rollsTaken).toBe(1);
    expect(await funnel.summary()).toMatchObject({ return: 1 });
  });

  it('turns the mini-app request into the bot’s real Stars offer without counting a second paywall', async () => {
    const { bot, sent, funnel } = await paidBot();
    await bot.handleUpdate(handedOver(SUBSCRIBE_REQUEST));

    expect(said(sent)).toContain(messageFor('en', 'app.tollDue'));
    expect(said(sent)).toContain('/pro month');
    expect(said(sent)).not.toContain(messageFor('en', 'square.unreadable'));
    // The server-authoritative /api/roll refusal owns attribution. sendData is
    // only a transport bridge and can also be forged or replayed directly.
    expect(await funnel.summary()).toMatchObject({ paywall: 0 });
  });

  it('keeps both a paywall refusal and a successful move working when funnel storage is down', async () => {
    const broken: PaymentFunnelStore = {
      async record() {
        throw new Error('analytics unavailable');
      },
      async summary() {
        throw new Error('analytics unavailable');
      },
    };

    const refused = await paidBot({ funnel: broken });
    await refused.bot.handleUpdate(typed('/roll'));
    expect(said(refused.sent)).toContain(messageFor('en', 'app.tollDue'));

    const moving = await paidBot({ funnel: broken, moved: FREE_MOVES - 1, onBoard: true });
    await moving.bot.handleUpdate(typed('/roll'));
    expect((await moving.store.get(String(PLAYER)))?.rollsTaken).toBe(1);
  });
});
