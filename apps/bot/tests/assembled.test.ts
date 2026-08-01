import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Guide } from '@leela/ai';
import { createBot } from '../src/bot';
import { openStorage } from '../src/storage';

/**
 * The bot an operator actually runs, played across a restart.
 *
 * The pass before this found the worst defect of the run by playing a game
 * through SQLite: the durable sink had `record` and no `history`, so the
 * configuration that exists precisely so that nothing is lost wrote every
 * report into a database and then told anybody who asked that it kept nothing.
 *
 * No unit test could have found it. Every one of them holds a store it built
 * itself, and the two halves only meet where the thing is **assembled** —
 * `openStorage` deciding what to build, `createBot` deciding what to ask.
 * `audit-unread` could not see it either: `reportsFor` is a method on a class
 * rather than an export.
 *
 * So this is the missing kind of test rather than another of the kind there
 * were plenty of. It builds the bot the way `index.ts` does, plays through it,
 * throws the process away, builds it again on the same volume, and carries on.
 */

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'Leela',
  username: 'leela',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business_account: false,
  has_main_web_app: false,
} as never;

const CHAT = { id: 500, type: 'private' as const };

let updateId = 0;

function message(text: string) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: CHAT.id, type: CHAT.type, title: 'A table' },
      from: { id: 100, is_bot: false, first_name: 'Ada' },
      text,
      entities: text.startsWith('/')
        ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }]
        : undefined,
    },
  } as never;
}

/** A square handed over from the mini app, as Telegram delivers it. */
function handedOver(data: string) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: CHAT.id, type: CHAT.type, title: 'A table' },
      from: { id: 100, is_bot: false, first_name: 'Ada' },
      web_app_data: { button_text: 'Ask', data },
    },
  } as never;
}

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

/** Everything `index.ts` does, minus the polling. */
function assemble(path: string, guide?: Guide) {
  const storage = openStorage({ path, log: () => undefined });
  const sent: Sent[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store: storage.store,
    reports: storage.reports,
    steps: storage.steps,
    guide,
  });

  bot.api.config.use(async (_next, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return {
      ok: true,
      result: method === 'answerCallbackQuery' ? true : { message_id: 1 },
    } as never;
  });

  return { bot, sent, storage };
}

const texts = (sent: Sent[]) =>
  sent.filter((entry) => entry.method === 'sendMessage').map((entry) => String(entry.payload.text));

/** A fresh directory, so one run cannot read another's games. */
const temporary = () => join(mkdtempSync(join(tmpdir(), 'leela-assembled-')), 'leela.db');

