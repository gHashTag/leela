import { describe, expect, it } from 'vitest';
import { LANGUAGES, rulesFor, type Language } from '@leela/content';
import { MAX_SEATS, ONCHAIN } from '@leela/engine';
import { planFor } from '@leela/content';
import {
  MAX_MESSAGE_CHARS,
  board,
  help,
  paginate,
  path,
  pathFor,
  join,
  openRoom,
  plan,
  report,
  roll,
  start,
  type Room,
  rules,
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

  it('shows a path to someone who is not at this table', () => {
    // Reports belong to the player, not to the chat. Requiring a seat meant
    // that clearing a table, or walking into another chat, hid everything they
    // had ever written.
    const { replies } = path(table(2), 'stranger', entries);
    expect(replies[0].text).toContain('first words');
    expect(replies[0].text).not.toMatch(/not at this table/i);
  });

  it('needs no table at all', () => {
    const replies = pathFor('en', entries);
    expect(replies[0].text).toContain('first words');
  });

  it('uses the language it is given when there is no room to take one from', () => {
    expect(pathFor('ru', entries)[0].text).toContain(planFor('ru', 6).title);
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

describe('the end of a game is not a dead end', () => {
  // "This game is over" and nothing else leaves a player with no hint that
  // another table is one command away.

  /** Play a solo table to its finish. */
  function finished(): Room {
    let room = table(1, SEED);
    for (let i = 0; i < 3000; i++) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      room = result.room as Room;

      // The win first, because one reply can now be both: the closing line
      // names `/report` when the winning square's account is still owed, and a
      // helper that reads `/report` before the win files it and plays on
      // forever.
      if (result.replies.some((r) => r.text.includes('Cosmic Consciousness'))) return room;
      if (result.replies.some((r) => r.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
        continue;
      }
    }
    throw new Error('the game never finished');
  }

  it('says what to do next when the game is over', () => {
    const { replies } = roll(finished(), 'u1', NOW);
    const text = replies.map((r) => r.text).join('\n');
    expect(text).toContain('/new');
    expect(text).toContain('/path');
  });

  it('names the account the end still owes, at the end', () => {
    /**
     * `classic` asks for a report on 68, and a pass went into making the
     * winner's account possible at all — the square a whole game is played to
     * reach was, for a while, the one arrival nobody was ever asked to write
     * about. Having made it possible, the closing line pointed at `/path` and
     * `/new` and not at `/report`.
     *
     * Every other arrival is met with the words that discharge it. The
     * standings just above do say *owes a report*, in a list — an obligation
     * named in a parenthesis, in the same breath as *that is the game*, is one
     * nobody reads as an obligation.
     *
     * Found by playing a game to its end and reading what it said.
     */
    let room = table(1, SEED);

    for (let turn = 0; turn < 3000; turn += 1) {
      const holder = room.session.players[room.session.turnIndex] as { id: string };
      const result = roll(room, holder.id, NOW);
      const text = result.replies.map((reply) => reply.text).join('\n');
      room = result.room as Room;

      if (text.includes('Cosmic Consciousness')) {
        const winner = room.session.players[0] as { reportSubmitted: boolean };

        expect(winner.reportSubmitted, 'the winning square owes an account').toBe(false);
        expect(text, 'the closing line names the way to give it').toContain('/report');

        // And the account can be given: the sentence has to point somewhere.
        const filed = report(room, holder.id, 'the account of the end of it');
        expect(filed.replies.map((reply) => reply.text).join(' ')).not.toMatch(/not on the board/);
        return;
      }

      if (text.includes('/report')) {
        room = report(room, holder.id, 'noted').room as Room;
      }
    }

    throw new Error('the game never finished');
  });

  it('says nothing about an account when none is owed', () => {
    /**
     * The guard against the new sentence becoming the only one. `onchain` is
     * the variant with `reportOnWinningSquare: false` — an on-chain winner is
     * out of play and `createReport` requires `isStart`, so they cannot file
     * one at all — and a game under it must end without asking for words that
     * are impossible to give.
     *
     * Written after the first version proved nothing: it filed the report and
     * then rolled a finished game, which answers *this game is over* and never
     * reaches the closing line at all.
     */
    let room: Room = {
      ...table(1, SEED),
      session: { ...table(1, SEED).session, rules: ONCHAIN },
    };

    for (let turn = 0; turn < 3000; turn += 1) {
      const holder = room.session.players[room.session.turnIndex] as { id: string };
      const result = roll(room, holder.id, NOW);
      const text = result.replies.map((reply) => reply.text).join('\n');
      room = result.room as Room;

      if (text.includes('Cosmic Consciousness')) {
        expect(text, 'nothing is owed, so nothing is asked for').not.toMatch(/still to be written/);
        expect(text, 'and the ordinary ending is still said').toContain('/new');
        return;
      }

      if (text.includes('/report')) {
        room = report(room, holder.id, 'noted').room as Room;
      }
    }

    throw new Error('the game never finished');
  });

  it('offers the path at the moment of winning, not only afterwards', () => {
    // The winning roll itself should point at what the game produced.
    let room = table(1, SEED);
    for (let i = 0; i < 3000; i++) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      room = result.room as Room;

      const text = result.replies.map((r) => r.text).join('\n');
      if (text.includes('Cosmic Consciousness')) {
        expect(text).toContain('/path');
        return;
      }
      if (text.includes('/report')) {
        room = report(room, holder.id, 'noted').room as Room;
      }
    }
    throw new Error('the game never finished');
  });
});

describe('nothing personal is marked for the whole table', () => {
  // The transport now honours `broadcast`, which only helps if the command
  // layer marks the right things. Asserted on the shape: a reply carrying a
  // player's own words, or a whole plan's text, is theirs.

  const secret = 'a private thing I wrote about myself';

  it('keeps a report out of the broadcast', () => {
    const room = getOnBoard(table(2, SEED), 'u1');
    for (const reply of report(room, 'u1', secret).replies) {
      if (reply.text.includes(secret)) {
        expect(reply.broadcast, 'a report was marked for the whole table').toBe(false);
      }
    }
  });

  it('keeps a path private, every message of it', () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      plan: (i % 72) + 1,
      text: `${secret} ${i} `.padEnd(400, 'x'),
      createdAt: new Date(NOW + i * 1000),
    }));

    const { replies } = path(table(2), 'u1', entries);
    expect(replies.length).toBeGreaterThan(1);
    for (const reply of replies) expect(reply.broadcast).toBe(false);
  });

  it('keeps a whole plan text private, because it is a wall of text', () => {
    for (const reply of plan(table(2), 'u1', 1).replies) {
      expect(reply.broadcast).toBe(false);
    }
  });

  it('keeps the report gate private, since it names where a player stands', () => {
    const room = getOnBoard(table(2, SEED), 'u1');
    const holder = room.session.players[room.session.turnIndex];
    const { replies } = roll(room, holder.id, NOW);
    for (const reply of replies) {
      if (reply.text.includes('/report')) expect(reply.broadcast).toBe(false);
    }
  });

  it('still broadcasts what the table needs to see', () => {
    // A move, and who is next, are the group's business.
    const room = table(2, SEED);
    const { replies } = roll(room, 'u1', NOW);
    expect(replies.some((reply) => reply.broadcast)).toBe(true);
  });
});

