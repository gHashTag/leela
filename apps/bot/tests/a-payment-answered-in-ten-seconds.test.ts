/**
 * The one handler in this bot with a deadline on it.
 *
 * Telegram's own words, in `answerPreCheckoutQuery`'s documentation: *the Bot
 * API must receive an answer within 10 seconds after the pre-checkout query
 * was sent.* Past that the payment fails, and it fails for the player with no
 * reason given — the worst kind of failure this repository knows, because it
 * is indistinguishable from a broken bot and it happens at the moment somebody
 * is trying to give you money.
 *
 * Ten seconds is a long time and that is exactly the trap: a database read, a
 * model call or a retry costs nothing on a good day and everything on a bad
 * one, and nothing in the type system says which of them is on this path.
 * `bot.ts` has three other handlers that read a store before answering, and
 * this is the one where doing so is a defect rather than a habit.
 *
 * **So the shape asserted here is not "it is fast".** It is that *nothing
 * awaited stands between the update arriving and the answer going out*, proved
 * two ways that fail differently:
 *
 *   - every injected dependency is replaced with one whose promises **never
 *     settle** — the kind of failure no `catch` can see, and the kind
 *     `audit-promises` exists to require a test for. The answer still goes out;
 *   - and the stores are watched: the number of times the pre-checkout path
 *     touches one is asserted to be zero, so a read that happened to be fast
 *     in a test would still fail here.
 *
 * The validation is the other half, and it happens *before* the answer rather
 * than after: the three things that can be wrong are all in hand the moment the
 * update arrives, so checking them costs nothing and refusing a payment this
 * bot cannot honour is worth everything.
 */

import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import { createBot } from '../src/bot';
import { payloadFor, type PricedTier } from '../src/stars';
import type { Entitlement, EntitlementStore, ReportSink, RoomStore, Subscription } from '../src/store';

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

const SOLD: readonly PricedTier[] = [
  { id: 'month', stars: 150, days: 30 },
  { id: 'year', stars: 1200, days: 365 },
];

let updateId = 0;

function checkingOut(query: { payload: string; currency: string; amount: number }) {
  updateId += 1;
  return {
    update_id: updateId,
    pre_checkout_query: {
      id: `q${updateId}`,
      from: { id: 700, is_bot: false, first_name: 'P' },
      currency: query.currency,
      total_amount: query.amount,
      invoice_payload: query.payload,
    },
  } as never;
}

/** A promise nobody will ever settle — a store that has stopped answering. */
const never = <T,>(): Promise<T> => new Promise<T>(() => undefined);

/** Every store this bot takes, counting what is asked of it and answering nothing. */
function stoppedStores() {
  const touched: string[] = [];
  const watch = <T,>(what: string): Promise<T> => {
    touched.push(what);
    return never<T>();
  };

  const entitlements: EntitlementStore = {
    record: () => watch<Entitlement>('entitlements.record'),
    subscribed: () => watch<Subscription | null>('entitlements.subscribed'),
    of: () => watch<Entitlement | null>('entitlements.of'),
    refund: () => watch<Entitlement | null>('entitlements.refund'),
  };

  const store: RoomStore = {
    get: () => watch('store.get'),
    save: () => watch('store.save'),
    delete: () => watch('store.delete'),
    roomOf: () => watch('store.roomOf'),
    allRooms: () => watch('store.allRooms'),
  };

  const reports: ReportSink = {
    record: () => watch('reports.record'),
    history: () => watch('reports.history'),
    intention: () => watch('reports.intention'),
    setIntention: () => watch('reports.setIntention'),
  };

  return { touched, entitlements, store, reports };
}

interface Answered {
  method: string;
  payload: Record<string, unknown>;
}

/**
 * Drive one pre-checkout query at a bot whose every store has stopped.
 *
 * The whole update is raced against a timer: a handler that awaits a store
 * here would never return, and a test that simply awaited it would fail as a
 * timeout minutes later with nothing said about why.
 */
async function answerFor(query: {
  payload: string;
  currency: string;
  amount: number;
}): Promise<{ calls: Answered[]; touched: string[]; logs: string[] }> {
  const stopped = stoppedStores();
  const calls: Answered[] = [];
  const logs: string[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: (line) => logs.push(line),
    stars: SOLD,
    entitlements: stopped.entitlements,
    store: stopped.store,
    reports: stopped.reports,
  });

  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: true } as never;
  });

  const handled = bot.handleUpdate(checkingOut(query));
  const timer = new Promise<'hung'>((resolve) => {
    setTimeout(() => resolve('hung'), 1_000).unref?.();
  });

  const outcome = await Promise.race([handled.then(() => 'answered' as const), timer]);
  expect(outcome, 'the pre-checkout answer waited on something that never came').toBe('answered');

  return { calls, touched: stopped.touched, logs };
}

