/**
 * Where a player's own writing goes when they ask for it at a table.
 *
 * `/save` hands back a whole journal — every account they have written, about
 * every square they have stood on. It used to hand it to **the chat the command
 * came from**, because `replyWithDocument` answers the chat and nothing else,
 * so at a table of six one player's year of writing was posted for everybody to
 * read and to keep. That was found and fixed.
 *
 * Nothing held the fix. Measured before this was written: replacing the whole
 * `destinationFor` call in the `/save` handler with `{ kind: 'chat' }` — the
 * defect exactly as it was — leaves **all six hundred and seventeen** of this
 * package's tests passing.
 *
 * The reason is the shape this repository keeps meeting: both halves were
 * tested and the crossing was not. `destinationFor` has its own unit tests and
 * `deliver` is held by two — take its routing out and *"sends a private answer
 * directly, not into the group"* goes red. But a document is not a `Reply`, so
 * `/save` is the one route that had to write the decision out again, and the
 * copy was the one nothing asked about.
 *
 * So this asks the property rather than the route: **nothing a player wrote
 * reaches the table.** Every message and every document the bot sends to the
 * group is searched for what the player actually wrote, at the end of a played
 * game, where the record is longest. A fourth branch added inside this handler
 * tomorrow is held by it without being named.
 *
 * The three answers are all asserted, because the first attempt at the fix
 * required `direct` and broke the ordinary one: in a private chat the
 * destination *is* the chat, and refusing to send there sent a player who had
 * asked in a direct message a note telling them to ask in a direct message.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument } from '@leela/journal';
import { createBot } from '../src/bot';
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

const TABLE = -4242;
const ADA = 11;
/** Words that appear nowhere else, so finding them means finding her writing. */
const HERS = 'the salt marsh at low tide, and what I would not look at';

let update = 0;

const from = { id: ADA, first_name: 'Ada', is_bot: false };

const at = (text: string, chat: { id: number; type: 'group'; title: string } | { id: number; type: 'private' }) => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat,
    from,
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }],
  },
});

// `as never` on the way into `handleUpdate`, which is what every other test in
// this package does: grammY's `Update` is a deep union and a fixture that
// satisfies it in full is longer than the test.
const table = (text: string) => at(text, { id: TABLE, type: 'group', title: 'a table' }) as never;
const alone = (text: string) => at(text, { id: ADA, type: 'private' }) as never;

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

/**
 * A bot on a real database, played until Ada has won and written her last
 * account.
 *
 * `blocked` makes every direct message fail the way Telegram fails one to
 * somebody who has not started the bot, which is the third answer.
 */
async function played(blocked = false) {
  const storage = openStorage({
    path: join(mkdtempSync(join(tmpdir(), 'leela-table-')), 'leela.db'),
    log: () => undefined,
  });
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
    const to = (payload as { chat_id?: number | string }).chat_id;
    sent.push({ method, payload: payload as Record<string, unknown> });

    if (blocked && String(to) === String(ADA) && method !== 'sendMessage') {
      throw Object.assign(new Error('Forbidden: bot was blocked by the user'), {
        error_code: 403,
        description: 'Forbidden: bot was blocked by the user',
      });
    }

    return { ok: true, result: { message_id: 1 } } as never;
  });

  const said = (start: number) =>
    sent
      .slice(start)
      .filter((one) => one.method === 'sendMessage')
      .map((one) => String(one.payload.text));

  await bot.handleUpdate(table('/new'));
  await bot.handleUpdate(table('/start'));
  await bot.handleUpdate(table('/intention to see it through to the end'));

  // The bound is the one `the-end-of-a-game.test.ts` measured: twenty games ran
  // from ten throws to two hundred and fifty-seven.
  for (let throws = 0; throws < 20_000; throws += 1) {
    const before = sent.length;
    await bot.handleUpdate(table('/roll'));
    const answer = said(before).join(' ');

    if (answer.includes('Cosmic Consciousness')) break;
    if (/before you move on/i.test(answer)) {
      await bot.handleUpdate(table(`/report ${HERS}, on the ${throws}th square`));
    }
  }

  await bot.handleUpdate(table(`/report ${HERS}, and here at the end of it`));

  return { bot, sent, said, storage };
}

/** Everything the bot put into the group, as one piece of text. */
const intoTheTable = (sent: Sent[], start: number): string =>
  sent
    .slice(start)
    .filter((one) => String(one.payload.chat_id) === String(TABLE))
    .map((one) => JSON.stringify(one.payload))
    .join('\n');

/** The file a `sendDocument` carried, wherever it went. */
function documentIn(sent: Sent[], start: number) {
  const found = sent.slice(start).find((one) => one.method === 'sendDocument');
  if (!found) return null;

  const file = found.payload.document as unknown as { fileData: Buffer };

  return { to: String(found.payload.chat_id), text: file.fileData.toString('utf8') };
}

describe('a whole journal, asked for at a table', () => {
  it('goes to the player and not to the table', async () => {
    const { bot, sent, storage } = await played();

    const start = sent.length;
    await bot.handleUpdate(table('/save'));
    storage.stopPruning?.();

    const document = documentIn(sent, start);

    expect(document, 'a path was handed back at all').not.toBeNull();
    expect(document?.to, 'to Ada, not to the table').toBe(String(ADA));

    // The property, and the reason this file exists: whatever the handler does,
    // her writing is not in the room. Asserted over everything sent to the
    // group rather than over the document alone, so a reply that quoted the
    // path would fail here too.
    expect(intoTheTable(sent, start)).not.toContain(HERS);
  });

  it('carries the game she actually played, so this is her path and not an empty one', async () => {
    // A check that her writing stayed private is worth nothing if there was
    // nothing to keep private.
    const { bot, sent, storage } = await played();

    const start = sent.length;
    await bot.handleUpdate(table('/save'));
    storage.stopPruning?.();

    const back = parseDocument(documentIn(sent, start)?.text ?? '');

    expect(back?.entries.length ?? 0).toBeGreaterThan(1);
    expect(back?.entries.some((entry) => entry.plan === 68), 'the winning square is in it').toBe(true);
    expect(back?.entries.every((entry) => entry.text.includes(HERS))).toBe(true);
    expect(back?.intention, 'and the question she played under').toBe('to see it through to the end');
  });

  it('answers the chat when the chat is where she is alone', async () => {
    // The ordinary case, and the one the first fix broke: requiring `direct`
    // sent a player who had asked in a direct message a note telling them to
    // ask in a direct message.
    const { bot, sent, storage } = await played();

    const start = sent.length;
    await bot.handleUpdate(alone('/save'));
    storage.stopPruning?.();

    expect(documentIn(sent, start)?.to).toBe(String(ADA));
  });

  it('says where to go, without saying what it was, when it cannot reach her', async () => {
    // The third answer. A player who has never opened a chat with the bot
    // cannot be sent anything — and the note that says so is said in the room,
    // so it must not carry what it was about.
    const { bot, sent, said, storage } = await played(true);

    const start = sent.length;
    await bot.handleUpdate(table('/save'));
    storage.stopPruning?.();

    const answer = said(start).join('\n');

    expect(answer.length, 'she is told something').toBeGreaterThan(0);
    expect(intoTheTable(sent, start), 'and it is not her writing').not.toContain(HERS);
  });
});
