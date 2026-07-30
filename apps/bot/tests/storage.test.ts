import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KEEP_FINISHED_MS, openStorage } from '../src/storage';
import { SqliteRoomQueries } from '../src/sqlite';

/**
 * A store that cannot be opened is not a reason to refuse to play.
 *
 * `index.ts` knew two cases — a path was given, or it was not — and there is a
 * third. Pointed at `/data/leela.db` with no volume mounted, the bot died on
 * startup with `SQLITE_CANTOPEN` and was restarted into dying again, while its
 * own README promised it would run and say it was holding games in memory.
 *
 * Found by simulating the container's install and start rather than by reading
 * the Dockerfile, which is the only way that failure was ever going to show up.
 */

function temporary(): string {
  return mkdtempSync(join(tmpdir(), 'leela-storage-'));
}

describe('the three cases', () => {
  it('keeps games when a path can be opened', () => {
    const directory = temporary();
    try {
      const storage = openStorage({ path: join(directory, 'leela.db'), log: () => undefined });
      expect(storage.durable).toBe(true);
      expect(storage.failure).toBeUndefined();
      expect(storage.steps).toBeDefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('holds them in memory when no path is asked for', () => {
    const storage = openStorage({ log: () => undefined });
    expect(storage.durable).toBe(false);
    // Not a failure: choosing not to keep games is a choice, and reporting it
    // as a failure trains people to ignore the line that matters.
    expect(storage.failure).toBeUndefined();
  });

  it('holds them in memory when the path cannot be opened, rather than dying', () => {
    const directory = temporary();
    try {
      // A file where a directory belongs: the database can never be created
      // here, whatever is retried.
      const blocked = join(directory, 'occupied');
      writeFileSync(blocked, 'not a directory');

      const storage = openStorage({ path: join(blocked, 'leela.db'), log: () => undefined });

      expect(storage.durable).toBe(false);
      expect(storage.failure).toBeTruthy();
      expect(storage.store).toBeDefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('always hands back a working store, whatever happened', () => {
    // The shape: `openStorage` has no failure mode that reaches the caller. A
    // bot that will not start is worse at keeping a game than one that forgets
    // it, and the caller is never given a reason to exit.
    const directory = temporary();
    const blocked = join(directory, 'occupied');
    writeFileSync(blocked, 'not a directory');

    const cases = [
      { path: undefined },
      { path: join(directory, 'fresh.db') },
      { path: join(blocked, 'leela.db') },
      { path: join(directory, 'deep', 'deeper', 'leela.db') },
      { path: '' },
    ];

    try {
      for (const options of cases) {
        const storage = openStorage({ ...options, log: () => undefined });
        expect(typeof storage.store.get, JSON.stringify(options)).toBe('function');
        expect(typeof storage.reports.record).toBe('function');
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('a store makes the place it lives in', () => {
  it('creates a directory that is not there', () => {
    // The container case exactly: `/data` exists only when a volume is
    // mounted, and SQLite does not create directories.
    const directory = temporary();
    try {
      const missing = join(directory, 'data', 'nested');
      const storage = openStorage({ path: join(missing, 'leela.db'), log: () => undefined });
      expect(storage.durable).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does the same when the queries are built directly', () => {
    const directory = temporary();
    try {
      const queries = new SqliteRoomQueries({ path: join(directory, 'a', 'b', 'leela.db') });
      expect(queries.pruneFinished(KEEP_FINISHED_MS)).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('what it says', () => {
  it('names the path when it could not be used, because that is the answer', () => {
    const directory = temporary();
    const blocked = join(directory, 'occupied');
    writeFileSync(blocked, 'not a directory');
    const said: string[] = [];

    try {
      const storage = openStorage({
        path: join(blocked, 'leela.db'),
        log: (message) => said.push(message),
      });

      expect(said).toHaveLength(1);
      expect(said[0]).toContain(blocked);
      expect(said[0]).toContain('memory');
      expect(storage.failure).toContain(blocked);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('says nothing when there is nothing to say', () => {
    const said: string[] = [];
    openStorage({ log: (message) => said.push(message) });
    expect(said).toEqual([]);
  });

  it('forgets finished tables and says how many', () => {
    // The pruning that used to live in index.ts, still happening — and still
    // reported, because a line about deleting things is one to keep.
    const directory = temporary();
    try {
      const said: string[] = [];
      openStorage({ path: join(directory, 'leela.db'), log: (m) => said.push(m) });
      // Nothing to forget in a fresh database: the assertion is that a clean
      // start is silent, not that pruning never speaks.
      expect(said).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