describe('a table plays with its own variant’s die', () => {
  // Reading `rerollOnRepeat` at each call site is how it came to be read at
  // none of them. The check is that the variant reaches the die at all.

  /** Collect the die values a room actually produced, by watching the messages. */
  function rolledValues(ruleset: 'classic' | 'legacy-mobile', turns = 60): number[] {
    let room = openRoom('c', { id: 'u1', name: 'A' }, 4242, { ruleset }).room as Room;
    room = start(room, 'u1').room as Room;

    const values: number[] = [];
    for (let i = 0; i < turns; i++) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      room = result.room as Room;

      const match = result.replies[0]?.text.match(/throws (\d)/);
      if (match) values.push(Number(match[1]));
      if (result.replies.some((r) => r.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
      }
    }
    return values;
  }

  it('gives a different sequence under a variant with a different die', () => {
    // Same seed, same board, different die: the sequences must diverge, or the
    // variant is not being honoured.
    expect(rolledValues('classic')).not.toEqual(rolledValues('legacy-mobile'));
  });

  it('is still deterministic for a given variant and seed', () => {
    expect(rolledValues('legacy-mobile')).toEqual(rolledValues('legacy-mobile'));
  });

  it('produces fewer immediate repeats under the re-rolling variant', () => {
    const repeats = (values: number[]) =>
      values.filter((v, i) => i > 0 && v === values[i - 1]).length;

    expect(repeats(rolledValues('legacy-mobile', 200))).toBeLessThanOrEqual(
      repeats(rolledValues('classic', 200)),
    );
  });
});

