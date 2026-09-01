import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import { createBot } from '../src/bot';
import { MemoryNudgeStore } from '../src/store';

/**
 * `/quiet`, through the transport: the opt-out the first daily word names has
 * to actually close the door, and the same word has to open it again — a way
 * out that does not work is worse than none, because the player has been told
 * it exists.
 */

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

let updateId = 0;

/** A `/quiet` typed in a private chat, in the client's own language. */
function quietFrom(userId: number, language?: string) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: userId, type: 'private' as const },
      from: { id: userId, is_bot: false, first_name: `P${userId}`, language_code: language },
      text: '/quiet',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 6 }],
    },
  } as never;
}

function harness(nudges = new MemoryNudgeStore()) {
  const texts: string[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    nudges,
  });

  bot.api.config.use(async (_prev, method, payload) => {
    if (method === 'sendMessage') texts.push(String((payload as { text?: unknown }).text));
    return { ok: true, result: { message_id: 1 } } as never;
  });

  return { bot, texts, nudges };
}

describe('/quiet', () => {
  it('closes the door, and names the way back in the reply', async () => {
    const { bot, texts, nudges } = harness();

    await bot.handleUpdate(quietFrom(100));

    expect((await nudges.of('100')).quieted).toBe(true);
    expect(texts).toEqual([messageFor('en', 'quiet.on')]);
    expect(texts[0]).toContain('/quiet');
  });

  it('is a toggle: the second /quiet opens the door again', async () => {
    const { bot, texts, nudges } = harness();

    await bot.handleUpdate(quietFrom(100));
    await bot.handleUpdate(quietFrom(100));

    expect((await nudges.of('100')).quieted).toBe(false);
    expect(texts[1]).toBe(messageFor('en', 'quiet.off'));
  });

  it('answers in the asker’s language', async () => {
    const { bot, texts } = harness();

    await bot.handleUpdate(quietFrom(100, 'ru'));
    await bot.handleUpdate(quietFrom(100, 'ru'));

    expect(texts).toEqual([messageFor('ru', 'quiet.on'), messageFor('ru', 'quiet.off')]);
  });

  it('quiets one player, not the table', async () => {
    const { bot, nudges } = harness();

    await bot.handleUpdate(quietFrom(100));

    expect((await nudges.of('100')).quieted).toBe(true);
    expect((await nudges.of('200')).quieted).toBe(false);
  });

  it('writes into the store it was built with — the one the initiative reads', async () => {
    // The command and the tick must share one memory, or /quiet silences a
    // door the daily word never checks. Passing the store in and reading the
    // flag back is the wiring half; `the-daily-word.test.ts` holds the tick
    // to honouring what is read.
    const shared = new MemoryNudgeStore();
    const { bot } = harness(shared);

    await bot.handleUpdate(quietFrom(100));
    expect((await shared.of('100')).quieted).toBe(true);
  });

  it('tells the player something went wrong when the memory refuses the write', async () => {
    // The injected `nudges` store is a promise the type holds nobody to. A
    // /quiet answered "quiet, then" over a flag that was never kept would be
    // the opt-out lying — so a store that throws must reach the floor, and
    // the floor must say so rather than leave silence.
    const broken = new MemoryNudgeStore();
    broken.setQuieted = async () => {
      throw new Error('the disk is gone');
    };
    const { bot, texts } = harness(broken);

    await bot.handleUpdate(quietFrom(100));

    expect(texts).toEqual([messageFor('en', 'chat.wentWrong')]);
  });
});
