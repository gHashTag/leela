/**
 * The bot, assembled, over a table it cannot read.
 *
 * `DatabaseRoomStore.get` answered `null` both to *no table in this chat* and
 * to *there is a table and the engine will not take it*, and two commands act
 * on that difference:
 *
 * - `/end` replied *there is no table here* and left the row exactly where it
 *   was, so nothing in the chat could clear it;
 * - `/new` carries a guard that refuses to replace a game in progress, and the
 *   guard asks whether a room came back. None did — so `/new` wrote a fresh
 *   table over every seat at the old one, and the only account of why went to a
 *   server log that nobody at the table can read.
 *
 * A unit test over the store cannot see the second half: the destruction is in
 * a command handler, and the row is in a file. So this plays it — a real table
 * in SQLite, one column made impossible, and the commands sent through the bot
 * an operator actually runs.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBot } from '../src/bot';
import { openStorage } from '../src/storage';
import { SqliteRoomQueries } from '../src/sqlite';

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'Leela',
  username: 'leela_test_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business_account: false,
  has_main_web_app: false,
} as never;

const CHAT = -100;
let update = 0;

const message = (text: string, from = { id: 7, first_name: 'Ada', is_bot: false }) => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat: { id: CHAT, type: 'group' as const, title: 'a table' },
    from,
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }],
  },
});

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

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
    return { ok: true, result: { message_id: 1 } } as never;
  });

  return { bot, sent };
}

const texts = (sent: Sent[]) =>
  sent.filter((entry) => entry.method === 'sendMessage').map((entry) => String(entry.payload.text));

const temporary = () => join(mkdtempSync(join(tmpdir(), 'leela-unreadable-')), 'leela.db');

/** What is actually in the file, as opposed to what the bot is holding. */
function onDisk(path: string) {
  const queries = new SqliteRoomQueries({ path });
  return {
    async seats() {
      return queries.loadSeats(String(CHAT));
    },
    async session() {
      return queries.loadSession(String(CHAT));
    },
    /** One column, made into something no game reaches. */
    async damage() {
      const rows = await queries.loadSeats(String(CHAT));
      const seat = rows[1] ?? rows[0];
      await queries.save(
        { ...(await queries.loadSession(String(CHAT))!) } as never,
        rows.map((row) => ({
          ...row,
          plan: row.user_id === seat?.user_id ? 900 : row.plan,
        })) as never,
      );
    },
  };
}

async function seatedTable(path: string) {
  const { bot, sent } = assemble(path);
  await bot.handleUpdate(message('/new'));
  await bot.handleUpdate(message('/join', { id: 8, first_name: 'Grace', is_bot: false }));
  await bot.handleUpdate(message('/start'));
  return { bot, sent };
}

describe('the bot over a table it cannot read', () => {
  it('refuses to open a new one over it, and says why', async () => {
    const path = temporary();
    await seatedTable(path);

    const disk = onDisk(path);
    expect(await disk.seats(), 'two players are seated').toHaveLength(2);
    await disk.damage();

    const { bot, sent } = assemble(path);
    await bot.handleUpdate(message('/new'));

    // Told, in the chat, rather than in a log only an operator reads.
    expect(texts(sent).join(' ')).toContain('cannot read');
    // And the seats are still where they were: nothing was replaced.
    expect(await disk.seats()).toHaveLength(2);
    expect((await disk.session())?.host_id).toBe('7');
  });

  it('lets the chat clear it, which is the only way out', async () => {
    const path = temporary();
    await seatedTable(path);
    await onDisk(path).damage();

    const { bot, sent } = assemble(path);
    await bot.handleUpdate(message('/end'));

    expect(texts(sent).join(' ')).toContain('cleared');
    expect(await onDisk(path).session()).toBeNull();
  });

  it('opens a table again once the unreadable one is gone', async () => {
    // The whole point of clearing it: a chat that can neither continue its game
    // nor start another is a chat with nothing left to do.
    const path = temporary();
    await seatedTable(path);
    await onDisk(path).damage();

    const { bot, sent } = assemble(path);
    await bot.handleUpdate(message('/end'));
    await bot.handleUpdate(message('/new'));

    expect(await onDisk(path).seats()).toHaveLength(1);
    expect(texts(sent).join(' ')).not.toContain('cannot read');
  });

  it('still refuses to replace a game it can read', async () => {
    // The guard this restores, doing what it always claimed to: a running table
    // is not replaced, whichever of the two reasons the store had for saying so.
    const path = temporary();
    await seatedTable(path);

    const { bot, sent } = assemble(path);
    await bot.handleUpdate(message('/new'));

    expect(texts(sent).join(' ')).toContain('already');
    expect(await onDisk(path).seats()).toHaveLength(2);
  });

  it('still says there is no table where there is none', async () => {
    // The other half. A chat that has never played is not sent to /end to
    // clear something that is not there.
    const { bot, sent } = assemble(temporary());
    await bot.handleUpdate(message('/end'));

    const said = texts(sent).join(' ');
    expect(said).toContain('No table here');
    expect(said).not.toContain('cleared');
  });
});