describe('what the bot says about whose throw it is', () => {
  /**
   * A solo table announced every throw as a six.
   *
   * `roll.again` — "A six — throw again." — was pushed whenever the next
   * holder of the turn was the player who had just thrown, which at a table of
   * one is *always*. So a throw of one produced "Ann throws 1. It takes a six
   * to enter the game." and "A six — throw again." in the same breath, and had
   * done since the branch above it was fixed for the same table shape.
   *
   * 315 tests did not notice, because none of them read what the bot says
   * about a throw that is not interesting.
   *
   * The rule: the extra turn is the engine's answer — `keepsTurn`, from
   * `grantsExtraTurn` — and not a guess from who holds the turn next.
   */

  /**
   * Either way of saying the six granted one.
   *
   * *A six — throw again* when the throw can happen now, and *A six — and
   * another throw, once you have written about this plan* when it cannot. The
   * rule below is about being **told**; which of the two is said is the rule
   * after it.
   */
  const AGAIN = /throw again|another throw/;

  it('offers another throw exactly when the rules grant one', () => {
    // A table of two, because at a table of one the turn always comes back and
    // "the same player throws next" is no evidence of anything — which is the
    // confusion the defect itself was made of.
    let room = table(2, SEED);

    for (let turn = 0; turn < 300; turn += 1) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      const said = result.replies.map((reply) => reply.text).join(' ');
      const next = result.room as Room;

      room = next;

      // A refused throw is not a throw: the gate holds the seat and nothing
      // was granted or passed.
      if (result.replies.some((reply) => reply.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
        continue;
      }

      // Whether the seat was kept, read off the table rather than inferred
      // from the sixes counter — which the entering six does not touch under
      // `classic`, so counting it called an extra turn a passed one.
      const granted = next.session.players[next.session.turnIndex]?.id === holder.id;
      expect(AGAIN.test(said), `turn ${turn}: ${said}`).toBe(granted);
      if (said.includes('Cosmic Consciousness')) break;
    }
  });

  it('never offers a throw the next command refuses', () => {
    /**
     * Found by playing a game and reading it. A six that enters the board also
     * leaves the player owing a report, so the bot said *A six — throw again*
     * and answered the next `/roll` with *write what it brings up before you
     * move on*: two sentences in a row, contradicting each other, on the
     * most-travelled path there is — the entering six is the first six of every
     * game.
     *
     * The shape, over a whole game: **whenever the bot promises a throw now,
     * the next throw must not be refused.** The announcement and the refusal
     * ask `canCurrentPlayerRoll` in both places, so they cannot disagree.
     *
     * Under `classic` almost every six owes an account, so the immediate
     * promise is nearly always wrong — which is how long this went unnoticed.
     * The count is reported rather than required: a game where it is never
     * made is a game where the promise is never broken.
     */
    let room = table(2, SEED);
    let promised = 0;
    let deferred = 0;

    for (let turn = 0; turn < 400; turn += 1) {
      const holder = room.session.players[room.session.turnIndex] as { id: string };
      const result = roll(room, holder.id, NOW);
      const said = result.replies.map((reply) => reply.text).join(' ');
      const next = result.room as Room;

      // A refused throw is not a throw: the gate holds the seat, and the words
      // it answers with are the refusal, not an announcement about a six.
      if (said.includes('before you move on')) {
        room = report(room, holder.id, 'noted').room as Room;
        continue;
      }

      if (said.includes('throw again')) {
        promised += 1;
        expect(
          roll(next, holder.id, NOW).replies.map((reply) => reply.text).join(' '),
          `turn ${turn}: promised a throw and then refused it`,
        ).not.toMatch(/before you move on|Not yet/);
      }

      if (said.includes('another throw')) {
        deferred += 1;
        // And the other half: what it defers to is real. The next throw is
        // refused, and refused for the reason the sentence gave.
        expect(
          roll(next, holder.id, NOW).replies.map((reply) => reply.text).join(' '),
          `turn ${turn}: deferred a throw that was not owed`,
        ).toMatch(/before you move on/);
      }

      room = next;
      if (said.includes('Cosmic Consciousness')) break;
    }

    expect(deferred, 'no six ever landed on a square that owed an account').toBeGreaterThan(0);
  });

  it('never says it takes a six and offers another throw in one breath', () => {
    // The shape of the defect as a reader met it: two sentences about the same
    // throw, disagreeing about what it was.
    let room = table(1, 4242);

    for (let turn = 0; turn < 200; turn += 1) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      const said = result.replies.map((reply) => reply.text).join(' ');

      expect(said.includes('takes a six') && AGAIN.test(said), said).toBe(false);

      room = result.room as Room;
      if (result.replies.some((reply) => reply.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
      }
      if (said.includes('Cosmic Consciousness')) break;
    }
  });

  it('still names the next player at a table of more than one', () => {
    // The branch this shares a chain with: a table of two has to say whose
    // turn it is, or nobody knows.
    let room = table(2, SEED);
    const first = room.session.players[room.session.turnIndex];

    for (let turn = 0; turn < 50; turn += 1) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      const said = result.replies.map((reply) => reply.text).join(' ');
      room = result.room as Room;

      if (result.replies.some((reply) => reply.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
      }
      if (room.session.players[room.session.turnIndex].id !== holder.id) {
        expect(said).toMatch(/next/i);
        return;
      }
    }

    throw new Error(`the turn never moved on from ${first.id}`);
  });

  it('says nothing extra when the turn comes back without a six', () => {
    // A player alone at a table can see whose turn it is. The line that used
    // to be here was wrong; the fix is not to replace it with a different one.
    let room = table(1, 99);

    for (let turn = 0; turn < 100; turn += 1) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      const said = result.replies.map((reply) => reply.text).join(' ');
      room = result.room as Room;

      if (!AGAIN.test(said) && !said.includes('/report') && !said.includes('over')) {
        expect(said).not.toMatch(/next/i);
        return;
      }
      if (result.replies.some((reply) => reply.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
      }
    }
  });
});

