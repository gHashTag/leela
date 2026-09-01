/**
 * A rail that exists and is switched off, and the difference being provable.
 *
 * Whether this game charges for anything, and what for, is the owner's
 * decision and it has not been made. So the Telegram Stars rail is written and
 * tested and **dark**: with no price in the environment there is no `/pro`, no
 * payment surface, no invoice, and nothing anywhere that says a word about
 * money. That claim is the whole of this file.
 *
 * **What "nothing is sent" honestly means, measured rather than asserted.**
 * The obvious phrasing — *a dark bot makes zero API calls for `/pro`* — is
 * false, and it is false in the direction that matters: `/pro` at a bot with no
 * price registered is an unknown command, and this bot has answered unknown
 * commands with *I do not know that one* since before the rail was written.
 * Zero calls would be a **change** in behaviour. So the claim asserted here is
 * the stronger and truer one:
 *
 *   - `/pro`, `/terms`, `/paysupport`, and a tier request are answered **byte
 *     for byte** as any word this bot does not know is answered — the same one
 *     call, the same one sentence, in the same chat;
 *   - a `pre_checkout_query` produces **zero** calls because new charges are
 *     dark, while a `successful_payment` from an older priced deployment is
 *     still fulfilled so already-spent Stars never buy nothing;
 *   - across all of it, no call is `sendInvoice` or `answerPreCheckoutQuery`,
 *     and no sentence sent carries any of the Stars catalogue's words or a
 *     star.
 *
 * The gate itself is checked exhaustively, because the shape allows it: three
 * variables, each absent, priced or mistyped, is twenty-seven environments and
 * every one of them is run.
 */

import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import { createBot } from '../src/bot';
import {
  NothingIsSoldError,
  TIERS,
  invoiceFor,
  offering,
  operatorIds,
  whyNoOperators,
  whyNothingIsSold,
  type Environment,
} from '../src/stars';

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

/** A command typed in a private chat. */
function typed(text: string) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: 700, type: 'private' as const },
      from: { id: 700, is_bot: false, first_name: 'P' },
      text,
      entities: [
        { type: 'bot_command' as const, offset: 0, length: (text.split(' ')[0] ?? '').length },
      ],
    },
  } as never;
}

/** What Telegram would send if an invoice this bot never sent were paid. */
function paid(payload: string) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: 700, type: 'private' as const },
      from: { id: 700, is_bot: false, first_name: 'P' },
      successful_payment: {
        currency: 'XTR',
        total_amount: 150,
        invoice_payload: payload,
        telegram_payment_charge_id: 'charge-1',
        provider_payment_charge_id: 'provider-1',
      },
    },
  } as never;
}

/** The same for the question Telegram asks before taking the money. */
function checkingOut(payload: string) {
  updateId += 1;
  return {
    update_id: updateId,
    pre_checkout_query: {
      id: String(updateId),
      from: { id: 700, is_bot: false, first_name: 'P' },
      currency: 'XTR',
      total_amount: 150,
      invoice_payload: payload,
    },
  } as never;
}

/**
 * A bot built the way a deployment with no prices builds one.
 *
 * No `stars` option at all: `createBot` reads `process.env` for itself, which
 * is the code path production takes. `offering(process.env)` is asserted to be
 * null first, so a machine that happened to have a price set would fail loudly
 * here rather than pass this file for the wrong reason.
 */
function darkBot() {
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];

  const bot = createBot({ token: '1:TEST', botInfo: BOT_INFO, log: () => undefined });
  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: 1 } } as never;
  });

  return { bot, sent };
}

/** Every environment three variables can be in, in one list. */
const STATES = ['absent', 'priced', 'mistyped'] as const;
type State = (typeof STATES)[number];

function environmentOf(states: readonly State[]): Environment {
  const env: Environment = {};
  TIERS.forEach((tier, index) => {
    const state = states[index] as State;
    if (state === 'priced') env[tier.variable] = String(100 + index);
    if (state === 'mistyped') env[tier.variable] = 'a hundred';
  });
  return env;
}

/** All twenty-seven of them. */
const EVERY_ENVIRONMENT: State[][] = STATES.flatMap((first) =>
  STATES.flatMap((second) => STATES.map((third) => [first, second, third])),
);

