/**
 * What is actually inside the file a chat hands a player.
 *
 * `/save` was asserted at the assembled level by counting: *one document was
 * sent*. Nothing read it. So the defect found the pass before — `offer` calling
 * `toDocument` with the entries alone, and the file carrying no `intention`
 * field at all — was invisible here, and was fixed one layer down where a unit
 * test could see it.
 *
 * That is the shape this repository has met before: `sqliteStepSink` wrote a
 * table nothing read, and the durable report sink had `record` and no
 * `history`. Both were found only where the thing is **assembled**, because
 * every unit test holds a store it built itself.
 *
 * So this builds the bot the way `index.ts` does, on a real SQLite file, plays
 * until there is something to write about, writes it, and then opens the
 * document it is handed.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InputFile } from 'grammy';
import { parseDocument } from '@leela/journal';
import { createBot } from '../src/bot';
import { offer } from '../src/take-out';
import { openStorage } from '../src/storage';

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

const CHAT = -500;
let update = 0;

const message = (text: string) => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat: { id: CHAT, type: 'group' as const, title: 'a table' },
    from: { id: 11, first_name: 'Ada', is_bot: false },
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

  return { bot, sent, storage };
}

const texts = (sent: Sent[]) =>
  sent.filter((entry) => entry.method === 'sendMessage').map((entry) => String(entry.payload.text));

/** The bytes of the one document that was sent, as the player receives them. */
function fileSent(sent: Sent[]): { name: string; text: string } | null {
  const documents = sent.filter((entry) => entry.method === 'sendDocument');
  if (documents.length !== 1) return null;

  const file = documents[0]?.payload.document as InputFile;
  const data = (file as unknown as { fileData: Buffer }).fileData;

  return { name: file.filename ?? '', text: data.toString('utf8') };
}

const temporary = () => join(mkdtempSync(join(tmpdir(), 'leela-file-')), 'leela.db');

/** A game played far enough to owe an account, and the account written. */
async function played(path: string, { asking }: { asking: string | null }) {
  const { bot, sent, storage } = assemble(path);

  await bot.handleUpdate(message('/new'));
  await bot.handleUpdate(message('/start'));
  if (asking !== null) await bot.handleUpdate(message(`/intention ${asking}`));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const before = sent.length;
    await bot.handleUpdate(message('/roll'));
    if (texts(sent.slice(before)).join(' ').includes('before you move on')) break;
  }

  await bot.handleUpdate(message('/report the account this file is being written for'));

  const before = sent.length;
  await bot.handleUpdate(message('/save'));
  storage.stopPruning?.();

  return fileSent(sent.slice(before));
}

describe('the file a chat hands a player', () => {
  it('is a path the other two applications can read', async () => {
    // The format's own reader, which is what the mini app and the phone hand an
    // incoming file to. A document only this bot can read is not a bridge.
    const file = await played(temporary(), { asking: 'to see what I keep avoiding' });
    expect(file).not.toBeNull();

    const document = parseDocument(file?.text ?? '');

    expect(document).not.toBeNull();
    expect(document?.entries.map((entry) => entry.text)).toEqual([
      'the account this file is being written for',
    ]);
  });

  it('carries the question the player was playing for', async () => {
    // The defect of the pass before, asserted where it happened: `offer` had
    // the entries and not the intention, and the assembled test counted
    // documents rather than opening one.
    const asking = 'to see what I keep avoiding';
    const file = await played(temporary(), { asking });

    expect(parseDocument(file?.text ?? '')?.intention).toBe(asking);
  });

  it('cannot be written without one, which is why the question always travels', async () => {
    // Measured rather than assumed: this test first built a player who had
    // written an account and never said what for, and no file was sent at all.
    // The bot refuses the throw before the question — *what are you playing
    // for?* — so a path out of a chat has an intention by construction.
    const { bot, sent, storage } = assemble(temporary());

    await bot.handleUpdate(message('/new'));
    await bot.handleUpdate(message('/start'));
    const before = sent.length;
    await bot.handleUpdate(message('/roll'));
    storage.stopPruning?.();

    expect(texts(sent.slice(before)).join(' ')).toContain('/intention');
  });

  it('leaves the field out where there is no question to write', () => {
    // Unreachable through the bot, and asserted because `offer` is not only the
    // bot's: a file saying `intention: ""` would hand the receiving surface
    // something to adopt, and it adopts only where it has none — so a player
    // would be given a blank question and never asked again.
    const stored = [{ plan: 41, text: 'an account', createdAt: new Date(1_700_000_000_000) }];

    for (const asked of [null, '', '   ']) {
      const offered = offer(stored, '2026-08-03', asked);
      expect(offered.kind).toBe('file');
      if (offered.kind !== 'file') continue;

      expect({ asked, has: 'intention' in offered.document }).toEqual({ asked, has: false });
    }
  });

  it('says where it came from, in a folder that may hold three of them', async () => {
    // With a question, because a path out of a chat cannot be written without.
    // Deliberate, and the reason `@leela/journal` does not name this one: a
    // player with a file from the chat, one from the phone and one from the
    // mini app can tell them apart.
    const file = await played(temporary(), { asking: 'what I keep avoiding' });

    expect(file?.name).toMatch(/^leela-path-bot-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('is indented, because a person may well open it', async () => {
    const file = await played(temporary(), { asking: 'what I keep avoiding' });

    expect(file?.text).toContain('\n  ');
  });
});
