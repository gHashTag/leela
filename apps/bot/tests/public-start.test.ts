import { describe, expect, it } from 'vitest';
import { createBot } from '../src/bot';
import { publicDay, publicStartPayload } from '../src/public-outreach';
import {
  MemoryAcquisitionStore,
  MemoryPublicOutreachStore,
  MemoryRoomStore,
} from '../src/store';

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

const AT = Date.UTC(2026, 8, 2, 10);
let update = 0;

function command(text: string, type: 'private' | 'group' = 'private') {
  update += 1;
  const chatId = type === 'private' ? 100 : -100;
  return {
    update_id: update,
    message: {
      message_id: update,
      date: Math.floor(AT / 1000),
      chat: { id: chatId, type, title: 'A table' },
      from: { id: 100, is_bot: false, first_name: 'Player', language_code: 'ru' },
      text,
      entities: [{ type: 'bot_command' as const, offset: 0, length: 6 }],
    },
  } as never;
}

function harness() {
  const store = new MemoryRoomStore();
  const publications = new MemoryPublicOutreachStore();
  const acquisitions = new MemoryAcquisitionStore();
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    store,
    publications,
    acquisitions,
    now: () => AT,
    log: () => undefined,
  });
  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: 1 } } as never;
  });
  return { bot, store, publications, acquisitions, sent };
}

describe('public first contact', () => {
  it('opens and starts one durable private game and puts the signed board within reach', async () => {
    const { bot, store, publications, acquisitions, sent } = harness();
    const day = publicDay(AT);
    await publications.record({ day, plan: 41, sentAt: AT - 1_000, bridge: 'canonical' });

    await bot.handleUpdate(command(`/start ${publicStartPayload(day)}`));

    const room = await store.get('100');
    expect(room?.started).toBe(true);
    expect(room?.language).toBe('ru');
    expect((await publications.of(day))?.starts).toBe(1);
    expect(await acquisitions.of('100')).toEqual({
      source: 'public',
      campaign: publicStartPayload(day).slice('public_'.length),
      startedAt: AT,
    });
    expect(sent.some(({ payload }) => JSON.stringify(payload.reply_markup).includes('web_app'))).toBe(true);
    expect(sent.map(({ payload }) => String(payload.text)).join('\n')).toContain('Игра начинается');
  });

  it('also makes plain private /start useful while keeping an empty group non-destructive', async () => {
    const privateRun = harness();
    await privateRun.bot.handleUpdate(command('/start'));
    expect((await privateRun.store.get('100'))?.started).toBe(true);
    expect(await privateRun.acquisitions.of('100')).toMatchObject({ source: 'direct' });

    const groupRun = harness();
    await groupRun.bot.handleUpdate(command('/start', 'group'));
    expect(await groupRun.store.get('-100')).toBeNull();
  });

  it('starts the game even when anonymous attribution cannot be kept', async () => {
    const store = new MemoryRoomStore();
    const logs: string[] = [];
    const bot = createBot({
      token: '1:TEST',
      botInfo: BOT_INFO,
      store,
      publications: {
        async of() {
          return null;
        },
        async record() {},
        async started() {
          throw new Error('database unavailable');
        },
      },
      now: () => AT,
      log: (line) => logs.push(line),
    });
    bot.api.config.use(async () => ({ ok: true, result: { message_id: 1 } }) as never);

    await bot.handleUpdate(command(`/start ${publicStartPayload(publicDay(AT))}`));

    expect((await store.get('100'))?.started).toBe(true);
    expect(logs).toContain('[public] could not count a start.');
  });
});
