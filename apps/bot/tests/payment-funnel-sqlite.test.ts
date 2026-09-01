import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteRoomQueries, openDatabase, sqlitePaymentFunnel } from '../src/sqlite';

const directories: string[] = [];

function pathFor(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'leela-payment-funnel-'));
  directories.push(directory);
  return join(directory, `${name}.db`);
}

afterEach(() => {
  while (directories.length > 0) {
    const directory = directories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe('the durable payment funnel', () => {
  it('is idempotent per player and milestone and keeps only aggregate output', async () => {
    const queries = new SqliteRoomQueries({ path: pathFor('counts'), now: () => 999 });
    const funnel = sqlitePaymentFunnel(queries);

    await funnel.record('player-one', 'trial', 100);
    await funnel.record('player-one', 'trial', 101);
    await funnel.record('player-one', 'paywall', 102);
    await funnel.record('player-two', 'paywall', 103);
    await funnel.record('player-two', 'invoice', 104);

    expect(await funnel.summary()).toEqual({
      trial: 1,
      paywall: 2,
      invoice: 1,
      purchase: 0,
      return: 0,
    });
    queries.close();
  });

  it('survives a restart and preserves the first milestone timestamp', async () => {
    const path = pathFor('restart');
    let observedAt = 200;
    const first = new SqliteRoomQueries({ path, now: () => observedAt });
    await sqlitePaymentFunnel(first).record('player-one', 'purchase', 100);
    observedAt = 300;
    await sqlitePaymentFunnel(first).record('player-one', 'purchase', 250);
    first.close();

    const raw = openDatabase(path);
    const row = raw
      .prepare('SELECT purchase_at, updated_at FROM payment_funnel WHERE user_id = ?')
      .get('player-one') as { purchase_at: number; updated_at: number };
    expect(row).toEqual({ purchase_at: 100, updated_at: 200 });
    raw.close();

    const second = new SqliteRoomQueries({ path, now: () => 400 });
    const funnel = sqlitePaymentFunnel(second);

    expect(second.paymentMilestoneAt('player-one', 'purchase')).toBe(100);
    expect(await funnel.summary()).toMatchObject({ purchase: 1 });
    second.close();
  });
});
