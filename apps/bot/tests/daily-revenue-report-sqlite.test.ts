import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteRoomQueries, openDatabase, sqliteRevenueReports } from '../src/sqlite';
import { DAY_MS } from '../src/stars';

const directories: string[] = [];

function pathFor(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'leela-revenue-report-'));
  directories.push(directory);
  return join(directory, `${name}.db`);
}

afterEach(() => {
  while (directories.length > 0) {
    const directory = directories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe('the durable daily revenue report', () => {
  it('aggregates two money directions and every growth signal without exposing a player row', async () => {
    const day = 20_000;
    const start = day * DAY_MS;
    const path = pathFor('aggregate');
    const queries = new SqliteRoomQueries({ path, now: () => start + 500 });
    const db = openDatabase(path);

    const entitlement = db.prepare(
      `INSERT INTO entitlements
       (charge_id, user_id, tier, stars, paid_at, until, refunded_at, updated_at)
       VALUES (?, ?, 'month', ?, ?, ?, ?, ?)`,
    );
    entitlement.run('one', 'payer-a', 100, start + 10, start + DAY_MS, null, start + 10);
    entitlement.run('two', 'payer-a', 50, start + 20, start + DAY_MS, start + 80, start + 80);
    entitlement.run('three', 'payer-b', 700, start + 30, start + DAY_MS, null, start + 30);
    entitlement.run('old-refund', 'payer-c', 30, start - 100, start + DAY_MS, start + 90, start + 90);
    entitlement.run('tomorrow', 'payer-d', 1_200, start + DAY_MS, start + 2 * DAY_MS, null, start + DAY_MS);

    db.prepare(
      `INSERT INTO payment_funnel
       (user_id, trial_at, paywall_at, invoice_at, purchase_at, return_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('funnel-a', start + 1, start + 2, start + 3, start + 4, start + 5, start + 5);
    db.prepare(
      `INSERT INTO payment_funnel
       (user_id, trial_at, paywall_at, invoice_at, purchase_at, return_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, ?)`,
    ).run('funnel-b', start + 6, start + 7, start + 7);
    db.prepare(
      `INSERT INTO public_posts (day, plan, sent_at, model_bridge, starts, updated_at)
       VALUES (?, 41, ?, 0, 5, ?)`,
    ).run(day, start + 8, start + 8);
    db.close();

    await expect(sqliteRevenueReports(queries).day(day)).resolves.toEqual({
      day,
      grossStars: 850,
      refundedStars: 80,
      payments: 3,
      payers: 2,
      refunds: 2,
      funnel: { trial: 2, paywall: 2, invoice: 1, purchase: 1, return: 1 },
      publicStarts: 5,
      publicPosted: true,
    });
    queries.close();
  });

  it('adds a per-recipient cap, returns zeroes for an empty day and survives restart', async () => {
    const path = pathFor('restart');
    const legacy = openDatabase(path);
    legacy.exec('CREATE TABLE legacy_marker (kept INTEGER NOT NULL)');
    legacy.prepare('INSERT INTO legacy_marker (kept) VALUES (1)').run();
    legacy.close();
    const first = new SqliteRoomQueries({ path, now: () => 300 });
    const reports = sqliteRevenueReports(first);

    await expect(reports.day(20_000)).resolves.toEqual({
      day: 20_000,
      grossStars: 0,
      refundedStars: 0,
      payments: 0,
      payers: 0,
      refunds: 0,
      funnel: { trial: 0, paywall: 0, invoice: 0, purchase: 0, return: 0 },
      publicStarts: 0,
      publicPosted: false,
    });
    await expect(reports.claimDelivery(20_000, '11', 90)).resolves.toBe(true);
    await expect(reports.claimDelivery(20_000, '11', 95)).resolves.toBe(false);
    await reports.recordDelivery(20_000, '11', 100);
    await reports.recordDelivery(20_000, '11', 200);
    await reports.releaseDelivery(20_000, '11');
    first.close();

    const second = new SqliteRoomQueries({ path, now: () => 400 });
    const reopened = sqliteRevenueReports(second);
    await expect(reopened.claimDelivery(20_000, '11', 300)).resolves.toBe(false);
    await expect(reopened.claimDelivery(20_000, '22', 300)).resolves.toBe(true);
    await reopened.releaseDelivery(20_000, '22');

    const db = openDatabase(path);
    const rows = db.prepare('SELECT day, recipient, claimed_at, sent_at FROM admin_revenue_reports').all();
    expect(rows).toEqual([{ day: 20_000, recipient: '11', claimed_at: 90, sent_at: 100 }]);
    expect(db.prepare('SELECT kept FROM legacy_marker').get()).toEqual({ kept: 1 });
    db.close();
    second.close();
  });
});
