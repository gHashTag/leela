/**
 * A deployment that has named a price, driven end to end.
 *
 * The other half of `dark-until-a-price-is-named.test.ts`: that file proves the
 * rail is invisible until somebody prices it, and this one proves that once
 * priced it does exactly what it says — an invoice in Stars for the amount the
 * environment names, a payment written down against the player, an expiry that
 * can be read back after the process that took the money has gone, and a refund
 * that goes to Telegram first and to this bot's own record second.
 *
 * **What a payment buys is access until a date.** The access decision itself
 * is held in `paid-play.test.ts`; this file holds the Stars transaction that
 * creates, extends, reports and refunds that entitlement.
 *
 * The environments are built by hand rather than read from `process.env`: the
 * gate is `offering`'s to answer and it is answered exhaustively next door, so
 * what is under test here is everything downstream of it.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messageFor, translatedLanguages } from '@leela/content';
import { createBot } from '../src/bot';
import { openStorage } from '../src/storage';
import {
  STARS_CURRENCY,
  TIERS,
  asDay,
  extendedTo,
  invoiceFor,
  offerFor,
  offering,
  payloadFor,
  tierOfPayload,
  type PricedTier,
} from '../src/stars';
import {
  MemoryEntitlementStore,
  MemoryPaymentFunnelStore,
  type EntitlementStore,
  type PaymentFunnelStore,
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

const PLAYER = 700;
const OPERATOR = 900;
const NOW = 1_760_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

/** The environment an owner writes when they have decided on all three. */
const PRICED = {
  LEELA_STARS_MONTH: '150',
  LEELA_STARS_HALFYEAR: '700',
  LEELA_STARS_YEAR: '1200',
};

const ALL_THREE = offering(PRICED) as readonly PricedTier[];

let updateId = 0;

function typed(text: string, from = PLAYER) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: from, type: 'private' as const },
      from: { id: from, is_bot: false, first_name: `P${from}` },
      text,
      entities: [
        { type: 'bot_command' as const, offset: 0, length: (text.split(' ')[0] ?? '').length },
      ],
    },
  } as never;
}

function pressed(data: string, from = PLAYER) {
  updateId += 1;
  return {
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: { id: from, is_bot: false, first_name: `P${from}`, language_code: 'en' },
      chat_instance: 'private-chat',
      data,
      message: {
        message_id: updateId,
        date: 0,
        chat: { id: from, type: 'private' as const },
      },
    },
  } as never;
}

/** Telegram's word that the money has moved. */
function paid(options: {
  payload: string;
  amount: number;
  charge: string;
  from?: number;
}) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: options.from ?? PLAYER, type: 'private' as const },
      from: { id: options.from ?? PLAYER, is_bot: false, first_name: 'P' },
      successful_payment: {
        currency: STARS_CURRENCY,
        total_amount: options.amount,
        invoice_payload: options.payload,
        telegram_payment_charge_id: options.charge,
        provider_payment_charge_id: `provider-${options.charge}`,
      },
    },
  } as never;
}

interface Harness {
  bot: ReturnType<typeof createBot>;
  sent: Array<{ method: string; payload: Record<string, unknown> }>;
  entitlements: EntitlementStore;
  funnel: PaymentFunnelStore;
  texts(): string[];
  logs: string[];
}

function priced(
  options: {
    stars?: readonly PricedTier[] | null;
    entitlements?: EntitlementStore;
    funnel?: PaymentFunnelStore;
    operators?: readonly string[];
    now?: () => number;
    refuseRefund?: string;
  } = {},
): Harness {
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const logs: string[] = [];
  const entitlements = options.entitlements ?? new MemoryEntitlementStore();
  const funnel = options.funnel ?? new MemoryPaymentFunnelStore();

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: (line) => logs.push(line),
    now: options.now ?? (() => NOW),
    stars: options.stars === undefined ? ALL_THREE : options.stars,
    entitlements,
    funnel,
    operators: options.operators ?? [String(OPERATOR)],
  });

  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    if (method === 'refundStarPayment' && options.refuseRefund) {
      throw new Error(options.refuseRefund);
    }
    return { ok: true, result: { message_id: sent.length } } as never;
  });

  return {
    bot,
    sent,
    entitlements,
    funnel,
    logs,
    texts: () =>
      sent
        .filter((call) => call.method === 'sendMessage')
        .map((call) => String(call.payload.text ?? '')),
  };
}

