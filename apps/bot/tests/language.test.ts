import { describe, expect, it } from 'vitest';
import { CLASSIC, ONLINE } from '@leela/engine';
import { messageCoverage, messageFor } from '@leela/content';
import {
  board,
  help,
  join,
  openRoom,
  path,
  plan,
  playingButtons,
  report,
  roll,
  waitingButtons,
  type CommandResult,
  type Room,
} from '../src/commands';
import { renderBoardMessage, renderPlan, renderStandings } from '../src/render';

/**
 * The bot spoke English at a Russian table.
 *
 * `room.language` reached exactly one function — `planFor` — so a game opened
 * with `language_code: 'ru'` served all 72 plans in Russian and every sentence
 * around them in English: whose turn it is, that you owe a report, the help.
 *
 * These tests are not a list of the sentences that were wrong. They play a
 * whole game in Russian and assert that nothing Latin comes out, so a sentence
 * added in English tomorrow fails here rather than shipping.
 */

const NOW = 1_700_000_000_000;

/**
 * Commands, HTML tags and placeholders are Latin by nature; prose is the issue.
 *
 * `<b>` and `<pre>` are Telegram's markup, not something a player reads, so
 * they are stripped before looking. Everything left is meant to be read.
 */
function latinProseIn(text: string): string[] {
  const withoutMarkup = text
    .replace(/<\/?[a-z]+>/gi, ' ')
    .replace(/\/[a-z]+/g, ' ')
    // `[n]` in `/plan [n]` is the name of an argument, like `{count}` — part
    // of the command's syntax rather than a sentence.
    .replace(/\[[a-z]+\]/gi, ' ')
    .replace(/\{[a-z]+\}/gi, ' ');
  return withoutMarkup.match(/[A-Za-z]+/g) ?? [];
}

/**
 * Roll until the player is on the board.
 *
 * Entry needs a six and the die is deterministic, so how many throws that
 * takes depends on the seed. Each attempt is a day later so a variant with a
 * cooldown does not refuse the next one.
 */
function enter(room: Room, id: string, from = NOW): { room: Room; at: number } {
  let current = room;
  let at = from;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const holder = current.session.players[current.session.turnIndex];
    const result = roll(current, holder.id, at);
    current = (result.room as Room) ?? current;
    at += 2 * 86_400_000;
    const seated = current.session.players.find((p) => p.id === id);
    if (seated && !seated.state.is_finished) return { room: current, at };
    if (seated && !seated.reportSubmitted) {
      current = report(current, id, 'слова').room as Room;
    }
  }
  throw new Error('never entered');
}

/** A Russian table with Cyrillic names, so a leftover name is not a false alarm. */
function russianTable(): Room {
  const opened = openRoom('чат', { id: 'а', name: 'Аня' }, 42, { language: 'ru' });
  const room = opened.room as Room;
  const joined = join(room, { id: 'б', name: 'Боря' }).room as Room;
  return { ...joined, started: true };
}

describe('a Russian table is played in Russian', () => {
  it('says nothing Latin from opening a table to the end of a game', () => {
    const said: string[] = [];
    const collect = (result: CommandResult) => {
      for (const reply of result.replies) {
        said.push(reply.text);
        for (const button of reply.buttons ?? []) said.push(button.label);
      }
      return result;
    };

    let room = collect(openRoom('чат', { id: 'а', name: 'Аня' }, 42, { language: 'ru' }))
      .room as Room;
    room = collect(join(room, { id: 'б', name: 'Боря' })).room as Room;

    // Every refusal, not only the happy path: a message a player sees when
    // they get something wrong is the one they most need to read.
    collect(join(room, { id: 'б', name: 'Боря' }));
    collect(roll(room, 'а', NOW));

    room = { ...room, started: true };
    collect(join(room, { id: 'в', name: 'Вера' }));
    collect(roll(room, 'б', NOW));

    // Play far enough for entries, plain steps, jumps and the report gate.
    for (let turn = 0; turn < 24; turn += 1) {
      const holder = room.session.players[room.session.turnIndex];
      const moved = collect(roll(room, holder.id, NOW + turn * 86_400_000));
      room = moved.room as Room;
      if (!moved.room) break;
      collect(report(room, holder.id, 'что-то поднялось'));
      room = report(room, holder.id, 'что-то поднялось').room as Room;
    }

    collect(board(room));
    collect(plan(room, 'а'));
    collect(plan(room, 'а', 900));
    collect(path(room, 'а', null));
    collect(path(room, 'а', []));
    collect(path(room, 'а', [{ plan: 6, text: 'первый', createdAt: new Date(NOW) }]));
    collect(help('ru'));
    said.push(renderBoardMessage(room), renderStandings(room));
    said.push(...playingButtons('ru').map((b) => b.label));
    said.push(...waitingButtons('ru').map((b) => b.label));

    expect(said.length).toBeGreaterThan(40);
    const latin = said.flatMap(latinProseIn);
    expect(latin).toEqual([]);
  });

  it('answers the report gate in Russian, which is where a player is stuck', () => {
    const entered = enter(russianTable(), 'а');
    const text = roll(entered.room, 'а', entered.at)
      .replies.map((r) => r.text)
      .join('\n');
    expect(latinProseIn(text)).toEqual([]);
  });

  it('names the plan in Russian when it cuts a long one short', () => {
    const long = renderPlan('ru', 6, 'Заблуждение (моха)', 'слово '.repeat(3000));
    expect(long).toContain('продолжение');
    expect(latinProseIn(long.replace(/<\/?[a-z]+>/g, ' '))).toEqual([]);
  });

  it('counts plans with the Russian plural, not the English pair', () => {
    const one = path(russianTable(), 'а', [
      { plan: 6, text: 'раз', createdAt: new Date(NOW) },
    ]).replies[0].text;
    const five = path(
      russianTable(),
      'а',
      Array.from({ length: 5 }, (_, i) => ({
        plan: i + 1,
        text: 'раз',
        createdAt: new Date(NOW + i),
      })),
    ).replies[0].text;

    expect(one).toContain('1 план.');
    expect(five).toContain('5 планов.');
  });
});

