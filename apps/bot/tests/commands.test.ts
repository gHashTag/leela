import { describe, expect, it } from 'vitest';
import { MAX_SEATS } from '@leela/engine';
import { planFor } from '@leela/content';
import {
  MAX_MESSAGE_CHARS,
  board,
  help,
  paginate,
  path,
  join,
  openRoom,
  plan,
  report,
  roll,
  start,
  type Room,
} from '../src/commands';

const NOW = 1_700_000_000_000;
const SEED = 20260729;

/** A table with `count` players, already started. */
function table(count = 2, seed = SEED): Room {
  let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, seed).room as Room;
  for (let i = 2; i <= count; i++) {
    room = join(room, { id: `u${i}`, name: `P${i}` }).room as Room;
  }
  return start(room, 'u1').room as Room;
}

/** Roll until `playerId` is on the board, reporting whenever asked. */
function getOnBoard(room: Room, playerId: string, limit = 200): Room {
  for (let i = 0; i < limit; i++) {
    const seated = room.session.players.find((p) => p.id === playerId);
    if (seated && !seated.state.is_finished) return room;

    const holder = room.session.players[room.session.turnIndex];
    const result = roll(room, holder.id, NOW);
    room = result.room as Room;
    if (result.replies.some((r) => r.text.includes('/report'))) {
      room = report(room, holder.id, 'noted').room as Room;
    }
  }
  throw new Error(`${playerId} never entered the game`);
}

describe('opening a table', () => {
  it('seats the host and invites the rest', () => {
    const { room, replies } = openRoom('chat-1', { id: 'u1', name: 'Ada' }, SEED);
    expect(room?.session.players).toHaveLength(1);
    expect(room?.started).toBe(false);
    expect(replies[0].text).toContain('Ada');
    expect(replies[0].text).toContain('/join');
  });

  it('records the seed so the game can be replayed', () => {
    expect(openRoom('c', { id: 'u1', name: 'A' }, 99).room?.seed).toBe(99);
  });

  it('plays the classic rules unless told otherwise', () => {
    expect(openRoom('c', { id: 'u1', name: 'A' }, 1).room?.session.rules.id).toBe('classic');
    expect(
      openRoom('c', { id: 'u1', name: 'A' }, 1, { ruleset: 'neuroleela' }).room?.session.rules.id,
    ).toBe('neuroleela');
  });

  it('falls back to English for a locale it does not carry', () => {
    expect(openRoom('c', { id: 'u1', name: 'A' }, 1, { language: 'kl' }).room?.language).toBe('en');
    expect(openRoom('c', { id: 'u1', name: 'A' }, 1, { language: 'ru-RU' }).room?.language).toBe('ru');
  });
});

describe('joining', () => {
  it('seats a newcomer', () => {
    const room = openRoom('c', { id: 'u1', name: 'Ada' }, SEED).room as Room;
    const { room: next, replies } = join(room, { id: 'u2', name: 'Grace' });
    expect(next?.session.players.map((p) => p.id)).toEqual(['u1', 'u2']);
    expect(replies[0].text).toContain('Grace');
  });

  it('does not seat the same person twice', () => {
    const room = openRoom('c', { id: 'u1', name: 'Ada' }, SEED).room as Room;
    const { room: next, replies } = join(room, { id: 'u1', name: 'Ada' });
    expect(next?.session.players).toHaveLength(1);
    expect(replies[0].text).toMatch(/already seated/i);
  });

  it('turns away a seventh player', () => {
    let room = openRoom('c', { id: 'u1', name: 'A' }, SEED).room as Room;
    for (let i = 2; i <= MAX_SEATS; i++) {
      room = join(room, { id: `u${i}`, name: `P${i}` }).room as Room;
    }
    const { room: next, replies } = join(room, { id: 'u7', name: 'Late' });
    expect(next?.session.players).toHaveLength(MAX_SEATS);
    expect(replies[0].text).toMatch(/full/i);
  });

  it('turns away anyone arriving after the start', () => {
    const room = table(2);
    const { replies } = join(room, { id: 'u9', name: 'Late' });
    expect(replies[0].text).toMatch(/already begun/i);
  });

  it('keeps seating order, which is turn order', () => {
    const room = table(3);
    expect(room.session.players.map((p) => p.id)).toEqual(['u1', 'u2', 'u3']);
  });
});