/** The one invoice a drive produced. */
function invoiceIn(sent: Harness['sent']): Record<string, unknown> {
  const invoices = sent.filter((call) => call.method === 'sendInvoice');
  expect(invoices, 'exactly one invoice').toHaveLength(1);
  return invoices[0]?.payload ?? {};
}

describe('care before a Stars purchase', () => {
  it('names the published terms and the existing payment support in both bot languages', async () => {
    for (const language of translatedLanguages()) {
      const { bot, texts } = priced();
      updateId += 1;
      const command = (text: string) =>
        ({
          update_id: ++updateId,
          message: {
            message_id: updateId,
            date: 0,
            chat: { id: PLAYER, type: 'private' as const },
            from: { id: PLAYER, is_bot: false, first_name: 'P', language_code: language },
            text,
            entities: [{ type: 'bot_command' as const, offset: 0, length: text.length }],
          },
        }) as never;

      await bot.handleUpdate(command('/terms'));
      await bot.handleUpdate(command('/paysupport'));

      const said = texts().join('\n');
      expect(said, `${language} terms`).toContain(
        `https://t27.ai/leela/docs/${language}/legal/eula.html`,
      );
      expect(said, `${language} support`).toContain('raoffonom@icloud.com');
      expect(said, `${language} Telegram boundary`).toContain(
        messageFor(language, 'pro.telegramCannotSupport'),
      );
    }
  });

  it('sends an invoice only after the player explicitly accepts the terms', async () => {
    const { bot, sent, funnel } = priced();

    await bot.handleUpdate(typed('/pro month'));

    expect(sent.filter((call) => call.method === 'sendInvoice')).toEqual([]);
    const prompt = sent.find((call) => call.method === 'sendMessage');
    expect(String(prompt?.payload.text)).toContain(
      'https://t27.ai/leela/docs/en/legal/eula.html',
    );
    expect(prompt?.payload.reply_markup).toMatchObject({
      inline_keyboard: [[{ callback_data: 'pay:month' }]],
    });
    expect(await funnel.summary()).toMatchObject({ invoice: 0 });

    await bot.handleUpdate(pressed('pay:month'));

    expect(sent[1]?.method).toBe('answerCallbackQuery');
    expect(invoiceIn(sent).currency).toBe('XTR');
    expect(await funnel.summary()).toMatchObject({ invoice: 1 });
  });

  it('turns a stale or forged acceptance into the current offer, never an invoice', async () => {
    const { bot, sent, texts, funnel } = priced();

    await bot.handleUpdate(pressed('pay:month:extra'));
    await bot.handleUpdate(pressed('pay:ghost'));

    expect(sent.filter((call) => call.method === 'sendInvoice')).toEqual([]);
    expect(texts().join('\n')).toContain('/pro month');
    expect(await funnel.summary()).toMatchObject({ invoice: 0 });
  });

  it('refuses a well-formed acceptance for a tier removed from the current offer', async () => {
    const sold = offering({ LEELA_STARS_YEAR: '1200' });
    const { bot, sent, texts, funnel } = priced({ stars: sold });

    await bot.handleUpdate(pressed('pay:month'));

    expect(sent.filter((call) => call.method === 'sendInvoice')).toEqual([]);
    expect(texts().join('\n')).toContain('/pro year');
    expect(texts().join('\n')).not.toContain('/pro month');
    expect(await funnel.summary()).toMatchObject({ invoice: 0 });
  });
});

