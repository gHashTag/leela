import { describe, expect, it } from 'vitest';
import { attributePaymentStage, funnelSaid } from '../src/payment-funnel';
import { MemoryPaymentFunnelStore, type PaymentFunnelStore } from '../src/store';

const EMPTY = { trial: 0, paywall: 0, invoice: 0, purchase: 0, return: 0 };

describe('the paid-play player funnel', () => {
  it('counts each milestone once per player, however often Telegram retries it', async () => {
    const funnel = new MemoryPaymentFunnelStore();

    for (const stage of ['trial', 'paywall', 'invoice', 'purchase', 'return'] as const) {
      await funnel.record('player-one', stage, 100);
      await funnel.record('player-one', stage, 101);
      await funnel.record('player-one', stage, 102);
    }

    expect(await funnel.summary()).toEqual({
      trial: 1,
      paywall: 1,
      invoice: 1,
      purchase: 1,
      return: 1,
    });
  });

  it('counts players rather than offers, invoices, or payment update attempts', async () => {
    const funnel = new MemoryPaymentFunnelStore();
    await funnel.record('player-one', 'paywall', 100);
    await funnel.record('player-two', 'paywall', 101);
    await funnel.record('player-two', 'invoice', 102);

    expect(await funnel.summary()).toEqual({
      ...EMPTY,
      paywall: 2,
      invoice: 1,
    });
  });

  it('says only aggregate counts to an operator', () => {
    const said = funnelSaid({ trial: 7, paywall: 5, invoice: 4, purchase: 3, return: 2 });

    expect(said).toBe('Payment funnel: trial 7, paywall 5, invoice 4, purchase 3, return 2.');
    expect(said).not.toMatch(/player|charge|payload/i);
  });
});

describe('funnel attribution is analytics, never gameplay', () => {
  it('emits no correlatable success line', async () => {
    const funnel = new MemoryPaymentFunnelStore();
    const said: string[] = [];

    await expect(
      attributePaymentStage({
        funnel,
        userId: 'private-player-id',
        stage: 'invoice',
        at: 100,
        log: (line) => said.push(line),
      }),
    ).resolves.toBe(true);

    expect(said).toEqual([]);
    expect(await funnel.summary()).toEqual({ ...EMPTY, invoice: 1 });
  });

  it('cannot interrupt a move, invoice, or payment when storage and logging fail', async () => {
    const funnel: PaymentFunnelStore = {
      async record() {
        throw new Error('database failed for private-player-id and charge-secret');
      },
      async summary() {
        throw new Error('unused');
      },
    };
    const said: string[] = [];

    await expect(
      attributePaymentStage({
        funnel,
        userId: 'private-player-id',
        stage: 'purchase',
        at: 100,
        log: (line) => said.push(line),
      }),
    ).resolves.toBe(false);

    expect(said).toEqual(['[payments] purchase milestone could not be recorded.']);
    expect(said.join(' ')).not.toMatch(/private-player-id|charge-secret/);

    await expect(
      attributePaymentStage({
        funnel,
        userId: 'private-player-id',
        stage: 'return',
        at: 101,
        log: () => {
          throw new Error('logger failed');
        },
      }),
    ).resolves.toBe(false);
  });
});