describe('the bot as it is actually assembled', () => {
  it('keeps a game and a path across a restart', async () => {
    const path = temporary();

    let { bot, sent, storage } = assemble(path);
    expect(storage.durable, 'a path was given and opened').toBe(true);

    await bot.handleUpdate(message('/new'));
    await bot.handleUpdate(message('/start'));

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const before = sent.length;
      await bot.handleUpdate(message('/roll'));
      if (texts(sent.slice(before)).join(' ').includes('before you move on')) break;
    }
    await bot.handleUpdate(message('/report a first account, long enough to count as one'));

    // A new process on the same volume.
    storage.stopPruning?.();
    ({ bot, sent, storage } = assemble(path));

    let before = sent.length;
    await bot.handleUpdate(message('/path'));
    const path_ = texts(sent.slice(before)).join(' ');

    // The defect this file exists for: a bot that kept the report and said it
    // had not. Both halves are asserted, because the empty list and the "not
    // keeping reports" sentence are different lies.
    expect(path_).toContain('a first account');
    expect(path_).not.toMatch(/not keeping reports/i);
    expect(path_).not.toMatch(/have not written anything/i);

    // And the game itself is still there to carry on with.
    before = sent.length;
    await bot.handleUpdate(message('/roll'));
    expect(texts(sent.slice(before)).join(' ')).toMatch(/throws \d/);

    storage.stopPruning?.();
  });

  it('offers the file it says it has', async () => {
    // `/save` reads the same store through a different door, and a store that
    // cannot be read has nothing to write.
    const path = temporary();
    const { bot, sent, storage } = assemble(path);

    await bot.handleUpdate(message('/new'));
    await bot.handleUpdate(message('/start'));
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const before = sent.length;
      await bot.handleUpdate(message('/roll'));
      if (texts(sent.slice(before)).join(' ').includes('before you move on')) break;
    }
    await bot.handleUpdate(message('/report something worth keeping in a file'));

    const before = sent.length;
    await bot.handleUpdate(message('/save'));

    expect(sent.slice(before).filter((entry) => entry.method === 'sendDocument')).toHaveLength(1);
    storage.stopPruning?.();
  });

  it('says plainly when it cannot keep anything, and still plays', async () => {
    // A path that cannot be opened is the commonest deployment mistake — a
    // volume that is not mounted — and the bot promises in its own README that
    // it will run anyway and say so.
    const { bot, sent, storage } = assemble('/nowhere-at-all/leela.db');

    expect(storage.durable).toBe(false);
    expect(storage.failure).toBeTruthy();

    await bot.handleUpdate(message('/new'));
    const before = sent.length;
    await bot.handleUpdate(message('/start'));

    expect(texts(sent.slice(before)).join(' ')).toMatch(/begins/i);
    storage.stopPruning?.();
  });
});

describe('the question the bot had nowhere to keep', () => {
  /**
   * *The game is being played to answer it, and the reports are the answer
   * accumulating* — this repository's own words, about the intention. And the
   * companion, which reads every report, had never been told it. The word
   * appeared nowhere in `packages/ai` or in this app.
   *
   * Kept by player rather than by table: a chat has no profile, but the question
   * belongs to the person and follows them between tables, exactly as their
   * reports do. Which is why this is tested here, through the assembled bot and
   * across a restart, rather than against a store built by hand.
   */

  it('holds it, gives it back, and survives a restart', async () => {
    const path = temporary();

    let { bot, sent, storage } = assemble(path);

    let before = sent.length;
    await bot.handleUpdate(message('/intention'));
    expect(texts(sent.slice(before)).join(' '), 'nothing held yet').toMatch(/have not said/i);

    await bot.handleUpdate(message('/intention to stop hurrying, and see what I hurry past'));

    storage.stopPruning?.();
    ({ bot, sent, storage } = assemble(path));

    before = sent.length;
    await bot.handleUpdate(message('/intention'));
    expect(texts(sent.slice(before)).join(' ')).toContain('to stop hurrying');

    storage.stopPruning?.();
  });

  it('changes it when asked again, because changing it is part of playing', async () => {
    const path = temporary();
    const { bot, sent, storage } = assemble(path);

    await bot.handleUpdate(message('/intention the first question'));
    await bot.handleUpdate(message('/intention the second question'));

    const before = sent.length;
    await bot.handleUpdate(message('/intention'));
    const said = texts(sent.slice(before)).join(' ');

    expect(said).toContain('the second question');
    expect(said).not.toContain('the first question');
    storage.stopPruning?.();
  });

  it('refuses one nobody could have meant', async () => {
    const path = temporary();
    const { bot, sent, storage } = assemble(path);

    const before = sent.length;
    await bot.handleUpdate(message('/intention x'));

    expect(texts(sent.slice(before)).join(' ')).toMatch(/two characters/i);
    storage.stopPruning?.();
  });

  it('holds one in memory when the volume is missing, as it holds reports', async () => {
    // A path that cannot be opened falls back to memory — and memory keeps a
    // question exactly as long as it keeps a report, which is until the process
    // ends. Saying "there is nowhere to hold it" here would be the same lie the
    // durable sink used to tell about reports.
    const { bot, sent, storage } = assemble('/nowhere-at-all/leela.db');
    expect(storage.durable).toBe(false);

    await bot.handleUpdate(message('/intention to see it through'));

    const before = sent.length;
    await bot.handleUpdate(message('/intention'));
    expect(texts(sent.slice(before)).join(' ')).toContain('to see it through');

    storage.stopPruning?.();
  });

  it('says there is nowhere only where there truly is nowhere', async () => {
    // A bot built with no store at all discards everything, and the two
    // sentences are different facts: "nothing is kept here" and "you have not
    // chosen one". Only one of them is ever true.
    const sent: Sent[] = [];
    const bot = createBot({ token: '1:TEST', botInfo: BOT_INFO, log: () => undefined });
    bot.api.config.use(async (_next, method, payload) => {
      sent.push({ method, payload: payload as Record<string, unknown> });
      return { ok: true, result: { message_id: 1 } } as never;
    });

    await bot.handleUpdate(message('/intention to see it through'));
    expect(texts(sent).join(' ')).toMatch(/nowhere to hold/i);
  });
});