describe('the invoice a price produces', () => {
  it('is in Stars, for the exact amount the environment named', async () => {
    for (const tier of ALL_THREE) {
      const { bot, sent, funnel } = priced();
      await bot.handleUpdate(typed(`/pro ${tier.id}`));
      await bot.handleUpdate(pressed(`pay:${tier.id}`));

      const invoice = invoiceIn(sent);
      expect(invoice.currency, tier.id).toBe('XTR');
      // The amount is read back out of the environment rather than restated:
      // a test that spells 150 twice agrees with itself and not with the file.
      expect(invoice.prices, tier.id).toEqual([
        { label: messageFor('en', 'pro.title'), amount: Number(price(tier.id)) },
      ]);
      // "Must contain exactly one item for payments in Telegram Stars."
      expect((invoice.prices as unknown[]).length).toBe(1);
      // Empty for Stars: a provider token is BotFather's answer for the other
      // currencies, and sending one here is how the call is refused.
      expect(invoice.provider_token, tier.id).toBe('');
      expect(invoice.payload, tier.id).toBe(payloadFor(tier.id));
      expect(tierOfPayload(String(invoice.payload)), tier.id).toBe(tier.id);
      expect(await funnel.summary(), tier.id).toMatchObject({ invoice: 1 });
    }
  });

  it('offers one tier per configured price, over every way of pricing them', async () => {
    // Exhaustive over the seven non-empty subsets: what `/pro` lists is what
    // the environment priced, never the three the code knows about.
    for (let mask = 1; mask < 8; mask += 1) {
      const chosen = TIERS.filter((_, index) => (mask & (1 << index)) !== 0);
      const env: Record<string, string> = {};
      for (const tier of chosen) env[tier.variable] = String(price(tier.id));

      const sold = offering(env);
      const { bot, texts } = priced({ stars: sold });
      await bot.handleUpdate(typed('/pro'));

      const said = texts().join('\n');
      for (const tier of TIERS) {
        const line = `/pro ${tier.id}`;
        expect(said.includes(line), `${mask}: ${tier.id}`).toBe(chosen.includes(tier));
      }

      // And the price beside each of them, as the environment wrote it.
      for (const tier of chosen) expect(said, `${mask}: ${tier.id}`).toContain(String(price(tier.id)));
    }
  });

  it('sends no invoice for a tier the deployment does not sell', async () => {
    const sold = offering({ LEELA_STARS_YEAR: '1200' });
    const { bot, sent, texts } = priced({ stars: sold });

    await bot.handleUpdate(typed('/pro month'));

    // The list, not a refusal: what a player asked for is not on offer, and
    // the answer to that is what is.
    expect(sent.filter((call) => call.method === 'sendInvoice')).toEqual([]);
    expect(texts().join('\n')).toContain('/pro year');
  });

  it('fits inside what Telegram accepts, in every language with a catalogue', () => {
    // Telegram refuses the whole call for an over-long title or description,
    // not the field — so a sentence that grew in translation would take the
    // rail down. `invoiceFor` slices; this is the check that it never has to.
    for (const language of translatedLanguages()) {
      for (const tier of ALL_THREE) {
        const invoice = invoiceFor(language, ALL_THREE, tier.id);

        expect(invoice.title.length, `${language} title`).toBeGreaterThan(0);
        expect(invoice.title.length, `${language} title`).toBeLessThanOrEqual(32);
        expect(messageFor(language, 'pro.title').length, `${language} title unsliced`)
          .toBeLessThanOrEqual(32);

        expect(invoice.description.length, `${language} description`).toBeGreaterThan(0);
        expect(invoice.description, `${language} description`).toContain(String(tier.days));
        expect(
          messageFor(language, 'pro.description', { days: tier.days }).length,
          `${language} description unsliced`,
        ).toBeLessThanOrEqual(255);

        // 1–128 bytes, and it has to survive the round trip that identifies
        // what was bought.
        expect(Buffer.byteLength(invoice.payload)).toBeGreaterThan(0);
        expect(Buffer.byteLength(invoice.payload)).toBeLessThanOrEqual(128);
      }
    }
  });

  it('goes to the player and not to the table, when it is asked for at one', async () => {
    // A payment is between a player and the bot. The offer and the invoice
    // both take the route every private reply takes — into their own chat —
    // and the group is told nothing about either.
    const { bot, sent } = priced();
    updateId += 1;
    await bot.handleUpdate({
      update_id: updateId,
      message: {
        message_id: updateId,
        date: 0,
        chat: { id: -1001, type: 'group', title: 'a table' },
        from: { id: PLAYER, is_bot: false, first_name: 'P' },
        text: '/pro month',
        entities: [{ type: 'bot_command', offset: 0, length: 4 }],
      },
    } as never);
    await bot.handleUpdate(pressed('pay:month'));

    const invoice = invoiceIn(sent);
    expect(String(invoice.chat_id)).toBe(String(PLAYER));
    expect(sent.map((call) => String(call.payload.chat_id))).not.toContain('-1001');
  });

  it('says what is true and no more, in the words the catalogue holds', async () => {
    const { bot, texts } = priced();
    await bot.handleUpdate(typed('/pro'));

    const said = texts().join('\n');
    expect(said).toContain(messageFor('en', 'pro.free'));
    expect(said).toContain(messageFor('en', 'pro.buys'));
    expect(said).toContain(messageFor('en', 'pro.refundable'));
  });

  it('answers in the asker’s language', async () => {
    const { bot, texts } = priced();
    updateId += 1;
    await bot.handleUpdate({
      update_id: updateId,
      message: {
        message_id: updateId,
        date: 0,
        chat: { id: PLAYER, type: 'private' },
        from: { id: PLAYER, is_bot: false, first_name: 'P', language_code: 'ru' },
        text: '/pro',
        entities: [{ type: 'bot_command', offset: 0, length: 4 }],
      },
    } as never);

    expect(texts().join('\n')).toContain(messageFor('ru', 'pro.free'));
  });
});

