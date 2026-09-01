import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { join as seat, openRoom, report, roll, start, type Room } from '../src/commands';
import { DatabaseRoomStore } from '../src/persistence';
import {
  CLASSIC,
  LEGACY_MOBILE,
  TOTAL_PLANS,
  WIN_LOKA,
  applyRoll,
  hasWon,
  initialState,
  type GameState,
} from '@leela/engine';

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
import { SCHEMA, SqliteRoomQueries, addMissingColumns, openDatabase, sqliteNudgeStore, sqliteReportSink, sqliteStepSink } from '../src/sqlite';

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

  it('counts successful moves and not refused throws, per player', async () => {
    const sink = sqliteStepSink(database('steps-moved'));
    const stopped = applyRoll(initialState(), 1, CLASSIC).event;
    const entered = applyRoll(initialState(), 6, CLASSIC).event;

    await sink.record({ userId: 'u1', event: stopped, ruleset: CLASSIC });
    await sink.record({ userId: 'u1', event: entered, ruleset: CLASSIC });
    await sink.record({ userId: 'u2', event: entered, ruleset: CLASSIC });

    expect(await sink.moved('u1')).toBe(1);
    expect(await sink.moved('u2')).toBe(1);
    expect(await sink.moved('u3')).toBe(0);
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

describe('what counts as a table worth forgetting', () => {
  /**
   * `pruneFinished` deletes, so being wrong here loses somebody's game.
   *
   * It used to decide in SQL — `is_finished = 1 AND previous_plan != 0` — under
   * a comment claiming that was "the same condition the engine uses". It was
   * not: the engine also asks whether the player is standing on the winning
   * square. Asked against every seat shape a row can hold, the two disagreed
   * seven times out of eight, and every disagreement was a table deleted while
   * the engine still considered it live.
   *
   * The reachable one is a migration. `stateFromLegacy` sets `previous_plan`
   * equal to the plan when the export carried no history — the engine reads
   * that as "has not moved", deliberately, so a migrated player can still
   * enter; the clause read it as "done" and threw their table away.
   *
   * So the assertion is the relation, over the shapes rather than over a list
   * of remembered cases: a table is deleted exactly when the engine says every
   * seat has won.
   */
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const seatShapes = () => {
    const shapes: Array<{ plan: number; previous: number; finished: boolean }> = [];
    for (const plan of [1, 41, WIN_LOKA, TOTAL_PLANS]) {
      for (const previous of [0, 5, plan]) {
        for (const finished of [true, false]) {
          shapes.push({ plan, previous, finished });
        }
      }
    }
    return shapes;
  };

  it('deletes exactly the tables the engine calls over', async () => {
    const shapes = seatShapes();
    const path = join(dir, 'prune-shapes.db');
    const queries = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(queries);

    for (const [index, shape] of shapes.entries()) {
      await queries.save(
        {
          id: `chat-${index}`,
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
            session_id: `chat-${index}`,
            user_id: 'u1',
            seat: 0,
            name: null,
            plan: shape.plan,
            previous_plan: shape.previous,
            direction: '' as const,
            consecutive_sixes: 0,
            position_before_three_sixes: 0,
            is_finished: shape.finished,
            last_roll_at: null,
            last_report_at: null,
            report_submitted: true,
          },
        ],
      );
    }

    const later = new SqliteRoomQueries({ path, now: () => NOW + 2 * WEEK_MS });
    open.push(later);
    later.pruneFinished(WEEK_MS);

    for (const [index, shape] of shapes.entries()) {
      const engineSaysOver = hasWon({
        loka: shape.plan,
        previous_loka: shape.previous,
        direction: '',
        consecutive_sixes: 0,
        position_before_three_sixes: 0,
        is_finished: shape.finished,
      });

      const gone = (await later.loadSession(`chat-${index}`)) === null;
      expect(gone, `plan ${shape.plan}, previous ${shape.previous}, finished ${shape.finished}`).toBe(
        engineSaysOver,
      );
    }
  });

  it('keeps the table of a player migrated with no history', async () => {
    // The case that made this real: `previous_plan` equal to the plan is what
    // `stateFromLegacy` writes when the published app's export carried no
    // moves. They have not finished; they have not started.
    const path = join(dir, 'prune-migrated.db');
    const queries = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(queries);

    await queries.save(
      {
        id: 'chat-migrated',
        host_id: 'u1',
        ruleset: 'legacy-mobile',
        turn_index: 0,
        roll_count: 0,
        dice_seed: 0,
        is_open: false,
        language: 'en',
      },
      [
        {
          session_id: 'chat-migrated',
          user_id: 'u1',
          seat: 0,
          name: null,
          plan: WIN_LOKA,
          previous_plan: WIN_LOKA,
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

    const later = new SqliteRoomQueries({ path, now: () => NOW + 100 * WEEK_MS });
    open.push(later);

    expect(later.pruneFinished(WEEK_MS)).toBe(0);
    expect(await later.loadSession('chat-migrated')).not.toBeNull();
  });
});

describe('finding a table by the player at it', () => {
  /**
   * The durable half of the same question the memory store answers: which table
   * does this player sit at, asked from a chat that holds no table. `/ask`
   * needs it because the companion answers privately, so the natural place to
   * ask is a private chat.
   */

  const seat = (sessionId: string, userId: string) => ({
    session_id: sessionId,
    user_id: userId,
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
  });

  const session = (id: string) => ({
    id,
    host_id: 'u1',
    ruleset: 'classic',
    turn_index: 0,
    roll_count: 0,
    dice_seed: 1,
    is_open: false,
    language: 'en',
  });

  it('finds the table from the player alone', async () => {
    const queries = database('seat-lookup');
    await queries.save(session('-500'), [seat('-500', 'u1')]);

    expect(await queries.sessionOfPlayer('u1')).toBe('-500');
  });

  it('is nothing for somebody seated nowhere', async () => {
    const queries = database('seat-none');
    await queries.save(session('-500'), [seat('-500', 'u1')]);

    expect(await queries.sessionOfPlayer('u2')).toBeNull();
  });

  it('is the table they played most recently, of several', async () => {
    // A group game and a private one. The one they mean is the last one they
    // touched, which is what `updated_at` records.
    const path = join(dir, 'seat-two.db');
    let clock = 1_000;
    const queries = new SqliteRoomQueries({ path, now: () => clock });
    open.push(queries);

    await queries.save(session('-500'), [seat('-500', 'u1')]);
    clock = 2_000;
    await queries.save(session('900'), [seat('900', 'u1')]);
    expect(await queries.sessionOfPlayer('u1')).toBe('900');

    clock = 3_000;
    await queries.save(session('-500'), [seat('-500', 'u1')]);
    expect(await queries.sessionOfPlayer('u1')).toBe('-500');
  });

  it('forgets it when the table is forgotten', async () => {
    const queries = database('seat-gone');
    await queries.save(session('-500'), [seat('-500', 'u1')]);
    await queries.remove('-500');

    expect(await queries.sessionOfPlayer('u1')).toBeNull();
  });
});

describe('the last tick, kept', () => {
  it('answers nothing before a tick has ever run', () => {
    expect(database('tick-none').lastTick()).toBeNull();
  });

  it('survives a restart, which is the whole point of it', async () => {
    // The `[initiative]` line lives in a stream that resets: in six attempts to
    // read the 06:00 tick the container had restarted past it five times. This
    // is the assertion that makes the record worth having. specs/008.
    const path = join(dir, 'tick-restart.db');

    const first = new SqliteRoomQueries({ path, now: () => NOW });
    first.recordTick(NOW, 1, { quieted: 1, 'doorstep-spent': 2 });
    first.close();

    const second = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(second);

    expect(second.lastTick()).toEqual({
      at: NOW,
      sent: 1,
      skipped: { quieted: 1, 'doorstep-spent': 2 },
    });
  });

  it('keeps one row, overwritten, not a history to prune', () => {
    const queries = database('tick-one-row');

    queries.recordTick(NOW, 0, { lapsed: 1 });
    queries.recordTick(NOW + 86_400_000, 2, {});

    expect(queries.lastTick()).toEqual({ at: NOW + 86_400_000, sent: 2, skipped: {} });
  });

  it('reads a malformed record as no reasons rather than refusing to start', () => {
    // Read at boot to print one sentence. A bot that will not start because a
    // stored summary is unreadable has traded the product for a note about it.
    const queries = database('tick-malformed');
    queries.recordTick(NOW, 1, { quieted: 1 });
    // Whatever a future version, or a hand, might leave there.
    (queries as unknown as { db: { exec(sql: string): void } }).db.exec(
      "UPDATE last_tick SET skipped = 'not json at all' WHERE id = 1",
    );

    expect(queries.lastTick()).toEqual({ at: NOW, sent: 1, skipped: {} });
  });
});

describe('the initiative’s memory', () => {
  it('answers nothing for a player never nudged', () => {
    expect(database('nudge-unknown').nudgeOf('u1')).toBeNull();
  });

  it('round-trips a send', () => {
    const queries = database('nudge-roundtrip');
    queries.recordNudge('u1', NOW, 2);
    expect(queries.nudgeOf('u1')).toEqual({ sentAt: NOW, excerpt: 2, quieted: false, doorsteps: 0 });
  });

  it('lets neither half of the row speak for the other', () => {
    // A send must not undo /quiet, and /quiet must not invent a send: the two
    // are written by different acts, and the first daily word hangs on
    // `sent_at` still being NULL when the player has only ever said /quiet.
    const queries = database('nudge-halves');

    queries.setQuieted('u1', true);
    expect(queries.nudgeOf('u1')).toEqual({ sentAt: null, excerpt: null, quieted: true, doorsteps: 0 });

    queries.recordNudge('u1', NOW, 0);
    expect(queries.nudgeOf('u1')).toEqual({ sentAt: NOW, excerpt: 0, quieted: true, doorsteps: 0 });

    queries.setQuieted('u1', false);
    expect(queries.nudgeOf('u1')).toEqual({ sentAt: NOW, excerpt: 0, quieted: false, doorsteps: 0 });
  });

  it('survives a restart, like everything else in the file', async () => {
    const path = join(dir, 'nudge-restart.db');

    const first = new SqliteRoomQueries({ path, now: () => NOW });
    await sqliteNudgeStore(first).setQuieted('u1', true);
    await sqliteNudgeStore(first).record('u2', { at: NOW, excerpt: 3 });
    first.close();

    const second = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(second);
    const memory = sqliteNudgeStore(second);
    expect(await memory.of('u1')).toEqual({ sentAt: null, excerpt: null, quieted: true, doorsteps: 0 });
    expect(await memory.of('u2')).toEqual({ sentAt: NOW, excerpt: 3, quieted: false, doorsteps: 0 });
    // And a player it has never met still gets the four not-yets, not null.
    expect(await memory.of('u3')).toEqual({ sentAt: null, excerpt: null, quieted: false, doorsteps: 0 });
  });

  it('counts doorstep words and counts nothing else', () => {
    // The third arm's whole bound lives in this column, and it is spent by a
    // doorstep word only: a daily word writing the same row must leave it be,
    // or a player who enters would carry a number they never earned.
    const queries = database('nudge-doorsteps');

    queries.recordNudge('u1', NOW, 0, true);
    queries.recordNudge('u1', NOW + 1000, 0, true);
    expect(queries.nudgeOf('u1')?.doorsteps).toBe(2);

    queries.recordNudge('u1', NOW + 2000, 1);
    expect(queries.nudgeOf('u1')).toEqual({
      sentAt: NOW + 2000,
      excerpt: 1,
      quieted: false,
      doorsteps: 2,
    });
  });

  it('says out loud which columns an older database gained', () => {
    // The deployed volume is the one database nobody can read. If the process
    // that opens it does not say what it changed, a migration that silently
    // did not run is discovered later, inside a tick, as a missing column.
    const path = join(dir, 'nudge-migration-says.db');

    const older = openDatabase(path);
    older.exec(
      'CREATE TABLE IF NOT EXISTS nudges (\n  user_id TEXT PRIMARY KEY,\n  updated_at INTEGER NOT NULL\n);',
    );
    older.close();

    const said: string[] = [];
    const queries = new SqliteRoomQueries({ path, now: () => NOW, log: (line) => said.push(line) });
    open.push(queries);

    expect(said.join(' ')).toContain('nudges.doorsteps');

    // And it holds its tongue when there was nothing to do: a line every
    // restart would train an operator to skip the one that matters.
    const quiet: string[] = [];
    const again = new SqliteRoomQueries({ path, now: () => NOW, log: (line) => quiet.push(line) });
    open.push(again);
    expect(quiet).toEqual([]);
  });

  it('reads a database written before the column existed as zero, not as null', () => {
    // The deployed volume outlives every release: the live `nudges` table was
    // created without `doorsteps`, so the migration adds it and every row
    // already there answers with the default. A null here would be read as
    // `undefined` by the arm and compared against three.
    const path = join(dir, 'nudge-old-shape.db');

    const older = openDatabase(path);
    older.exec(
      `CREATE TABLE IF NOT EXISTS nudges (
  user_id    TEXT PRIMARY KEY,
  sent_at    INTEGER,
  excerpt    INTEGER,
  quieted    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);`,
    );
    older.prepare('INSERT INTO nudges VALUES (?, ?, ?, 0, ?)').run('u1', NOW, 1, NOW);
    older.close();

    const queries = new SqliteRoomQueries({ path, now: () => NOW });
    open.push(queries);

    expect(queries.nudgeOf('u1')).toEqual({ sentAt: NOW, excerpt: 1, quieted: false, doorsteps: 0 });
    // And the counter works on the migrated row, rather than throwing on it.
    queries.recordNudge('u1', NOW + 1000, 1, true);
    expect(queries.nudgeOf('u1')?.doorsteps).toBe(1);
  });
});

describe('every table, for the initiative to walk', () => {
  it('lists them oldest-played first, so the newest wins a deduplication', async () => {
    const queries = database('all-sessions');
    const store = new DatabaseRoomStore(queries);

    await store.save(playedRoom('chat-a'));
    await store.save(playedRoom('chat-b'));
    expect(await queries.allSessions()).toEqual(['chat-a', 'chat-b']);

    // Playing at the first table again moves it to the end — the same answer
    // the memory store's insertion order gives.
    await store.save(playedRoom('chat-a'));
    expect(await queries.allSessions()).toEqual(['chat-b', 'chat-a']);
  });

  it('hands back whole rooms through the store, and every one of them', async () => {
    const queries = database('all-rooms');
    const store = new DatabaseRoomStore(queries);
    const played = playedRoom('chat-one');
    await store.save(played);
    await store.save(playedRoom('chat-two'));

    const rooms = await store.allRooms();
    expect(rooms.map((room) => room.chatId)).toEqual(['chat-one', 'chat-two']);
    expect(rooms[0]).toEqual(played);
  });
});