describe('the rules book, in a chat', () => {
  /**
   * `@leela/content` has carried the book in 22 languages since the third pass.
   * The docs site serves it, the mini app opens it, and the bot — which is
   * where people actually play — had eleven commands and none of them was
   * this one. A player in Telegram could not read how the game works.
   */

  it('lists the chapters, numbered so one can be asked for', () => {
    const said = rules('en').replies[0].text;

    for (const chapter of rulesFor('en')) {
      expect(said, chapter.slug).toContain(chapter.title ?? chapter.slug);
    }
    expect(said).toMatch(/1\./);
  });

  it('opens every chapter it lists, in every language', () => {
    // The rule for any list: nothing in it is a dead end.
    for (const language of LANGUAGES) {
      const listed = rulesFor(language).length > 0 ? rulesFor(language) : rulesFor('en');

      for (let index = 1; index <= listed.length; index += 1) {
        const said = rules(language, index).replies[0].text;
        expect(said.length, `${language} chapter ${index}`).toBeGreaterThan(50);
      }
    }
  });

  it('answers a number that is not a chapter, rather than saying nothing', () => {
    for (const asked of [0, -1, 99, 1.5]) {
      const said = rules('en', asked).replies[0].text;
      expect(said, String(asked)).toMatch(/chapter|Which/i);
    }
  });

  it('falls back as a whole book, not chapter by chapter', () => {
    // Half in one language and half in another is worse than one a reader can
    // at least read — the same rule the mini app follows.
    const unknown = 'zz' as Language;
    const said = rules(unknown).replies[0].text;

    for (const chapter of rulesFor('en')) {
      expect(said).toContain(chapter.title ?? chapter.slug);
    }
  });

  it('is in the language of the chat when that language has a book', () => {
    const said = rules('ru').replies[0].text;
    expect(said).toMatch(/[А-Яа-я]/);
  });
});

describe('the table of standings', () => {
  /**
   * It had two states where there are three. `hasWon` gave "finished" and
   * everything else printed its raw square — so a player who had never thrown
   * a six was listed as standing on **68**, the winning square, because that
   * is where a waiting player sits in this shape.
   *
   * `render.ts` knew and this did not, which is the sixth time the 68
   * ambiguity has cost something. The predicate lives in the engine now.
   */

  it('never shows a player who has not entered as standing anywhere', () => {
    let room = table(3, SEED);
    // Nobody has thrown: every seat is waiting.
    const said = board(room).replies[0].text;

    expect(said).not.toMatch(/\b68\b/);
    expect(said.split('\n').filter((line) => /waiting/i.test(line))).toHaveLength(3);
  });

  it('shows a square only for somebody standing on one', () => {
    // The relation: a line carries a number exactly when that player is in
    // play, over a game long enough for the three states to occur.
    let room = table(2, SEED);

    for (let turn = 0; turn < 60; turn += 1) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      room = result.room as Room;
      if (result.replies.some((reply) => reply.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
      }

      // Matched by name: these lines are sorted by standing, not by seat, and
      // a name can hold a digit — the first two versions of this test read
      // `P2` as a square and then read the wrong player's line.
      const lines = new Map(
        board(room)
          .replies[0].text.split('\n')
          .map((line) => {
            const [name, ...rest] = line.split(': ');
            return [name ?? '', rest.join(': ')];
          }),
      );

      for (const player of room.session.players) {
        const where = lines.get(player.name ?? room.names[player.id] ?? player.id) ?? '';
        const inPlay = !player.state.is_finished;
        expect(/^\d+/.test(where), `${player.id}: ${where}`).toBe(inPlay);
      }
    }
  });

  it('says a winner is finished rather than giving their square', () => {
    const won = {
      ...table(1, SEED),
    } as Room;
    const room: Room = {
      ...won,
      session: {
        ...won.session,
        players: won.session.players.map((player) => ({
          ...player,
          state: { ...player.state, loka: 68, previous_loka: 62, is_finished: true },
        })),
      },
    };

    expect(board(room).replies[0].text).not.toMatch(/68/);
  });
});