describe('a payment that arrives', () => {
  it('honours a completed payment even when the current offer changed or went dark', async () => {
    const cases = [
      {
        name: 'legacy month while only year remains for sale',
        stars: offering({ LEELA_STARS_YEAR: '1200' }),
        payload: 'leela:pro:month:v1',
        tier: 'month',
      },
      {
        name: 'consent-bound halfyear after every price was removed',
        stars: null,
        payload: payloadFor('halfyear'),
        tier: 'halfyear',
      },
    ] as const;

    for (const one of cases) {
      const { bot, entitlements, texts } = priced({ stars: one.stars });
      const charge = `completed-${one.tier}`;

      await bot.handleUpdate(paid({ payload: one.payload, amount: 150, charge }));

      expect((await entitlements.of(charge))?.tier, one.name).toBe(one.tier);
      expect(texts().join('\n'), one.name).toContain(messageFor('en', 'pro.thanks', {
        until: asDay(NOW + (one.tier === 'month' ? 30 : 182) * DAY),
      }));
    }
  });

  it('is written down, and read back as a date', async () => {
    const { bot, entitlements, texts, funnel } = priced();

    await bot.handleUpdate(
      paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-1' }),
    );

    const live = await entitlements.subscribed(String(PLAYER), NOW);
    expect(live?.until).toBe(NOW + 30 * DAY);
    expect(texts().join('\n')).toContain(asDay(NOW + 30 * DAY));
    expect(texts().join('\n')).toContain(messageFor('en', 'pro.thanks', { until: asDay(NOW + 30 * DAY) }));
    expect(await funnel.summary()).toMatchObject({ purchase: 1 });
  });

  it('still sends the invoice and keeps the payment when funnel storage is down', async () => {
    const broken: PaymentFunnelStore = {
      async record() {
        throw new Error('analytics unavailable');
      },
      async summary() {
        throw new Error('analytics unavailable');
      },
    };
    const { bot, sent, entitlements, texts } = priced({ funnel: broken });

    await bot.handleUpdate(typed('/pro month'));
    await bot.handleUpdate(pressed('pay:month'));
    expect(sent.some((call) => call.method === 'sendInvoice')).toBe(true);

    await bot.handleUpdate(
      paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-funnel-down' }),
    );
    expect(await entitlements.of('charge-funnel-down')).not.toBeNull();
    expect(texts().join('\n')).toContain(messageFor('en', 'pro.thanks', { until: asDay(NOW + 30 * DAY) }));
  });

  it('keeps the charge id only where a refund can find it, not in operator logs', async () => {
    const { bot, entitlements, logs } = priced();

    await bot.handleUpdate(paid({ payload: payloadFor('year'), amount: 1200, charge: 'charge-9' }));

    const held = await entitlements.of('charge-9');
    expect(held?.userId).toBe(String(PLAYER));
    expect(held?.tier).toBe('year');
    expect(held?.stars).toBe(1200);
    expect(held?.refundedAt).toBeNull();
    expect(logs.join('\n')).not.toContain('charge-9');
  });

  it('records what Telegram says was paid, not what the price says it should be', async () => {
    // The two can differ — a price edited between the invoice and the tap —
    // and the amount that actually left somebody's balance is the true one.
    const { bot, entitlements } = priced();

    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 149, charge: 'charge-2' }));

    expect((await entitlements.of('charge-2'))?.stars).toBe(149);
  });

  it('is not the player’s alone: another player’s date is their own', async () => {
    const { bot, entitlements } = priced();

    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-3' }));

    expect(await entitlements.subscribed(String(PLAYER), NOW)).not.toBeNull();
    expect(await entitlements.subscribed('999', NOW)).toBeNull();
  });

  it('runs out when it runs out', async () => {
    const { bot, entitlements } = priced();

    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-4' }));

    expect(await entitlements.subscribed(String(PLAYER), NOW + 30 * DAY - 1)).not.toBeNull();
    expect(await entitlements.subscribed(String(PLAYER), NOW + 30 * DAY)).toBeNull();
    expect(await entitlements.subscribed(String(PLAYER), NOW + 31 * DAY)).toBeNull();
  });

  it('says so plainly and raises an anonymous alarm when the payload names nothing this bot sells', async () => {
    const { bot, entitlements, texts, logs } = priced();

    await bot.handleUpdate(paid({ payload: 'somebody else:v9', amount: 150, charge: 'charge-5' }));

    // The money is real and nothing was recorded, so the player is told that
    // rather than thanked for something nothing here can honour.
    expect(texts()).toEqual([messageFor('en', 'pro.unmatched')]);
    expect(await entitlements.of('charge-5')).toBeNull();
    expect(logs.join('\n')).toContain('did not match a known tier');
    expect(logs.join('\n')).not.toContain('recording entitlement');
    expect(logs.join('\n')).not.toContain('charge-5');
  });

  it('tells the player when the record refuses the write, rather than thanking them', async () => {
    // The injected store is a promise the type holds nobody to — the rule
    // `audit-promises` states — and this is the one call where breaking it
    // means money has moved and nothing was kept.
    const broken = new MemoryEntitlementStore();
    broken.record = async () => {
      throw new Error('the disk is gone');
    };

    const { bot, texts, logs } = priced({ entitlements: broken });
    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-6' }));

    expect(texts()).toEqual([messageFor('en', 'pro.notKept')]);
    expect(logs.join('\n')).not.toContain('charge-6');
  });

  it('does not copy an inbound player id or full command into operator logs', async () => {
    const { bot, logs } = priced();

    await bot.handleUpdate(typed('/pro private-tail'));

    expect(logs.join('\n')).not.toContain(String(PLAYER));
    expect(logs.join('\n')).not.toContain('private-tail');
    expect(logs.join('\n')).toContain('[bot] <- private message:text /pro');
  });
});

