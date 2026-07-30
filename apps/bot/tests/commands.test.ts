import { describe, expect, it } from 'vitest';
import { MAX_SEATS } from '@leela/engine';
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
      if (result.replies.some((r) => r.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
        continue;
      }
      if (result.replies.some((r) => r.text.includes('Cosmic Consciousness'))) return room;
    }
    throw new Error('the game never finished');
  }

  it('says what to do next when the game is over', () => {
    const { replies } = roll(finished(), 'u1', NOW);
    const text = replies.map((r) => r.text).join('\n');
    expect(text).toContain('/new');
    expect(text).toContain('/path');
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

  const AGAIN = 'throw again';

  it('offers another throw exactly when the rules grant one', () => {
    let room = table(1, SEED);

    for (let turn = 0; turn < 300; turn += 1) {
      const holder = room.session.players[room.session.turnIndex];
      const before = holder.state.consecutive_sixes;
      const result = roll(room, holder.id, NOW);
      const said = result.replies.map((reply) => reply.text).join(' ');
      const after = (result.room as Room).session.players[0].state;

      // The engine grants the extra turn on a six under `classic`; the state
      // it produced is the record of whether it did.
      const granted = after.consecutive_sixes > before && !after.is_finished;
      expect(said.includes(AGAIN), `turn ${turn}: ${said}`).toBe(granted);

      room = result.room as Room;
      if (result.replies.some((reply) => reply.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
      }
      if (said.includes('Cosmic Consciousness')) break;
    }
  });

  it('never says it takes a six and offers another throw in one breath', () => {
    // The shape of the defect as a reader met it: two sentences about the same
    // throw, disagreeing about what it was.
    let room = table(1, 4242);

    for (let turn = 0; turn < 200; turn += 1) {
      const holder = room.session.players[room.session.turnIndex];
      const result = roll(room, holder.id, NOW);
      const said = result.replies.map((reply) => reply.text).join(' ');

      expect(said.includes('takes a six') && said.includes(AGAIN), said).toBe(false);

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

      if (!said.includes(AGAIN) && !said.includes('/report') && !said.includes('over')) {
        expect(said).not.toMatch(/next/i);
        return;
      }
      if (result.replies.some((reply) => reply.text.includes('/report'))) {
        room = report(room, holder.id, 'noted').room as Room;
      }
    }
  });
});