describe('which route may set a question', () => {
  /**
   * The mini app's hand-over is the one square the bot can be sure belongs to
   * the person sending it: Telegram delivers it from *their* app. `/take` is
   * the other kind — somebody pasting you a square they landed on — and reading
   * their frame is not adopting it.
   *
   * Same rule as everywhere else it appears: only where there is none.
   */
  const shared = [
    '41. The human plane (jana-loka)',
    '',
    'What it asked of me.',
    '',
    '— to stop hurrying',
  ].join('\n');

  function handedOver(data: string) {
    updateId += 1;
    return {
      update_id: updateId,
      message: {
        message_id: updateId,
        date: 0,
        chat: { id: CHAT.id, type: CHAT.type, title: 'A table' },
        from: { id: 100, is_bot: false, first_name: 'Ada' },
        web_app_data: { data, button_text: '📝' },
      },
    } as never;
  }

  it('takes the question from the player’s own app', async () => {
    const path = temporary();
    const { bot, sent, storage } = assemble(path);

    await bot.handleUpdate(handedOver(shared));

    const before = sent.length;
    await bot.handleUpdate(message('/intention'));
    expect(texts(sent.slice(before)).join(' ')).toContain('to stop hurrying');

    storage.stopPruning?.();
  });

  it('leaves a question already given alone', async () => {
    const path = temporary();
    const { bot, sent, storage } = assemble(path);

    await bot.handleUpdate(message('/intention to say it out loud'));
    await bot.handleUpdate(handedOver(shared));

    const before = sent.length;
    await bot.handleUpdate(message('/intention'));
    const said = texts(sent.slice(before)).join(' ');

    expect(said).toContain('to say it out loud');
    expect(said).not.toContain('to stop hurrying');

    storage.stopPruning?.();
  });

  it('does not mistake the end of an account for a question', async () => {
    // A closing line is ordinary writing. Shared from the mini app, it used to
    // be lifted out of the account and installed as the question the game is
    // played to answer — and the player it happened to is the one who has no
    // question yet, which is the only one this route sets.
    const ownWords = [
      '41. The human plane (jana-loka)',
      '',
      'I kept circling the same thing today.',
      '— that I am afraid of being ordinary',
    ].join('\n');

    const path = temporary();
    const { bot, sent, storage } = assemble(path);

    await bot.handleUpdate(handedOver(ownWords));

    let before = sent.length;
    await bot.handleUpdate(message('/intention'));
    expect(texts(sent.slice(before)).join(' '), 'nothing was adopted').toMatch(/have not said/i);

    before = sent.length;
    await bot.handleUpdate(message('/path'));
    expect(texts(sent.slice(before)).join(' '), 'and the line is still theirs').toContain(
      'afraid of being ordinary',
    );

    storage.stopPruning?.();
  });

  it('never takes it from a square somebody pasted', async () => {
    // `/take` keeps the square and declines the frame.
    const path = temporary();
    const { bot, sent, storage } = assemble(path);

    await bot.handleUpdate(message(`/take ${shared}`));

    const before = sent.length;
    await bot.handleUpdate(message('/intention'));
    expect(texts(sent.slice(before)).join(' ')).toMatch(/have not said/i);

    storage.stopPruning?.();
  });
});