describe('a second payment', () => {
  /**
   * **Extends rather than replaces**, and the choice is deliberate.
   *
   * A player who buys a second year in month eleven of the first has bought
   * two years. Replacing would quietly take eleven months from somebody for
   * paying again — the one direction of error that cannot be argued with
   * afterwards, because the evidence of what they had is what was overwritten.
   */
  it('adds its days to the end of what is already held', async () => {
    const { bot, entitlements } = priced();

    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-a' }));
    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-b' }));

    expect((await entitlements.subscribed(String(PLAYER), NOW))?.until).toBe(NOW + 60 * DAY);
  });

  it('starts from now when the first has already run out, not from the past', async () => {
    let clock = NOW;
    const { bot, entitlements } = priced({ now: () => clock });

    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-c' }));
    clock = NOW + 100 * DAY;
    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-d' }));

    // Not `NOW + 60 days`, which would sell a stretch of the past.
    expect((await entitlements.subscribed(String(PLAYER), clock))?.until).toBe(clock + 30 * DAY);
  });

  it('is one stretch when Telegram delivers the same charge twice', async () => {
    // An update is retried until the bot answers, so the same payment can
    // arrive more than once. Keyed by the charge, it buys one stretch.
    const { bot, entitlements } = priced();

    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'same' }));
    await bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge: 'same' }));

    expect((await entitlements.subscribed(String(PLAYER), NOW))?.until).toBe(NOW + 30 * DAY);
  });

  it('is the same arithmetic wherever it is done', () => {
    // The two stores share one function rather than each doing the sum, which
    // is what makes the sqlite case below the same rule and not a second one.
    expect(extendedTo(null, NOW, 30)).toBe(NOW + 30 * DAY);
    expect(extendedTo(NOW + 10 * DAY, NOW, 30)).toBe(NOW + 40 * DAY);
    expect(extendedTo(NOW - 10 * DAY, NOW, 30)).toBe(NOW + 30 * DAY);
    expect(extendedTo(NOW, NOW, 30)).toBe(NOW + 30 * DAY);
  });
});