describe('an English table is unchanged', () => {
  // The 188 tests written before this catalogue existed assert English text
  // directly. They are the check that translating the bot did not reword it.
  it('still says what it said', () => {
    const opened = openRoom('c', { id: 'a', name: 'Anna' }, 42);
    expect(opened.replies[0].text).toContain('A table is open. Anna is seated.');
    expect(help().replies[0].text).toContain('Leela — the game of self-knowledge.');
  });

  it('falls back to English for a language with no catalogue', () => {
    const opened = openRoom('c', { id: 'a', name: 'Anna' }, 42, { language: 'ja' });
    expect(opened.replies[0].text).toContain('A table is open.');
    // The plans are still Japanese: a missing catalogue withholds the
    // scaffolding, not the game.
    const room = { ...(opened.room as Room), started: true };
    expect(plan(room, 'a', 1).replies[0].text).not.toMatch(/^1\. Birth/);
  });
});

describe('the language of a table, not of a player', () => {
  it('keeps one language at the table whoever is speaking', () => {
    // Two players with different Telegram locales sit at one board. A reply
    // naming a square has to name it the same way for both, or they are
    // reading different games.
    const entered = enter(russianTable(), 'а');
    const seen = roll(entered.room, 'а', entered.at);
    expect(latinProseIn(seen.replies.map((r) => r.text).join('\n'))).toEqual([]);
  });

  it('reports coverage rather than implying every language is done', () => {
    const coverage = messageCoverage();
    expect(coverage.map((c) => c.language).sort()).toEqual(['en', 'ru']);
    // A language with no catalogue is not listed as 0% — it is not listed,
    // and `messageFor` serves it English. The distinction is deliberate.
    expect(messageFor('de', 'start.already')).toBe(messageFor('en', 'start.already'));
  });
});

describe('a table that is not English does not lose the cooldown message', () => {
  it('says how long is left, in Russian', () => {
    // Under `online` the day begins when the report is written, and a report is
    // a hundred characters — both read out of the published app rather than
    // assumed. A five-letter line is refused and starts nothing.
    const written = 'Этот план поднимает во мне давнее, о чём я до сих пор не находил слов, и сегодня оно наконец назвалось.';
    expect(written.length).toBeGreaterThanOrEqual(100);

    const opened = openRoom('чат', { id: 'а', name: 'Аня' }, 42, {
      language: 'ru',
      ruleset: ONLINE.id,
    });
    const entered = enter({ ...(opened.room as Room), started: true }, 'а');
    const wroteAt = entered.at;
    const reported = report(entered.room, 'а', written, wroteAt).room as Room;

    const tooSoon = roll(reported, 'а', wroteAt + 1000);
    // `formatWait` is the engine's, and its "3h 5m" is a duration rather than
    // prose — the only Latin the game speaks on purpose.
    expect(tooSoon.replies[0].text).toContain('Пока нет.');
  });

  it('refuses a line too short to be a report, in Russian', () => {
    const opened = openRoom('чат', { id: 'а', name: 'Аня' }, 42, {
      language: 'ru',
      ruleset: ONLINE.id,
    });
    const entered = enter({ ...(opened.room as Room), started: true }, 'а');
    const said = report(entered.room, 'а', 'слова', entered.at).replies[0].text;

    expect(said).toContain('100');
    expect(latinProseIn(said.replace(/\d+/g, ''))).toEqual([]);
  });

  it('still gates a classic table in Russian', () => {
    const opened = openRoom('чат', { id: 'а', name: 'Аня' }, 42, {
      language: 'ru',
      ruleset: CLASSIC.id,
    });
    const entered = enter({ ...(opened.room as Room), started: true }, 'а');
    const blocked = roll(entered.room, 'а', entered.at);
    expect(blocked.replies[0].text).toContain('Напишите');
  });
});

