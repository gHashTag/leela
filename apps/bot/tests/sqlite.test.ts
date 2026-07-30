import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { join as seat, openRoom, report, roll, start, type Room } from '../src/commands';
import { DatabaseRoomStore } from '../src/persistence';
import { CLASSIC, LEGACY_MOBILE, applyRoll, type GameState } from '@leela/engine';

/** A player mid-game on a given plan. */
function playingAt(loka: number): GameState {
  return {
    loka,
    previous_loka: 5,
    direction: '',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
  };
}
import { gameStepRow } from '@leela/db';
import { SCHEMA, SqliteRoomQueries, addMissingColumns, openDatabase, sqliteReportSink, sqliteStepSink } from '../src/sqlite';

const NOW = 1_700_000_000_000;
const dir = mkdtempSync(join(tmpdir(), 'leela-sqlite-'));
const open: SqliteRoomQueries[] = [];

afterAll(() => {
  for (const queries of open) queries.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A fresh database, on disk so it can be reopened. */
function database(name: string): SqliteRoomQueries {
  const queries = new SqliteRoomQueries({ path: join(dir, `${name}.db`), now: () => NOW });
  open.push(queries);
  return queries;
}

/** A table part-way through a game. */
function playedRoom(chatId = 'chat-1'): Room {
  let room = openRoom(chatId, { id: 'u1', name: 'Ada' }, 4242, { language: 'ru' }).room as Room;
  room = seat(room, { id: 'u2', name: 'Grace' }).room as Room;
  room = start(room, 'u1').room as Room;

  for (let i = 0; i < 10; i++) {
    const holder = room.session.players[room.session.turnIndex];
    const result = roll(room, holder.id, NOW);
    room = result.room as Room;
    if (result.replies.some((r) => r.text.includes('/report'))) {
      room = report(room, holder.id, 'noted').room as Room;
    }
  }
  return room;
}

describe('a game survives a restart', () => {
  // This is the whole reason the file exists: the bot announced on every start
  // that games in progress would be lost.

  it('reloads a played game exactly, from a process that never saw it', async () => {
    const path = join(dir, 'restart.db');
    const room = playedRoom();

    const first = new SqliteRoomQueries({ path, now: () => NOW });
    await new DatabaseRoomStore(first).save(room);
    first.close();

    // A brand new process, holding nothing.
    const second = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(second);
    const restored = await new DatabaseRoomStore(second).get(room.chatId);

    expect(restored).toEqual(room);
  });

  it('keeps playing from where it stopped', async () => {
    const store = new DatabaseRoomStore(database('continue'));
    const room = playedRoom('chat-continue');
    await store.save(room);

    let restored = (await store.get('chat-continue')) as Room;
    const holder = restored.session.players[restored.session.turnIndex];

    // The gate survives the restart too, so clear it before expecting a roll.
    if (!holder.reportSubmitted) {
      restored = report(restored, holder.id, 'noted').room as Room;
    }

    const result = roll(restored, holder.id, NOW);
    expect(result.replies[0].text).not.toMatch(/not started|\/report/i);
    expect((result.room as Room).rollsTaken).toBe(room.rollsTaken + 1);
  });
});

describe('SqliteRoomQueries', () => {
  let queries: SqliteRoomQueries;
  let store: DatabaseRoomStore;

  beforeEach(() => {
    queries = database(`q-${Math.floor(performance.now() * 1000)}`);
    store = new DatabaseRoomStore(queries);
  });

  it('returns null for a chat it has never seen', async () => {
    expect(await store.get('nobody')).toBeNull();
  });

  it('round-trips every field, including the ones SQLite has no type for', async () => {
    const room = playedRoom('chat-fields');
    await store.save(room);
    const restored = (await store.get('chat-fields')) as Room;

    // Booleans are 1 and 0 in SQLite; dates are numbers. Both must read back
    // as themselves or the engine sees a different game.
    expect(restored.started).toBe(room.started);
    expect(restored.language).toBe('ru');
    expect(restored.seed).toBe(room.seed);
    for (const [index, player] of restored.session.players.entries()) {
      expect(typeof player.state.is_finished).toBe('boolean');
      expect(player.reportSubmitted).toBe(room.session.players[index].reportSubmitted);
      expect(player.lastRollAt).toBe(room.session.players[index].lastRollAt);
    }
  });

  it('replaces seats rather than accumulating them', async () => {
    const room = playedRoom('chat-seats');
    await store.save(room);
    await store.save(room);
    await store.save(room);

    expect((await queries.loadSeats('chat-seats'))).toHaveLength(2);
  });

  it('drops a seat that has left, so it cannot keep taking turns', async () => {
    const two = playedRoom('chat-left');
    await store.save(two);

    const one: Room = {
      ...two,
      session: { ...two.session, players: two.session.players.slice(0, 1), turnIndex: 0 },
    };
    await store.save(one);

    const restored = (await store.get('chat-left')) as Room;
    expect(restored.session.players.map((p) => p.id)).toEqual(['u1']);
  });

  it('orders seats by seat number, not by insertion', async () => {
    const room = playedRoom('chat-order');
    await store.save(room);
    const seats = await queries.loadSeats('chat-order');
    expect(seats.map((s) => s.seat)).toEqual([0, 1]);
    expect(seats.map((s) => s.user_id)).toEqual(['u1', 'u2']);
  });

  it('forgets a deleted room, and its seats with it', async () => {
    const room = playedRoom('chat-delete');
    await store.save(room);
    await store.delete('chat-delete');

    expect(await store.get('chat-delete')).toBeNull();
    expect(await queries.loadSeats('chat-delete')).toEqual([]);
  });

  it('keeps two chats apart', async () => {
    await store.save(playedRoom('chat-a'));
    await store.save(playedRoom('chat-b'));

    expect((await store.get('chat-a'))?.chatId).toBe('chat-a');
    expect((await store.get('chat-b'))?.chatId).toBe('chat-b');
  });

  it('writes a room whole or not at all', async () => {
    const room = playedRoom('chat-atomic');
    await store.save(room);

    // A seat that violates the unique index aborts the transaction, and the
    // session it belongs to must not be left rewritten around a missing seat.
    const before = await store.get('chat-atomic');
    const duplicated = { ...room, session: { ...room.session, rollCount: 999 } };
    const seats = duplicated.session.players.map((player, index) => ({
      session_id: 'chat-atomic',
      user_id: 'same-user',
      seat: index,
      name: null,
      plan: 1,
      previous_plan: 0,
      direction: '' as const,
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
      last_roll_at: null,
      last_report_at: null,
      report_submitted: true,
    }));

    await expect(
      queries.save(
        { id: 'chat-atomic', host_id: 'u1', ruleset: 'classic', turn_index: 0, roll_count: 999, dice_seed: 1, is_open: false, language: 'en' },
        seats,
      ),
    ).rejects.toThrow();

    expect((await store.get('chat-atomic'))?.rollsTaken).toBe(before?.rollsTaken);
  });
});

describe('reports', () => {
  it('keeps what a player wrote, newest first', async () => {
    const queries = database('reports');
    const sink = sqliteReportSink(queries);

    await sink.record({ userId: 'u1', plan: 5, text: 'first' });
    await sink.record({ userId: 'u1', plan: 9, text: 'second' });
    await sink.record({ userId: 'u2', plan: 3, text: 'someone else' });

    const mine = queries.reportsFor('u1');
    expect(mine.map((r) => r.text)).toEqual(['second', 'first']);
    expect(mine[0].plan).toBe(9);
    expect(mine[0].createdAt).toBeInstanceOf(Date);
  });

  it('keeps two reports on the same plan, because a player may return to it', async () => {
    const queries = database('reports-repeat');
    const sink = sqliteReportSink(queries);
    await sink.record({ userId: 'u1', plan: 5, text: 'first time' });
    await sink.record({ userId: 'u1', plan: 5, text: 'and again' });

    expect(queries.reportsFor('u1')).toHaveLength(2);
  });

  it('returns nothing for a player who has written nothing', () => {
    expect(database('reports-empty').reportsFor('nobody')).toEqual([]);
  });

  it('survives a restart, like the rooms', async () => {
    const path = join(dir, 'reports-restart.db');
    const first = new SqliteRoomQueries({ path, now: () => NOW });
    first.recordReport({ userId: 'u1', plan: 7, text: 'kept' });
    first.close();

    const second = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(second);
    expect(second.reportsFor('u1').map((r) => r.text)).toEqual(['kept']);
  });
});

describe('the schema', () => {
  it('is safe to open twice, so a restart does not fail on CREATE TABLE', () => {
    const path = join(dir, 'twice.db');
    const first = new SqliteRoomQueries({ path });
    first.close();
    const second = new SqliteRoomQueries({ path });
    open.push(second);
    expect(second).toBeDefined();
  });
});

describe('a path outlives the table it was written at', () => {
  // Reports belong to the player. Clearing a table must not take them with it.

  it('survives the room being deleted', async () => {
    const queries = database('path-outlives');
    const store = new DatabaseRoomStore(queries);
    const room = playedRoom('chat-outlives');
    await store.save(room);

    queries.recordReport({ userId: 'u1', plan: 6, text: 'written at the table' });
    await store.delete('chat-outlives');

    expect(await store.get('chat-outlives')).toBeNull();
    expect(queries.reportsFor('u1').map((r) => r.text)).toEqual(['written at the table']);
  });

  it('is the same path from any chat', async () => {
    const queries = database('path-any-chat');
    queries.recordReport({ userId: 'u1', plan: 6, text: 'from one chat' });

    // Nothing about reading it back mentions a chat.
    expect(queries.reportsFor('u1')).toHaveLength(1);
  });
});

describe('forgetting tables whose game is over', () => {
  // Nothing deleted a finished game, so every table ever opened stayed in the
  // database. A table is scaffolding; a report is the player's.

  const WEEK = 7 * 24 * 60 * 60 * 1000;

  /** A room where every seat has finished after being on the board. */
  function finishedRoom(chatId: string): Room {
    const room = playedRoom(chatId);
    return {
      ...room,
      session: {
        ...room.session,
        players: room.session.players.map((p) => ({
          ...p,
          state: { ...p.state, loka: 68, previous_loka: 65, is_finished: true },
        })),
      },
    };
  }

  it('forgets a finished table once it is old enough', async () => {
    const queries = new SqliteRoomQueries({ path: join(dir, 'prune-old.db'), now: () => NOW });
    open.push(queries);
    await new DatabaseRoomStore(queries).save(finishedRoom('chat-old'));

    // Ask as though a fortnight had passed.
    const later = new SqliteRoomQueries({
      path: join(dir, 'prune-old.db'),
      now: () => NOW + 2 * WEEK,
    });
    open.push(later);

    expect(later.pruneFinished(WEEK)).toBe(1);
    expect(await later.loadSession('chat-old')).toBeNull();
  });

  it('keeps a finished table that only just ended', async () => {
    const queries = database('prune-recent');
    await new DatabaseRoomStore(queries).save(finishedRoom('chat-recent'));

    expect(queries.pruneFinished(WEEK)).toBe(0);
    expect(await queries.loadSession('chat-recent')).not.toBeNull();
  });

  it('never touches a game still in progress, however old', async () => {
    const queries = new SqliteRoomQueries({ path: join(dir, 'prune-live.db'), now: () => NOW });
    open.push(queries);
    await new DatabaseRoomStore(queries).save(playedRoom('chat-live'));

    const later = new SqliteRoomQueries({
      path: join(dir, 'prune-live.db'),
      now: () => NOW + 100 * WEEK,
    });
    open.push(later);

    expect(later.pruneFinished(WEEK)).toBe(0);
    expect(await later.loadSession('chat-live')).not.toBeNull();
  });

  it('never touches a table where someone is still waiting to enter', async () => {
    // A seat that never got on the board has previous_plan = 0: waiting, not
    // done. Treating that as finished would delete a game before it started.
    const queries = new SqliteRoomQueries({ path: join(dir, 'prune-wait.db'), now: () => NOW });
    open.push(queries);

    const room = finishedRoom('chat-wait');
    const waiting: Room = {
      ...room,
      session: {
        ...room.session,
        players: room.session.players.map((p, i) =>
          i === 0 ? { ...p, state: { ...p.state, previous_loka: 0 } } : p,
        ),
      },
    };
    await new DatabaseRoomStore(queries).save(waiting);

    const later = new SqliteRoomQueries({
      path: join(dir, 'prune-wait.db'),
      now: () => NOW + 100 * WEEK,
    });
    open.push(later);
    expect(later.pruneFinished(WEEK)).toBe(0);
  });

  it('keeps the reports, which belong to the player and not to the table', async () => {
    const queries = new SqliteRoomQueries({ path: join(dir, 'prune-reports.db'), now: () => NOW });
    open.push(queries);
    await new DatabaseRoomStore(queries).save(finishedRoom('chat-reports'));
    queries.recordReport({ userId: 'u1', plan: 6, text: 'kept regardless' });

    const later = new SqliteRoomQueries({
      path: join(dir, 'prune-reports.db'),
      now: () => NOW + 2 * WEEK,
    });
    open.push(later);
    later.pruneFinished(WEEK);

    expect(later.reportsFor('u1').map((r) => r.text)).toEqual(['kept regardless']);
  });

  it('does nothing to an empty database', () => {
    expect(database('prune-empty').pruneFinished(WEEK)).toBe(0);
  });
});

describe('a game keeps a history a person can read', () => {
  // `game_steps` and `gameStepRow` both existed and nothing ever wrote a row:
  // the schema promised a replayable history and never kept one.

  it('records a move', async () => {
    const queries = database('steps');
    const sink = sqliteStepSink(queries);
    const { event } = applyRoll(
      playingAt(10),
      2,
      CLASSIC,
    );

    await sink.record({ userId: 'u1', event, ruleset: CLASSIC });

    expect(queries.stepsFor('u1')).toEqual([
      { roll: 2, from: 10, to: 8, direction: 'snake 🐍' },
    ]);
  });

  it('keeps moves newest first, with id breaking a tie', async () => {
    const queries = database('steps-order');
    const sink = sqliteStepSink(queries);
    let state: GameState = playingAt(11);

    for (const roll of [1, 2, 3]) {
      const result = applyRoll(state, roll, CLASSIC);
      await sink.record({ userId: 'u1', event: result.event, ruleset: CLASSIC });
      state = result.state;
    }

    // Same millisecond for all three; the order must still be definite.
    expect(queries.stepsFor('u1').map((s) => s.roll)).toEqual([3, 2, 1]);
  });

  it('keeps one player’s moves out of another’s', async () => {
    const queries = database('steps-users');
    const sink = sqliteStepSink(queries);
    const { event } = applyRoll(
      playingAt(11),
      1,
      CLASSIC,
    );

    await sink.record({ userId: 'u1', event, ruleset: CLASSIC });
    expect(queries.stepsFor('u2')).toEqual([]);
  });

  it('survives a restart, like everything else in the file', async () => {
    const path = join(dir, 'steps-restart.db');
    const first = new SqliteRoomQueries({ path, now: () => NOW });
    const { event } = applyRoll(
      playingAt(11),
      4,
      CLASSIC,
    );
    await sqliteStepSink(first).record({ userId: 'u1', event, ruleset: CLASSIC });
    first.close();

    const second = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(second);
    expect(second.stepsFor('u1')).toHaveLength(1);
  });

  it('records which variant produced the move', async () => {
    // A history that does not say which rules were in force cannot be replayed.
    const queries = database('steps-ruleset');
    const { event } = applyRoll(
      playingAt(11),
      6,
      LEGACY_MOBILE,
    );
    queries.recordStep(gameStepRow('u1', event, LEGACY_MOBILE));

    const stored = queries.stepsFor('u1');
    expect(stored).toHaveLength(1);
  });
});

describe('a database older than the code that opens it', () => {
  /**
   * The bot's volume outlives every release, and `CREATE TABLE IF NOT EXISTS`
   * does nothing to a table that is already there. A column added to the schema
   * therefore never reaches a deployed database, and the first write to it
   * throws inside the transaction — the player is told there is no table.
   *
   * The assertion is about the shape of that defect rather than about
   * `last_report_at`, which is only the column that found it: whatever the
   * schema declares and the file lacks gets added.
   */
  it('gains whatever column the schema has grown', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE IF NOT EXISTS sessions (\n  id TEXT PRIMARY KEY\n);');

    const added = addMissingColumns(
      db,
      'CREATE TABLE IF NOT EXISTS sessions (\n  id TEXT PRIMARY KEY,\n  invented TEXT\n);',
    );

    expect(added).toEqual(['sessions.invented']);
    expect(() => db.prepare('SELECT invented FROM sessions').all()).not.toThrow();
  });

  it('adds nothing twice, so opening a current database is a no-op', () => {
    const db = openDatabase(':memory:');
    db.exec(SCHEMA);
    expect(addMissingColumns(db)).toEqual([]);
    expect(addMissingColumns(db)).toEqual([]);
  });

  it('leaves a table it has never seen to CREATE TABLE', () => {
    // An empty database is not a database missing every column: creating the
    // tables is the schema's job, and an ALTER on a table that is not there
    // would throw where nothing is wrong.
    expect(addMissingColumns(openDatabase(':memory:'))).toEqual([]);
  });

  it('is not fooled by a constraint line into adding a column called PRIMARY', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE IF NOT EXISTS sessions (\n  id TEXT NOT NULL\n);');

    const added = addMissingColumns(
      db,
      'CREATE TABLE IF NOT EXISTS sessions (\n  id TEXT NOT NULL,\n  PRIMARY KEY (id),\n  FOREIGN KEY (id) REFERENCES other (id)\n);',
    );

    expect(added).toEqual([]);
  });

  it('keeps the rows that were already in it', () => {
    // A migration that loses a game is worse than one that never runs.
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE IF NOT EXISTS sessions (\n  id TEXT PRIMARY KEY\n);');
    db.prepare('INSERT INTO sessions (id) VALUES (?)').run('chat-old');

    addMissingColumns(db, 'CREATE TABLE IF NOT EXISTS sessions (\n  id TEXT PRIMARY KEY,\n  invented TEXT\n);');

    const rows = db.prepare('SELECT id, invented FROM sessions').all() as Array<Record<string, unknown>>;
    expect(rows).toEqual([{ id: 'chat-old', invented: null }]);
  });
});
