import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '../src/stars';
import { SqliteRoomQueries, sqliteAcquisitions } from '../src/sqlite';

const directories: string[] = [];

function pathFor(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'leela-acquisition-'));
  directories.push(directory);
  return join(directory, `${name}.db`);
}

afterEach(() => {
  while (directories.length > 0) {
    const directory = directories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe('durable first-touch acquisition', () => {
  it('survives restart and never replaces the first source', async () => {
    const path = pathFor('restart');
    const first = new SqliteRoomQueries({ path, now: () => 999 });
    const acquisitions = sqliteAcquisitions(first);
    await acquisitions.record('player', { source: 'guest', campaign: null, startedAt: 100 });
    await acquisitions.record('player', { source: 'inline', campaign: null, startedAt: 200 });
    first.close();

    const second = new SqliteRoomQueries({ path, now: () => 1_000 });
    await expect(sqliteAcquisitions(second).of('player')).resolves.toEqual({
      source: 'guest',
      campaign: null,
      startedAt: 100,
    });
    second.close();
  });

  it('returns complete aggregate source rows for starts and first purchases', async () => {
    const day = 20_000;
    const at = day * DAY_MS + 100;
    const queries = new SqliteRoomQueries({ path: pathFor('summary') });
    const acquisitions = sqliteAcquisitions(queries);
    await acquisitions.record('guest-player', { source: 'guest', campaign: null, startedAt: at });
    await acquisitions.record('inline-player', { source: 'inline', campaign: null, startedAt: at });
    await acquisitions.record('old-player', {
      source: 'public',
      campaign: 'old',
      startedAt: at - DAY_MS,
    });
    queries.recordPaymentMilestone('guest-player', 'purchase', at + 10);
    queries.recordPaymentMilestone('old-player', 'purchase', at + 20);

    expect(queries.revenueDay(day).acquisition).toEqual([
      { source: 'direct', starts: 0, purchases: 0 },
      { source: 'public', starts: 0, purchases: 1 },
      { source: 'guest', starts: 1, purchases: 1 },
      { source: 'inline', starts: 1, purchases: 0 },
      { source: 'mini_app', starts: 0, purchases: 0 },
    ]);
    queries.close();
  });
});