describe('a payment that outlives the process that took it', () => {
  const temporary = () => join(mkdtempSync(join(tmpdir(), 'leela-stars-')), 'leela.db');

  it('is read back by a storage that never saw it written', async () => {
    const path = temporary();

    const first = openStorage({ path, log: () => undefined });
    expect(first.durable, 'a path was given and opened').toBe(true);
    await first.entitlements.record({
      userId: '700',
      chargeId: 'charge-restart',
      tier: 'year',
      stars: 1200,
      days: 365,
      at: NOW,
    });
    first.stopPruning?.();

    const second = openStorage({ path, log: () => undefined });
    const live = await second.entitlements.subscribed('700', NOW);
    const held = await second.entitlements.of('charge-restart');
    second.stopPruning?.();

    expect(live?.until).toBe(NOW + 365 * DAY);
    expect(held?.stars).toBe(1200);
  });

  it('extends across the restart, rather than starting again', async () => {
    const path = temporary();

    const first = openStorage({ path, log: () => undefined });
    await first.entitlements.record({
      userId: '700',
      chargeId: 'charge-one',
      tier: 'month',
      stars: 150,
      days: 30,
      at: NOW,
    });
    first.stopPruning?.();

    const second = openStorage({ path, log: () => undefined });
    await second.entitlements.record({
      userId: '700',
      chargeId: 'charge-two',
      tier: 'month',
      stars: 150,
      days: 30,
      at: NOW,
    });
    const live = await second.entitlements.subscribed('700', NOW);
    second.stopPruning?.();

    expect(live?.until).toBe(NOW + 60 * DAY);
  });

  it('counts a re-delivered charge once on disk too, not only in memory', async () => {
    // The same defect, in the other implementation. Both stores compute the
    // extension, so both have to refuse to compute it twice — and a fix in one
    // of two places is the shape this repository keeps finding.
    const storage = openStorage({ path: temporary(), log: () => undefined });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await storage.entitlements.record({
        userId: '700',
        chargeId: 'charge-retried',
        tier: 'month',
        stars: 150,
        days: 30,
        at: NOW,
      });
    }

    expect((await storage.entitlements.subscribed('700', NOW))?.until).toBe(NOW + 30 * DAY);
    storage.stopPruning?.();
  });

  it('is kept in memory, truthfully, when nothing is kept at all', async () => {
    // A deployment with no `LEELA_DB` still has to answer honestly about a
    // payment it has just been told about — the same rule the nudge store is
    // held to. What it must not do is have no store and drop it.
    const storage = openStorage({ log: () => undefined });

    expect(storage.durable).toBe(false);
    await storage.entitlements.record({
      userId: '700',
      chargeId: 'charge-memory',
      tier: 'month',
      stars: 150,
      days: 30,
      at: NOW,
    });

    expect((await storage.entitlements.subscribed('700', NOW))?.until).toBe(NOW + 30 * DAY);
  });

  it('survives a restart of the bot, not only of the storage', async () => {
    const path = temporary();

    const first = openStorage({ path, log: () => undefined });
    const before = priced({ entitlements: first.entitlements });
    await before.bot.handleUpdate(
      paid({ payload: payloadFor('halfyear'), amount: 700, charge: 'charge-across' }),
    );
    first.stopPruning?.();

    const second = openStorage({ path, log: () => undefined });
    const live = await second.entitlements.subscribed(String(PLAYER), NOW);
    second.stopPruning?.();

    expect(live?.until).toBe(NOW + 182 * DAY);
  });
});

