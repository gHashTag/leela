import { beforeAll, describe, expect, it } from 'vitest';
import { Guide, fixedModel, recordingModel } from '@leela/ai';
import { loadEveryLanguage } from '@leela/content';
import { createBot } from '../src/bot';
import { MemoryAcquisitionStore, MemoryReportSink, MemoryRoomStore } from '../src/store';

beforeAll(() => loadEveryLanguage());

const BOT_INFO = {
  id: 1,
  is_bot: true as const,
  first_name: 'Leela',
  username: 'leela_test_bot',
  can_join_groups: true as const,
  can_read_all_group_messages: false as const,
  supports_inline_queries: true as const,
  can_connect_to_business: false as const,
  has_main_web_app: true as const,
  has_topics_enabled: false as const,
  allows_users_to_create_topics: false as const,
  can_manage_bots: false as const,
  supports_join_request_queries: false as const,
};

function harness(guide = new Guide({ model: fixedModel('Что меняется, если остаться с этим вопросом?') })) {
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const store = new MemoryRoomStore();
  const reports = new MemoryReportSink();
  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    store,
    reports,
    acquisitions: new MemoryAcquisitionStore(),
    guide,
    now: () => Date.UTC(2026, 8, 2, 10),
    log: () => undefined,
  });
  bot.api.config.use(async (_previous, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: method === 'answerInlineQuery' ? true : { message_id: 1 } } as never;
  });
  return { bot, sent, store, reports };
}

function guest(text: string, language = 'ru') {
  return {
    update_id: 1,
    guest_message: {
      message_id: 1,
      date: 1,
      chat: { id: -100, type: 'supergroup', title: 'Elsewhere' },
      // Bot API 10.x sends the original caller here. The
      // guest_bot_caller_user field belongs to the resulting message sent by
      // the guest bot and is not present on this incoming update.
      from: {
        id: 100,
        is_bot: false,
        first_name: 'Player',
        language_code: language,
      },
      guest_query_id: 'guest-query',
      text,
    },
  } as never;
}

function inline(query: string, language = 'ru') {
  return {
    update_id: 2,
    inline_query: {
      id: 'inline-query',
      from: { id: 100, is_bot: false, first_name: 'Player', language_code: language },
      query,
      offset: '',
    },
  } as never;
}

function start() {
  return {
    update_id: 3,
    message: {
      message_id: 3,
      date: 1,
      chat: { id: 100, type: 'private', first_name: 'Player' },
      from: { id: 100, is_bot: false, first_name: 'Player', language_code: 'ru' },
      text: '/start',
      entities: [{ type: 'bot_command', offset: 0, length: 6 }],
    },
  } as never;
}

describe('Telegram discovery surfaces', () => {
  it('answers one guest query with one localized plan card and Main Mini App CTA', async () => {
    const { bot, sent } = harness();
    await bot.handleUpdate(guest('@leela_test_bot Что мне сейчас важно увидеть?'));

    const answers = sent.filter(({ method }) => method === 'answerGuestQuery');
    expect(answers).toHaveLength(1);
    expect(answers[0]?.payload.guest_query_id).toBe('guest-query');
    expect(JSON.stringify(answers[0]?.payload.result)).toContain('startapp=guest');
    expect(JSON.stringify(answers[0]?.payload.result)).toMatch(/План|план/);
    expect(JSON.stringify(answers[0]?.payload.result).length).toBeLessThan(4096);
  });

  it('still answers canonically when Telegram omits the optional sender', async () => {
    const { bot, sent } = harness();
    const update = guest('@leela_test_bot What now?', 'en') as {
      guest_message: { from?: unknown };
    };
    delete update.guest_message.from;

    await bot.handleUpdate(update as never);

    expect(sent.filter(({ method }) => method === 'answerGuestQuery')).toHaveLength(1);
  });

  it('uses invocation text but never private journal fields', async () => {
    const model = recordingModel('Что этот план позволяет заметить?');
    const guide = new Guide({ model });
    const { bot, reports } = harness(guide);
    await reports.setIntention?.('100', 'PRIVATE INTENTION');
    await reports.record({ userId: '100', plan: 6, text: 'PRIVATE REPORT' });
    await bot.handleUpdate(guest('@leela_test_bot Что здесь важно?'));

    const prompt = model.calls.flatMap((call) => call.messages.map(({ content }) => content)).join('\n');
    expect(prompt).toContain('Что здесь важно?');
    expect(prompt).not.toContain('PRIVATE INTENTION');
    expect(prompt).not.toContain('PRIVATE REPORT');
  });

  it('grounds a returning caller in the plan held by their durable game', async () => {
    const model = recordingModel('Что этот план позволяет заметить?');
    const { bot } = harness(new Guide({ model }));
    await bot.handleUpdate(start());
    await bot.handleUpdate(guest('@leela_test_bot Что здесь важно?'));

    const prompt = model.calls.flatMap((call) => call.messages.map(({ content }) => content)).join('\n');
    expect(prompt).toContain('plan 68');
  });

  it('answers inline queries with a selectable canonical card and no model spend', async () => {
    const model = recordingModel('must not be called');
    const { bot, sent } = harness(new Guide({ model }));
    await bot.handleUpdate(inline('41'));

    const answers = sent.filter(({ method }) => method === 'answerInlineQuery');
    expect(answers).toHaveLength(1);
    expect(JSON.stringify(answers[0]?.payload.results)).toContain('startapp=inline');
    expect(JSON.stringify(answers[0]?.payload.results)).toContain('41');
    expect(model.calls).toHaveLength(0);
  });
});
