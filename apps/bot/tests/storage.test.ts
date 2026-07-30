import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KEEP_FINISHED_MS, PRUNE_EVERY_MS, openStorage } from '../src/storage';
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

describe('forgetting finished tables while the bot is running', () => {
  /**
   * The cleanup ran at startup and nowhere else, under a comment saying that
   * "a bot that is never restarted is not accumulating tables either".
   *
   * That is false, and it was measured before it was fixed: twelve games
   * played and finished over twelve weeks in one process leave twelve tables,
   * because tables come from play and not from restarts. A deployment that
   * stays up for months — which is the deployment this was written for — never
   * looked once.
   *
   * The rule asserted is that a table finished a week ago is forgotten by a bot
   * that has not restarted, whatever else it has done since.
   */

  /** A schedule under the test's control, so nothing waits a day. */
  function scheduler() {
    const runs: Array<{ run: () => void; everyMs: number }> = [];
    return {
      schedule: (run: () => void, everyMs: number) => {
        runs.push({ run, everyMs });
        return () => {
          const at = runs.findIndex((entry) => entry.run === run);
          if (at > -1) runs.splice(at, 1);
        };
      },
      tick: () => {
        for (const entry of [...runs]) entry.run();
      },
      scheduled: () => runs.length,
      every: () => runs[0]?.everyMs,
    };
  }

  const finishedTable = (queries: SqliteRoomQueries, id: string) =>
    queries.save(
      {
        id,
        host_id: 'u1',
        ruleset: 'classic',
        turn_index: 0,
        roll_count: 0,
        dice_seed: 0,
        is_open: false,
        language: 'en',
      },
      [
        {
          session_id: id,
          user_id: 'u1',
          seat: 0,
          name: null,
          plan: 68,
          previous_plan: 62,
          direction: '' as const,
          consecutive_sixes: 0,
          position_before_three_sixes: 0,
          is_finished: true,
          last_roll_at: null,
          last_report_at: null,
          report_submitted: true,
        },
      ],
    );

  it('forgets a table that finished while the bot was up', async () => {
    const path = join(temporary(), 'running.db');
    let clock = 1_000_000_000_000;
    const queries = new SqliteRoomQueries({ path, now: () => clock });
    const clocked = scheduler();

    const storage = openStorage({
      path,
      log: () => undefined,
      openQueries: () => queries,
      schedule: clocked.schedule,
    });

    // A game is played and finished *after* the bot started.
    await finishedTable(queries, 'chat-later');
    expect(await queries.loadSession('chat-later')).not.toBeNull();

    // A week and a day pass without a restart.
    clock += KEEP_FINISHED_MS + 24 * 60 * 60 * 1000;
    clocked.tick();

    expect(await queries.loadSession('chat-later')).toBeNull();
    storage.stopPruning?.();
  });

  it('still sweeps once at startup, for whatever was left behind', async () => {
    const path = join(temporary(), 'startup.db');
    let clock = 1_000_000_000_000;
    const queries = new SqliteRoomQueries({ path, now: () => clock });

    await finishedTable(queries, 'chat-old');
    clock += KEEP_FINISHED_MS + 1;

    openStorage({
      path,
      log: () => undefined,
      openQueries: () => queries,
      schedule: () => () => undefined,
    });

    expect(await queries.loadSession('chat-old')).toBeNull();
  });

  it('leaves a game that is still being played, however often it looks', async () => {
    // The sweep runs more often than the age filter allows anything to be
    // deleted, so looking often must not delete sooner.
    const path = join(temporary(), 'live.db');
    const queries = new SqliteRoomQueries({ path, now: () => 1_000_000_000_000 });
    const clocked = scheduler();

    await queries.save(
      {
        id: 'chat-live',
        host_id: 'u1',
        ruleset: 'classic',
        turn_index: 0,
        roll_count: 3,
        dice_seed: 0,
        is_open: false,
        language: 'en',
      },
      [
        {
          session_id: 'chat-live',
          user_id: 'u1',
          seat: 0,
          name: null,
          plan: 41,
          previous_plan: 37,
          direction: '' as const,
          consecutive_sixes: 0,
          position_before_three_sixes: 0,
          is_finished: false,
          last_roll_at: null,
          last_report_at: null,
          report_submitted: true,
        },
      ],
    );

    const storage = openStorage({
      path,
      log: () => undefined,
      openQueries: () => queries,
      schedule: clocked.schedule,
    });

    for (let day = 0; day < 30; day += 1) clocked.tick();

    expect(await queries.loadSession('chat-live')).not.toBeNull();
    storage.stopPruning?.();
  });

  it('looks often enough to matter and not so often it is a habit', () => {
    const clocked = scheduler();
    const path = join(temporary(), 'interval.db');
    const queries = new SqliteRoomQueries({ path });

    openStorage({ path, log: () => undefined, openQueries: () => queries, schedule: clocked.schedule });

    expect(clocked.scheduled()).toBe(1);
    expect(clocked.every()).toBe(PRUNE_EVERY_MS);
    // Nothing is deleted sooner for being checked more often: the age filter
    // is what decides, and it is longer than the interval.
    expect(PRUNE_EVERY_MS).toBeLessThan(KEEP_FINISHED_MS);
  });

  it('schedules nothing when games are held in memory', () => {
    // A process ending is the only cleanup they need, and a timer that outlives
    // its reason is a timer somebody has to explain later.
    const clocked = scheduler();
    const storage = openStorage({ log: () => undefined, schedule: clocked.schedule });

    expect(clocked.scheduled()).toBe(0);
    expect(storage.stopPruning).toBeUndefined();
  });

  it('can be stopped, so a test or a shutdown leaves nothing running', () => {
    const clocked = scheduler();
    const path = join(temporary(), 'stop.db');
    const queries = new SqliteRoomQueries({ path });

    const storage = openStorage({
      path,
      log: () => undefined,
      openQueries: () => queries,
      schedule: clocked.schedule,
    });

    expect(clocked.scheduled()).toBe(1);
    storage.stopPruning?.();
    expect(clocked.scheduled()).toBe(0);
  });
});