describe('giving the money back', () => {
  async function bought(harness: Harness, charge = 'charge-r'): Promise<Harness> {
    await harness.bot.handleUpdate(paid({ payload: payloadFor('month'), amount: 150, charge }));
    return harness;
  }

  it('calls Telegram’s own refund, with the payer and the charge', async () => {
    const harness = await bought(priced());
    await harness.bot.handleUpdate(typed('/refund charge-r', OPERATOR));

    const refunds = harness.sent.filter((call) => call.method === 'refundStarPayment');
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.payload).toMatchObject({
      user_id: PLAYER,
      telegram_payment_charge_id: 'charge-r',
    });
  });

  it('clears the entitlement, so the date stops counting', async () => {
    const harness = await bought(priced());
    expect(await harness.entitlements.subscribed(String(PLAYER), NOW)).not.toBeNull();

    await harness.bot.handleUpdate(typed('/refund charge-r', OPERATOR));

    expect(await harness.entitlements.subscribed(String(PLAYER), NOW)).toBeNull();
    // The row stays: what happened is a fact, and an operator asked to explain
    // it a month later has only this to read.
    expect((await harness.entitlements.of('charge-r'))?.refundedAt).toBe(NOW);
  });

  it('leaves the other payment standing when a player has made two', async () => {
    // The reason payments are kept one row each: a refund undoes one charge.
    const harness = priced();
    await bought(harness, 'charge-first');
    await bought(harness, 'charge-second');
    expect((await harness.entitlements.subscribed(String(PLAYER), NOW))?.until).toBe(NOW + 60 * DAY);

    await harness.bot.handleUpdate(typed('/refund charge-second', OPERATOR));

    expect((await harness.entitlements.subscribed(String(PLAYER), NOW))?.until).toBe(NOW + 30 * DAY);
  });

  it('tells the player, in the words that say what happened', async () => {
    const harness = await bought(priced());
    await harness.bot.handleUpdate(typed('/refund charge-r', OPERATOR));

    const said = harness.sent
      .filter((call) => call.method === 'sendMessage')
      .map((call) => ({ to: String(call.payload.chat_id), text: String(call.payload.text) }));

    expect(said).toContainEqual({
      to: String(PLAYER),
      text: messageFor('en', 'pro.refunded', { stars: 150 }),
    });
    expect(said).toContainEqual({
      to: String(OPERATOR),
      text: messageFor('en', 'pro.refundDone', { stars: 150, user: String(PLAYER) }),
    });
  });

  it('does not touch its own record when Telegram refuses', async () => {
    // Telegram first, this bot's record second. A record cleared for a refund
    // that did not happen is a player told they have been paid back when they
    // have not.
    const harness = await bought(priced({ refuseRefund: 'CHARGE_ALREADY_REFUNDED' }));
    await harness.bot.handleUpdate(typed('/refund charge-r', OPERATOR));

    expect(await harness.entitlements.subscribed(String(PLAYER), NOW)).not.toBeNull();
    expect(harness.texts().join('\n')).toContain('CHARGE_ALREADY_REFUNDED');
  });

  it('says which half happened when its own record refuses the write', async () => {
    // The state a floor message would describe wrongly: Telegram has the money
    // back and this bot's record still counts the date. *Something went wrong*
    // reads as *nothing happened*, and what happened is a refund.
    const harness = await bought(priced());
    (harness.entitlements as { refund: unknown }).refund = async () => {
      throw new Error('the disk is gone');
    };

    await harness.bot.handleUpdate(typed('/refund charge-r', OPERATOR));

    expect(harness.sent.filter((call) => call.method === 'refundStarPayment')).toHaveLength(1);
    expect(harness.texts()).toContain(
      messageFor('en', 'pro.refundNotCleared', { charge: 'charge-r' }),
    );
    expect(harness.logs.join('\n')).toContain('could not clear');
    expect(harness.logs.join('\n')).not.toContain('charge-r');
  });

  it('says so rather than pretending, for a charge it has never heard of', async () => {
    const harness = priced();
    await harness.bot.handleUpdate(typed('/refund no-such-charge', OPERATOR));

    expect(harness.sent.filter((call) => call.method === 'refundStarPayment')).toEqual([]);
    expect(harness.texts()).toEqual([
      messageFor('en', 'pro.refundUnknown', { charge: 'no-such-charge' }),
    ]);
  });

  it('asks which payment when it is sent without one', async () => {
    const harness = priced();
    await harness.bot.handleUpdate(typed('/refund', OPERATOR));

    expect(harness.texts()).toEqual([messageFor('en', 'pro.refundWhich')]);
  });

  it('is not a player’s command: to them it does not exist', async () => {
    const harness = await bought(priced());
    const before = harness.texts().length;
    await harness.bot.handleUpdate(typed('/refund charge-r', PLAYER));

    // Byte for byte what any unknown command earns — not a refusal, which
    // would tell them the command is there and that they are not allowed it.
    expect(harness.sent.filter((call) => call.method === 'refundStarPayment')).toEqual([]);
    expect(harness.texts().slice(before)).toEqual([messageFor('en', 'chat.unknown')]);
    expect(await harness.entitlements.subscribed(String(PLAYER), NOW)).not.toBeNull();
  });

  it('is not registered at all where nobody is named as an operator', async () => {
    const harness = priced({ operators: [] });
    await harness.bot.handleUpdate(typed('/refund charge-r', OPERATOR));

    expect(harness.texts()).toEqual([messageFor('en', 'chat.unknown')]);
  });
});

describe('what the offer says back to a player who has already paid', () => {
  it('names the date they hold, and still nothing else', async () => {
    const harness = priced();
    await harness.bot.handleUpdate(
      paid({ payload: payloadFor('month'), amount: 150, charge: 'charge-held' }),
    );
    await harness.bot.handleUpdate(typed('/pro'));

    const said = harness.texts().join('\n');
    expect(said).toContain(messageFor('en', 'pro.held', { until: asDay(NOW + 30 * DAY) }));
    // And the free game is still the first thing it says.
    expect(said).toContain(messageFor('en', 'pro.free'));
  });

  it('says nothing about a date to somebody who holds none', () => {
    const said = offerFor('en', ALL_THREE, null);
    expect(said).not.toContain(messageFor('en', 'pro.held', { until: asDay(NOW) }));
    expect(said).toContain(messageFor('en', 'pro.free'));
  });
});

/** What the priced environment says a tier costs, read rather than restated. */
function price(id: string): number {
  const tier = TIERS.find((one) => one.id === id);
  return Number(PRICED[tier?.variable as keyof typeof PRICED]);
}