describe('the board is a diagram, not a sentence', () => {
  /**
   * Digits are weak in the Unicode bidirectional algorithm. Inside a
   * right-to-left paragraph — which is what an Arabic or Urdu Telegram client
   * gives a message — a row reading `01 02 03` is displayed as `03 02 01`.
   * Nothing in the string is wrong; the board is mirrored anyway, plan 1 sits
   * where plan 9 belongs, and every snake descends the other way.
   */
  const boardIn = (message: string) => message.slice(message.indexOf('<pre>') + 5, message.indexOf('</pre>'));

  it('holds the grid left to right whoever is reading', () => {
    const message = renderBoardMessage(russianTable());
    const board = boardIn(message);
    expect(board.codePointAt(0)).toBe(0x2066);
    expect(board.codePointAt(board.length - 1)).toBe(0x2069);
  });

  it('is isolated in every language, not only the right-to-left ones', () => {
    // A board that mirrors for some readers and not others is two boards. The
    // isolate is unconditional so there is only one, and it does nothing
    // visible in a left-to-right message.
    for (const language of ['en', 'ru', 'ar', 'ur', 'ja'] as const) {
      const opened = openRoom('чат', { id: 'а', name: 'Аня' }, 42, { language });
      const board = boardIn(renderBoardMessage({ ...(opened.room as Room), started: true }));
      expect(board.codePointAt(0), language).toBe(0x2066);
    }
  });

  it('changes nothing a player sees', () => {
    const room = russianTable();
    const board = boardIn(renderBoardMessage(room)).replace(/[⁦⁩]/g, '');
    // Eight rows of nine squares, in the order the board has always had them.
    const rows = board.split('\n');
    expect(rows).toHaveLength(8);
    expect(rows[7].split(' ')).toHaveLength(9);
    expect(rows[7].split(' ')[0]).toBe('01');
  });
});

/**
 * What the bot says about a throw that did not move anybody.
 *
 * From a live game, in a private chat, seven throws in a row:
 *
 *     Dmitrii бросает 2. Не хватает места — бросок не проходит.
 *     Следующий ход — Dmitrii.
 *
 * Both sentences are wrong in their own way. The player was waiting to enter
 * and is not short of room — they need a six, which is a different rule and
 * the one they needed told. And at a table of one, "X is next" after every
 * throw, addressed to X, is half of everything the bot says.
 *
 * `apps/miniapp` fixed the first of these when it was written, with a comment
 * saying exactly what was wrong with it. The bot never got the fix. These
 * assert over every throw from every square rather than over the case that was
 * reported.
 */
describe('a throw that moves nobody', () => {
  function soloTable(seed = 42) {
    const opened = openRoom('чат', { id: 'а', name: 'Аня' }, seed, { language: 'ru' });
    return { ...(opened.room as Room), started: true };
  }

  /** What the bot says for a given roll, by driving the room to produce it. */
  function saidFor(room: Room, id: string, at = NOW) {
    return roll(room, id, at)
      .replies.map((r) => r.text)
      .join('\n');
  }

  it('tells a player waiting to enter what would let them in', () => {
    // The die is deterministic, so walk seeds until each of 1..5 has been
    // thrown by someone still waiting. Every one of them must say six.
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60 && seen.size < 5; seed += 1) {
      const room = soloTable(seed);
      const said = saidFor(room, 'а');
      const value = Number(said.match(/бросает (\d)/)?.[1]);
      if (!Number.isInteger(value) || value === 6) continue;
      seen.add(value);
      expect(said, `seed ${seed} threw ${value}`).toContain('шестёрки');
      expect(said).not.toContain('Не хватает места');
    }
    expect(seen.size, 'every failing die value was exercised').toBe(5);
  });

  it('does not claim they came from the square nobody stands on', () => {
    // A waiting player sits on 68 as an implementation detail. A sentence
    // reading "68 → 6" describes a move from Cosmic Consciousness.
    for (let seed = 1; seed <= 40; seed += 1) {
      const said = saidFor(soloTable(seed), 'а');
      expect(said, `seed ${seed}`).not.toContain('68 →');
    }
  });

  it('names the plan when a six finally lets them in', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const said = saidFor(soloTable(seed), 'а');
      if (!said.includes('бросает шестёрку')) continue;
      expect(said).toContain('входит в игру на 6');
      expect(said).toContain('Заблуждение');
      return;
    }
    throw new Error('no seed in 1..60 entered the game on the first throw');
  });

  it('does not tell the only player at the table that they are next', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(saidFor(soloTable(seed), 'а'), `seed ${seed}`).not.toContain('Следующий ход');
    }
  });

  it('still says who is next when it is somebody else', () => {
    // The rule is "not when the turn comes straight back", not "never".
    const opened = openRoom('чат', { id: 'а', name: 'Аня' }, 42, { language: 'ru' });
    const two = join(opened.room as Room, { id: 'б', name: 'Боря' }).room as Room;
    expect(saidFor({ ...two, started: true }, 'а')).toContain('Следующий ход — Боря');
  });

  it('says nothing Latin in any of it', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(latinProseIn(saidFor(soloTable(seed), 'а')), `seed ${seed}`).toEqual([]);
    }
  });
});
