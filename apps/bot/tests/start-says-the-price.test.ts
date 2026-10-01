import { describe, expect, it } from 'vitest';
import { messageFor, translatedLanguages } from '@leela/content';
import { createBot } from '../src/bot';
import { offerFor, offering, type PricedTier } from '../src/stars';
import { MemoryEntitlementStore, MemoryRoomStore, MemoryStepSink } from '../src/store';

/**
 * `/start` says the price before anything else.
 *
 * Play moved to the mini app, so `/start` is where a player first meets this
 * bot, and the first they heard of the subscription was the paywall on their
 * fourth move. The defect's shape is *a priced private `/start` whose first
 * message is not the offer*, checked in every language that is translated, for
 * a new player and for one who already holds a subscription — and the dark
 * deployment, which has no price to say, must say none.
 */

const NOW = 1_760_000_000_000;
const PLAYER = 701;
const PRICED = offering({
  LEELA_STARS_MONTH: '150',
  LEELA_STARS_HALFYEAR: '700',
  LEELA_STARS_YEAR: '1200',
}) as readonly PricedTier[];

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

const startFrom = (language: string, chat: 'private' | 'group' = 'private') =>
  ({
    update_id: (updateId += 1),
    message: {
      message_id: updateId,
      date: 0,
      chat:
        chat === 'private'
          ? { id: PLAYER, type: 'private' as const }
          : { id: -PLAYER, type: 'group' as const, title: 'Table' },
      from: { id: PLAYER, is_bot: false, first_name: 'P', language_code: language },
      text: '/start',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 6 }],
    },
  }) as never;

async function botWith(stars: readonly PricedTier[] | null, held = false) {
  const texts: string[] = [];
  const entitlements = new MemoryEntitlementStore();
  if (held) {
    await entitlements.record({
      userId: String(PLAYER),
      chargeId: 'charge-held',
      tier: 'month',
      stars: 150,
      days: 30,
      at: NOW,
    });
  }
  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    store: new MemoryRoomStore(),
    steps: new MemoryStepSink(),
    entitlements,
    stars,
    now: () => NOW,
    log: () => undefined,
  });
  bot.api.config.use(async (_previous, method, payload) => {
    if (method === 'sendMessage') texts.push(String((payload as { text?: unknown }).text ?? ''));
    return { ok: true, result: { message_id: texts.length } } as never;
  });
  return { bot, texts, entitlements };
}

describe('a private /start in a priced deployment', () => {
  it('opens with the offer, in every translated language', async () => {
    for (const language of translatedLanguages()) {
      const { bot, texts } = await botWith(PRICED);
      await bot.handleUpdate(startFrom(language));

      expect(texts[0], language).toBe(offerFor(language, PRICED, null));
      for (const tier of PRICED) {
        expect(texts[0], `${language}/${tier.id}`).toContain(`/pro ${tier.id}`);
        expect(texts[0], `${language}/${tier.id}`).toContain(`${tier.stars} ⭐`);
      }
      // And the game is still opened behind it, or the mini app has no table.
      expect(texts.length, language).toBeGreaterThan(1);
    }
  });

  it('tells a subscriber how long their game is open', async () => {
    const { bot, texts, entitlements } = await botWith(PRICED, true);
    await bot.handleUpdate(startFrom('ru'));

    const held = await entitlements.subscribed(String(PLAYER), NOW);
    expect(held).not.toBeNull();
    expect(texts[0]).toBe(offerFor('ru', PRICED, held?.until ?? null));
  });
});

describe('where /start says no price', () => {
  it('says none in a deployment that has not named one', async () => {
    const { bot, texts } = await botWith(null);
    await bot.handleUpdate(startFrom('en'));

    expect(texts.length).toBeGreaterThan(0);
    expect(texts.join('\n')).not.toContain(messageFor('en', 'pro.free'));
    expect(texts.join('\n')).not.toContain('⭐');
  });

  it('says none in a group, where a price is between the bot and one player', async () => {
    const { bot, texts } = await botWith(PRICED);
    await bot.handleUpdate(startFrom('en', 'group'));

    expect(texts.join('\n')).not.toContain(messageFor('en', 'pro.free'));
  });
});