describe('the gate, over every environment three variables can be in', () => {
  it('is twenty-seven environments, so the sweep is the whole space', () => {
    expect(TIERS).toHaveLength(3);
    expect(EVERY_ENVIRONMENT).toHaveLength(27);
    expect(new Set(EVERY_ENVIRONMENT.map((one) => one.join(','))).size).toBe(27);
  });

  it('sells exactly the tiers that are priced, and nothing at all if any is mistyped', () => {
    for (const states of EVERY_ENVIRONMENT) {
      const env = environmentOf(states);
      const sold = offering(env);
      const where = states.join(',');

      const priced = TIERS.filter((_, index) => states[index] === 'priced');
      const mistyped = states.includes('mistyped');

      if (mistyped || priced.length === 0) {
        // One unreadable price darkens all of them: a deployment that meant to
        // charge twice and mistyped one is not a deployment that meant to
        // charge once, and the safe direction of failure is no money changing
        // hands. The reason is said out loud rather than left to be guessed.
        expect(sold, where).toBeNull();
        expect(whyNothingIsSold(env), where).toBeTruthy();
        continue;
      }

      expect(sold?.map((tier) => tier.id), where).toEqual(priced.map((tier) => tier.id));
      expect(whyNothingIsSold(env), where).toBeNull();
    }
  });

  it('carries the price and the duration each tier was written with', () => {
    for (const states of EVERY_ENVIRONMENT) {
      const sold = offering(environmentOf(states));
      if (!sold) continue;

      for (const tier of sold) {
        const shape = TIERS.find((one) => one.id === tier.id);
        expect(tier.days, tier.id).toBe(shape?.days);
        expect(tier.stars, tier.id).toBe(100 + TIERS.findIndex((one) => one.id === tier.id));
      }
    }
  });

  it('names the variable that was mistyped, so an operator can find it', () => {
    for (const tier of TIERS) {
      const why = whyNothingIsSold({ [tier.variable]: 'lots' }) ?? '';
      expect(why, tier.variable).toContain(tier.variable);
      expect(why, tier.variable).toContain('lots');
    }
  });

  it('names every variable when none is set, so an operator knows what to set', () => {
    const why = whyNothingIsSold({}) ?? '';
    for (const tier of TIERS) expect(why).toContain(tier.variable);
  });
});

describe('what counts as a price', () => {
  /**
   * Written out because a price is money and the failure is silent: a form
   * this reader takes differently from the person who typed it is a wrong
   * amount charged, or a tier that vanishes without a word.
   *
   * `1e3` and `12.00` are **taken**, and that is a decision rather than an
   * oversight: both are whole numbers of Stars, however oddly written. `12,50`
   * is the dangerous one — a decimal comma — and it is refused rather than
   * silently read as 12.
   */
  const TAKEN: Array<[string, number]> = [
    ['1', 1],
    ['150', 150],
    ['  150  ', 150],
    ['+150', 150],
    ['12.00', 12],
    ['1e3', 1000],
  ];

  const REFUSED = ['0', '-1', '1.5', '12,50', 'abc', '150 stars', 'NaN', 'Infinity', '½', '一'];

  it.each(TAKEN)('takes %s as %i Stars', (written, stars) => {
    const sold = offering({ LEELA_STARS_MONTH: written });
    expect(sold?.[0]?.stars).toBe(stars);
  });

  it.each(REFUSED)('refuses %s, and sells nothing at all', (written) => {
    expect(offering({ LEELA_STARS_MONTH: written })).toBeNull();
    expect(whyNothingIsSold({ LEELA_STARS_MONTH: written })).toContain('LEELA_STARS_MONTH');
  });

  it('treats an empty or blank variable as one nobody set', () => {
    // Not a mistyped price: a variable set to nothing is how a platform
    // renders an unset one, and refusing the whole offering for it would
    // darken a deployment that priced the other two on purpose.
    for (const blank of ['', '   ', '\n']) {
      expect(offering({ LEELA_STARS_MONTH: blank, LEELA_STARS_YEAR: '900' })?.length).toBe(1);
    }
  });
});

describe('who may hand money back', () => {
  it('is nobody unless somebody is named', () => {
    expect(operatorIds({})).toEqual([]);
    expect(whyNoOperators({})).toContain('LEELA_STARS_OPERATORS');
  });

  it('takes a list of ids, and refuses the whole list if any of it is not one', () => {
    expect(operatorIds({ LEELA_STARS_OPERATORS: '11' })).toEqual(['11']);
    expect(operatorIds({ LEELA_STARS_OPERATORS: ' 11 , 22 ' })).toEqual(['11', '22']);

    // A half-read list of who is trusted with a refund is worse than none.
    for (const written of ['11,ada', '-11', '0', '1e3', '11;22', 'everyone']) {
      expect(operatorIds({ LEELA_STARS_OPERATORS: written }), written).toEqual([]);
      expect(whyNoOperators({ LEELA_STARS_OPERATORS: written }), written).toContain(written);
    }
  });
});