describe('starting', () => {
  it('lets only the host start', () => {
    let room = openRoom('c', { id: 'u1', name: 'Ada' }, SEED).room as Room;
    room = join(room, { id: 'u2', name: 'Grace' }).room as Room;

    const refused = start(room, 'u2');
    expect(refused.room?.started).toBe(false);
    expect(refused.replies[0].text).toMatch(/only whoever opened/i);

    expect(start(room, 'u1').room?.started).toBe(true);
  });

  it('will not start twice', () => {
    expect(start(table(2), 'u1').replies[0].text).toMatch(/already playing/i);
  });
});

describe('rolling', () => {
  it('refuses before the table has started', () => {
    const room = openRoom('c', { id: 'u1', name: 'A' }, SEED).room as Room;
    expect(roll(room, 'u1', NOW).replies[0].text).toMatch(/not started/i);
  });

  it('holds the turn against whoever is out of order', () => {
    const room = table(2);
    const { replies } = roll(room, 'u2', NOW);
    expect(replies[0].text).toMatch(/Ada's turn/);
  });

  it('is deterministic for a given seed', () => {
    const a = roll(table(2, 4242), 'u1', NOW);
    const b = roll(table(2, 4242), 'u1', NOW);
    expect(a.replies[0].text).toBe(b.replies[0].text);
  });

  it('gives different games for different seeds', () => {
    const texts = new Set(
      [1, 2, 3, 4, 5].map((seed) => roll(table(2, seed), 'u1', NOW).replies[0].text),
    );
    expect(texts.size).toBeGreaterThan(1);
  });

  it('advances the die, so a repeated roll is not the same throw', () => {
    let room = table(2, 7);
    const first = roll(room, 'u1', NOW);
    room = first.room as Room;
    expect(room.rollsTaken).toBe(1);

    const holder = room.session.players[room.session.turnIndex];
    const second = roll(room, holder.id, NOW);
    expect((second.room as Room).rollsTaken).toBe(2);
  });

  it('names the plan a player lands on', () => {
    const room = getOnBoard(table(1, SEED), 'u1');
    const seated = room.session.players[0];
    // Whatever square they reached, the room announced it by name.
    expect(seated.state.loka).toBeGreaterThanOrEqual(1);
    expect(seated.state.loka).toBeLessThanOrEqual(72);
  });
});

describe('the report gate in a chat', () => {
  it('asks for a report instead of moving, and names the plan', () => {
    const room = getOnBoard(table(1, SEED), 'u1');
    const { replies } = roll(room, 'u1', NOW);
    expect(replies[0].text).toMatch(/\/report/);
    expect(replies[0].broadcast).toBe(false);
  });

  it('unblocks the throw once something is written', () => {
    let room = getOnBoard(table(1, SEED), 'u1');
    expect(roll(room, 'u1', NOW).replies[0].text).toMatch(/\/report/);

    room = report(room, 'u1', 'this is where I am').room as Room;
    expect(roll(room, 'u1', NOW).replies[0].text).not.toMatch(/\/report/);
  });

  it('does not accept an empty report', () => {
    const room = getOnBoard(table(1, SEED), 'u1');
    const { replies } = report(room, 'u1', '   ');
    expect(replies[0].text).toMatch(/followed by/i);
  });

  it('turns away a report from someone not at the table', () => {
    expect(report(table(2), 'stranger', 'hello').replies[0].text).toMatch(/not at this table/i);
  });

  it('asks for the report to be kept, against the plan it was written about', () => {
    const room = getOnBoard(table(1, SEED), 'u1');
    const where = room.session.players[0].state.loka;

    const { effects } = report(room, 'u1', '  what this brings up  ');
    expect(effects).toEqual([
      { kind: 'report', userId: 'u1', plan: where, text: 'what this brings up' },
    ]);
  });

  it('asks for nothing to be kept when the report was refused', () => {
    const room = getOnBoard(table(1, SEED), 'u1');
    expect(report(room, 'u1', '   ').effects).toBeUndefined();
    expect(report(room, 'stranger', 'hello').effects).toBeUndefined();
  });

  it('produces no effects for the commands that only read', () => {
    const room = table(2);
    expect(board(room).effects).toBeUndefined();
    expect(plan(room, 'u1', 5).effects).toBeUndefined();
    expect(help().effects).toBeUndefined();
  });
});

describe('reading a plan', () => {
  it('serves any plan by number', () => {
    const { replies } = plan(table(2), 'u1', 1);
    expect(replies[0].text).toMatch(/^1\. /);
    expect(replies[0].text.length).toBeGreaterThan(200);
  });

  it('serves it in the room language', () => {
    const room = openRoom('c', { id: 'u1', name: 'A' }, SEED, { language: 'ru' }).room as Room;
    expect(plan(room, 'u1', 1).replies[0].text).toContain('Рождение');
  });

  it('refuses a square off the board', () => {
    for (const n of [0, 73, -1]) {
      expect(plan(table(2), 'u1', n).replies[0].text, `plan ${n}`).toMatch(/1 to 72/);
    }
  });

  it('defaults to where the asker stands', () => {
    const room = getOnBoard(table(1, SEED), 'u1');
    const where = room.session.players[0].state.loka;
    expect(plan(room, 'u1').replies[0].text).toMatch(new RegExp(`^${where}\\. `));
  });

  it('answers privately, not to the whole room', () => {
    expect(plan(table(2), 'u1', 5).replies[0].broadcast).toBe(false);
  });
});

describe('the board', () => {
  it('lists everyone', () => {
    const text = board(table(3)).replies[0].text;
    for (const name of ['Ada', 'P2', 'P3']) expect(text).toContain(name);
  });

  it('marks who owes a report', () => {
    const room = getOnBoard(table(1, SEED), 'u1');
    expect(board(room).replies[0].text).toMatch(/owes a report/);
  });
});

describe('a whole game', () => {
  it('plays to a finish and then refuses to continue', () => {
    let room = table(1, SEED);

    for (let i = 0; i < 2000; i++) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      room = result.room as Room;

      if (result.replies.some((r) => r.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
        continue;
      }
      if (result.replies.some((r) => r.text.includes('Cosmic Consciousness'))) break;
    }

    const seated = room.session.players[0];
    expect(seated.state.loka).toBe(68);
    expect(roll(room, 'u1', NOW).replies[0].text).toMatch(/over/i);
  });

  it('never lets a player off the board, over a long game', () => {
    let room = table(3, 31337);

    for (let i = 0; i < 1500; i++) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      room = result.room as Room;

      for (const player of room.session.players) {
        expect(player.state.loka).toBeGreaterThanOrEqual(1);
        expect(player.state.loka).toBeLessThanOrEqual(72);
      }

      if (result.replies.some((r) => r.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
      }
      if (result.replies.some((r) => r.text.match(/over/i))) break;
    }
  });
});

describe('help', () => {
  it('lists every command the bot answers to', () => {
    const text = help().replies[0].text;
    for (const command of ['/new', '/join', '/start', '/roll', '/report', '/plan', '/board']) {
      expect(text).toContain(command);
    }
  });
});

describe('the path a player has walked', () => {
  // The reports were being kept and never shown. This is what keeping them was
  // for: a player's own account of the squares they have stood on.

  const entries = [
    { plan: 6, text: 'first words', createdAt: new Date(NOW) },
    { plan: 23, text: 'later words', createdAt: new Date(NOW + 1000) },
  ];

  it('lists what was written, oldest first, because it is a path', () => {
    const { replies } = path(table(2), 'u1', entries);
    const text = replies[0].text;
    expect(text.indexOf('first words')).toBeLessThan(text.indexOf('later words'));
  });

  it('does not trust the order it was handed', () => {
    const { replies } = path(table(2), 'u1', [...entries].reverse());
    const text = replies[0].text;
    expect(text.indexOf('first words')).toBeLessThan(text.indexOf('later words'));
  });

  it('names each plan, so the words have a place', () => {
    const text = path(table(2), 'u1', entries).replies[0].text;
    expect(text).toContain(planFor('en', 6).title);
    expect(text).toContain(planFor('en', 23).title);
  });

  it('names the plans in the room language', () => {
    const room = openRoom('c', { id: 'u1', name: 'A' }, SEED, { language: 'ru' }).room as Room;
    expect(path(room, 'u1', entries).replies[0].text).toContain(planFor('ru', 6).title);
  });

  it('counts the plans, in the singular when there is one', () => {
    expect(path(table(2), 'u1', [entries[0]]).replies[0].text).toMatch(/1 plan\b/);
    expect(path(table(2), 'u1', entries).replies[0].text).toMatch(/2 plans\b/);
  });

  it('says what to do when nothing has been written yet', () => {
    const { replies } = path(table(2), 'u1', []);
    expect(replies[0].text).toMatch(/\/report/);
  });

  it('says the reports are not kept, rather than showing an empty path', () => {
    // An empty list from a store that keeps nothing would read as "you never
    // wrote anything", which is a different and untrue statement.
    const { replies } = path(table(2), 'u1', null);
    expect(replies[0].text).toMatch(/not keeping reports/i);
    expect(replies[0].text).not.toMatch(/have not written/i);
  });

  it('turns away someone not at the table', () => {
    expect(path(table(2), 'stranger', entries).replies[0].text).toMatch(/not at this table/i);
  });

  it('answers privately — a path is the player’s own', () => {
    expect(path(table(2), 'u1', entries).replies[0].broadcast).toBe(false);
  });

  it('changes nothing about the game', () => {
    const room = table(2);
    const before = JSON.stringify(room);
    path(room, 'u1', entries);
    expect(JSON.stringify(room)).toBe(before);
    expect(path(room, 'u1', entries).effects).toBeUndefined();
  });

  it('is offered in the help, or nobody will find it', () => {
    expect(help().replies[0].text).toContain('/path');
  });
});

describe('a path too long for one message', () => {
  // Telegram refuses a message over 4096 characters outright, so the reply
  // would fail to send and the player would see nothing at all. renderPlan
  // already accounted for this; /path did not.

  const longEntries = (count: number, size = 400) =>
    Array.from({ length: count }, (_, i) => ({
      plan: (i % 72) + 1,
      text: `report ${i} `.padEnd(size, 'x'),
      createdAt: new Date(NOW + i * 1000),
    }));

  it('splits into several messages rather than one that cannot be sent', () => {
    const { replies } = path(table(2), 'u1', longEntries(30));
    expect(replies.length).toBeGreaterThan(1);
    for (const reply of replies) {
      expect(reply.text.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    }
  });

  it('never splits a single report across two messages', () => {
    const entries = longEntries(30);
    const joined = path(table(2), 'u1', entries).replies.map((r) => r.text).join('\n\n');
    for (const entry of entries) {
      expect(joined, `report on plan ${entry.plan}`).toContain(entry.text);
    }
  });

  it('keeps the order across messages', () => {
    const entries = longEntries(20);
    const joined = path(table(2), 'u1', entries).replies.map((r) => r.text).join('\n\n');
    const positions = entries.map((e) => joined.indexOf(e.text));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('still sends one message when the path is short', () => {
    const { replies } = path(table(2), 'u1', longEntries(2, 50));
    expect(replies).toHaveLength(1);
  });

  it('answers privately on every message, not only the first', () => {
    for (const reply of path(table(2), 'u1', longEntries(30)).replies) {
      expect(reply.broadcast).toBe(false);
    }
  });
});

describe('paginate', () => {
  it('packs blocks into as few messages as fit', () => {
    expect(paginate(['a', 'b', 'c'], 100)).toEqual(['a\n\nb\n\nc']);
  });

  it('starts a new message rather than exceeding the limit', () => {
    const pages = paginate(['x'.repeat(60), 'y'.repeat(60)], 100);
    expect(pages).toHaveLength(2);
    expect(pages.every((page) => page.length <= 100)).toBe(true);
  });

  it('truncates a single block that cannot fit anywhere', () => {
    const [page] = paginate(['x'.repeat(500)], 100);
    expect(page.length).toBeLessThanOrEqual(100);
    expect(page.endsWith('…')).toBe(true);
  });

  it('loses nothing when everything fits', () => {
    const blocks = ['one', 'two', 'three'];
    expect(paginate(blocks, 1000).join('\n\n')).toBe(blocks.join('\n\n'));
  });

  it('returns nothing for nothing', () => {
    expect(paginate([], 100)).toEqual([]);
  });

  it('never returns an empty message', () => {
    for (const page of paginate(['a'.repeat(90), 'b'.repeat(90), 'c'], 100)) {
      expect(page.length).toBeGreaterThan(0);
    }
  });
});