describe('a page the bot tells you to ask for', () => {
  /**
   * Through `handleUpdate`, because that is where it was wrong.
   *
   * `plan.continues` reads *…continues. /plan {plan} {next} for page {next} of
   * {pages}* and `/plan 2 2` was answered with *the board runs from 1 to 72* —
   * the command refusing an instruction it had printed four lines earlier,
   * because `Number("2 2")` is `NaN`. A hundred and seventy-five plan texts
   * across 22 languages had a second page nothing could reach.
   *
   * The pure suites cannot see it: the parsing lives in the transport, and
   * reverting the fix left five hundred and twenty-one of them green. This is
   * the only place it shows.
   */
  it('gives the second page when asked the way it says to ask', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'leela-paged-'));
    const { bot, sent } = assemble(join(dir, 'leela.db'));

    await bot.handleUpdate(message('/new'));
    await bot.handleUpdate(message('/start'));
    await bot.handleUpdate(message('/plan 2'));

    const first = sent.at(-1)?.payload.text as string;
    const told = first.match(/\/plan (\d+) (\d+)/);
    expect(told, 'plan 2 does not run to a second page in this language').not.toBe(null);

    // Typed back verbatim, as a reader would.
    await bot.handleUpdate(message(told?.[0] as string));
    const second = sent.at(-1)?.payload.text as string;

    expect(second, 'the command refused its own instruction').not.toContain(
      'The board runs from 1 to 72',
    );
    expect(second).not.toBe(first);
  });

  it('still refuses a square that is not on the board', () => {
    // The guard against the parser becoming a way of accepting anything.
    expect(Number('99')).toBe(99);
    expect(Number('abc')).toBeNaN();
  });
});

describe('a square somebody sent is not where the player stands', () => {
  /**
   * The mini app hands a square over through Telegram — `web_app_data` — and
   * the bot files it and asks the companion about it. The player is **not** on
   * that square: they may be on plan 6, or waiting to enter the game at all.
   * `systemPrompt` said *The player is on plan N* for every path alike, so the
   * companion answered somebody else's account as though it were where the
   * reader lived.
   *
   * (`/take` in a chat files the same square and does *not* call the companion.
   * The hand-over is the path that does, because it comes from the player's own
   * app rather than from a message anybody could paste.)
   *
   * Through `handleUpdate`, because the fact travels in the transport: removing
   * `arrival: 'received'` from the handler leaves all five hundred and
   * thirty-two of this package's other tests green.
   */
  it('tells the companion the square was handed over', async () => {
    const asked: string[] = [];
    const guide = new Guide({
      model: {
        id: 'test',
        async complete(messages) {
          asked.push(messages.map((one) => one.content).join('\n'));
          return 'a reflection';
        },
      },
    });

    const dir = mkdtempSync(join(tmpdir(), 'leela-handed-'));
    const { bot } = assemble(join(dir, 'leela.db'), guide);

    await bot.handleUpdate(message('/new'));
    await bot.handleUpdate(message('/start'));
    await bot.handleUpdate(handedOver('41. Ignorance (avidya)\n\nWhat somebody else wrote.'));

    expect(asked.length, 'the companion was never asked').toBeGreaterThan(0);
    const prompt = asked.at(-1) ?? '';

    expect(prompt).toContain('sent the player');
    expect(prompt, 'the player is elsewhere').toContain('not standing there');
    expect(prompt).not.toContain('The player is on plan 41');
  });
});