describe('an invoice nobody priced', () => {
  it('refuses to exist, and says why, rather than being assembled for nothing', () => {
    // The internal call: no command reaches this while the rail is dark, so
    // this is the caller that arrives from inside — code that assembles an
    // invoice without asking whether anything is sold.
    expect(() => invoiceFor('en', null, 'month')).toThrow(NothingIsSoldError);

    try {
      invoiceFor('en', null, 'month');
    } catch (error) {
      const why = (error as Error).message;
      for (const tier of TIERS) expect(why).toContain(tier.variable);
    }
  });

  it('refuses a tier this deployment does not sell, naming the ones it does', () => {
    const sold = offering({ LEELA_STARS_YEAR: '900' });

    expect(() => invoiceFor('en', sold, 'month')).toThrow(NothingIsSoldError);
    expect(() => invoiceFor('en', sold, null)).toThrow(NothingIsSoldError);
    expect(() => invoiceFor('en', sold, 'anything')).toThrow(/year/);
    // And the one it does sell is assembled.
    expect(invoiceFor('en', sold, 'year').prices[0]?.amount).toBe(900);
  });
});

describe('a deployment nobody priced, driven', () => {
  it('has no price in this environment, or nothing below proves anything', () => {
    expect(offering(process.env)).toBeNull();
  });

  it('answers every priced-only command exactly as it answers a word it does not know', async () => {
    const known = darkBot();
    await known.bot.handleUpdate(typed('/pro'));
    await known.bot.handleUpdate(typed('/pro month'));
    await known.bot.handleUpdate(typed('/terms'));
    await known.bot.handleUpdate(typed('/paysupport'));

    const unknown = darkBot();
    await unknown.bot.handleUpdate(typed('/flibbertigibbet'));

    // One call each, the same method, the same sentence: the bot a player
    // meets is the bot that existed before the rail was written.
    expect(known.sent.map((call) => call.method)).toEqual([
      'sendMessage',
      'sendMessage',
      'sendMessage',
      'sendMessage',
    ]);
    expect(known.sent.map((call) => call.payload.text)).toEqual([
      unknown.sent[0]?.payload.text,
      unknown.sent[0]?.payload.text,
      unknown.sent[0]?.payload.text,
      unknown.sent[0]?.payload.text,
    ]);
    expect(known.sent[0]?.payload.text).toBe(messageFor('en', 'chat.unknown'));
  });

  it('starts no checkout, but fulfils a payment an older deployment completed', async () => {
    const { bot, sent } = darkBot();

    await bot.handleUpdate(checkingOut('leela:pro:month:v1'));
    await bot.handleUpdate(paid('leela:pro:month:v1'));
    await bot.handleUpdate(checkingOut('anything else'));
    await bot.handleUpdate(paid('anything else'));

    expect(sent.map((call) => call.method)).toEqual(['sendMessage', 'sendMessage']);
    const thanks = messageFor('en', 'pro.thanks', { until: '__DATE__' }).split('__DATE__')[0];
    expect(String(sent[0]?.payload.text)).toContain(thanks);
    expect(sent[1]?.payload.text).toBe(messageFor('en', 'pro.unmatched'));
  });

  it('says nothing about money at all, across its whole command surface', async () => {
    const { bot, sent } = darkBot();

    for (const line of [
      '/start',
      '/help',
      '/pro',
      '/pro month',
      '/pro year',
      '/terms',
      '/paysupport',
      '/refund charge-1',
      '/new',
      '/board',
      '/path',
    ]) {
      await bot.handleUpdate(typed(line));
    }

    // No payment call was even attempted.
    expect(sent.filter((call) => call.method !== 'sendMessage')).toEqual([]);

    // And nothing said carries a word from the Stars catalogue, or a star.
    const said = sent.map((call) => String(call.payload.text ?? '')).join('\n');
    for (const key of [
      'pro.free',
      'pro.buys',
      'pro.refundable',
      'pro.terms',
      'pro.paymentSupport',
      'pro.thanks',
      'menu.pro',
    ] as const) {
      for (const language of ['en', 'ru'] as const) {
        expect(said, `${language} ${key}`).not.toContain(messageFor(language, key));
      }
    }
    expect(said).not.toContain('⭐');
    expect(said).not.toContain('XTR');
    expect(said).not.toContain('/pro');
  });

  it('registers no /refund even for somebody named, while nothing is sold', async () => {
    // Both gates, and the outer one wins: `LEELA_STARS_OPERATORS` names an
    // operator and there is nothing to refund, because there was never
    // anything to buy.
    const sent: Array<{ method: string }> = [];
    const bot = createBot({
      token: '1:TEST',
      botInfo: BOT_INFO,
      log: () => undefined,
      stars: null,
      operators: ['700'],
    });
    bot.api.config.use(async (_prev, method) => {
      sent.push({ method });
      return { ok: true, result: { message_id: 1 } } as never;
    });

    await bot.handleUpdate(typed('/refund charge-1'));

    expect(sent.map((call) => call.method)).toEqual(['sendMessage']);
  });
});
