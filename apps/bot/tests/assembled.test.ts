import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

/** Everything `index.ts` does, minus the polling. */
function assemble(path: string) {
  const storage = openStorage({ path, log: () => undefined });
  const sent: Sent[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store: storage.store,
    reports: storage.reports,
    steps: storage.steps,
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
