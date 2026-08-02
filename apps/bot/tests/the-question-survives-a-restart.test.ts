/**
 * The question a player is playing for, across a restart of the process.
 *
 * The durable sink keeps four things: the accounts, the moves, the intention,
 * and the setting of it. The assembled restart test proves two of them — it
 * plays, writes an account, reassembles on the same file and asks `/path` — and
 * it *sets* an intention before the restart and never asks about one after.
 *
 * Which leaves the one capability that decides whether a player can play at
 * all. **The bot refuses the throw before the question**, so an intention that
 * did not survive a restart would mean every player at every table being asked
 * again after each deploy — and, since the pass that put the question into the
 * file `/save` hands over, a path leaving the chat without it.
 *
 * It does survive. Nothing said so, which is the same state `reportsFor` was in
 * before `/path` existed: stored correctly, and unread by anything that would
 * notice if it stopped.
 *
 * Measured twice, because the first measurement was wrong in both directions.
 * Searching the database file for the words found nothing — they were still in
 * the write-ahead log — and `storage.ts` holds no mention of an intention at
 * all, because `sqlite.ts` is where it is implemented. A test that reassembles
 * inside one process would prove neither: a map on a module lives exactly that
 * long. So this opens the file with a handle of its own, through the same
 * `node:sqlite` the bot loads, which is the nearest thing to a second process a
 * test can hold.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { openStorage } from '../src/storage';

const temporary = () => join(mkdtempSync(join(tmpdir(), 'leela-question-')), 'leela.db');

const ASKED = 'to see what I keep putting off';

describe('the question a player gave', () => {
  it('is on the disk, not in the process that took it', () => {
    // The assertion that a reassembled `openStorage` cannot make: a `Map` on a
    // module answers a second `openStorage` in the same process perfectly well
    // and is gone the moment the bot restarts.
    const path = temporary();

    const storage = openStorage({ path, log: () => undefined });
    expect(storage.durable, 'a path was given and opened').toBe(true);
    void storage.reports.setIntention?.('player-1', ASKED);
    storage.stopPruning?.();

    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
      DatabaseSync: new (file: string) => {
        prepare(sql: string): { all(...values: unknown[]): unknown[] };
        close(): void;
      };
    };
    const beside = new DatabaseSync(path);
    const rows = beside
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;

    const held = rows
      .map((row) => beside.prepare(`SELECT * FROM "${row.name}"`).all())
      .flat()
      .map((row) => JSON.stringify(row))
      .join(' ');
    beside.close();

    expect(held).toContain(ASKED);
  });

  it('comes back to a storage that never saw it written', () => {
    const path = temporary();

    const first = openStorage({ path, log: () => undefined });
    void first.reports.setIntention?.('player-1', ASKED);
    first.stopPruning?.();

    const second = openStorage({ path, log: () => undefined });
    const back = second.reports.intention?.('player-1');
    second.stopPruning?.();

    return expect(back).resolves.toBe(ASKED);
  });

  it('is one player’s own, and not the table’s', async () => {
    // A chat has several people in it and each is playing for their own
    // reason. Keyed by the player, as `history` is.
    const storage = openStorage({ path: temporary(), log: () => undefined });

    await storage.reports.setIntention?.('player-1', ASKED);

    expect(await storage.reports.intention?.('player-2')).toBeNull();
    expect(await storage.reports.intention?.('player-1')).toBe(ASKED);
    storage.stopPruning?.();
  });

  it('is replaced rather than added to', async () => {
    // A player who answers again has changed their mind, not written a second
    // question. Two rows for one player would make which one is theirs a matter
    // of what order they came back in.
    const storage = openStorage({ path: temporary(), log: () => undefined });

    await storage.reports.setIntention?.('player-1', ASKED);
    await storage.reports.setIntention?.('player-1', 'to stop pretending it is fine');

    expect(await storage.reports.intention?.('player-1')).toBe('to stop pretending it is fine');
    storage.stopPruning?.();
  });

  it('takes the empty answer as no question at all', async () => {
    // `/end` clears it with an empty string, and every surface reads an empty
    // question as none: the throw is refused, and `offer` leaves the field out
    // of the file rather than writing a blank one.
    const storage = openStorage({ path: temporary(), log: () => undefined });

    await storage.reports.setIntention?.('player-1', ASKED);
    await storage.reports.setIntention?.('player-1', '');

    expect(await storage.reports.intention?.('player-1')).toBe('');
    storage.stopPruning?.();
  });
});
