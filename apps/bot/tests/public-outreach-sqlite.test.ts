import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SqliteRoomQueries, sqlitePublicOutreach } from '../src/sqlite';

describe('public outreach survives a restart without storing a reader', () => {
  it('keeps one successful day and only an aggregate number of starts', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'leela-public-')), 'game.db');
    const first = new SqliteRoomQueries({ path, now: () => 300 });
    const posts = sqlitePublicOutreach(first);

    await posts.record({ day: 20_000, plan: 41, sentAt: 100, bridge: 'model' });
    await posts.record({ day: 20_000, plan: 6, sentAt: 200, bridge: 'canonical' });
    await posts.started(20_000);
    await posts.started(20_000);
    await posts.started(19_999);
    first.close();

    const second = new SqliteRoomQueries({ path, now: () => 400 });
    await expect(sqlitePublicOutreach(second).of(20_000)).resolves.toEqual({
      day: 20_000,
      plan: 41,
      sentAt: 100,
      bridge: 'model',
      starts: 2,
    });
    await expect(sqlitePublicOutreach(second).of(19_999)).resolves.toBeNull();
    second.close();
  });
});