describe('the ten-second answer', () => {
  it('goes out with every store this bot has stopped answering', async () => {
    const { calls } = await answerFor({
      payload: payloadFor('month'),
      currency: 'XTR',
      amount: 150,
    });

    expect(calls.map((call) => call.method)).toEqual(['answerPreCheckoutQuery']);
    expect(calls[0]?.payload.ok).toBe(true);
  });

  it('touches no store at all on the way to it', async () => {
    // Stronger than the race above, which a fast read would pass: the
    // pre-checkout path is asserted to ask nothing of anything. A store read
    // added here tomorrow fails this by name.
    const { touched } = await answerFor({
      payload: payloadFor('month'),
      currency: 'XTR',
      amount: 150,
    });

    expect(touched, 'the pre-checkout path read a store').toEqual([]);
  });

  it('answers before it does anything else, on a refusal as much as on a yes', async () => {
    const { calls, touched } = await answerFor({
      payload: 'not from this bot',
      currency: 'XTR',
      amount: 150,
    });

    expect(calls.map((call) => call.method)).toEqual(['answerPreCheckoutQuery']);
    expect(touched).toEqual([]);
  });
});

describe('what is checked before the answer', () => {
  it('refuses an unpaid invoice issued before explicit Terms acceptance existed', async () => {
    const { calls } = await answerFor({
      payload: 'leela:pro:month:v1',
      currency: 'XTR',
      amount: 150,
    });

    expect(calls[0]?.payload.ok).toBe(false);
  });

  /**
   * Three things, all of them in hand the moment the update arrives: this rail
   * wrote the payload, the tier it names is still sold, and the amount is what
   * it is sold for. Every combination is run, because the shape allows it and
   * because each of the three has its own way of being wrong.
   */
  const PAYLOADS: Array<[string, string, boolean]> = [
    ['this rail wrote it, and the tier is sold', payloadFor('month'), true],
    ['this rail wrote it, and the tier is not sold here', payloadFor('halfyear'), false],
    ['another bot wrote it', 'somebody:else:v1', false],
    ['nobody wrote it', '', false],
  ];
  const CURRENCIES: Array<[string, boolean]> = [
    ['XTR', true],
    ['USD', false],
    ['', false],
  ];
  const AMOUNTS: Array<[number, boolean]> = [
    [150, true],
    [149, false],
    [1200, false],
    [0, false],
  ];

  it('takes a payment exactly when all three are right, over every way they can be wrong', async () => {
    for (const [what, payload, payloadIsRight] of PAYLOADS) {
      for (const [currency, currencyIsRight] of CURRENCIES) {
        for (const [amount, amountIsRight] of AMOUNTS) {
          const { calls } = await answerFor({ payload, currency, amount });
          const answer = calls[0]?.payload ?? {};
          const where = `${what} / ${currency || '(none)'} / ${amount}`;

          expect(answer.ok, where).toBe(payloadIsRight && currencyIsRight && amountIsRight);
        }
      }
    }
  });

  it('gives a reason a player can read when it refuses, and none when it does not', async () => {
    const refused = await answerFor({ payload: payloadFor('month'), currency: 'XTR', amount: 1 });
    expect(refused.calls[0]?.payload.error_message).toBe(messageFor('en', 'pro.cannotTake'));

    const taken = await answerFor({ payload: payloadFor('month'), currency: 'XTR', amount: 150 });
    expect(taken.calls[0]?.payload.error_message).toBeUndefined();
  });

  it('says the refusal in the payer’s own language', async () => {
    // Telegram shows this inside the payment sheet, so it is read at the one
    // moment a sentence in the wrong language is least welcome.
    const stopped = stoppedStores();
    const calls: Answered[] = [];

    const bot = createBot({
      token: '1:TEST',
      botInfo: BOT_INFO,
      log: () => undefined,
      stars: SOLD,
      entitlements: stopped.entitlements,
    });
    bot.api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as Record<string, unknown> });
      return { ok: true, result: true } as never;
    });

    updateId += 1;
    await bot.handleUpdate({
      update_id: updateId,
      pre_checkout_query: {
        id: `q${updateId}`,
        from: { id: 700, is_bot: false, first_name: 'P', language_code: 'ru' },
        currency: 'XTR',
        total_amount: 1,
        invoice_payload: payloadFor('month'),
      },
    } as never);

    expect(calls[0]?.payload.error_message).toBe(messageFor('ru', 'pro.cannotTake'));
  });

  it('records a refused checkout without correlating it to a player or payload', async () => {
    const { logs } = await answerFor({ payload: payloadFor('month'), currency: 'USD', amount: 150 });
    const said = logs.join('\n');

    expect(said).toContain('refused a pre-checkout');
    expect(said).not.toContain('700');
    expect(said).not.toContain('USD');
    expect(said).not.toContain(payloadFor('month'));
  });

  it('says nothing to the log about one it took', async () => {
    const { logs } = await answerFor({
      payload: payloadFor('month'),
      currency: 'XTR',
      amount: 150,
    });

    expect(logs.filter((line) => line.includes('refused'))).toEqual([]);
  });
});
